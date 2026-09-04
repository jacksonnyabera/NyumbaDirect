from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PropertyPhoto(Base):
    __tablename__ = "property_photos"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    property_id: Mapped[int] = mapped_column(
        ForeignKey(
            "properties.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    image_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    caption: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    property: Mapped["Property"] = relationship(
        back_populates="photos",
    )