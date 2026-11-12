import logging
import re
from decimal import Decimal, InvalidOperation

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from datetime import datetime, timedelta, timezone
from secrets import compare_digest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.rate_limit import check_rate_limit, get_client_ip, rate_limit
from app.config import settings
from app.dependencies import get_current_user
from app.models.property import Property
from app.models.property_promotion import PropertyPromotion
from app.models.user import User
from app.services.mpesa import (
    MpesaInitiationUncertainError,
    MpesaQueryUnavailableError,
    initiate_stk_push,
    query_stk_status,
)


router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)

logger = logging.getLogger(__name__)


class STKPushRequest(BaseModel):
    promotion_id: int
    phone_number: str


@router.post(
    "/mpesa/stk-push",
    dependencies=[Depends(rate_limit("stk-push", 5, 3600, per_user=True))],
)
def mpesa_stk_push(
    data: STKPushRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    promotion = db.scalar(
        select(PropertyPromotion)
        .where(PropertyPromotion.id == data.promotion_id)
        .with_for_update()
    )

    if not promotion:
        raise HTTPException(
            status_code=404,
            detail="Promotion not found.",
        )

    if promotion.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only pay for your own promotion.",
        )

    if promotion.payment_status == "PAID":
        raise HTTPException(
            status_code=400,
            detail="This promotion has already been paid for.",
        )

    if promotion.payment_status == "PENDING" and (
        promotion.checkout_request_id or promotion.phone_number
    ):
        raise HTTPException(
            status_code=409,
            detail="An M-Pesa request has already been sent or may still be processing. Check its status before trying again.",
        )

    phone = re.sub(r"[\s()-]", "", data.phone_number)

    if phone.startswith("0"):
        phone = "254" + phone[1:]

    if phone.startswith("+"):
        phone = phone[1:]

    if not re.fullmatch(r"254[17]\d{8}", phone):
        raise HTTPException(
            status_code=400,
            detail="Enter a valid Kenyan phone number.",
        )

    # Save an initiation reservation before contacting Safaricom. This releases
    # the row lock while the network request runs and blocks parallel prompts.
    promotion.phone_number = phone
    promotion.payment_status = "PENDING"
    promotion.result_description = "M-Pesa request is being initiated."
    db.commit()

    try:
        response = initiate_stk_push(
            phone_number=phone,
            amount=int(promotion.amount),
            account_reference=f"NYUMBA-{promotion.id}",
            transaction_description=(
                f"NyumbaDirect {promotion.package} property boost"
            ),
        )

    except MpesaInitiationUncertainError as exc:
        logger.warning(
            "M-Pesa STK outcome is uncertain for promotion %s",
            promotion.id,
        )
        promotion.result_description = (
            "We could not confirm whether M-Pesa received this request. "
            "Check your phone and contact support before trying another payment."
        )
        db.commit()
        return {
            "message": promotion.result_description,
            "checkout_request_id": None,
            "promotion_id": promotion.id,
            "payment_status": promotion.payment_status,
            "requires_support": True,
        }
    except Exception as exc:
        # Provider exceptions can contain credentials, request details, or
        # infrastructure information. Keep diagnostics in server logs only.
        logger.warning("M-Pesa STK initiation failed (%s)", type(exc).__name__)
        promotion.payment_status = "FAILED"
        promotion.result_description = "M-Pesa could not start the payment. Please try again."
        db.commit()
        raise HTTPException(
            status_code=502,
            detail="Unable to initiate payment right now. Please try again shortly.",
        ) from exc

    checkout_request_id = response.get("CheckoutRequestID")
    response_code = str(response.get("ResponseCode", ""))
    if not response_code or not checkout_request_id:
        if response_code in {"", "0"}:
            promotion.checkout_request_id = checkout_request_id
            promotion.merchant_request_id = response.get("MerchantRequestID")
            promotion.result_description = (
                "M-Pesa may have received this request but returned an incomplete response. "
                "Check your phone and contact support before trying another payment."
            )
            db.commit()
            return {
                "message": promotion.result_description,
                "checkout_request_id": checkout_request_id,
                "promotion_id": promotion.id,
                "payment_status": promotion.payment_status,
                "requires_support": not bool(checkout_request_id),
            }

    if response_code != "0":

        logger.warning("M-Pesa did not accept STK request (code=%s)", response_code or "missing")
        promotion.payment_status = "FAILED"
        promotion.result_description = "M-Pesa did not accept the payment request. Please check the number and try again."
        db.commit()
        raise HTTPException(
            status_code=502,
            detail="M-Pesa could not start the payment. Check the number and try again.",
        )

    promotion.phone_number = phone

    promotion.merchant_request_id = response.get(
        "MerchantRequestID"
    )

    promotion.checkout_request_id = checkout_request_id

    promotion.payment_status = "PENDING"

    db.commit()
    db.refresh(promotion)

    return {
        "message": response.get(
            "CustomerMessage",
            "STK push sent. Check your phone.",
        ),
        "merchant_request_id": response.get(
            "MerchantRequestID"
        ),
        "checkout_request_id": checkout_request_id,
        "response_code": response.get(
            "ResponseCode"
        ),
        "promotion_id": promotion.id,
        "payment_status": promotion.payment_status,
    }

