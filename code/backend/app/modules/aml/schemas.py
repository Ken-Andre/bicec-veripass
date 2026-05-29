"""Module Pydantic schemas AML/CFT."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from datetime import datetime


class AmlSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class AmlAlertStatus(str, Enum):
    OPEN = "OPEN"
    CLEARED = "CLEARED"
    CONFIRMED = "CONFIRMED"
    ESCALATED = "ESCALATED"


class AmlListType(str, Enum):
    PEP = "PEP"
    SANCTIONS = "SANCTIONS"
    ADVERSE_MEDIA = "ADVERSE_MEDIA"


class NiuConflictStatus(str, Enum):
    OPEN = "OPEN"
    MERGED = "MERGED"
    FRAUD = "FRAUD"


class BatchJobStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"


# ===== Sanction Hit =====
class SanctionHitResponse(BaseModel):
    id: str
    list_name: str = Field(alias="listName")
    matched_name: str = Field(alias="matchedName")
    match_score: float = Field(alias="matchScore")
    list_type: Optional[AmlListType] = Field(None, alias="listType")
    details: Optional[str] = None
    country: Optional[str] = None

    model_config = {"populate_by_name": True, "from_attributes": True}


# ===== AML Alert =====
class AmlAlertResponse(BaseModel):
    id: str
    session_id: str = Field(alias="sessionId")
    client_name: str = Field(alias="clientName")
    niu: str
    severity: AmlSeverity
    status: AmlAlertStatus
    hits: list[SanctionHitResponse] = []
    created_at: Optional[datetime] = Field(None, alias="createdAt")
    reviewed_by: Optional[str] = Field(None, alias="reviewedBy")
    reviewed_at: Optional[datetime] = Field(None, alias="reviewedAt")
    justification: Optional[str] = None

    model_config = {"populate_by_name": True, "from_attributes": True}

    @field_validator("session_id", mode="before")
    @classmethod
    def mask_session_id(cls, v):
        """Mask internal session ID to avoid exposing raw database IDs."""
        from app.core.security import make_session_handle

        if v and isinstance(v, str):
            return make_session_handle(v)
        return v


class AmlAlertAction(BaseModel):
    """Action sur une alerte AML (clear/confirm/escalate)"""

    justification: str = Field(..., min_length=1, max_length=500)


class AmlEscalation(BaseModel):
    """Escalade d'alerte AML"""

    reason: str = Field(..., min_length=1, max_length=500)


# ===== NIU Conflict =====
class NiuConflictSession(BaseModel):
    id: str
    client_name: str = Field(alias="clientName")
    created_at: str = Field(alias="createdAt")
    confidence: float

    @field_validator("id", mode="before")
    @classmethod
    def mask_session_id(cls, v):
        """Mask internal session ID to avoid exposing raw database IDs."""
        from app.core.security import make_session_handle

        if v and isinstance(v, str):
            return make_session_handle(v)
        return v


class NiuConflictResponse(BaseModel):
    id: str
    niu: str
    session_a: NiuConflictSession = Field(alias="sessionA")
    session_b: NiuConflictSession = Field(alias="sessionB")
    similarity_score: float = Field(alias="similarityScore")
    status: NiuConflictStatus


class NiuConflictResolve(BaseModel):
    """Résolution de conflit NIU"""

    action: NiuConflictStatus  # MERGED ou FRAUD
    justification: str = Field(..., min_length=1, max_length=500)


# ===== Agency =====
class AgencyResponse(BaseModel):
    id: str
    code: str
    name: str
    city: str
    is_active: bool = Field(alias="isActive")
    agent_count: int = Field(0, alias="agentCount")

    model_config = {"populate_by_name": True, "from_attributes": True}


class AgencyCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    city: str = Field(..., min_length=1, max_length=100)


class AgencyUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    is_active: Optional[bool] = Field(None, alias="isActive")

    model_config = {"populate_by_name": True}


# ===== Batch Job =====
class BatchJobResponse(BaseModel):
    id: str
    job_type: str = Field(alias="type")
    status: BatchJobStatus
    total_items: int = Field(alias="totalItems")
    processed_items: int = Field(alias="processedItems")
    failed_items: int = Field(alias="failedItems")
    started_at: Optional[datetime] = Field(None, alias="startedAt")
    completed_at: Optional[datetime] = Field(None, alias="completedAt")

    model_config = {"populate_by_name": True, "from_attributes": True}


class DocumentExpiryItem(BaseModel):
    session_id: str = Field(alias="sessionId")
    client_name: str = Field(alias="clientName")
    status: str
    access_level: str = Field(alias="accessLevel")
    expiry_date: datetime | None = Field(None, alias="expiryDate")
    state: str
    notified_at: datetime | None = Field(None, alias="notifiedAt")
    contact: str | None = None

    model_config = {"populate_by_name": True}

    @field_validator("session_id", mode="before")
    @classmethod
    def mask_session_id(cls, v):
        from app.core.security import make_session_handle

        if v and isinstance(v, str):
            return make_session_handle(v)
        return v


class DocumentExpiryListResponse(BaseModel):
    items: list[DocumentExpiryItem]
    total: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    limit: int = Field(..., ge=1)


class GlobalNotificationRequest(BaseModel):
    type: str = Field(..., min_length=1, max_length=50)
    message: str = Field(..., min_length=1, max_length=500)
    reason: str = Field(..., min_length=1, max_length=500)


class GlobalNotificationResponse(BaseModel):
    created: int = Field(..., ge=0)
    event_key: str = Field(alias="eventKey")

    model_config = {"populate_by_name": True}


class AmlListRegistryItem(BaseModel):
    source: str
    list_type: AmlListType = Field(alias="listType")
    active_count: int = Field(alias="activeCount", ge=0)
    latest_synced_at: str | None = Field(None, alias="latestSyncedAt")
    latest_import_id: str | None = Field(None, alias="latestImportId")
    latest_import_status: str | None = Field(None, alias="latestImportStatus")
    latest_import_at: datetime | None = Field(None, alias="latestImportAt")
    imported_by: str | None = Field(None, alias="importedBy")

    model_config = {"populate_by_name": True}


class AmlListImportError(BaseModel):
    row: int
    message: str


class AmlListImportReport(BaseModel):
    import_id: str | None = Field(None, alias="importId")
    source: str
    list_type: AmlListType = Field(alias="listType")
    dry_run: bool = Field(alias="dryRun")
    status: str
    total_rows: int = Field(alias="totalRows", ge=0)
    imported_rows: int = Field(alias="importedRows", ge=0)
    failed_rows: int = Field(alias="failedRows", ge=0)
    errors: list[AmlListImportError] = []

    model_config = {"populate_by_name": True}
