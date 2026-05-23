"""011_address_niu

Revision ID: 011_address_niu
Revises: d6e8c2e05497
Create Date: 2026-03-21 08:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "011_address_niu"
down_revision: Union[str, Sequence[str], None] = "d6e8c2e05497"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Address fields + NIU persistence
    op.add_column(
        "kyc_sessions", sa.Column("address_city", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "kyc_sessions",
        sa.Column("address_commune", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "kyc_sessions",
        sa.Column("address_quartier", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "kyc_sessions",
        sa.Column("address_lieu_dit", sa.String(length=150), nullable=True),
    )
    op.add_column(
        "kyc_sessions", sa.Column("address_details", sa.Text(), nullable=True)
    )
    op.add_column(
        "kyc_sessions",
        sa.Column("gps_latitude", sa.Numeric(precision=10, scale=7), nullable=True),
    )
    op.add_column(
        "kyc_sessions",
        sa.Column("gps_longitude", sa.Numeric(precision=10, scale=7), nullable=True),
    )
    op.add_column(
        "kyc_sessions",
        sa.Column("utility_provider", sa.String(length=30), nullable=True),
    )
    op.add_column(
        "kyc_sessions", sa.Column("utility_bill_date", sa.Date(), nullable=True)
    )
    op.add_column(
        "kyc_sessions", sa.Column("niu_number", sa.String(length=32), nullable=True)
    )
    op.add_column(
        "kyc_sessions",
        sa.Column(
            "niu_declarative",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # Query index for lookups by NIU
    op.create_index(
        "ix_kyc_sessions_niu_number", "kyc_sessions", ["niu_number"], unique=False
    )

    # Unique NIU per user when NIU is present (allows NULL NIU values)
    op.create_index(
        "uq_kyc_sessions_user_niu_not_null",
        "kyc_sessions",
        ["user_id", "niu_number"],
        unique=True,
        postgresql_where=sa.text("niu_number IS NOT NULL"),
    )

    # Explicit consent table requested by issue #193
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


def downgrade() -> None:
    # Note: `consents` table is dropped by migration 016_drop_orphan_consents (which runs after this).
    # Downgrading past 016 will recreate it there; no action needed here.
    op.drop_index("uq_kyc_sessions_user_niu_not_null", table_name="kyc_sessions")
    op.drop_index("ix_kyc_sessions_niu_number", table_name="kyc_sessions")

    op.drop_column("kyc_sessions", "niu_declarative")
    op.drop_column("kyc_sessions", "niu_number")
    op.drop_column("kyc_sessions", "utility_bill_date")
    op.drop_column("kyc_sessions", "utility_provider")
    op.drop_column("kyc_sessions", "gps_longitude")
    op.drop_column("kyc_sessions", "gps_latitude")
    op.drop_column("kyc_sessions", "address_details")
    op.drop_column("kyc_sessions", "address_lieu_dit")
    op.drop_column("kyc_sessions", "address_quartier")
    op.drop_column("kyc_sessions", "address_commune")
    op.drop_column("kyc_sessions", "address_city")
