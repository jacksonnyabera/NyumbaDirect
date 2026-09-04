from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.landlord_verification import LandlordVerification
from app.models.user import User
from app.schemas.landlord_verification import (
    LandlordVerificationCreate,
    LandlordVerificationResponse,
)


router = APIRouter(
    prefix="/landlord-verification",
    tags=["Landlord Verification"],
)


@router.post(
    "",
    response_model=LandlordVerificationResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_verification(
    verification_data: LandlordVerificationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in {
        "LANDLORD",
        "PROPERTY_MANAGER",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only landlords and property managers "
                "can submit verification."
            ),
        )

    existing = db.scalar(
        select(LandlordVerification).where(
            LandlordVerification.user_id == current_user.id
        )
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Verification already submitted.",
        )

    verification = LandlordVerification(
        user_id=current_user.id,
        national_id_number=verification_data.national_id_number,
        phone_number=verification_data.phone_number,
        document_url=verification_data.document_url,
        status="PENDING",
    )

    db.add(verification)
    db.commit()
    db.refresh(verification)

    return verification


@router.get(
    "/me",
    response_model=LandlordVerificationResponse,
)
def get_my_verification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verification = db.scalar(
        select(LandlordVerification).where(
            LandlordVerification.user_id == current_user.id
        )
    )

    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification not found.",
        )

    return verification