from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReviewCreate(BaseModel):
    rating: int = Field(
        ge=1,
        le=5,
    )

    comment: str = Field(
        min_length=3,
        max_length=2000,
    )


class ReviewResponse(BaseModel):
    id: int
    user_id: int
    property_id: int
    rating: int
    comment: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )