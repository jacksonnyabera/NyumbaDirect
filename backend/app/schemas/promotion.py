from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class PromotionCreate(BaseModel):
    property_id: int
    package: str


class PromotionResponse(BaseModel):
    id: int
    property_id: int
    user_id: int
    package: str
    amount: Decimal
    payment_status: str
    payment_reference: str | None
    starts_at: datetime | None
    expires_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)