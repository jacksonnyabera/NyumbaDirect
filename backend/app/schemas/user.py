from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)

    email: EmailStr

    phone_number: str = Field(
        min_length=9,
        max_length=30,
    )

    password: str = Field(
        min_length=8,
        max_length=128,
    )

    role: str = "HOUSE_HUNTER"


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    phone_number: str
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )

class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=8,
        max_length=128,
    )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"