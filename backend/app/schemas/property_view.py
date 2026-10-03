from uuid import UUID

from pydantic import BaseModel


class PropertyViewCreate(BaseModel):
    visitor_id: UUID


class PropertyViewResponse(BaseModel):
    recorded: bool


class PropertyEngagementResponse(BaseModel):
    property_id: int
    unique_views: int
    saves: int