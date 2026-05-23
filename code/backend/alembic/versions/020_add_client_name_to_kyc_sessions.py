"""add client_name to kyc_sessions

Revision ID: 020_add_client_name
Revises: 60b8fe84565f
Create Date: 2026-04-27 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "020_add_client_name"
down_revision: Union[str, Sequence[str], None] = "60b8fe84565f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "kyc_sessions",
        sa.Column("client_name", sa.String(200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("kyc_sessions", "client_name")
