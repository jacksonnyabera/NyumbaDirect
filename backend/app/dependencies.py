from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.security import decode_access_token


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
)


def authentication_error(detail: str):
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={
            "WWW-Authenticate": "Bearer",
        },
    )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(token)

    if not payload:
        raise authentication_error(
            "Invalid or expired authentication token."
        )

    user_id = payload.get("sub")

    if user_id is None:
        raise authentication_error(
            "Invalid authentication token."
        )

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise authentication_error(
            "Invalid authentication token."
        )

    if user_id <= 0:
        raise authentication_error(
            "Invalid authentication token."
        )

    user = db.scalar(
        select(User).where(User.id == user_id)
    )

    if not user:
        raise authentication_error(
            "User no longer exists."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive.",
        )

    return user


def require_role(*allowed_roles: str) -> Callable:
    normalized_roles = {
        role.upper().strip()
        for role in allowed_roles
    }

    def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        current_role = (
            current_user.role.upper().strip()
            if current_user.role
            else ""
        )

        if current_role not in normalized_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )

        return current_user

    return role_checker


require_house_hunter = require_role(
    "HOUSE_HUNTER"
)

require_landlord = require_role(
    "LANDLORD"
)

require_property_manager = require_role(
    "PROPERTY_MANAGER"
)

require_landlord_or_manager = require_role(
    "LANDLORD",
    "PROPERTY_MANAGER",
)

require_admin = require_role(
    "ADMIN"
)