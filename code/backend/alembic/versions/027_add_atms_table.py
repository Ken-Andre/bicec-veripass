"""027_add_atms_table

Revision ID: 027_add_atms_table
Revises: 026_notification_preferences
Create Date: 2026-05-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "027_add_atms_table"
down_revision: Union[str, Sequence[str], None] = "026_notification_preferences"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "atms",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("city", sa.String(length=50), nullable=False),
        sa.Column("address", sa.String(length=200), nullable=False),
        sa.Column("latitude", sa.Numeric(precision=10, scale=6), nullable=False),
        sa.Column("longitude", sa.Numeric(precision=10, scale=6), nullable=False),
        sa.Column("services", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("available_24h", sa.Boolean(), nullable=True),
        sa.Column("access_tier", sa.String(length=20), nullable=True),
        sa.Column("last_verified", sa.Date(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("atms")
