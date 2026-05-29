"""Backoffice router — Agent review workflow per ADR-001.

Endpoints:
- GET  /queue           — Paginated KYC dossier queue (JEAN, THOMAS, SYLVIE, ADMIN_IT)
- GET  /dossier/{id}    — Full dossier detail for side-by-side review (J08)
- POST /dossier/{id}/review  — Submit review decision
- POST /dossier/{id}/assign  — Assign dossier to an agent
- POST /dossier/{id}/auto-assign — Auto-assign to least loaded available agent
- GET  /dossier/{id}/documents/{doc_id}/file — Serve document file
- GET  /audit-logs      — Paginated audit log
- GET  /support/threads — List support threads for a session
- POST /support/threads — Create support thread
- GET  /support/threads/{id}/messages — List messages in a thread
- POST /support/threads/{id}/messages — Send a message in a thread
- GET  /support/messages/{id}/attachment — Download support attachment
"""

import mimetypes
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, Request, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.pagination import PageParams, PageResponse, paginate
from app.core.security import require_agent_role, get_current_agent
from app.core.logging import logger
from app.db.session import get_db
from app.modules.auth.models import Agent, AgentRole
from app.modules.admin.models import Agency
from app.modules.kyc.models import (
    KYCSession,
    Document,
    DuplicateCheck,
    OCRField,
    ValidationDecision,
    DossierAssignment,
    Notification,
    SupportThread,
    SupportMessage,
)
from app.modules.kyc.schemas import (
    LifecycleState,
    AccessTier,
    LIFECYCLE_TO_ACCESS_TIER,
)
from app.modules.kyc.service import biometric_manual_review_reasons
from app.modules.audit.models import AuditLog
from app.modules.analytics.service import (
    record_ocr_performance_best_effort,
    track_event_best_effort,
)
from app.modules.kyc.storage import DocumentStorage
from app.modules.backoffice.schemas import (
    AuditLogSchema,
    KYCQueueItemSchema,
    KYCQueueStatsSchema,
    DossierDetailSchema,
    DossierDocumentBrief,
    DossierBiometricBrief,
    DossierDecisionBrief,
    DossierAmlAlertBrief,
    OCRFieldBrief,
    ReviewDecisionRequest,
    ReviewDecisionResponse,
    AssignDossierRequest,
    AssignDossierResponse,
    AutoAssignResponse,
    DocumentClassifyRequest,
    DocumentClassifyResponse,
    SupportThreadSchema,
    SupportMessageSchema,
    SupportMessageCreate,
    SupportThreadCreate,
    PromoteAttachmentRequest,
    PromoteAttachmentResponse,
)

router = APIRouter()
document_storage = DocumentStorage()


def _request_uuid(request: Request) -> uuid.UUID | None:
    raw = getattr(request.state, "correlation_id", None)
    try:
        return uuid.UUID(str(raw)) if raw else None
    except ValueError:
        return None


def _attachment_filename(path: str | None) -> str | None:
    if not path:
        return None
    name = Path(path).name
    parts = name.split("_", 1)
    return parts[1] if len(parts) == 2 else name


def _resolve_attachment_path(path: str) -> Path:
    candidate = Path(path)
    if candidate.is_absolute():
        return candidate
    return (document_storage.base_path / candidate).resolve()


async def _resolve_attachment_document_id(
    db: AsyncSession,
    session_id: uuid.UUID,
    attachment_path: str | None,
    attachment_sha256: str | None,
) -> uuid.UUID | None:
    if not attachment_path and not attachment_sha256:
        return None
    query = select(Document.id).where(Document.session_id == session_id)
    if attachment_sha256:
        query = query.where(Document.sha256_hash == attachment_sha256)
    elif attachment_path:
        query = query.where(Document.file_path == attachment_path)
    query = query.order_by(Document.captured_at.desc())
    result = await db.execute(query.limit(1))
    return result.scalar_one_or_none()


_ROLE_DECISIONS: dict[AgentRole, set[str]] = {
    AgentRole.JEAN: {"APPROVED", "REJECTED", "INFO_REQUESTED"},
    AgentRole.THOMAS: {"FRAUD_SUSPECT", "INFO_REQUESTED"},
    AgentRole.SYLVIE: {"APPROVED", "REJECTED", "INFO_REQUESTED", "FRAUD_SUSPECT"},
    AgentRole.ADMIN_IT: set(),
}

_ROLE_DECISIONS_FRAUD: dict[AgentRole, set[str]] = {
    AgentRole.THOMAS: {"REJECTED"},
    AgentRole.SYLVIE: {"REJECTED"},
}

_REVIEW_STATES = {
    LifecycleState.PENDING_AGENT_REVIEW,
    LifecycleState.PENDING_KYC,
    LifecycleState.PENDING_INFO,
}

ALLOWED_DOC_CATEGORIES: set[str] = {
    "CNI_RECTO",
    "CNI_VERSO",
    "BILL_ENEO",
    "BILL_CAMWATER",
    "NIU",
    "SELFIE",
    "IDENTITY_PROOF",
    "ADDRESS_PROOF",
    "OTHER",
}


@router.get("/")
async def get_root():
    return {"module": "backoffice", "status": "initialized"}


class CommandCenterAgentLoadSchema(BaseModel):
    """Read-only agent load snapshot for operational dashboards."""

    id: str
    name: str
    email: str
    role: str
    agency_id: str | None = None
    agency_code: str | None = None
    agency_name: str | None = None
    is_available: bool
    is_connected: bool
    active_dossier_count: int
    active_queue_count: int
    completed_dossier_count: int
    total_assigned_count: int
    last_activity_at: str | None = None


AGENT_CONNECTED_WINDOW = timedelta(minutes=5)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _is_agent_connected(agent: Agent) -> bool:
    last_activity_at = _as_utc(agent.last_activity_at)
    if not last_activity_at:
        return False
    return datetime.now(timezone.utc) - last_activity_at <= AGENT_CONNECTED_WINDOW


async def _count_agent_active_queue(db: AsyncSession, agent_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count(func.distinct(DossierAssignment.session_id)))
        .select_from(DossierAssignment)
        .join(KYCSession, KYCSession.id == DossierAssignment.session_id)
        .where(
            DossierAssignment.agent_id == agent_id,
            DossierAssignment.is_current == True,  # noqa: E712
            DossierAssignment.completed_at == None,  # noqa: E711
            KYCSession.status.in_(_REVIEW_STATES),
        )
    )
    return int(result.scalar() or 0)


async def _sync_agent_active_count(db: AsyncSession, agent_id: uuid.UUID) -> None:
    agent = await db.get(Agent, agent_id)
    if agent:
        agent.active_dossier_count = await _count_agent_active_queue(db, agent_id)


