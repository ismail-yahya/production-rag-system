"""add_chat_and_tenant_config

Revision ID: 9f8e7d6c5b4a
Revises: a3f8e2b1d9c7
Create Date: 2026-07-09 17:46:00.000000

Adds tables for chat threads, chat messages, and tenant configurations:
  - chat_threads
  - chat_messages
  - tenant_configs
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "9f8e7d6c5b4a"
down_revision: str | Sequence[str] | None = "a3f8e2b1d9c7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # chat_threads — conversation sessions
    # ------------------------------------------------------------------
    op.create_table(
        "chat_threads",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_threads_tenant_id", "chat_threads", ["tenant_id"])
    op.create_index("ix_chat_threads_user_id", "chat_threads", ["user_id"])
    op.create_index("ix_chat_threads_workspace_id", "chat_threads", ["workspace_id"])

    # ------------------------------------------------------------------
    # chat_messages — individual messages inside a thread
    # ------------------------------------------------------------------
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("thread_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("sources", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["thread_id"], ["chat_threads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_messages_thread_id", "chat_messages", ["thread_id"])

    # ------------------------------------------------------------------
    # tenant_configs — system settings overrides per tenant
    # ------------------------------------------------------------------
    op.create_table(
        "tenant_configs",
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("llm_provider", sa.String(length=50), nullable=False, server_default="openai"),
        sa.Column("llm_model", sa.String(length=100), nullable=False, server_default="gpt-4o"),
        sa.Column("temperature", sa.Float(), nullable=False, server_default="0.2"),
        sa.Column("query_expansion", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("rate_limit_ingest", sa.Integer(), nullable=False, server_default="20"),
        sa.Column("rate_limit_query", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("tenant_id"),
    )
    op.create_index("ix_tenant_configs_tenant_id", "tenant_configs", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_tenant_configs_tenant_id", table_name="tenant_configs")
    op.drop_table("tenant_configs")
    op.drop_index("ix_chat_messages_thread_id", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_index("ix_chat_threads_workspace_id", table_name="chat_threads")
    op.drop_index("ix_chat_threads_user_id", table_name="chat_threads")
    op.drop_index("ix_chat_threads_tenant_id", table_name="chat_threads")
    op.drop_table("chat_threads")
