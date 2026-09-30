import logging
import re
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from secrets import compare_digest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.dependencies import get_current_user
from app.models.property import Property
from app.models.property_promotion import PropertyPromotion
from app.models.user import User
from app.services.mpesa import (
    MpesaInitiationUncertainError,
    initiate_stk_push,
)


router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)

logger = logging.getLogger(__name__)


class STKPushRequest(BaseModel):
    promotion_id: int
    phone_number: str


@router.post("/mpesa/stk-push")
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

@router.post("/mpesa/callback")
def mpesa_callback(
    payload: dict,
    key: str | None = None,
    db: Session = Depends(get_db),
):
    if not settings.mpesa_callback_secret:
        raise HTTPException(
            status_code=503,
            detail="M-Pesa callback authentication is not configured.",
        )
    if not key or not compare_digest(key, settings.mpesa_callback_secret):
        raise HTTPException(
            status_code=401,
            detail="Invalid payment callback credentials.",
        )

    body = payload.get("Body")
    callback = body.get("stkCallback") if isinstance(body, dict) else None
    if not isinstance(callback, dict):
        return {
            "ResultCode": 0,
            "ResultDesc": "Callback received.",
        }

    merchant_request_id = callback.get("MerchantRequestID")
    checkout_request_id = callback.get("CheckoutRequestID")
    result_code = callback.get("ResultCode")
    result_description = callback.get("ResultDesc")

    if not checkout_request_id:
        return {
            "ResultCode": 0,
            "ResultDesc": "Callback received.",
        }

    promotion = db.scalar(
        select(PropertyPromotion)
        .where(PropertyPromotion.checkout_request_id == checkout_request_id)
        .with_for_update()
    )

    if not promotion:
        return {
            "ResultCode": 0,
            "ResultDesc": "Promotion not found.",
        }

    if (
        merchant_request_id
        and promotion.merchant_request_id
        and merchant_request_id != promotion.merchant_request_id
    ):
        logger.warning("M-Pesa callback merchant request ID did not match promotion %s", promotion.id)
        return {
            "ResultCode": 0,
            "ResultDesc": "Callback received.",
        }

    # Prevent duplicate successful callbacks from extending the promotion
    if promotion.payment_status == "PAID":
        return {
            "ResultCode": 0,
            "ResultDesc": "Payment already processed.",
        }

    promotion.merchant_request_id = merchant_request_id
    promotion.result_code = str(result_code)
    promotion.result_description = (
        str(result_description)[:255] if result_description is not None else None
    )

    # Payment successful
    if str(result_code) == "0":
        metadata = callback.get("CallbackMetadata")
        metadata_items = metadata.get("Item", []) if isinstance(metadata, dict) else []
        if not isinstance(metadata_items, list):
            metadata_items = []

        receipt_number = None
        phone_number = promotion.phone_number
        paid_amount = None

        for item in metadata_items:
            if not isinstance(item, dict):
                continue
            name = item.get("Name")
            value = item.get("Value")

            if name == "MpesaReceiptNumber" and value:
                receipt_number = str(value).strip()

            elif name == "PhoneNumber":
                phone_number = str(value)

            elif name == "Amount":
                paid_amount = value

        # Verify the amount matches the promotion
        try:
            exact_paid_amount = Decimal(str(paid_amount))
        except (InvalidOperation, TypeError, ValueError):
            exact_paid_amount = None

        if exact_paid_amount != promotion.amount:
            promotion.payment_status = "FAILED"
            promotion.result_description = (
                "Payment amount does not match promotion amount."
            )

            db.commit()

            return {
                "ResultCode": 0,
                "ResultDesc": "Callback received.",
            }

        if not receipt_number:
            promotion.payment_status = "FAILED"
            promotion.result_description = (
                "M-Pesa receipt number missing."
            )

            db.commit()

            return {
                "ResultCode": 0,
                "ResultDesc": "Callback received.",
            }

        receipt_already_used = db.scalar(
            select(PropertyPromotion.id).where(
                PropertyPromotion.payment_reference == receipt_number,
                PropertyPromotion.id != promotion.id,
            )
        )
        if receipt_already_used:
            promotion.payment_status = "FAILED"
            promotion.result_description = "M-Pesa receipt number was already applied to another boost."
            db.commit()
            return {
                "ResultCode": 0,
                "ResultDesc": "Callback received.",
            }

        promotion.payment_status = "PAID"
        promotion.payment_reference = receipt_number

        if phone_number:
            promotion.phone_number = phone_number

        days = {
            "7_DAYS": 7,
            "14_DAYS": 14,
            "30_DAYS": 30,
        }.get(promotion.package)

        if not days:
            promotion.payment_status = "FAILED"
            promotion.result_description = (
                "Invalid promotion package."
            )

            db.commit()

            return {
                "ResultCode": 0,
                "ResultDesc": "Callback received.",
            }

        # Lock the property row so concurrent paid renewals cannot overwrite
        # one another's expiry and so unused paid time rolls forward.
        property_obj = db.scalar(
            select(Property)
            .where(Property.id == promotion.property_id)
            .with_for_update()
        )
        now = datetime.now(timezone.utc)
        starts_at = now
        if (
            property_obj
            and property_obj.is_featured
            and property_obj.featured_until
        ):
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

    # Payment failed/cancelled
    else:
        promotion.payment_status = "FAILED"

    db.commit()

    return {
        "ResultCode": 0,
        "ResultDesc": "Callback received successfully.",
    }

@router.get("/mpesa/status/{promotion_id}")
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
