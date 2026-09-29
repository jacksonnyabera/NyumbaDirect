from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import (
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.security import (
    create_access_token,
    create_email_verification_token,
    create_password_reset_token,
    decode_email_verification_token,
    decode_password_reset_token,
    hash_password,
    verify_password,
)
from app.services.notifications import NotificationService


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=20, max_length=2000)
    password: str = Field(min_length=8, max_length=128)


class RegistrationResponse(UserResponse):
    verification_email_sent: bool


ALLOWED_REGISTRATION_ROLES = {
    "HOUSE_HUNTER",
    "LANDLORD",
    "PROPERTY_MANAGER",
}


@router.post(
    "/register",
    response_model=RegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
):
    email = user_data.email.strip().lower()
    phone_number = user_data.phone_number.strip()
    full_name = user_data.full_name.strip()
    role = user_data.role.strip().upper()

    if not full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name cannot be empty.",
        )

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email cannot be empty.",
        )

    if not phone_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number cannot be empty.",
        )

    if role not in ALLOWED_REGISTRATION_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid registration role.",
        )

    existing_email = db.scalar(
        select(User).where(User.email == email)
    )

    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        )

    existing_phone = db.scalar(
        select(User).where(
            User.phone_number == phone_number
        )
    )

    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Phone number is already registered.",
        )

    user = User(
        full_name=full_name,
        email=email,
        phone_number=phone_number,
        password_hash=hash_password(
            user_data.password
        ),
        role=role,
        is_active=True,
        is_verified=False,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    verification_token = create_email_verification_token(user.email)
    verification_email_sent = NotificationService.send_verification_email(
        to_email=user.email,
        name=user.full_name,
        token=verification_token,
    )

    response = UserResponse.model_validate(user).model_dump()
    response["verification_email_sent"] = verification_email_sent
    return response


@router.get(
    "/verify-email",
    status_code=status.HTTP_200_OK,
)
def verify_email(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    payload = decode_email_verification_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token.",
        )

    email = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token.",
        )

    user = db.scalar(select(User).where(User.email == email))

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    user.is_verified = True
    user.is_active = True
    db.commit()

    return {
        "message": "Email verified successfully.",
        "status": "verified",
    }


@router.post("/forgot-password")
def request_password_reset(
    data: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    email = str(data.email).strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user:
        token = create_password_reset_token(user.email)
        NotificationService.send_password_reset_email(
            to_email=user.email,
            name=user.full_name,
            token=token,
        )
    # The same response for known and unknown emails prevents account discovery.
    return {
        "message": "If an account uses that email address, password reset instructions will be sent.",
    }


@router.post("/reset-password")
def reset_password(
    data: PasswordResetConfirm,
    db: Session = Depends(get_db),
):
    payload = decode_password_reset_token(data.token)
    email = payload.get("sub") if payload else None
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link is invalid or has expired.",
        )

    user = db.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link is invalid or has expired.",
        )
    user.password_hash = hash_password(data.password)
    db.commit()
    return {"message": "Your password has been updated. You can now sign in."}


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login_user(
    login_data: UserLogin,
    db: Session = Depends(get_db),
):
    email = login_data.email.strip().lower()

    user = db.scalar(
        select(User).where(User.email == email)
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    if not verify_password(
        login_data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive.",
        )

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "role": user.role,
        }
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return current_user
