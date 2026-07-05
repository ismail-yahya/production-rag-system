"""add_idempotency_and_heartbeat

Revision ID: 8a1b2c3d4e5f
Revises: 76bdd9bc31dd
Create Date: 2026-07-05 12:50:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "8a1b2c3d4e5f"
down_revision: str | Sequence[str] | None = "76bdd9bc31dd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add last_heartbeat_at to ingestion_jobs
    op.add_column(
        "ingestion_jobs",
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 2. Create task_executions table
    op.create_table(
        "task_executions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("task_name", sa.String(length=255), nullable=False),
        sa.Column("task_args_hash", sa.String(length=64), nullable=False),
        sa.Column("celery_task_id", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error", sa.String(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("task_name", "task_args_hash", name="uq_task_executions_name_hash"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    # 1. Drop task_executions table
    op.drop_table("task_executions")

    # 2. Drop last_heartbeat_at from ingestion_jobs
    op.drop_column("ingestion_jobs", "last_heartbeat_at")