async def _agent_load_counts(
    db: AsyncSession, agent_ids: list[uuid.UUID]
) -> dict[uuid.UUID, dict[str, int]]:
    counts = {
        agent_id: {
            "active_queue_count": 0,
            "completed_dossier_count": 0,
            "total_assigned_count": 0,
        }
        for agent_id in agent_ids
    }
    if not agent_ids:
        return counts

    active_rows = await db.execute(
        select(
            DossierAssignment.agent_id,
            func.count(func.distinct(DossierAssignment.session_id)),
        )
        .select_from(DossierAssignment)
        .join(KYCSession, KYCSession.id == DossierAssignment.session_id)
        .where(
            DossierAssignment.agent_id.in_(agent_ids),
            DossierAssignment.is_current == True,  # noqa: E712
            DossierAssignment.completed_at == None,  # noqa: E711
            KYCSession.status.in_(_REVIEW_STATES),
        )
        .group_by(DossierAssignment.agent_id)
    )
    for agent_id, count in active_rows.all():
        counts[agent_id]["active_queue_count"] = int(count or 0)

    completed_rows = await db.execute(
        select(
            ValidationDecision.agent_id,
            func.count(func.distinct(ValidationDecision.session_id)),
        )
        .where(ValidationDecision.agent_id.in_(agent_ids))
        .group_by(ValidationDecision.agent_id)
    )
    for agent_id, count in completed_rows.all():
        counts[agent_id]["completed_dossier_count"] = int(count or 0)

    assigned_rows = await db.execute(
        select(
            DossierAssignment.agent_id,
            func.count(func.distinct(DossierAssignment.session_id)),
        )
        .where(DossierAssignment.agent_id.in_(agent_ids))
        .group_by(DossierAssignment.agent_id)
    )
    for agent_id, count in assigned_rows.all():
        counts[agent_id]["total_assigned_count"] = int(count or 0)

    return counts


async def _least_loaded_connected_agent(
    db: AsyncSession, candidates: list[Agent]
) -> Agent | None:
    connected = [agent for agent in candidates if _is_agent_connected(agent)]
    if not connected:
        return None
    counts = await _agent_load_counts(db, [agent.id for agent in connected])
    return min(
        connected,
        key=lambda agent: (
            counts[agent.id]["active_queue_count"],
            agent.name.lower(),
        ),
    )


def _agent_load_to_response(
    agent: Agent, counts: dict[str, int]
) -> CommandCenterAgentLoadSchema:
    active_queue_count = counts.get("active_queue_count", 0)
    agency = getattr(agent, "agency", None)
    return CommandCenterAgentLoadSchema(
        id=str(agent.id),
        name=agent.name,
        email=agent.email,
        role=agent.role.value if hasattr(agent.role, "value") else str(agent.role),
        agency_id=str(agent.agency_id) if agent.agency_id else None,
        agency_code=getattr(agency, "code", None),
        agency_name=getattr(agency, "name", None),
        is_available=agent.is_available,
        is_connected=_is_agent_connected(agent),
        active_dossier_count=active_queue_count,
        active_queue_count=active_queue_count,
        completed_dossier_count=counts.get("completed_dossier_count", 0),
        total_assigned_count=counts.get("total_assigned_count", 0),
        last_activity_at=agent.last_activity_at.isoformat() if agent.last_activity_at else None,
    )


