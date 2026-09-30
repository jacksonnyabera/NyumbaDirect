from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.account_verification import AccountVerification
from app.config import settings
from app.schemas.user import (
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.security import (
    create_access_token,
    create_password_reset_token,
    decode_email_verification_token,
    decode_password_reset_token,
    hash_password,
    verify_password,
)
from app.services.notifications import NotificationService
from app.services.account_verification import (
    check_code, generate_code, hash_code, normalize_kenyan_phone,
)


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
    verification_method: str
    verification_sent: bool


class VerificationRequest(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class ResendVerificationRequest(BaseModel):
    email: EmailStr
    method: str = Field(pattern=r"^(EMAIL|SMS)$")


def _deliver_verification(user: User, method: str, code: str) -> bool:
    if method == "SMS":
        return NotificationService.send_verification_code_sms(user.phone_number, code)
    return NotificationService.send_verification_code_email(user.email, user.full_name, code)


def _new_challenge(user: User, method: str, db: Session) -> tuple[AccountVerification, str]:
    code = generate_code()
    now = datetime.now(timezone.utc)
    challenge = db.scalar(
        select(AccountVerification).where(AccountVerification.user_id == user.id)
    )
    if challenge is None:
        challenge = AccountVerification(user_id=user.id)
        db.add(challenge)
    challenge.method = method
    challenge.code_hash = hash_code(code)
    challenge.expires_at = now + timedelta(minutes=settings.verification_code_ttl_minutes)
    challenge.attempts = 0
    challenge.last_sent_at = now
    challenge.consumed_at = None
    return challenge, code


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
    verification_method: str = Query("EMAIL", pattern="^(EMAIL|SMS)$"),
    db: Session = Depends(get_db),
):
    email = user_data.email.strip().lower()
    try:
        phone_number = normalize_kenyan_phone(user_data.phone_number)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
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

    _, code = _new_challenge(user, verification_method, db)
    db.commit()
    verification_sent = _deliver_verification(user, verification_method, code)

    response = UserResponse.model_validate(user).model_dump()
    response["verification_method"] = verification_method
    response["verification_sent"] = verification_sent
    return response


@router.post("/verify-signup")
def verify_signup(data: VerificationRequest, db: Session = Depends(get_db)):
    email = str(data.email).strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    challenge = db.scalar(
        select(AccountVerification).where(AccountVerification.user_id == user.id)
    ) if user else None
    invalid = HTTPException(status_code=400, detail="The code is invalid or expired. Request a new code and try again.")
    if not user or not challenge or challenge.consumed_at or user.is_verified:
        raise invalid
    now = datetime.now(timezone.utc)
    expires_at = challenge.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now or challenge.attempts >= settings.verification_code_max_attempts:
        raise invalid
    if not check_code(data.code, challenge.code_hash):
        challenge.attempts += 1
        db.commit()
        raise invalid
    challenge.consumed_at = now
    user.is_verified = True
    db.commit()
    return {"status": "verified", "message": "Your account is verified. You can now sign in."}


@router.post("/resend-verification", status_code=status.HTTP_202_ACCEPTED)
def resend_verification(data: ResendVerificationRequest, db: Session = Depends(get_db)):
    email = str(data.email).strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user and not user.is_verified and user.is_active:
        existing = db.scalar(
            select(AccountVerification).where(AccountVerification.user_id == user.id)
        )
        now = datetime.now(timezone.utc)
        last_sent = existing.last_sent_at if existing else None
        if last_sent and last_sent.tzinfo is None:
            last_sent = last_sent.replace(tzinfo=timezone.utc)
        if not last_sent or (now - last_sent).total_seconds() >= settings.verification_resend_cooldown_seconds:
            _, code = _new_challenge(user, data.method, db)
            db.commit()
            _deliver_verification(user, data.method, code)
    return {"message": "If this account is awaiting verification, a code has been sent when the requested channel is available."}


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

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ACCOUNT_NOT_VERIFIED",
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
