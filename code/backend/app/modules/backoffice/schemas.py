"""Backoffice Pydantic schemas."""

from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel, Field, model_validator


class KYCQueueItemSchema(BaseModel):
    """Minimal KYC session info for the backoffice queue view."""

    id: UUID
    status: str
    access_level: str
    priority_flag: bool
    started_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None

    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    assigned_agent_name: Optional[str] = None
    overall_confidence: Optional[float] = None
    agency_code: Optional[str] = None
    biometric_risk_flags: list[str] = []

    model_config = {"from_attributes": True}


class KYCQueueStatsSchema(BaseModel):
    """Stable queue counters independent from table filters."""

    pending: int = 0
    info_required: int = 0
    fraud_suspect: int = 0
    approved: int = 0
    rejected: int = 0


class AuditLogSchema(BaseModel):
    """Audit log entry aligned with DossierTimeline component."""

    id: UUID
    timestamp: datetime = Field(alias="performed_at")
    agentId: Optional[UUID] = Field(None, alias="performed_by")
    agentName: str = ""
    actionType: str = Field(alias="action")
    previousState: Optional[str] = None
    newState: Optional[str] = None
    rationale: str = ""
    sessionId: Optional[str] = Field(None, alias="record_id")

    model_config = {"from_attributes": True, "populate_by_name": True}

    @model_validator(mode="before")
    @classmethod
    def _extract_from_data(cls, data: Any) -> Any:
        """Extract agentName, rationale, previousState, newState from JSONB fields."""
        def _as_text(value: Any) -> str:
            return "" if value is None else str(value)

        if hasattr(data, "__dict__"):
            # SQLAlchemy model instance
            new = getattr(data, "new_data", None) or {}
            old = getattr(data, "old_data", None) or {}
            if not hasattr(data, "agentName") or getattr(data, "agentName") is None:
                data.agentName = _as_text(new.get("agent_name", ""))
            if not hasattr(data, "rationale") or getattr(data, "rationale") is None:
                data.rationale = _as_text(new.get("rationale", ""))
            if not hasattr(data, "previousState") or getattr(data, "previousState") is None:
                data.previousState = _as_text(old.get("status", ""))
            if not hasattr(data, "newState") or getattr(data, "newState") is None:
                data.newState = _as_text(new.get("status", ""))
        elif isinstance(data, dict):
            new = data.get("new_data") or {}
            old = data.get("old_data") or {}
            data["agentName"] = _as_text(data.get("agentName", new.get("agent_name", "")))
            data["rationale"] = _as_text(data.get("rationale", new.get("rationale", "")))
            data["previousState"] = _as_text(data.get("previousState", old.get("status", "")))
            data["newState"] = _as_text(data.get("newState", new.get("status", "")))
        return data


class ReviewDecisionRequest(BaseModel):
    """Agent submits a review decision on a KYC dossier."""

    decision: str = Field(
        ...,
        description="APPROVED, REJECTED, INFO_REQUESTED, or FRAUD_SUSPECT",
    )
    reason: str = Field(
        ...,
        description="Mandatory justification for the decision (audit trail, COBAC R-2023/01)",
        min_length=1,
    )
    biometric_override_confirmed: bool = Field(
        False,
        description="Required when approving a dossier with biometric risk flags.",
    )
    review_duration_ms: Optional[int] = Field(
        None,
        ge=0,
        description="Elapsed review time between opening the dossier and submitting a decision.",
    )


class ReviewDecisionResponse(BaseModel):
    """Response after a review decision is recorded."""

    session_id: UUID
    decision: str
    new_status: str
    new_access_level: str
    decided_at: datetime
    agent_id: UUID
    reason: str

    model_config = {"from_attributes": True}


class AssignDossierRequest(BaseModel):
    """Assign a dossier to an agent for review."""

    agent_id: UUID = Field(..., description="UUID of the agent to assign")


class AssignDossierResponse(BaseModel):
    """Response after dossier assignment."""

    session_id: UUID
    agent_id: UUID
    agent_name: str
    assigned_at: datetime

    model_config = {"from_attributes": True}


class DossierDocumentBrief(BaseModel):
    """Brief document info for dossier detail view."""

    id: UUID
    doc_type: str
    sha256_hash: str
    ocr_status: str = "PENDING"
    ocr_error: Optional[str] = None
    ocr_engine: Optional[str] = None
    classification_categories: list[str] = []
    classified_by_name: Optional[str] = None
    classified_at: Optional[str] = None
    classification_reason: Optional[str] = None
    captured_at: datetime
    ocr_fields: list["OCRFieldBrief"] = []

    model_config = {"from_attributes": True}