@router.get("/agents/load", response_model=PageResponse[CommandCenterAgentLoadSchema])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_agent_load(
    request: Request,
    _agent: Agent = Depends(require_agent_role(AgentRole.SYLVIE, AgentRole.ADMIN_IT)),
    page: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Read-only load distribution for command center dashboards.

    This is intentionally separate from /admin/agents: SYLVIE can supervise
    operational load, but only ADMIN_IT can create, edit, or deactivate agents.
    """
    query = (
        select(Agent)
        .options(selectinload(Agent.agency))
        .order_by(Agent.role.asc(), Agent.name.asc())
    )
    total = (await db.execute(select(func.count()).select_from(Agent))).scalar_one()
    result = await db.execute(query.offset(page.offset).limit(page.limit))
    agents = result.scalars().all()
    counts = await _agent_load_counts(db, [agent.id for agent in agents])
    return PageResponse[CommandCenterAgentLoadSchema](
        items=[_agent_load_to_response(agent, counts[agent.id]) for agent in agents],
        total=total,
        page=page.page,
        pages=(total + page.limit - 1) // page.limit if total else 1,
        limit=page.limit,
    )


async def _extract_client_name(session: KYCSession) -> str | None:
    """Extract client name from OCR fields or user info."""
    if session.client_name:
        return session.client_name
    try:
        for doc in session.documents:
            for field in doc.ocr_fields:
                if field.field_name in ("Nom", "Prénom", "firstName", "lastName"):
                    return field.extracted_value
    except Exception:
        pass
    if session.user:
        return session.user.phone or session.user.email
    return None


def _extract_client_name_from_docs(documents: list) -> str | None:
    """Extract client name from a list of documents with OCR fields."""
    parts: list[str] = []
    for doc in documents:
        if not hasattr(doc, 'ocr_fields'):
            continue
        for field in doc.ocr_fields:
            if field.field_name == "Prénom" and field.extracted_value:
                parts.insert(0, field.extracted_value)
            elif field.field_name == "Nom" and field.extracted_value:
                parts.append(field.extracted_value)
            elif field.field_name == "firstName" and field.extracted_value:
                parts.insert(0, field.extracted_value)
            elif field.field_name == "lastName" and field.extracted_value:
                parts.append(field.extracted_value)
    if parts:
        return " ".join(parts)
    return None


@router.get(
    "/queue/stats",
    response_model=KYCQueueStatsSchema,
)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_queue_stats(
    request: Request,
    _agent: Agent = Depends(
        require_agent_role(
            AgentRole.JEAN, AgentRole.THOMAS, AgentRole.SYLVIE, AgentRole.ADMIN_IT
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """Stable KYC queue counters for dashboard cards, independent of UI filters."""
    result = await db.execute(
        select(KYCSession.status, func.count(KYCSession.id))
        .where(
            KYCSession.status.in_(
                [
                    LifecycleState.PENDING_AGENT_REVIEW,
                    LifecycleState.PENDING_KYC,
                    LifecycleState.PENDING_INFO,
                    LifecycleState.FRAUD_SUSPECT,
                    LifecycleState.APPROVED,
                    LifecycleState.REJECTED,
                ]
            )
        )
        .group_by(KYCSession.status)
    )
    counts = {status: int(count) for status, count in result.all()}
    return KYCQueueStatsSchema(
        pending=counts.get(LifecycleState.PENDING_AGENT_REVIEW, 0)
        + counts.get(LifecycleState.PENDING_KYC, 0),
        info_required=counts.get(LifecycleState.PENDING_INFO, 0),
        fraud_suspect=counts.get(LifecycleState.FRAUD_SUSPECT, 0),
        approved=counts.get(LifecycleState.APPROVED, 0),
        rejected=counts.get(LifecycleState.REJECTED, 0),
    )


@router.get(
    "/queue",
    response_model=PageResponse[KYCQueueItemSchema],
)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_queue(
    request: Request,
    page: PageParams = Depends(),
    status_filter: str | None = Query(None, alias="status", description="Filter by KYC status (e.g. PENDING_AGENT_REVIEW, PENDING_INFO, APPROVED, REJECTED, FRAUD_SUSPECT)"),
    agent_id: uuid.UUID | None = Query(None, description="Filter by assigned agent UUID"),
    agency_code: str | None = Query(None, description="Filter by agency code"),
    client_name: str | None = Query(None, description="Search by client name (partial match)"),
    _agent: Agent = Depends(
        require_agent_role(
            AgentRole.JEAN, AgentRole.THOMAS, AgentRole.SYLVIE, AgentRole.ADMIN_IT
        )
    ),
    db: AsyncSession = Depends(get_db),
):
    """Paginated KYC session queue — dossiers awaiting agent review.

    Supports optional filters: status, agent_id, agency_code, client_name.
    """
    offset = page.offset
    limit = page.limit

    # Base conditions: if no status filter, show review states; otherwise show requested status
    conditions = []
    if status_filter:
        conditions.append(KYCSession.status == status_filter)
    else:
        conditions.append(KYCSession.status.in_(_REVIEW_STATES))

    base_query = (
        select(KYCSession)
        .where(*conditions)
        .options(
            selectinload(KYCSession.user),
            selectinload(KYCSession.agency),
            selectinload(KYCSession.documents).selectinload(Document.ocr_fields),
            selectinload(KYCSession.biometric_results),
            selectinload(KYCSession.assignments).selectinload(DossierAssignment.agent),
        )
    )

    # Apply filters at query level where possible
    if agency_code:
        base_query = base_query.join(KYCSession.agency).where(Agency.code == agency_code)

    base_query = base_query.order_by(KYCSession.priority_flag.desc(), KYCSession.submitted_at.asc())

    # Count query with same filters
    count_conditions = list(conditions)
    count_query = select(func.count()).select_from(KYCSession).where(*count_conditions)
    if agency_code:
        count_query = count_query.join(KYCSession.agency).where(Agency.code == agency_code)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    result = await db.execute(
        base_query.offset(offset).limit(limit)
    )
    sessions = result.scalars().unique().all()

    items = []
    for session in sessions:
        user_phone = session.user.phone if session.user else None
        client_name_extracted = _extract_client_name_from_docs(session.documents) or user_phone
        agency_code_val = session.agency.code if session.agency else None

        # Filter by agent_id (post-query, since assignments are eager-loaded)
        if agent_id:
            has_assignment = any(
                a.agent_id == agent_id and a.is_current and a.completed_at is None
                for a in session.assignments
            )
            if not has_assignment:
                continue

        # Filter by client_name (post-query, case-insensitive partial match)
        if client_name and client_name_extracted:
            if client_name.lower() not in client_name_extracted.lower():
                continue

        assigned_agent_name = None
        current = next(
            (a for a in session.assignments if a.is_current and a.completed_at is None),
            None,
        )
        if current and current.agent:
            assigned_agent_name = current.agent.name

        overall_confidence = float(session.confidence_score_global) if session.confidence_score_global else None
        biometric_risk_flags = biometric_manual_review_reasons(session.biometric_results)

        items.append(KYCQueueItemSchema(
            id=session.id,
            status=session.status,
            access_level=session.access_level,
            priority_flag=session.priority_flag,
            started_at=session.started_at,
            submitted_at=session.submitted_at,
            client_name=client_name_extracted,
            client_phone=user_phone,
            assigned_agent_name=assigned_agent_name,
            overall_confidence=overall_confidence,
            agency_code=agency_code_val,
            biometric_risk_flags=biometric_risk_flags,
        ))

    total_pages = (total + limit - 1) // limit if total > 0 else 1
    return PageResponse(
        items=items,
        total=total,
        page=page.page,
        limit=limit,
        pages=total_pages,
    )


@router.get(
    "/dossier/{session_id}",
    response_model=DossierDetailSchema,
)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_dossier_detail(
    request: Request,
    session_id: uuid.UUID,
    _agent: Agent = Depends(
        require_agent_role(AgentRole.JEAN, AgentRole.THOMAS, AgentRole.SYLVIE)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Full dossier detail for agent side-by-side review (J08)."""
    result = await db.execute(
        select(KYCSession)
        .options(
            selectinload(KYCSession.user),
            selectinload(KYCSession.agency),
            selectinload(KYCSession.documents).selectinload(Document.ocr_fields),
            selectinload(KYCSession.biometric_results),
            selectinload(KYCSession.consent_record),
            selectinload(KYCSession.decisions),
            selectinload(KYCSession.aml_alerts),
            selectinload(KYCSession.assignments).selectinload(DossierAssignment.agent),
        )
        .where(KYCSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Dossier not found")

    if _agent.role == AgentRole.THOMAS:
        # Verify if dossier has active compliance triggers
        has_aml = len(session.aml_alerts) > 0
        
        # Query DuplicateCheck to see if a NIU conflict exists
        dup_res = await db.execute(
            select(DuplicateCheck).where(
                (DuplicateCheck.session_id_new == session_id) | 
                (DuplicateCheck.session_id_existing == session_id)
            )
        )
        has_dup = dup_res.first() is not None

        if not (has_aml or has_dup):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: compliance check does not exist for this dossier."
            )

    client_name = _extract_client_name_from_docs(session.documents)
    user_phone = session.user.phone if session.user else None
    agency_code = session.agency.code if session.agency else None

    doc_briefs: list[DossierDocumentBrief] = []
    for doc in session.documents:
        ocr_field_briefs = [
            OCRFieldBrief(
                id=f.id,
                field_name=f.field_name,
                extracted_value=f.extracted_value,
                confidence_score=float(f.confidence_score),
                human_corrected=f.human_corrected or False,
                corrected_value=f.corrected_value,
                corrected_by_agent_id=f.corrected_by_agent_id,
                corrected_at=f.corrected_at,
            )
            for f in doc.ocr_fields
        ]
        classification = {}
        if isinstance(doc.ocr_raw_json, dict):
            raw_classification = doc.ocr_raw_json.get("backoffice_classification")
            if isinstance(raw_classification, dict):
                classification = raw_classification
        doc_briefs.append(
            DossierDocumentBrief(
                id=doc.id,
                doc_type=doc.doc_type,
                sha256_hash=doc.sha256_hash,
                ocr_status=doc.ocr_status or "PENDING",
                ocr_error=doc.ocr_error,
                ocr_engine=doc.ocr_engine,
                classification_categories=classification.get("categories") or [],
                classified_by_name=classification.get("classified_by_name"),
                classified_at=classification.get("classified_at"),
                classification_reason=classification.get("reason"),
                captured_at=doc.captured_at,
                ocr_fields=ocr_field_briefs,
            )
        )

    bio_brief: DossierBiometricBrief | None = None
    if session.biometric_results:
        bio_brief = DossierBiometricBrief(
            id=session.biometric_results.id,
            face_match_score=float(session.biometric_results.face_match_score)
            if session.biometric_results.face_match_score is not None
            else None,
            face_match_status=session.biometric_results.face_match_status,
            face_match_reason=session.biometric_results.face_match_reason,
            face_match_distance=float(session.biometric_results.face_match_distance)
            if session.biometric_results.face_match_distance is not None
            else None,
            face_match_threshold=float(session.biometric_results.face_match_threshold)
            if session.biometric_results.face_match_threshold is not None
            else None,
            face_match_detector=session.biometric_results.face_match_detector,
            liveness_score=float(session.biometric_results.liveness_score)
            if session.biometric_results.liveness_score is not None
            else None,
            anti_spoofing_score=float(session.biometric_results.anti_spoofing_score)
            if session.biometric_results.anti_spoofing_score is not None
            else None,
            model_version_face=session.biometric_results.model_version_face,
            model_version_liveness=session.biometric_results.model_version_liveness,
            processed_at=session.biometric_results.processed_at,
        )

    decision_briefs = [
        DossierDecisionBrief(
            id=d.id,
            agent_id=d.agent_id,
            decision=d.decision,
            reason=d.reason,
            decided_at=d.decided_at,
        )
        for d in session.decisions
    ]

    aml_briefs = [
        DossierAmlAlertBrief(
            id=a.id,
            alert_type=a.alert_type,
            match_score=float(a.match_score),
            status=a.status,
        )
        for a in session.aml_alerts
    ]

    assigned_agent_id: uuid.UUID | None = None
    assigned_agent_name: str | None = None
    current = next(
        (a for a in session.assignments if a.is_current and a.completed_at is None),
        None,
    )
    if current:
        assigned_agent_id = current.agent_id
        assigned_agent_name = current.agent.name if current.agent else None

    return DossierDetailSchema(
        session_id=session.id,
        status=session.status,
        access_level=session.access_level,
        priority_flag=session.priority_flag,
        confidence_score_global=float(session.confidence_score_global)
        if session.confidence_score_global
        else None,
        started_at=session.started_at,
        submitted_at=session.submitted_at,
        completed_at=session.completed_at,
        last_step_completed=session.last_step_completed,
        niu_type=session.niu_type,
        niu_number=session.niu_number,
        niu_declarative=bool(session.niu_declarative),
        address_city=session.address_city,
        address_commune=session.address_commune,
        address_quartier=session.address_quartier,
        address_lieu_dit=session.address_lieu_dit,
        address_details=session.address_details,
        gps_latitude=float(session.gps_latitude) if session.gps_latitude is not None else None,
        gps_longitude=float(session.gps_longitude) if session.gps_longitude is not None else None,
        utility_provider=session.utility_provider,
        utility_bill_date=session.utility_bill_date,
        user_phone=user_phone,
        client_name=client_name,
        agency_code=agency_code,
        documents=doc_briefs,
        biometric_result=bio_brief,
        biometric_risk_flags=biometric_manual_review_reasons(session.biometric_results),
        has_consent=session.consent_record is not None,
        consent_method=session.consent_record.consent_method if session.consent_record else None,
        signed_at=session.consent_record.signed_at if session.consent_record else None,
        decisions=decision_briefs,
        aml_alerts=aml_briefs,
        assigned_agent_id=assigned_agent_id,
        assigned_agent_name=assigned_agent_name,
    )


@router.get("/dossier/{session_id}/documents/{doc_id}/file")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_document_file(
    request: Request,
    session_id: uuid.UUID,
    doc_id: uuid.UUID,
    _agent: Agent = Depends(
        require_agent_role(AgentRole.JEAN, AgentRole.THOMAS, AgentRole.SYLVIE)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Serve a document file for the back-office agent review.
    
    Access: JEAN, THOMAS, SYLVIE (role-dependent dossier access)
    """
    result = await db.execute(
        select(Document).where(
            Document.id == doc_id,
            Document.session_id == session_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = document_storage.base_path / doc.file_path
    resolved = file_path.resolve()
    if not resolved.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=str(resolved),
        media_type=mimetypes.guess_type(resolved.name)[0]
        or "application/octet-stream",
        filename=resolved.name,
    )


@router.post(
    "/dossier/{session_id}/documents/{doc_id}/classify",
    response_model=DocumentClassifyResponse,
)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def classify_document(
    request: Request,
    session_id: uuid.UUID,
    doc_id: uuid.UUID,
    body: DocumentClassifyRequest,
    current_agent: Agent = Depends(
        require_agent_role(AgentRole.JEAN, AgentRole.SYLVIE)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Classify a document sent as a complement into one or more KYC categories."""
    result = await db.execute(
        select(Document).where(
            Document.id == doc_id,
            Document.session_id == session_id,
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    categories = [c.strip().upper() for c in body.categories if c.strip()]
    if not categories:
        raise HTTPException(status_code=400, detail="At least one category is required")
    invalid = sorted(set(categories) - ALLOWED_DOC_CATEGORIES)
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid document categories: {', '.join(invalid)}",
        )

    primary_doc_type = (body.primary_doc_type or categories[0]).strip().upper()
    if primary_doc_type not in ALLOWED_DOC_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid primary_doc_type")

    now = datetime.now(timezone.utc)
    old_doc_type = document.doc_type
    previous_raw = document.ocr_raw_json if isinstance(document.ocr_raw_json, dict) else {}
    document.doc_type = primary_doc_type
    document.ocr_raw_json = {
        **previous_raw,
        "backoffice_classification": {
            "categories": categories,
            "primary_doc_type": primary_doc_type,
            "classified_by": str(current_agent.id),
            "classified_by_name": current_agent.name,
            "classified_at": now.isoformat(),
            "reason": body.reason,
            "previous_doc_type": old_doc_type,
        },
    }

    audit = AuditLog(
        id=uuid.uuid4(),
        action="DOCUMENT_CLASSIFY",
        table_name="documents",
        record_id=str(session_id),
        old_data={"document_id": str(document.id), "doc_type": old_doc_type},
        new_data={
            "document_id": str(document.id),
            "doc_type": primary_doc_type,
            "categories": categories,
            "agent_name": current_agent.name,
            "rationale": body.reason,
        },
        performed_by=current_agent.id,
        performed_at=now,
        client_ip=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    return DocumentClassifyResponse(
        session_id=session_id,
        document_id=doc_id,
        doc_type=primary_doc_type,
        categories=categories,
        classified_at=now,
    )


@router.post(
    "/dossier/{session_id}/review",
    response_model=ReviewDecisionResponse,
)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def submit_review_decision(
    request: Request,
    session_id: uuid.UUID,
    body: ReviewDecisionRequest,
    current_agent: Agent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db),
):
    """Submit a review decision on a KYC dossier."""
    result = await db.execute(
        select(KYCSession)
        .options(
            selectinload(KYCSession.assignments),
            selectinload(KYCSession.biometric_results),
            selectinload(KYCSession.aml_alerts),
        )
        .where(KYCSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Dossier not found")

    reviewable = _REVIEW_STATES | {LifecycleState.FRAUD_SUSPECT}
    if session.status not in reviewable:
        raise HTTPException(
            status_code=400,
            detail=f"Dossier in status '{session.status}' cannot be reviewed. "
            f"Expected one of: {sorted(reviewable)}",
        )

    if session.status == LifecycleState.FRAUD_SUSPECT:
        allowed = _ROLE_DECISIONS_FRAUD.get(current_agent.role, set())
        if body.decision != "REJECTED" or "REJECTED" not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="From FRAUD_SUSPECT, only REJECTED is allowed.",
            )
    else:
        allowed_decisions = _ROLE_DECISIONS.get(current_agent.role, set())
        if not allowed_decisions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_agent.role.value}' cannot review dossiers.",
            )
        if body.decision not in allowed_decisions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_agent.role.value}' cannot make decision '{body.decision}'. "
                f"Allowed: {sorted(allowed_decisions)}",
            )

    decision_to_status = {
        "APPROVED": LifecycleState.APPROVED,
        "REJECTED": LifecycleState.REJECTED,
        "INFO_REQUESTED": LifecycleState.PENDING_INFO,
        "FRAUD_SUSPECT": LifecycleState.FRAUD_SUSPECT,
    }
    new_status = decision_to_status.get(body.decision)
    if not new_status:
        raise HTTPException(status_code=400, detail=f"Invalid decision: {body.decision}")

    biometric_risk_flags = biometric_manual_review_reasons(session.biometric_results)
    if new_status == LifecycleState.APPROVED and biometric_risk_flags:
        if not body.biometric_override_confirmed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "BIOMETRIC_OVERRIDE_REQUIRED",
                    "message": "Biometric risk flags require explicit approval override.",
                    "biometric_risk_flags": biometric_risk_flags,
                },
            )

    if new_status == LifecycleState.APPROVED:
        open_aml_statuses = {"OPEN", "CONFIRMED", "ESCALATED", "PENDING"}
        active_aml_alerts = [
            alert for alert in session.aml_alerts if str(alert.status) in open_aml_statuses
        ]
        if active_aml_alerts:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "AML_CLEARANCE_REQUIRED",
                    "message": "Open AML alerts must be cleared by compliance before approval.",
                    "alert_ids": [str(alert.id) for alert in active_aml_alerts],
                },
            )

        duplicate_result = await db.execute(
            select(DuplicateCheck.id).where(
                (
                    (DuplicateCheck.session_id_new == session.id)
                    | (DuplicateCheck.session_id_existing == session.id)
                ),
                DuplicateCheck.status == "OPEN",
            )
        )
        active_duplicate_ids = [str(row[0]) for row in duplicate_result.all()]
        if active_duplicate_ids:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "DUPLICATE_CLEARANCE_REQUIRED",
                    "message": "Open duplicate checks must be resolved before approval.",
                    "duplicate_check_ids": active_duplicate_ids,
                },
            )

    new_access_level = LIFECYCLE_TO_ACCESS_TIER.get(new_status, AccessTier.RESTRICTED)

    old_status = session.status
    old_access_level = session.access_level
    session.status = new_status
    session.access_level = new_access_level
    now = datetime.now(timezone.utc)

    if new_status == LifecycleState.APPROVED:
        session.completed_at = now

    decision_record = ValidationDecision(
        id=uuid.uuid4(),
        session_id=session.id,
        agent_id=current_agent.id,
        decision=body.decision,
        reason=body.reason,
        agent_ip=request.client.host if request.client else None,
        decided_at=now,
    )
    db.add(decision_record)

    closed_agent_ids: set[uuid.UUID] = set()
    for assignment in session.assignments:
        if assignment.is_current and assignment.completed_at is None:
            assignment.completed_at = now
            assignment.is_current = False
            closed_agent_ids.add(assignment.agent_id)

    await db.flush()
    for agent_id in closed_agent_ids:
        await _sync_agent_active_count(db, agent_id)

    audit = AuditLog(
        id=uuid.uuid4(),
        action=f"KYC_REVIEW_{body.decision}",
        table_name="kyc_sessions",
        record_id=str(session.id),
        old_data={"status": old_status, "access_level": old_access_level},
        new_data={
            "status": new_status,
            "access_level": new_access_level,
            "agent_name": current_agent.name,
            "rationale": body.reason,
            "biometric_override_confirmed": (
                bool(body.biometric_override_confirmed)
                if new_status == LifecycleState.APPROVED and biometric_risk_flags
                else False
            ),
            "biometric_risk_flags": biometric_risk_flags,
        },
        performed_by=current_agent.id,
        performed_at=now,
        client_ip=request.client.host if request.client else None,
    )
    db.add(audit)

    notification_messages = {
        "APPROVED": "Votre dossier KYC a été approuvé ! Vous pouvez désormais accéder à vos services.",
        "REJECTED": f"Votre dossier KYC a été refusé. Motif : {body.reason}.",
        "INFO_REQUESTED": f"Des informations supplémentaires sont requises : {body.reason}. Veuillez vous connecter.",
        "FRAUD_SUSPECT": "Votre dossier est en cours de vérification approfondie.",
    }
    user_notification = Notification(
        id=uuid.uuid4(),
        user_id=session.user_id,
        type=f"KYC_{body.decision}",
        message=notification_messages.get(body.decision, "Mise à jour de votre dossier KYC."),
        payload={
            "session_id": str(session.id),
            "decision": body.decision,
            "reason": body.reason,
        },
        sent_at=now,
    )
    db.add(user_notification)

    event_by_decision = {
        "APPROVED": "KYC_APPROVED",
        "REJECTED": "KYC_REJECTED",
        "INFO_REQUESTED": "KYC_INFO_REQUESTED",
        "FRAUD_SUSPECT": "KYC_FRAUD_SUSPECT",
    }
    await track_event_best_effort(
        db,
        event_type=event_by_decision.get(body.decision, f"KYC_{body.decision}"),
        session_id=session.id,
        user_id=session.user_id,
        agent_id=current_agent.id,
        agency_id=session.agency_id,
        occurred_at=now,
        step="agent_review",
        status=new_status,
        request_id=_request_uuid(request),
    )

    await db.commit()

    logger.info(
        f"Agent {current_agent.id} ({current_agent.role.value}) reviewed session {session.id}: "
        f"{body.decision} → status={new_status}"
    )

    return ReviewDecisionResponse(
        session_id=session.id,
        decision=body.decision,
        new_status=new_status,
        new_access_level=new_access_level,
        decided_at=now,
        agent_id=current_agent.id,
        reason=body.reason,
    )


