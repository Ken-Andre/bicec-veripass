"""Analytics SQLAlchemy models."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base_class import Base


class BusinessMetricBaseline(Base):
    """Validated declarative BICEC figures used to compute pilot ROI."""

    __tablename__ = "business_metric_baselines"
    __table_args__ = (
        CheckConstraint("period_end >= period_start", name="ck_business_metric_baselines_period"),
        CheckConstraint("pilot_duration_months IS NULL OR pilot_duration_months > 0", name="ck_business_metric_baselines_duration"),
        Index("ix_business_metric_baselines_period", "period_start", "period_end"),
        Index("ix_business_metric_baselines_agency_period", "agency_id", "period_start", "period_end"),
        Index("ix_business_metric_baselines_created_at", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    agency_id = Column(UUID(as_uuid=True), ForeignKey("agencies.id"), nullable=True)

    monthly_kyc_volume = Column(Integer, nullable=True)
    current_avg_days_to_validate = Column(Numeric(8, 2), nullable=True)
    current_branch_minutes_per_dossier = Column(Numeric(8, 2), nullable=True)
    current_backoffice_minutes_per_dossier = Column(Numeric(8, 2), nullable=True)
    current_incomplete_rate = Column(Numeric(5, 4), nullable=True)
    current_complement_rate = Column(Numeric(5, 4), nullable=True)
    current_abandonment_rate = Column(Numeric(5, 4), nullable=True)
    hourly_staff_cost_xaf = Column(Numeric(14, 2), nullable=True)
    avg_customer_12m_value_xaf = Column(Numeric(14, 2), nullable=True)
    audit_requests_per_period = Column(Integer, nullable=True)
    current_audit_assembly_hours = Column(Numeric(8, 2), nullable=True)
    veripass_audit_export_hours = Column(Numeric(8, 2), nullable=True)
    average_rework_cost_xaf = Column(Numeric(14, 2), nullable=True)
    current_aml_sensitive_case_rate = Column(Numeric(5, 4), nullable=True)
    pilot_setup_cost_xaf = Column(Numeric(14, 2), nullable=True)
    pilot_monthly_run_cost_xaf = Column(Numeric(14, 2), nullable=True)
    pilot_duration_months = Column(Integer, nullable=True)
    source_note = Column(Text, nullable=True)

    validated_by = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    validated_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
