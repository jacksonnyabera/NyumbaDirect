from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.property_photo import PropertyPhoto


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    property_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    bedrooms: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    bathrooms: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    monthly_rent: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    deposit: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2),
        nullable=True,
    )

    county: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    town: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    area: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
    )

    address: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    latitude: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 7),
        nullable=True,
    )

    longitude: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 7),
        nullable=True,
    )

    is_available: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
    )

    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    owner: Mapped["User"] = relationship(
        back_populates="properties",
    )

    photos: Mapped[list["PropertyPhoto"]] = relationship(
        back_populates="property",
        cascade="all, delete-orphan",
    )