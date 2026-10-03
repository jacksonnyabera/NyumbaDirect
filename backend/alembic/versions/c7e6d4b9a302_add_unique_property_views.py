"""Add unique property view tracking.

Revision ID: c7e6d4b9a302
Revises: a1c9e85f3d7b
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c7e6d4b9a302"
down_revision: Union[str, Sequence[str], None] = "a1c9e85f3d7b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "property_views",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("property_id", sa.Integer(), nullable=False),
        sa.Column("viewer_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "viewed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["property_id"],
            ["properties.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "property_id",
            "viewer_hash",
            name="uq_property_viewer",
        ),
    )
    op.create_index(
        op.f("ix_property_views_id"),
        "property_views",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_property_views_property_id"),
        "property_views",
        ["property_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_property_views_property_id"),
        table_name="property_views",
    )
    op.drop_index(
        op.f("ix_property_views_id"),
        table_name="property_views",
    )
    op.drop_table("property_views")