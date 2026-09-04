from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.landlord_verification import LandlordVerification
from app.models.user import User
from app.schemas.landlord_verification import (
    LandlordVerificationResponse,
)


router = APIRouter(
    prefix="/admin/verifications",
    tags=["Admin - Verification"],
)


@router.get(
    "/pending",
    response_model=list[LandlordVerificationResponse],
)
def list_pending_verifications(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(LandlordVerification)
        .where(
            LandlordVerification.status == "PENDING"
        )
        .order_by(
            LandlordVerification.submitted_at.asc()
        )
    ).all()


@router.put(
    "/{verification_id}/approve",
    response_model=LandlordVerificationResponse,
)
def approve_verification(
    verification_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    verification = db.scalar(
        select(LandlordVerification).where(
            LandlordVerification.id == verification_id
        )
    )

    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification not found.",
        )

    if verification.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending verifications can be approved.",
        )

    verification.status = "APPROVED"
    verification.reviewed_at = datetime.now(timezone.utc)

    landlord = db.get(User, verification.user_id)

    if landlord:
        landlord.is_verified = True

    db.commit()
    db.refresh(verification)

    return verification


@router.put(
    "/{verification_id}/reject",
    response_model=LandlordVerificationResponse,
)
def reject_verification(
    verification_id: int,
    rejection_reason: str,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    verification = db.scalar(
        select(LandlordVerification).where(
            LandlordVerification.id == verification_id
        )
    )

    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification not found.",
        )

    if verification.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending verifications can be rejected.",
        )

    if not rejection_reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rejection reason is required.",
        )

    verification.status = "REJECTED"
    verification.rejection_reason = rejection_reason.strip()
    verification.reviewed_at = datetime.now(timezone.utc)

    landlord = db.get(User, verification.user_id)

    if landlord:
        landlord.is_verified = False

    db.commit()
    db.refresh(verification)

    return verification