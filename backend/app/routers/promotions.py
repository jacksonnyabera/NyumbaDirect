from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.property import Property
from app.models.property_promotion import PropertyPromotion
from app.models.user import User
from app.schemas.promotion import PromotionCreate, PromotionResponse


router = APIRouter(
    prefix="/promotions",
    tags=["Promotions"],
)


PACKAGES = {
    "7_DAYS": {
        "amount": Decimal("300.00"),
        "days": 7,
    },
    "14_DAYS": {
        "amount": Decimal("700.00"),
        "days": 14,
    },
    "30_DAYS": {
        "amount": Decimal("1500.00"),
        "days": 30,
    },
}


@router.post(
    "",
    response_model=PromotionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_promotion(
    data: PromotionCreate,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    package = data.package.upper()

    if package not in PACKAGES:
        raise HTTPException(
            status_code=400,
            detail="Invalid promotion package.",
        )

    # Serialize promotion creation for one property so parallel requests do
    # not create multiple outstanding M-Pesa requests for it.
    property_obj = db.scalar(
        select(Property)
        .where(Property.id == data.property_id)
        .with_for_update()
    )

    if not property_obj:
        raise HTTPException(
            status_code=404,
            detail="Property not found.",
        )

    if property_obj.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only promote your own property.",
        )

    pending = db.scalar(
        select(PropertyPromotion)
        .where(
            PropertyPromotion.property_id == property_obj.id,
            PropertyPromotion.user_id == current_user.id,
            PropertyPromotion.payment_status == "PENDING",
        )
        .order_by(PropertyPromotion.created_at.desc())
        .limit(1)
    )
    if pending:
        if pending.package != package:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "A boost payment is already awaiting confirmation for this property. "
                    "Check its status before choosing another package."
                ),
            )
        response.status_code = status.HTTP_200_OK
        return pending

    package_info = PACKAGES[package]

    promotion = PropertyPromotion(
        property_id=property_obj.id,
        user_id=current_user.id,
        package=package,
        amount=package_info["amount"],
        payment_status="PENDING",
    )

    db.add(promotion)
    db.commit()
    db.refresh(promotion)

    return promotion


@router.get(
    "/my",
    response_model=list[PromotionResponse],
)
def get_my_promotions(
    property_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(PropertyPromotion).where(
        PropertyPromotion.user_id == current_user.id
    )
    if property_id is not None:
        query = query.where(PropertyPromotion.property_id == property_id)

    promotions = db.scalars(
        query
        .order_by(PropertyPromotion.created_at.desc())
        .limit(limit)
    ).all()

    return promotions