# ---------------------------------------------------------------------------
# M-Pesa callback
#
# Daraja does not sign callbacks, so a callback is only a *claim*. Defences:
#   1. shared secret (constant-time) + optional source-IP allowlist, with a
#      limit on failed attempts;
#   2. strict payload schema;
#   3. checkout/merchant request ID, amount and receipt checks;
#   4. one-way state machine (PENDING -> PAID | FAILED, both terminal);
#   5. independent confirmation with Safaricom's STK Push Query before a boost
#      is activated (MPESA_VERIFY_CALLBACKS, on by default).
# The callback body is never logged. Safaricom reports amounts in KES only and
# the STK callback carries no currency or shortcode field to validate.
# ---------------------------------------------------------------------------

ACK = {"ResultCode": 0, "ResultDesc": "Callback received."}
RECEIPT_PATTERN = re.compile(r"[A-Za-z0-9]{6,20}")
CHECKOUT_ID_PATTERN = re.compile(r"[A-Za-z0-9_\-]{1,100}")
PACKAGE_DAYS = {"7_DAYS": 7, "14_DAYS": 14, "30_DAYS": 30}


class _CallbackItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    Name: str = Field(max_length=100)
    Value: Any = None


class _CallbackMetadata(BaseModel):
    model_config = ConfigDict(extra="ignore")
    Item: list[_CallbackItem] = Field(default_factory=list, max_length=30)


class _StkCallback(BaseModel):
    model_config = ConfigDict(extra="ignore")
    MerchantRequestID: str | None = Field(default=None, max_length=100)
    CheckoutRequestID: str = Field(min_length=1, max_length=100)
    ResultCode: int
    ResultDesc: str | None = Field(default=None, max_length=1000)
    CallbackMetadata: _CallbackMetadata | None = None


class _CallbackBody(BaseModel):
    model_config = ConfigDict(extra="ignore")
    stkCallback: _StkCallback


class _CallbackPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    Body: _CallbackBody


def require_callback_auth(request: Request, key: str | None = None) -> None:
    secret = settings.mpesa_callback_secret
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="M-Pesa callback authentication is not configured.",
        )

    allowed_ips = [
        ip.strip()
        for ip in settings.mpesa_callback_allowed_ips.split(",")
        if ip.strip()
    ]
    if allowed_ips and get_client_ip(request) not in allowed_ips:
        check_rate_limit(request, None, "mpesa-callback-auth-fail", 20, 600)
        logger.warning("M-Pesa callback from a source IP that is not allowed")
        raise HTTPException(status_code=403, detail="Callback source not allowed.")

    candidate = key or request.headers.get("x-callback-key")
    if not candidate or not compare_digest(
        candidate.encode("utf-8"), secret.encode("utf-8")
    ):
        # Slow down anyone guessing the secret.
        check_rate_limit(request, None, "mpesa-callback-auth-fail", 20, 600)
        raise HTTPException(
            status_code=401,
            detail="Invalid payment callback credentials.",
        )


def _anomaly(promotion: PropertyPromotion, reason: str) -> None:
    # Visible to log-based alerting; contains ids only, no payment details.
    logger.error("payment_anomaly promotion=%s reason=%s", promotion.id, reason)


def _fail(promotion: PropertyPromotion, description: str, result_code: str | None = None) -> None:
    if promotion.payment_status != "PENDING":
        return
    promotion.payment_status = "FAILED"
    promotion.result_description = description[:255]
    if result_code is not None:
        promotion.result_code = result_code[:30]


