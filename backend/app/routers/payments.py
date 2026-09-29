import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from secrets import compare_digest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.dependencies import get_current_user
from app.models.property_promotion import PropertyPromotion
from app.models.user import User
from app.services.mpesa import initiate_stk_push


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
        select(PropertyPromotion).where(
            PropertyPromotion.id == data.promotion_id
        )
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

    phone = data.phone_number.strip()

    if phone.startswith("0"):
        phone = "254" + phone[1:]

    if phone.startswith("+"):
        phone = phone[1:]

    if not phone.startswith("254") or len(phone) != 12:
        raise HTTPException(
            status_code=400,
            detail="Enter a valid Kenyan phone number.",
        )

    try:
        response = initiate_stk_push(
            phone_number=phone,
            amount=int(promotion.amount),
            account_reference=f"NYUMBA-{promotion.id}",
            transaction_description=(
                f"NyumbaDirect {promotion.package} property boost"
            ),
        )

    except Exception as exc:
        # Provider exceptions can contain credentials, request details, or
        # infrastructure information. Keep diagnostics in server logs only.
        logger.warning("M-Pesa STK initiation failed (%s)", type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail="Unable to initiate payment right now. Please try again shortly.",
        ) from exc

    promotion.phone_number = phone

    promotion.merchant_request_id = response.get(
        "MerchantRequestID"
    )

    promotion.checkout_request_id = response.get(
        "CheckoutRequestID"
    )

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
        "checkout_request_id": response.get(
            "CheckoutRequestID"
        ),
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

    callback = payload.get("Body", {}).get("stkCallback", {})

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
        select(PropertyPromotion).where(
            PropertyPromotion.checkout_request_id == checkout_request_id
        )
    )

    if not promotion:
        return {
            "ResultCode": 0,
            "ResultDesc": "Promotion not found.",
        }

    # Prevent duplicate successful callbacks from extending the promotion
    if promotion.payment_status == "PAID":
        return {
            "ResultCode": 0,
            "ResultDesc": "Payment already processed.",
        }

    promotion.merchant_request_id = merchant_request_id
    promotion.result_code = str(result_code)
    promotion.result_description = result_description

    # Payment successful
    if result_code == 0:
        metadata_items = (
            callback
            .get("CallbackMetadata", {})
            .get("Item", [])
        )

        receipt_number = None
        phone_number = promotion.phone_number
        paid_amount = None

        for item in metadata_items:
            name = item.get("Name")
            value = item.get("Value")

            if name == "MpesaReceiptNumber":
                receipt_number = str(value)

            elif name == "PhoneNumber":
                phone_number = str(value)

            elif name == "Amount":
                paid_amount = value

        # Verify the amount matches the promotion
        if paid_amount is None or int(paid_amount) != int(promotion.amount):
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

        promotion.payment_status = "PAID"
        promotion.payment_reference = receipt_number

        if phone_number:
            promotion.phone_number = phone_number

        now = datetime.now(timezone.utc)

        promotion.starts_at = now

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

        promotion.expires_at = now + timedelta(days=days)

        property_obj = promotion.property

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
        "payment_reference": promotion.payment_reference,
        "result_code": promotion.result_code,
        "result_description": promotion.result_description,
        "starts_at": promotion.starts_at,
        "expires_at": promotion.expires_at,
    }
