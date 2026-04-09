"""016_drop_orphan_consents_table

Revision ID: 016_drop_orphan_consents
Revises: 015_token_revocations
Create Date: 2026-03-21 14:00:00.000000

Changes:
- Drops the orphan `consents` table created by mistake in migration 011_address_niu (issue #193).
  The canonical consent model is `ConsentRecord` mapped to `consent_records` (initial schema).
  The `consents` table had no SQLAlchemy model and was never used by the application.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "016_drop_orphan_consents"
down_revision: Union[str, Sequence[str], None] = "015_token_revocations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the orphan table — no model, no usage, superseded by consent_records
    op.drop_table("consents")


def downgrade() -> None:
    # Recreate the table as it was in 011_address_niu if rollback is needed
    op.create_table(
        "consents",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column(
            "cgu_accepted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "privacy_accepted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "data_processing_accepted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "consent_method",
            sa.String(length=50),
            nullable=False,
            server_default=sa.text("'CHECKBOX_DIGITAL'"),
        ),
        sa.Column("consent_version", sa.String(length=20), nullable=True),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("client_ip", postgresql.INET(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["kyc_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", name="uq_consents_session_id"),
    )
