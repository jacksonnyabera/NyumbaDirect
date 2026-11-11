"""add users.token_version for session revocation

Revision ID: f1a7c3d9e2b4
Revises: c7e6d4b9a302
Create Date: 2026-11-11

Non-destructive: adds one NOT NULL integer column with a constant server
default (metadata-only change on PostgreSQL 11+, no table rewrite).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a7c3d9e2b4"
down_revision: Union[str, Sequence[str], None] = "c7e6d4b9a302"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
