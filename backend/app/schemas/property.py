from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator
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

    @model_validator(mode="after")
    def validate_bedroom_count(self):
        is_studio_or_bedsitter = any(
            kind in self.property_type.casefold()
            for kind in ("studio", "bedsitter", "bachelor")
        )
        if self.bedrooms == 0 and not is_studio_or_bedsitter:
            raise ValueError(
                "Enter at least one bedroom, or choose Studio/Bedsitter for a zero-bedroom home."
            )
        return self

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

    is_featured: bool
    featured_until: datetime | None



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

    @model_validator(mode="before")
    @classmethod
    def reject_null_required_fields(cls, values):
        if not isinstance(values, dict):
            return values

        required_fields = {
            "title",
            "description",
            "property_type",
            "bedrooms",
            "bathrooms",
            "monthly_rent",
            "county",
            "town",
            "area",
            "is_available",
        }
        null_fields = sorted(
            field
            for field in required_fields
            if field in values and values[field] is None
        )
        if null_fields:
            raise ValueError(
                f"These listing fields cannot be cleared: {', '.join(null_fields)}."
            )
        return values


class PropertyListResponse(BaseModel):
    items: list[PropertyResponse]
    total: int
    skip: int
    limit: int

