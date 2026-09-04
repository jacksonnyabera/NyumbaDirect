from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LandlordVerificationCreate(BaseModel):
    national_id_number: str = Field(
        min_length=5,
        max_length=50,
    )

    phone_number: str = Field(
        min_length=9,
        max_length=30,
    )

    document_url: str | None = None


class LandlordVerificationResponse(BaseModel):
    id: int
    user_id: int
    phone_number: str
    status: str
    rejection_reason: str | None
    submitted_at: datetime
    reviewed_at: datetime | None

    model_config = ConfigDict(
        from_attributes=True,
    )