class OCRFieldBrief(BaseModel):
    """Brief OCR field info for dossier detail view."""

    id: UUID
    field_name: str
    extracted_value: Optional[str] = None
    confidence_score: float = 0.0
    human_corrected: bool = False
    corrected_value: Optional[str] = None
    corrected_by_agent_id: Optional[UUID] = None
    corrected_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DossierBiometricBrief(BaseModel):
    """Brief biometric result for dossier detail view."""

    id: UUID
    face_match_score: Optional[float] = None
    face_match_status: Optional[str] = None
    face_match_reason: Optional[str] = None
    face_match_distance: Optional[float] = None
    face_match_threshold: Optional[float] = None
    face_match_detector: Optional[str] = None
    liveness_score: Optional[float] = None
    anti_spoofing_score: Optional[float] = None
    model_version_face: Optional[str] = None
    model_version_liveness: Optional[str] = None
    processed_at: datetime

    model_config = {"from_attributes": True}


class DossierDecisionBrief(BaseModel):
    """Brief decision info for dossier detail view."""

    id: UUID
    agent_id: UUID
    decision: str
    reason: Optional[str] = None
    decided_at: datetime

    model_config = {"from_attributes": True}


class DossierAmlAlertBrief(BaseModel):
    """Brief AML alert info for dossier detail view."""

    id: UUID
    alert_type: str
    match_score: float
    status: str

    model_config = {"from_attributes": True}


class DossierDetailSchema(BaseModel):
    """Full dossier detail for agent side-by-side review (J08)."""

    session_id: UUID
    status: str
    access_level: str
    priority_flag: bool
    confidence_score_global: Optional[float] = None
    started_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    last_step_completed: Optional[str] = None
    niu_type: Optional[str] = None
    niu_number: Optional[str] = None
    niu_declarative: bool = False
    address_city: Optional[str] = None
    address_commune: Optional[str] = None
    address_quartier: Optional[str] = None
    address_lieu_dit: Optional[str] = None
    address_details: Optional[str] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    utility_provider: Optional[str] = None
    utility_bill_date: Optional[date] = None

    user_phone: Optional[str] = None
    client_name: Optional[str] = None
    agency_code: Optional[str] = None

    documents: list[DossierDocumentBrief] = []

    biometric_result: Optional[DossierBiometricBrief] = None
    biometric_risk_flags: list[str] = []

    has_consent: bool = False
    consent_method: Optional[str] = None
    signed_at: Optional[datetime] = None

    decisions: list[DossierDecisionBrief] = []

    aml_alerts: list[DossierAmlAlertBrief] = []

    assigned_agent_id: Optional[UUID] = None
    assigned_agent_name: Optional[str] = None

    model_config = {"from_attributes": True}


class SupportThreadSchema(BaseModel):
    id: UUID
    session_id: UUID
    status: str
    created_at: datetime
    message_count: int = 0

    model_config = {"from_attributes": True}


class SupportMessageSchema(BaseModel):
    id: UUID
    thread_id: UUID
    sender_type: str
    sender_id: UUID
    content: str
    attachment_path: Optional[str] = None
    attachment_sha256: Optional[str] = None
    attachment_filename: Optional[str] = None
    attachment_document_id: Optional[UUID] = None
    sent_at: datetime
    read_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SupportMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)


class SupportThreadCreate(BaseModel):
    session_id: UUID


class AutoAssignResponse(BaseModel):
    session_id: UUID
    agent_id: UUID
    agent_name: str
    assigned_at: datetime
    assignment_method: str = "auto"


class DocumentClassifyRequest(BaseModel):
    """Assign a client-provided complement to one or more business categories."""

    categories: list[str] = Field(..., min_length=1)
    primary_doc_type: Optional[str] = Field(
        None,
        description="Optional canonical doc_type to expose as the primary dossier tab.",
    )
    reason: str = Field(..., min_length=1, max_length=500)


class DocumentClassifyResponse(BaseModel):
    session_id: UUID
    document_id: UUID
    doc_type: str
    categories: list[str]
    classified_at: datetime

    model_config = {"from_attributes": True}


class PromoteAttachmentRequest(BaseModel):
    """Promote an attachment sent by the client in support chat to a KYC document."""

    doc_type: str = Field(..., description="Target canonical doc_type (e.g. CNI_RECTO, BILL_ENEO)")
    categories: list[str] = Field(..., min_length=1, description="E.g. ['CNI_RECTO', 'IDENTITY_PROOF']")
    reason: str = Field(..., min_length=1, max_length=500)


class PromoteAttachmentResponse(BaseModel):
    session_id: UUID
    document_id: UUID
    doc_type: str
    categories: list[str]
    promoted_at: datetime

    model_config = {"from_attributes": True}