def _activate(
    db: Session,
    promotion: PropertyPromotion,
    receipt_number: str | None,
    description: str,
) -> None:
    """Mark a PENDING promotion PAID and extend the boost. Caller holds the row lock."""
    if promotion.payment_status != "PENDING":
        return

    days = PACKAGE_DAYS.get(promotion.package)
    if not days:
        _anomaly(promotion, "invalid_package")
        _fail(promotion, "Invalid promotion package.")
        return

    promotion.payment_status = "PAID"
    promotion.result_code = "0"
    promotion.result_description = description[:255]
    if receipt_number:
        promotion.payment_reference = receipt_number

    # Lock the property row so concurrent paid renewals cannot overwrite one
    # another's expiry and so unused paid time rolls forward.
    property_obj = db.scalar(
        select(Property)
        .where(Property.id == promotion.property_id)
        .with_for_update()
    )
    starts_at = datetime.now(timezone.utc)
    if property_obj and property_obj.is_featured and property_obj.featured_until:
        current_expiry = property_obj.featured_until
        if current_expiry.tzinfo is None:
            current_expiry = current_expiry.replace(tzinfo=timezone.utc)
        if current_expiry > starts_at:
            starts_at = current_expiry

    promotion.starts_at = starts_at
    promotion.expires_at = starts_at + timedelta(days=days)

    if property_obj:
        property_obj.is_featured = True
        property_obj.featured_until = promotion.expires_at


def _verify_with_safaricom(promotion: PropertyPromotion) -> str:
    """Return "confirmed", "rejected" or "unavailable"."""
    try:
        result = query_stk_status(promotion.checkout_request_id)
    except MpesaQueryUnavailableError as exc:
        logger.warning(
            "Could not confirm promotion %s with Safaricom (%s)", promotion.id, exc
        )
        return "unavailable"
    except Exception as exc:  # never let a provider error break the endpoint
        logger.warning(
            "Safaricom query failed for promotion %s (%s)", promotion.id, type(exc).__name__
        )
        return "unavailable"

    if str(result.get("ResultCode")) == "0":
        merchant = result.get("MerchantRequestID")
        if (
            merchant
            and promotion.merchant_request_id
            and str(merchant) != promotion.merchant_request_id
        ):
            _anomaly(promotion, "query_merchant_mismatch")
            return "unavailable"
        return "confirmed"
    return "rejected"


def _parse_amount(value: Any) -> Decimal | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
    return amount if amount.is_finite() else None


@router.post(
    "/mpesa/callback",
    dependencies=[Depends(require_callback_auth)],
)
def mpesa_callback(
    payload: dict,
    db: Session = Depends(get_db),
):
    try:
        parsed = _CallbackPayload.model_validate(payload)
    except ValidationError:
        logger.warning("Rejected malformed M-Pesa callback")
        return JSONResponse(
            status_code=400,
            content={"ResultCode": 1, "ResultDesc": "Invalid callback payload."},
        )

    callback = parsed.Body.stkCallback
    if not CHECKOUT_ID_PATTERN.fullmatch(callback.CheckoutRequestID):
        logger.warning("Rejected M-Pesa callback with an invalid checkout id")
        return JSONResponse(
            status_code=400,
            content={"ResultCode": 1, "ResultDesc": "Invalid callback payload."},
        )

    promotion = db.scalar(
        select(PropertyPromotion)
        .where(PropertyPromotion.checkout_request_id == callback.CheckoutRequestID)
        .with_for_update()
    )
    if not promotion:
        # Same answer as for a valid callback, so ids cannot be probed.
        return ACK

    if promotion.merchant_request_id and callback.MerchantRequestID != promotion.merchant_request_id:
        _anomaly(promotion, "merchant_request_mismatch")
        return ACK
    if not promotion.merchant_request_id and callback.MerchantRequestID:
        promotion.merchant_request_id = callback.MerchantRequestID

    metadata_items = callback.CallbackMetadata.Item if callback.CallbackMetadata else []
    values = {item.Name: item.Value for item in metadata_items}

    # Terminal states never change. A late or repeated callback is acknowledged
    # so Safaricom stops retrying, but it cannot alter a settled payment.
    if promotion.payment_status == "PAID":
        receipt = str(values.get("MpesaReceiptNumber") or "").strip()
        if (
            callback.ResultCode == 0
            and promotion.payment_reference is None
            and RECEIPT_PATTERN.fullmatch(receipt)
            and _parse_amount(values.get("Amount")) == promotion.amount
            and not db.scalar(
                select(PropertyPromotion.id).where(
                    PropertyPromotion.payment_reference == receipt
                )
            )
        ):
            # Boost was activated from a Safaricom query; record the receipt.
            promotion.payment_reference = receipt
            db.commit()
        return {"ResultCode": 0, "ResultDesc": "Payment already processed."}

    if promotion.payment_status != "PENDING":
        logger.warning(
            "Ignored M-Pesa callback for settled promotion %s (%s)",
            promotion.id,
            promotion.payment_status,
        )
        return ACK

    result_description = (callback.ResultDesc or "")[:255] or None

    if callback.ResultCode != 0:
        promotion.result_code = str(callback.ResultCode)
        promotion.result_description = result_description
        promotion.payment_status = "FAILED"
        db.commit()
        return {"ResultCode": 0, "ResultDesc": "Callback received successfully."}

    # --- success claim: validate everything before trusting it ------------
    paid_amount = _parse_amount(values.get("Amount"))
    if paid_amount != promotion.amount:
        _anomaly(promotion, "amount_mismatch")
        _fail(promotion, "Payment amount does not match promotion amount.", "0")
        db.commit()
        return ACK

    receipt_number = str(values.get("MpesaReceiptNumber") or "").strip()
    if not RECEIPT_PATTERN.fullmatch(receipt_number):
        _anomaly(promotion, "receipt_missing_or_invalid")
        _fail(promotion, "M-Pesa receipt number missing or invalid.", "0")
        db.commit()
        return ACK

    if db.scalar(
        select(PropertyPromotion.id).where(
            PropertyPromotion.payment_reference == receipt_number,
            PropertyPromotion.id != promotion.id,
        )
    ):
        _anomaly(promotion, "receipt_reused")
        _fail(promotion, "M-Pesa receipt number was already applied to another boost.", "0")
        db.commit()
        return ACK

    promotion.payment_reference = receipt_number
    promotion.result_code = "0"

    if not settings.mpesa_verify_callbacks:
        # Sandbox/local only. Documented as unsafe for production.
        _activate(db, promotion, receipt_number, result_description or "Payment received.")
        db.commit()
        return {"ResultCode": 0, "ResultDesc": "Callback received successfully."}

    verdict = _verify_with_safaricom(promotion)
    if verdict == "confirmed":
        _activate(db, promotion, receipt_number, "Payment confirmed with M-Pesa.")
    elif verdict == "rejected":
        _anomaly(promotion, "callback_contradicts_query")
        _fail(promotion, "M-Pesa did not confirm this payment.")
    else:
        # Cannot confirm right now. Stay PENDING (neither paid nor failed); the
        # status endpoint re-checks with Safaricom and finishes the job.
        promotion.result_description = "Payment received. Confirming with M-Pesa."
    db.commit()
    return {"ResultCode": 0, "ResultDesc": "Callback received successfully."}


