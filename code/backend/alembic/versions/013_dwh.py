"""013_dwh

Revision ID: 013_dwh
Revises: 012_aml
Create Date: 2026-03-21 08:50:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "013_dwh"
down_revision: Union[str, Sequence[str], None] = "012_aml"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS dwh")

    op.create_table(
        "dim_users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("source_user_id", sa.UUID(), nullable=True),
        sa.Column("phone_prefix", sa.String(length=10), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("region", sa.String(length=100), nullable=True),
        sa.Column("language", sa.String(length=10), nullable=True),
        sa.Column("cohort_month", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        schema="dwh",
    )

    op.create_table(
        "dim_agencies",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("source_agency_id", sa.UUID(), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("region", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        schema="dwh",
    )

    op.create_table(
        "dim_agents",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("source_agent_id", sa.UUID(), nullable=True),
        sa.Column("agency_dim_id", sa.UUID(), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("role", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["agency_dim_id"], ["dwh.dim_agencies.id"]),
        sa.PrimaryKeyConstraint("id"),
        schema="dwh",
    )

    op.create_table(
        "dim_time",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("full_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("hour", sa.Integer(), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("week", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema="dwh",
    )

    # Partitioned fact table by month.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS dwh.fact_kyc_funnel (
            id BIGSERIAL,
            session_id UUID,
            user_dim_id UUID REFERENCES dwh.dim_users(id),
            agency_dim_id UUID REFERENCES dwh.dim_agencies(id),
            time_dim_id UUID REFERENCES dwh.dim_time(id),
            session_date DATE NOT NULL,
            current_status VARCHAR(50),
            final_status VARCHAR(50),
            niu_type VARCHAR(50),
            total_duration_seconds INTEGER,
            dropout_step VARCHAR(100),
            conversion_stage VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        ) PARTITION BY RANGE (session_date)
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS dwh.fact_kyc_funnel_p_current
        PARTITION OF dwh.fact_kyc_funnel
        FOR VALUES FROM (date_trunc('month', current_date)::date)
        TO ((date_trunc('month', current_date) + interval '1 month')::date)
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS dwh.fact_kyc_funnel_p_next
        PARTITION OF dwh.fact_kyc_funnel
        FOR VALUES FROM ((date_trunc('month', current_date) + interval '1 month')::date)
        TO ((date_trunc('month', current_date) + interval '2 month')::date)
        """
    )

    op.create_table(
        "fact_ocr_performance",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.UUID(), nullable=True),
        sa.Column("document_id", sa.UUID(), nullable=True),
        sa.Column("time_dim_id", sa.UUID(), nullable=True),
        sa.Column("extraction_date", sa.Date(), nullable=False),
        sa.Column("engine", sa.String(length=30), nullable=True),
        sa.Column("processing_duration_ms", sa.Integer(), nullable=True),
        sa.Column("confidence_avg", sa.Numeric(5, 4), nullable=True),
        sa.Column("low_confidence_fields_count", sa.Integer(), nullable=True),
        sa.Column("human_correction_needed", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["time_dim_id"], ["dwh.dim_time.id"]),
        schema="dwh",
    )

    op.create_index(
        "ix_dwh_fact_kyc_funnel_session_date",
        "fact_kyc_funnel",
        ["session_date"],
        unique=False,
        schema="dwh",
    )
    op.create_index(
        "ix_dwh_fact_ocr_performance_extraction_date",
        "fact_ocr_performance",
        ["extraction_date"],
        unique=False,
        schema="dwh",
    )


def downgrade() -> None:
    op.drop_index("ix_dwh_fact_ocr_performance_extraction_date", table_name="fact_ocr_performance", schema="dwh")
    op.drop_index("ix_dwh_fact_kyc_funnel_session_date", table_name="fact_kyc_funnel", schema="dwh")

    op.drop_table("fact_ocr_performance", schema="dwh")

    op.execute("DROP TABLE IF EXISTS dwh.fact_kyc_funnel_p_next")
    op.execute("DROP TABLE IF EXISTS dwh.fact_kyc_funnel_p_current")
    op.execute("DROP TABLE IF EXISTS dwh.fact_kyc_funnel")

    op.drop_table("dim_time", schema="dwh")
    op.drop_table("dim_agents", schema="dwh")
    op.drop_table("dim_agencies", schema="dwh")
    op.drop_table("dim_users", schema="dwh")
