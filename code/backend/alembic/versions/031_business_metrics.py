"""031_business_metrics

Revision ID: 031_business_metrics
Revises: 030_aml_list_imports
Create Date: 2026-06-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "031_business_metrics"
down_revision: Union[str, Sequence[str], None] = "030_aml_list_imports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "business_metric_baselines",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("agency_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("monthly_kyc_volume", sa.Integer(), nullable=True),
        sa.Column("current_avg_days_to_validate", sa.Numeric(8, 2), nullable=True),
        sa.Column("current_branch_minutes_per_dossier", sa.Numeric(8, 2), nullable=True),
        sa.Column("current_backoffice_minutes_per_dossier", sa.Numeric(8, 2), nullable=True),
        sa.Column("current_incomplete_rate", sa.Numeric(5, 4), nullable=True),
        sa.Column("current_complement_rate", sa.Numeric(5, 4), nullable=True),
        sa.Column("current_abandonment_rate", sa.Numeric(5, 4), nullable=True),
        sa.Column("hourly_staff_cost_xaf", sa.Numeric(14, 2), nullable=True),
        sa.Column("avg_customer_12m_value_xaf", sa.Numeric(14, 2), nullable=True),
        sa.Column("audit_requests_per_period", sa.Integer(), nullable=True),
        sa.Column("current_audit_assembly_hours", sa.Numeric(8, 2), nullable=True),
        sa.Column("veripass_audit_export_hours", sa.Numeric(8, 2), nullable=True),
        sa.Column("average_rework_cost_xaf", sa.Numeric(14, 2), nullable=True),
        sa.Column("current_aml_sensitive_case_rate", sa.Numeric(5, 4), nullable=True),
        sa.Column("pilot_setup_cost_xaf", sa.Numeric(14, 2), nullable=True),
        sa.Column("pilot_monthly_run_cost_xaf", sa.Numeric(14, 2), nullable=True),
        sa.Column("pilot_duration_months", sa.Integer(), nullable=True),
        sa.Column("source_note", sa.Text(), nullable=True),
        sa.Column("validated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("validated_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("period_end >= period_start", name="ck_business_metric_baselines_period"),
        sa.CheckConstraint("pilot_duration_months IS NULL OR pilot_duration_months > 0", name="ck_business_metric_baselines_duration"),
        sa.ForeignKeyConstraint(["agency_id"], ["agencies.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["agents.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["agents.id"]),
        sa.ForeignKeyConstraint(["validated_by"], ["agents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_business_metric_baselines_period", "business_metric_baselines", ["period_start", "period_end"])
    op.create_index(
        "ix_business_metric_baselines_agency_period",
        "business_metric_baselines",
        ["agency_id", "period_start", "period_end"],
    )
    op.create_index("ix_business_metric_baselines_created_at", "business_metric_baselines", ["created_at"])
    op.add_column("validation_decisions", sa.Column("review_duration_ms", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("validation_decisions", "review_duration_ms")
    op.drop_index("ix_business_metric_baselines_created_at", table_name="business_metric_baselines")
    op.drop_index("ix_business_metric_baselines_agency_period", table_name="business_metric_baselines")
    op.drop_index("ix_business_metric_baselines_period", table_name="business_metric_baselines")
    op.drop_table("business_metric_baselines")
