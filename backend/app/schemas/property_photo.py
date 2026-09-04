from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PropertyPhotoCreate(BaseModel):
    image_url: str = Field(
        min_length=1,
        max_length=500,
    )

    caption: str | None = Field(
        default=None,
        max_length=255,
    )

    is_primary: bool = False

    display_order: int = Field(
        default=0,
        ge=0,
    )


class PropertyPhotoResponse(BaseModel):
    id: int
    property_id: int
    image_url: str
    caption: str | None
    is_primary: bool
    display_order: int
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )