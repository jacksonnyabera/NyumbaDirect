"""add cloudinary public id to property photos

Revision ID: add_cloudinary_public_id
Revises: 360d6e57493d
"""

from alembic import op
import sqlalchemy as sa


revision = "add_cloudinary_public_id"
down_revision = "360d6e57493d"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "property_photos",
        sa.Column(
            "cloudinary_public_id",
            sa.String(length=255),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_property_photos_cloudinary_public_id",
        "property_photos",
        ["cloudinary_public_id"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        "ix_property_photos_cloudinary_public_id",
        table_name="property_photos",
    )

    op.drop_column(
        "property_photos",
        "cloudinary_public_id",
    )