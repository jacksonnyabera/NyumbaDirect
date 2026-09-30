"""add marketplace query indexes

Revision ID: a1c9e85f3d7b
Revises: e4f2a1c9b5d0
Create Date: 2026-09-30
"""

from typing import Sequence, Union

from alembic import op


revision: str = "a1c9e85f3d7b"
down_revision: Union[str, Sequence[str], None] = "e4f2a1c9b5d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_conversations_house_hunter_updated",
        "conversations",
        ["house_hunter_id", "updated_at"],
    )
    op.create_index(
        "ix_conversations_landlord_updated",
        "conversations",
        ["landlord_id", "updated_at"],
    )
    op.create_index(
        "ix_messages_conversation_read_sender",
        "messages",
        ["conversation_id", "is_read", "sender_id"],
    )
    op.create_index(
        "ix_properties_available_created",
        "properties",
        ["is_available", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_properties_available_created",
        table_name="properties",
    )
    op.drop_index(
        "ix_messages_conversation_read_sender",
        table_name="messages",
    )
    op.drop_index(
        "ix_conversations_landlord_updated",
        table_name="conversations",
    )
    op.drop_index(
        "ix_conversations_house_hunter_updated",
        table_name="conversations",
    )
