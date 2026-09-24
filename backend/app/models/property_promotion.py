from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PropertyPromotion(Base):
    __tablename__ = "property_promotions"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    property_id: Mapped[int] = mapped_column(
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    package: Mapped[str] = mapped_column(
        String(30),
        nullable=False
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )

    payment_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PENDING",
        index=True
    )

    payment_reference: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        unique=True,
        index=True
    )

    merchant_request_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True
    )

    checkout_request_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True
    )

    phone_number: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    result_code: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True
    )

    result_description: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    starts_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    property = relationship("Property")
    user = relationship("User")