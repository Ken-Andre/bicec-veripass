"""Analytics Pydantic schemas."""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class BusinessMetricBaselineBase(BaseModel):
    period_start: date
    period_end: date
    agency_id: Optional[UUID] = None

    monthly_kyc_volume: Optional[int] = Field(None, ge=0)
    current_avg_days_to_validate: Optional[float] = Field(None, ge=0)
    current_branch_minutes_per_dossier: Optional[float] = Field(None, ge=0)
    current_backoffice_minutes_per_dossier: Optional[float] = Field(None, ge=0)
    current_incomplete_rate: Optional[float] = Field(None, ge=0, le=1)
    current_complement_rate: Optional[float] = Field(None, ge=0, le=1)
    current_abandonment_rate: Optional[float] = Field(None, ge=0, le=1)
    hourly_staff_cost_xaf: Optional[float] = Field(None, ge=0)
    avg_customer_12m_value_xaf: Optional[float] = Field(None, ge=0)
    audit_requests_per_period: Optional[int] = Field(None, ge=0)
    current_audit_assembly_hours: Optional[float] = Field(None, ge=0)
    veripass_audit_export_hours: Optional[float] = Field(None, ge=0)
    average_rework_cost_xaf: Optional[float] = Field(None, ge=0)
    current_aml_sensitive_case_rate: Optional[float] = Field(None, ge=0, le=1)
    pilot_setup_cost_xaf: Optional[float] = Field(None, ge=0)
    pilot_monthly_run_cost_xaf: Optional[float] = Field(None, ge=0)
    pilot_duration_months: Optional[int] = Field(None, ge=1)
    source_note: Optional[str] = Field(None, max_length=4000)

    @model_validator(mode="after")
    def validate_period(self) -> "BusinessMetricBaselineBase":
        if self.period_end < self.period_start:
            raise ValueError("period_end must be greater than or equal to period_start")
        return self


class BusinessMetricBaselineCreate(BusinessMetricBaselineBase):
    pass


class BusinessMetricBaselineUpdate(BusinessMetricBaselineBase):
    id: Optional[UUID] = None


class BusinessMetricBaselineResponse(BusinessMetricBaselineBase):
    id: UUID
    validated_by: Optional[UUID] = None
    validated_at: Optional[datetime] = None
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
