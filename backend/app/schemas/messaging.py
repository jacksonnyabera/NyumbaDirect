from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ConversationCreate(BaseModel):
    property_id: int


class ConversationResponse(BaseModel):
    id: int
    property_id: int
    house_hunter_id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class MessageCreate(BaseModel):
    content: str = Field(
        min_length=1,
        max_length=5000,
    )


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    content: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )