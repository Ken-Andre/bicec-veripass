"""029_dwh_analytics_events

Revision ID: 029_dwh_analytics_events
Revises: 028_face_match_metadata
Create Date: 2026-05-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "029_dwh_analytics_events"
down_revision: Union[str, Sequence[str], None] = "028_face_match_metadata"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS dwh")

    op.create_table(
        "fact_kyc_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_dim_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("agency_dim_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("agent_dim_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("time_dim_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False, server_default="backend"),
        sa.Column("channel", sa.String(length=40), nullable=False, server_default="direct"),
        sa.Column("device_type", sa.String(length=60), nullable=True),
        sa.Column("step", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=80), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_dim_id"], ["dwh.dim_users.id"]),
        sa.ForeignKeyConstraint(["agency_dim_id"], ["dwh.dim_agencies.id"]),
        sa.ForeignKeyConstraint(["agent_dim_id"], ["dwh.dim_agents.id"]),
        sa.ForeignKeyConstraint(["time_dim_id"], ["dwh.dim_time.id"]),
        sa.PrimaryKeyConstraint("id"),
        schema="dwh",
    )
    op.create_index(
        "ix_dwh_fact_kyc_events_occurred_at",
        "fact_kyc_events",
        ["occurred_at"],
        schema="dwh",
    )
    op.create_index(
        "ix_dwh_fact_kyc_events_type",
        "fact_kyc_events",
        ["event_type"],
        schema="dwh",
    )
    op.create_index(
        "ix_dwh_fact_kyc_events_session",
        "fact_kyc_events",
        ["session_id"],
        schema="dwh",
    )

    op.add_column("duplicate_checks", sa.Column("niu_number", sa.String(length=32), nullable=True))
    op.add_column("duplicate_checks", sa.Column("similarity_score", sa.Numeric(5, 4), nullable=True))
    op.add_column("duplicate_checks", sa.Column("status", sa.String(length=50), nullable=False, server_default="OPEN"))
    op.add_column("duplicate_checks", sa.Column("justification", sa.Text(), nullable=True))
    op.add_column(
        "duplicate_checks",
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.execute("UPDATE aml_alerts SET status = 'OPEN' WHERE status = 'PENDING'")


def downgrade() -> None:
    op.drop_column("duplicate_checks", "created_at")
    op.drop_column("duplicate_checks", "justification")
    op.drop_column("duplicate_checks", "status")
    op.drop_column("duplicate_checks", "similarity_score")
    op.drop_column("duplicate_checks", "niu_number")

    op.drop_index("ix_dwh_fact_kyc_events_session", table_name="fact_kyc_events", schema="dwh")
    op.drop_index("ix_dwh_fact_kyc_events_type", table_name="fact_kyc_events", schema="dwh")
    op.drop_index("ix_dwh_fact_kyc_events_occurred_at", table_name="fact_kyc_events", schema="dwh")
    op.drop_table("fact_kyc_events", schema="dwh")