def reconcile_pending_promotion(db: Session, promotion_id: int) -> None:
    """Settle a PENDING promotion by asking Safaricom directly.

    Recovers payments whose callback was lost or could not be verified at the
    time. Safe to call repeatedly: it takes the row lock, only acts on PENDING,
    and is limited to one Safaricom query per promotion every 20 seconds.
    """
    if not settings.mpesa_verify_callbacks:
        return

    promotion = db.scalar(
        select(PropertyPromotion)
        .where(PropertyPromotion.id == promotion_id)
        .with_for_update()
    )
    if (
        not promotion
        or promotion.payment_status != "PENDING"
        or not promotion.checkout_request_id
    ):
        db.rollback()
        return

    try:
        check_rate_limit(None, None, "mpesa-reconcile", 1, 20, subject=f"p{promotion.id}")
    except HTTPException:
        db.rollback()
        return

    verdict = _verify_with_safaricom(promotion)
    if verdict == "confirmed":
        # Amount is the one this server put in the STK request, and the
        # customer cannot change it. The receipt may still be pending.
        _activate(
            db,
            promotion,
            promotion.payment_reference,
            "Payment confirmed with M-Pesa.",
        )
    elif verdict == "rejected":
        _fail(promotion, "M-Pesa reported that this payment was not completed.")
    db.commit()


@router.get(
    "/mpesa/status/{promotion_id}",
    dependencies=[Depends(rate_limit("stk-status", 60, 300, per_user=True))],
)
def mpesa_payment_status(
    promotion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    promotion = db.scalar(
        select(PropertyPromotion).where(
            PropertyPromotion.id == promotion_id
        )
    )

    if not promotion:
        raise HTTPException(
            status_code=404,
            detail="Promotion not found."
        )

    if promotion.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only view your own payment."
        )

    if promotion.payment_status == "PENDING" and promotion.checkout_request_id:
        reconcile_pending_promotion(db, promotion.id)
        db.refresh(promotion)

    return {
        "promotion_id": promotion.id,
        "payment_status": promotion.payment_status,
        "checkout_request_id": promotion.checkout_request_id,
        "requires_support": (
            promotion.payment_status == "PENDING"
            and bool(promotion.phone_number)
            and not promotion.checkout_request_id
        ),
        "payment_reference": promotion.payment_reference,
        "result_code": promotion.result_code,
        "result_description": promotion.result_description,
        "starts_at": promotion.starts_at,
        "expires_at": promotion.expires_at,
    }
