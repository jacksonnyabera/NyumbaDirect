from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field
from app.schemas.property_photo import PropertyPhotoResponse


class PropertyCreate(BaseModel):
    title: str = Field(
        min_length=5,
        max_length=200,
    )

    description: str = Field(
        min_length=20,
        max_length=5000,
    )

    property_type: str = Field(
        min_length=2,
        max_length=50,
    )

    bedrooms: int = Field(
        ge=0,
        le=50,
    )

    bathrooms: int = Field(
        ge=0,
        le=50,
    )

    monthly_rent: Decimal = Field(
        gt=0,
        max_digits=12,
        decimal_places=2,
    )

    deposit: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=12,
        decimal_places=2,
    )

    county: str = Field(
        min_length=2,
        max_length=100,
    )

    town: str = Field(
        min_length=2,
        max_length=100,
    )

    area: str = Field(
        min_length=2,
        max_length=150,
    )

    address: str | None = Field(
        default=None,
        max_length=255,
    )

    latitude: Decimal | None = Field(
        default=None,
        ge=-90,
        le=90,
        decimal_places=7,
    )

    longitude: Decimal | None = Field(
        default=None,
        ge=-180,
        le=180,
        decimal_places=7,
    )

    is_available: bool = True

class PropertyOwnerResponse(BaseModel):
    id: int
    full_name: str
    role: str
    is_verified: bool

    model_config = ConfigDict(
        from_attributes=True,
    )


class PropertyResponse(BaseModel):
    id: int
    owner_id: int
    owner: PropertyOwnerResponse

    title: str
    description: str
    property_type: str

    bedrooms: int
    bathrooms: int

    monthly_rent: Decimal
    deposit: Decimal | None

    county: str
    town: str
    area: str
    address: str | None

    latitude: Decimal | None
    longitude: Decimal | None

    is_available: bool
    is_verified: bool

    created_at: datetime
    updated_at: datetime

    photos: list[PropertyPhotoResponse] = Field(
        default_factory=list
    )

    model_config = ConfigDict(
        from_attributes=True,
    )



class PropertyUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=5,
        max_length=200,
    )

    description: str | None = Field(
        default=None,
        min_length=20,
        max_length=5000,
    )

    property_type: str | None = Field(
        default=None,
        min_length=2,
        max_length=50,
    )

    bedrooms: int | None = Field(
        default=None,
        ge=0,
        le=50,
    )

    bathrooms: int | None = Field(
        default=None,
        ge=0,
        le=50,
    )

    monthly_rent: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=12,
        decimal_places=2,
    )

    deposit: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=12,
        decimal_places=2,
    )

    county: str | None = Field(
        default=None,
        min_length=2,
        max_length=100,
    )

    town: str | None = Field(
        default=None,
        min_length=2,
        max_length=100,
    )

    area: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    address: str | None = Field(
        default=None,
        max_length=255,
    )

    latitude: Decimal | None = Field(
        default=None,
        ge=-90,
        le=90,
        decimal_places=7,
    )

    longitude: Decimal | None = Field(
        default=None,
        ge=-180,
        le=180,
        decimal_places=7,
    )

    is_available: bool | None = None


class PropertyListResponse(BaseModel):
    items: list[PropertyResponse]
    total: int
    skip: int
    limit: int

