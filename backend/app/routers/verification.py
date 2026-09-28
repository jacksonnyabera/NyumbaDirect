from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User


router = APIRouter(
    prefix="/verification",
    tags=["Verification"],
)


class VerificationSubmit(BaseModel):
    notes: str | None = Field(
        default=None,
        max_length=1000,
    )


class VerificationReview(BaseModel):
    notes: str | None = Field(
        default=None,
        max_length=1000,
    )


class VerificationStatusResponse(BaseModel):
    is_verified: bool
    verification_status: str
    verification_submitted_at: datetime | None
    verification_reviewed_at: datetime | None
    verification_notes: str | None


class VerificationAdminItem(BaseModel):
    id: int
    full_name: str
    email: str
    phone_number: str
    role: str
    is_verified: bool
    verification_status: str
    verification_submitted_at: datetime | None
    verification_reviewed_at: datetime | None
    verification_notes: str | None


def require_admin(current_user: User) -> User:
    role = str(current_user.role).upper()

    if role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required.",
        )

    return current_user


@router.get(
    "/status",
    response_model=VerificationStatusResponse,
)
def get_verification_status(
    current_user: User = Depends(get_current_user),
):
    return VerificationStatusResponse(
        is_verified=current_user.is_verified,
        verification_status=current_user.verification_status,
        verification_submitted_at=current_user.verification_submitted_at,
        verification_reviewed_at=current_user.verification_reviewed_at,
        verification_notes=current_user.verification_notes,
    )


@router.post(
    "/submit",
    response_model=VerificationStatusResponse,
)
def submit_verification(
    data: VerificationSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role = str(current_user.role).upper()

    if role not in {"LANDLORD", "PROPERTY_MANAGER"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only landlords and property managers "
                "can submit verification."
            ),
        )

    if current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account is already verified.",
        )

    if current_user.verification_status == "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your verification request is already under review.",
        )

    current_user.verification_status = "PENDING"
    current_user.verification_submitted_at = datetime.now(
        timezone.utc
    )
    current_user.verification_reviewed_at = None

    current_user.verification_notes = (
        data.notes.strip()
        if data.notes and data.notes.strip()
        else None
    )

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return VerificationStatusResponse(
        is_verified=current_user.is_verified,
        verification_status=current_user.verification_status,
        verification_submitted_at=current_user.verification_submitted_at,
        verification_reviewed_at=current_user.verification_reviewed_at,
        verification_notes=current_user.verification_notes,
    )


@router.get(
    "/admin/pending",
    response_model=list[VerificationAdminItem],
)
def list_pending_verifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    users = db.scalars(
        select(User)
        .where(User.verification_status == "PENDING")
        .order_by(User.verification_submitted_at.asc())
    ).all()

    return [
        VerificationAdminItem(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            phone_number=user.phone_number,
            role=str(user.role),
            is_verified=user.is_verified,
            verification_status=user.verification_status,
            verification_submitted_at=user.verification_submitted_at,
            verification_reviewed_at=user.verification_reviewed_at,
            verification_notes=user.verification_notes,
        )
        for user in users
    ]


@router.patch(
    "/admin/{user_id}/approve",
    response_model=VerificationStatusResponse,
)
def approve_verification(
    user_id: int,
    data: VerificationReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    user = db.scalar(
        select(User).where(User.id == user_id)
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    role = str(user.role).upper()

    if role not in {"LANDLORD", "PROPERTY_MANAGER"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only landlords and property managers "
                "can be verified."
            ),
        )

    if user.verification_status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This user does not have a pending "
                "verification request."
            ),
        )

    user.is_verified = True
    user.verification_status = "APPROVED"
    user.verification_reviewed_at = datetime.now(
        timezone.utc
    )

    if data.notes and data.notes.strip():
        user.verification_notes = data.notes.strip()

    db.add(user)
    db.commit()
    db.refresh(user)

    return VerificationStatusResponse(
        is_verified=user.is_verified,
        verification_status=user.verification_status,
        verification_submitted_at=user.verification_submitted_at,
        verification_reviewed_at=user.verification_reviewed_at,
        verification_notes=user.verification_notes,
    )


@router.patch(
    "/admin/{user_id}/reject",
    response_model=VerificationStatusResponse,
)
def reject_verification(
    user_id: int,
    data: VerificationReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    user = db.scalar(
        select(User).where(User.id == user_id)
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    role = str(user.role).upper()

    if role not in {"LANDLORD", "PROPERTY_MANAGER"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only landlords and property managers "
                "can be verified."
            ),
        )

    if user.verification_status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This user does not have a pending "
                "verification request."
            ),
        )

    user.is_verified = False
    user.verification_status = "REJECTED"
    user.verification_reviewed_at = datetime.now(
        timezone.utc
    )

    if data.notes and data.notes.strip():
        user.verification_notes = data.notes.strip()

    db.add(user)
    db.commit()
    db.refresh(user)

    return VerificationStatusResponse(
        is_verified=user.is_verified,
        verification_status=user.verification_status,
        verification_submitted_at=user.verification_submitted_at,
        verification_reviewed_at=user.verification_reviewed_at,
        verification_notes=user.verification_notes,
    )