@router.post(
    "/dossier/{session_id}/assign",
    response_model=AssignDossierResponse,
)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def assign_dossier(
    request: Request,
    session_id: uuid.UUID,
    body: AssignDossierRequest,
    _agent: Agent = Depends(
        require_agent_role(AgentRole.JEAN, AgentRole.SYLVIE, AgentRole.ADMIN_IT)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Assign a dossier to a specific agent for review."""
    result = await db.execute(
        select(KYCSession).where(KYCSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Dossier not found")
    if session.status not in _REVIEW_STATES:
        raise HTTPException(
            status_code=400,
            detail=f"Dossier in status '{session.status}' cannot be assigned.",
        )

    result = await db.execute(select(Agent).where(Agent.id == body.agent_id))
    target_agent = result.scalar_one_or_none()
    if not target_agent:
        raise HTTPException(status_code=404, detail="Target agent not found")
    if not target_agent.is_available:
        raise HTTPException(status_code=400, detail="Target agent is not available")

    now = datetime.now(timezone.utc)
    previous_agent_ids: set[uuid.UUID] = set()
    result = await db.execute(
        select(DossierAssignment).where(
            DossierAssignment.session_id == session_id,
            DossierAssignment.is_current == True,  # noqa: E712
            DossierAssignment.completed_at == None,  # noqa: E711
        )
    )
    current_assignment = result.scalar_one_or_none()
    if current_assignment:
        current_assignment.completed_at = now
        current_assignment.is_current = False
        previous_agent_ids.add(current_assignment.agent_id)

    assignment = DossierAssignment(
        id=uuid.uuid4(),
        session_id=session_id,
        agent_id=body.agent_id,
        assigned_at=now,
        is_current=True,
    )
    db.add(assignment)

    await db.flush()
    for agent_id in previous_agent_ids | {target_agent.id}:
        await _sync_agent_active_count(db, agent_id)

    audit = AuditLog(
        id=uuid.uuid4(),
        action="DOSSIER_ASSIGN",
        table_name="dossier_assignments",
        record_id=str(session_id),
        new_data={"agent_id": str(body.agent_id), "assigned_to": target_agent.name, "assigned_by": _agent.name},
        performed_by=_agent.id,
        performed_at=now,
        client_ip=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    logger.info(f"Dossier {session_id} assigned to agent {target_agent.name} ({body.agent_id})")

    return AssignDossierResponse(
        session_id=session_id,
        agent_id=body.agent_id,
        agent_name=target_agent.name,
        assigned_at=now,
    )


@router.post(
    "/dossier/{session_id}/auto-assign",
    response_model=AutoAssignResponse,
)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def auto_assign_dossier(
    request: Request,
    session_id: uuid.UUID,
    _agent: Agent = Depends(
        require_agent_role(AgentRole.JEAN, AgentRole.SYLVIE, AgentRole.ADMIN_IT)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Auto-assign a dossier to the least loaded available JEAN agent.
    
    Algorithm:
    1. Find JEAN agents with same agency_id as the dossier (if set)
    2. Fallback to any available JEAN agent
    3. Pick the connected agent with the lowest live active queue count
    """
    result = await db.execute(
        select(KYCSession)
        .options(selectinload(KYCSession.agency))
        .where(KYCSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Dossier not found")
    if session.status not in _REVIEW_STATES:
        raise HTTPException(
            status_code=400,
            detail=f"Dossier in status '{session.status}' cannot be assigned.",
        )

    agent_query = select(Agent).where(
        Agent.role == AgentRole.JEAN,
        Agent.is_available == True,  # noqa: E712
    )

    target_agent = None
    if session.agency_id:
        same_agency = (
            select(Agent)
            .where(
                Agent.role == AgentRole.JEAN,
                Agent.is_available == True,  # noqa: E712
                Agent.agency_id == session.agency_id,
            )
            .order_by(Agent.name.asc())
        )
        result = await db.execute(same_agency)
        target_agent = await _least_loaded_connected_agent(
            db, list(result.scalars().all())
        )

        if not target_agent:
            result = await db.execute(
                agent_query.order_by(Agent.name.asc())
            )
            target_agent = await _least_loaded_connected_agent(
                db, list(result.scalars().all())
            )
    else:
        result = await db.execute(
            agent_query.order_by(Agent.name.asc())
        )
        target_agent = await _least_loaded_connected_agent(
            db, list(result.scalars().all())
        )

    if not target_agent:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Aucun agent JEAN disponible et connecte pour assigner ce dossier.",
        )

    now = datetime.now(timezone.utc)
    previous_agent_ids: set[uuid.UUID] = set()
    result = await db.execute(
        select(DossierAssignment).where(
            DossierAssignment.session_id == session_id,
            DossierAssignment.is_current == True,  # noqa: E712
            DossierAssignment.completed_at == None,  # noqa: E711
        )
    )
    current_assignment = result.scalar_one_or_none()
    if current_assignment:
        current_assignment.completed_at = now
        current_assignment.is_current = False
        previous_agent_ids.add(current_assignment.agent_id)

    assignment = DossierAssignment(
        id=uuid.uuid4(),
        session_id=session_id,
        agent_id=target_agent.id,
        assigned_at=now,
        is_current=True,
    )
    db.add(assignment)
    await db.flush()
    for agent_id in previous_agent_ids | {target_agent.id}:
        await _sync_agent_active_count(db, agent_id)

    audit = AuditLog(
        id=uuid.uuid4(),
        action="DOSSIER_AUTO_ASSIGN",
        table_name="dossier_assignments",
        record_id=str(session_id),
        new_data={
            "agent_id": str(target_agent.id),
            "assigned_to": target_agent.name,
            "method": "auto",
            "assigned_by": _agent.name,
        },
        performed_by=_agent.id,
        performed_at=now,
        client_ip=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    logger.info(f"Dossier {session_id} auto-assigned to agent {target_agent.name} ({target_agent.id})")

    return AutoAssignResponse(
        session_id=session_id,
        agent_id=target_agent.id,
        agent_name=target_agent.name,
        assigned_at=now,
        assignment_method="auto",
    )


@router.get(
    "/audit-logs",
    response_model=PageResponse[AuditLogSchema],
)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_audit_logs(
    request: Request,
    page: PageParams = Depends(),
    session_id: str | None = None,
    _agent: Agent = Depends(
        require_agent_role(AgentRole.JEAN, AgentRole.THOMAS, AgentRole.SYLVIE, AgentRole.ADMIN_IT)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Paginated audit log — most recent first."""
    query = select(AuditLog).order_by(AuditLog.performed_at.desc())
    if session_id:
        query = query.where(AuditLog.record_id == session_id)
    return await paginate(db, query, page, AuditLogSchema)


# =========================================================================
# SUPPORT THREADS
# =========================================================================


@router.get("/support/threads", response_model=list[SupportThreadSchema])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_support_threads(
    request: Request,
    session_id: uuid.UUID | None = None,
    _agent: Agent = Depends(
        require_agent_role(AgentRole.JEAN, AgentRole.THOMAS, AgentRole.SYLVIE)
    ),
    db: AsyncSession = Depends(get_db),
):
    """List support threads, optionally filtered by session."""
    query = select(SupportThread).options(
        selectinload(SupportThread.messages),
    ).order_by(SupportThread.created_at.desc())
    if session_id:
        query = query.where(SupportThread.session_id == session_id)
    result = await db.execute(query)
    threads = result.scalars().unique().all()
    return [
        SupportThreadSchema(
            id=t.id,
            session_id=t.session_id,
            status=t.status,
            created_at=t.created_at,
            message_count=len(t.messages),
        )
        for t in threads
    ]


@router.post("/support/threads", response_model=SupportThreadSchema, status_code=201)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def create_support_thread(
    request: Request,
    body: SupportThreadCreate,
    current_agent: Agent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db),
):
    """Create a new support thread for a session."""
    result = await db.execute(
        select(KYCSession).where(KYCSession.id == body.session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    thread = SupportThread(
        id=uuid.uuid4(),
        session_id=body.session_id,
        status="OPEN",
    )
    db.add(thread)
    await db.commit()
    await db.refresh(thread)

    logger.info(f"Support thread {thread.id} created for session {body.session_id} by agent {current_agent.id}")

    return SupportThreadSchema(
        id=thread.id,
        session_id=thread.session_id,
        status=thread.status,
        created_at=thread.created_at,
        message_count=0,
    )


@router.get("/support/threads/{thread_id}/messages", response_model=list[SupportMessageSchema])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_support_messages(
    request: Request,
    thread_id: uuid.UUID,
    _agent: Agent = Depends(
        require_agent_role(AgentRole.JEAN, AgentRole.THOMAS, AgentRole.SYLVIE)
    ),
    db: AsyncSession = Depends(get_db),
):
    """List all messages in a support thread."""
    thread_result = await db.execute(
        select(SupportThread).where(SupportThread.id == thread_id)
    )
    thread = thread_result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    result = await db.execute(
        select(SupportMessage)
        .where(SupportMessage.thread_id == thread_id)
        .order_by(SupportMessage.sent_at.asc())
    )
    messages = result.scalars().all()
    attachment_doc_ids: dict[uuid.UUID, uuid.UUID | None] = {}
    for message in messages:
        attachment_doc_ids[message.id] = await _resolve_attachment_document_id(
            db,
            thread.session_id,
            message.attachment_path,
            message.attachment_sha256,
        )
    return [
        SupportMessageSchema(
            id=m.id,
            thread_id=m.thread_id,
            sender_type=m.sender_type,
            sender_id=m.sender_id,
            content=m.content,
            attachment_path=m.attachment_path,
            attachment_sha256=m.attachment_sha256,
            attachment_filename=_attachment_filename(m.attachment_path),
            attachment_document_id=attachment_doc_ids.get(m.id),
            sent_at=m.sent_at,
            read_at=m.read_at,
        )
        for m in messages
    ]


@router.post("/support/threads/{thread_id}/messages", response_model=SupportMessageSchema, status_code=201)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def send_support_message(
    request: Request,
    thread_id: uuid.UUID,
    body: SupportMessageCreate,
    current_agent: Agent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db),
):
    """Send a message in a support thread (as an agent)."""
    result = await db.execute(
        select(SupportThread).where(SupportThread.id == thread_id)
    )
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    now = datetime.now(timezone.utc)
    message = SupportMessage(
        id=uuid.uuid4(),
        thread_id=thread_id,
        sender_type=current_agent.role.value,
        sender_id=current_agent.id,
        content=body.content,
        sent_at=now,
    )
    db.add(message)

    # Look up the session's user_id for the notification
    session_result = await db.execute(
        select(KYCSession.user_id).where(KYCSession.id == thread.session_id)
    )
    session_user_id = session_result.scalar_one_or_none()

    if session_user_id is None:
        logger.warning(
            "Skipping support notification for thread %s: session %s has no user",
            thread_id,
            thread.session_id,
        )
    else:
        notification = Notification(
            id=uuid.uuid4(),
            user_id=session_user_id,
            type="SUPPORT_MESSAGE",
            message=f"Nouveau message de l'agent : {body.content[:100]}",
            payload={
                "thread_id": str(thread_id),
                "session_id": str(thread.session_id),
            },
            sent_at=now,
        )
        db.add(notification)

    await db.commit()
    await db.refresh(message)

    logger.info(f"Agent {current_agent.id} sent message in thread {thread_id}")

    return SupportMessageSchema(
        id=message.id,
        thread_id=message.thread_id,
        sender_type=message.sender_type,
        sender_id=message.sender_id,
        content=message.content,
        attachment_path=message.attachment_path,
        attachment_sha256=message.attachment_sha256,
        attachment_filename=_attachment_filename(message.attachment_path),
        attachment_document_id=None,
        sent_at=message.sent_at,
        read_at=message.read_at,
    )


@router.get("/support/messages/{message_id}/attachment")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_support_message_attachment(
    request: Request,
    message_id: uuid.UUID,
    _agent: Agent = Depends(
        require_agent_role(AgentRole.JEAN, AgentRole.THOMAS, AgentRole.SYLVIE)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Download attachment linked to a support message."""
    result = await db.execute(
        select(SupportMessage).where(SupportMessage.id == message_id)
    )
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Support message not found")
    if not message.attachment_path:
        raise HTTPException(status_code=404, detail="No attachment for this message")

    resolved = _resolve_attachment_path(message.attachment_path)
    if not resolved.exists() or not resolved.is_file():
        raise HTTPException(status_code=404, detail="Attachment file not found on disk")

    download_name = _attachment_filename(message.attachment_path) or resolved.name
    return FileResponse(
        path=str(resolved),
        media_type=mimetypes.guess_type(resolved.name)[0]
        or "application/octet-stream",
        filename=download_name,
    )


@router.patch("/support/messages/{message_id}/read", status_code=200)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def mark_message_read(
    request: Request,
    message_id: uuid.UUID,
    _agent: Agent = Depends(
        require_agent_role(AgentRole.JEAN, AgentRole.THOMAS, AgentRole.SYLVIE)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Mark a support message as read."""
    result = await db.execute(
        select(SupportMessage).where(SupportMessage.id == message_id)
    )
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    message.read_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "read", "message_id": str(message_id)}


@router.post(
    "/support/messages/{message_id}/promote-to-document",
    response_model=PromoteAttachmentResponse,
)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def promote_support_attachment(
    request: Request,
    message_id: uuid.UUID,
    body: PromoteAttachmentRequest,
    current_agent: Agent = Depends(
        require_agent_role(AgentRole.JEAN, AgentRole.SYLVIE)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Promote a support message's attachment to an official KYC document."""
    # 1. Load support message
    result = await db.execute(
        select(SupportMessage)
        .options(selectinload(SupportMessage.thread))
        .where(SupportMessage.id == message_id)
    )
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Support message not found")
    if not message.attachment_path:
        raise HTTPException(
            status_code=400, detail="This message does not contain any attachment"
        )

    # 2. Check if already promoted (doublon check)
    session_id = message.thread.session_id
    existing_doc_id = await _resolve_attachment_document_id(
        db,
        session_id,
        message.attachment_path,
        message.attachment_sha256,
    )
    if existing_doc_id:
        raise HTTPException(
            status_code=400,
            detail="This attachment is already registered as a document in this session",
        )

    # 3. Get file info to create Document record
    resolved_path = _resolve_attachment_path(message.attachment_path)
    if not resolved_path.exists() or not resolved_path.is_file():
        raise HTTPException(
            status_code=404, detail="Attachment file not found on disk"
        )

    file_size = resolved_path.stat().st_size
    sha256_hash = message.attachment_sha256 or "unknown_hash"

    # Validate document categories & type
    categories = [c.strip().upper() for c in body.categories if c.strip()]
    if not categories:
        raise HTTPException(status_code=400, detail="At least one category is required")
    invalid = sorted(set(categories) - ALLOWED_DOC_CATEGORIES)
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid document categories: {', '.join(invalid)}",
        )

    primary_doc_type = body.doc_type.strip().upper()
    if primary_doc_type not in ALLOWED_DOC_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid doc_type")

    now = datetime.now(timezone.utc)

    # 4. Create Document entry
    document_id = uuid.uuid4()
    document = Document(
        id=document_id,
        session_id=session_id,
        doc_type=primary_doc_type,
        file_path=message.attachment_path,
        sha256_hash=sha256_hash,
        ocr_status="PENDING",
        captured_at=now,
        file_size_bytes=file_size,
        ocr_raw_json={
            "backoffice_classification": {
                "categories": categories,
                "primary_doc_type": primary_doc_type,
                "classified_by": str(current_agent.id),
                "classified_by_name": current_agent.name,
                "classified_at": now.isoformat(),
                "reason": body.reason,
                "promoted_from_support_message_id": str(message_id),
            }
        }
    )
    db.add(document)

    # 5. Create Audit Log
    audit = AuditLog(
        id=uuid.uuid4(),
        action="DOCUMENT_PROMOTE",
        table_name="documents",
        record_id=str(session_id),
        new_data={
            "document_id": str(document_id),
            "doc_type": primary_doc_type,
            "categories": categories,
            "agent_name": current_agent.name,
            "rationale": body.reason,
            "source_message_id": str(message_id),
        },
        performed_by=current_agent.id,
        performed_at=now,
        client_ip=request.client.host if request.client else None,
    )
    db.add(audit)

    await db.commit()

    logger.info(
        f"Agent {current_agent.id} promoted attachment from message {message_id} to document {document_id} (type={primary_doc_type})"
    )

    return PromoteAttachmentResponse(
        session_id=session_id,
        document_id=document_id,
        doc_type=primary_doc_type,
        categories=categories,
        promoted_at=now,
    )


# --- OCR Correction ---



class OcrCorrectRequest(BaseModel):
    document_id: str
    field_name: str
    corrected_value: str


@router.post("/dossier/{session_id}/ocr-correct", status_code=200)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def correct_ocr_field(
    request: Request,
    session_id: str,
    body: OcrCorrectRequest,
    current_agent: Agent = Depends(
        require_agent_role(AgentRole.JEAN, AgentRole.THOMAS, AgentRole.SYLVIE)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Allow an agent to correct an OCR field value."""
    try:
        session_uuid = uuid.UUID(session_id)
        doc_uuid = uuid.UUID(body.document_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    # Verify session exists
    session_result = await db.execute(
        select(KYCSession).where(KYCSession.id == session_uuid)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify document belongs to session
    doc_result = await db.execute(
        select(Document).where(
            Document.id == doc_uuid,
            Document.session_id == session_uuid,
        )
    )
    document = doc_result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found in this session")

    # Find the OCR field
    field_result = await db.execute(
        select(OCRField).where(
            OCRField.document_id == doc_uuid,
            OCRField.field_name == body.field_name,
        )
    )
    field = field_result.scalar_one_or_none()
    if not field:
        raise HTTPException(status_code=404, detail=f"OCR field '{body.field_name}' not found")

    # Update the field
    now = datetime.now(timezone.utc)
    field.corrected_value = body.corrected_value
    field.human_corrected = True
    field.corrected_by_agent_id = current_agent.id
    field.corrected_at = now

    # Create audit log
    audit = AuditLog(
        id=uuid.uuid4(),
        action="OCR_CORRECTION",
        table_name="ocr_fields",
        record_id=str(field.id),
        old_data={"extracted_value": field.extracted_value},
        new_data={
            "corrected_value": body.corrected_value,
            "field_name": body.field_name,
            "document_id": str(doc_uuid),
            "agent_name": current_agent.name,
            "rationale": f"Correction OCR: {body.field_name}",
        },
        performed_by=current_agent.id,
        performed_at=now,
    )
    db.add(audit)
    await track_event_best_effort(
        db,
        event_type="OCR_CORRECTED",
        session_id=session_uuid,
        user_id=session.user_id,
        agent_id=current_agent.id,
        agency_id=session.agency_id,
        step="ocr_correction",
        status=session.status,
        metadata={"field_name": body.field_name, "document_id": str(doc_uuid)},
        request_id=_request_uuid(request),
    )
    await record_ocr_performance_best_effort(db, doc_uuid)

    await db.commit()

    logger.info(
        f"Agent {current_agent.id} corrected OCR field '{body.field_name}' "
        f"for document {doc_uuid} in session {session_id}"
    )

    return {
        "status": "corrected",
        "field_name": body.field_name,
        "corrected_value": body.corrected_value,
        "corrected_by": str(current_agent.id),
        "corrected_at": now.isoformat(),
    }
