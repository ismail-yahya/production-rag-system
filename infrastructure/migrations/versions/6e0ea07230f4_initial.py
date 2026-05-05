"""initial

Revision ID: 6e0ea07230f4
Revises: 
Create Date: 2026-04-28 07:59:45.561086

"""
from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = '6e0ea07230f4'
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
