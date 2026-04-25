"""Backoffice router — Agent review workflow per ADR-001.

Endpoints:
- GET  /queue           — Paginated KYC dossier queue (JEAN, THOMAS, SYLVIE, ADMIN_IT)
- GET  /dossier/{id}    — Full dossier detail for side-by-side review (J08)
- POST /dossier/{id}/review  — Submit review decision (APPROVED/REJECTED/INFO_REQUESTED/FRAUD_SUSPECT)
- POST /dossier/{id}/assign  — Assign dossier to an agent
- GET  /audit-logs      — Paginated audit log (THOMAS, SYLVIE, ADMIN_IT)
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

import app.db.base  # noqa — ensures all mappers (Agency, etc.) are registered
from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.pagination import PageParams, PageResponse, paginate
from app.core.security import require_agent_role, get_current_agent
from app.core.logging import logger
from app.db.session import get_db
from app.modules.auth.models import Agent, AgentRole
from app.modules.kyc.models import (
    KYCSession,
    Document,
    ValidationDecision,
    DossierAssignment,
    AmlAlert,
    BiometricResult,
    ConsentRecord,
    Notification,
)
from app.modules.kyc.schemas import (
    LifecycleState,
    AccessTier,
    LIFECYCLE_TO_ACCESS_TIER,
)
from app.modules.audit.models import AuditLog
from app.modules.backoffice.schemas import (
    KYCQueueItemSchema,
    AuditLogSchema,
    DossierDetailSchema,
    DossierDocumentBrief,
    DossierBiometricBrief,
    DossierDecisionBrief,
    DossierAmlAlertBrief,
    ReviewDecisionRequest,
    ReviewDecisionResponse,
    AssignDossierRequest,
    AssignDossierResponse,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Valid review decisions per agent role (ADR-001 §3)
# ---------------------------------------------------------------------------
_ROLE_DECISIONS: dict[AgentRole, set[str]] = {
    # Decisions allowed from PENDING_AGENT_REVIEW state
    AgentRole.JEAN: {"APPROVED", "REJECTED", "INFO_REQUESTED"},
    AgentRole.THOMAS: {"FRAUD_SUSPECT", "INFO_REQUESTED"},
    AgentRole.SYLVIE: {"APPROVED", "REJECTED", "INFO_REQUESTED", "FRAUD_SUSPECT"},
    AgentRole.ADMIN_IT: set(),  # ADMIN_IT does not review dossiers
}

# Decisions allowed from FRAUD_SUSPECT state (ADR-001: only REJECTED = Investigation Clear)
_ROLE_DECISIONS_FRAUD: dict[AgentRole, set[str]] = {
    AgentRole.THOMAS: {"REJECTED"},  # Only Thomas can clear investigation
    AgentRole.SYLVIE: {"REJECTED"},  # Sylvie as escalation override
}

# States that require agent review and appear in the queue
_REVIEW_STATES = {
    LifecycleState.PENDING_AGENT_REVIEW,
    LifecycleState.PENDING_KYC,  # legacy alias
}


@router.get("/")
async def get_root():
    return {"module": "backoffice", "status": "initialized"}


# ---------------------------------------------------------------------------
# Queue — list dossiers awaiting review
# ---------------------------------------------------------------------------

@router.get(
    "/queue",
    response_model=PageResponse[KYCQueueItemSchema],
)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_queue(
    request: Request,
    page: PageParams = Depends(),
    _agent: Agent = Depends(
        require_agent_role(AgentRole.JEAN, AgentRole.THOMAS, AgentRole.SYLVIE, AgentRole.ADMIN_IT)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Paginated KYC session queue — dossiers awaiting agent review.

    Shows PENDING_AGENT_REVIEW and PENDING_KYC sessions, priority first,
    oldest submission first (FIFO within priority).

    Access: JEAN, THOMAS, SYLVIE, ADMIN_IT
    """
    # Fetch sessions with eager-loaded relations to avoid N+1
    # We build KYCQueueItemSchema manually from the eager-loaded data
    offset = page.offset
    limit = page.limit
    base_query = (
        select(KYCSession)
        .where(KYCSession.status.in_(_REVIEW_STATES))
        .options(
            selectinload(KYCSession.user),
            selectinload(KYCSession.assignments).selectinload(DossierAssignment.agent),
        )
        .order_by(KYCSession.priority_flag.desc(), KYCSession.submitted_at.asc())
    )

    # Count total
    count_query = select(func.count()).select_from(
        select(KYCSession.id)
        .where(KYCSession.status.in_(_REVIEW_STATES))
        .subquery()
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch page
    result = await db.execute(
        base_query.offset(offset).limit(limit)
    )
    sessions = result.scalars().unique().all()

    # Build items from eager-loaded data
    items = []
    for session in sessions:
        user_phone = session.user.phone if session.user else None
        assigned_agent_name = None
        current = next(
            (a for a in session.assignments if a.is_current and a.completed_at is None),
            None,
        )
        if current and current.agent:
            assigned_agent_name = current.agent.name
        items.append(KYCQueueItemSchema(
            id=session.id,
            status=session.status,
            access_level=session.access_level,
            priority_flag=session.priority_flag,
            started_at=session.started_at,
            submitted_at=session.submitted_at,
            user_phone=user_phone,
            assigned_agent_name=assigned_agent_name,
        ))

    total_pages = (total + limit - 1) // limit if total > 0 else 1
    return PageResponse(
        items=items,
        total=total,
        page=page.page,
        limit=limit,
        pages=total_pages,
    )


# ---------------------------------------------------------------------------
# Dossier Detail — full data for side-by-side review
# ---------------------------------------------------------------------------

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
    """Full dossier detail for agent side-by-side review (J08).

    Access: JEAN, THOMAS, SYLVIE
    """
    result = await db.execute(
        select(KYCSession)
        .options(
            selectinload(KYCSession.user),
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

    # Build document briefs
    doc_briefs: list[DossierDocumentBrief] = []
    for doc in session.documents:
        confidences = [float(f.confidence_score) for f in doc.ocr_fields]
        avg_conf = sum(confidences) / len(confidences) if confidences else None
        doc_briefs.append(
            DossierDocumentBrief(
                id=doc.id,
                doc_type=doc.doc_type,
                sha256_hash=doc.sha256_hash,
                ocr_engine=doc.ocr_engine,
                captured_at=doc.captured_at,
                field_count=len(doc.ocr_fields),
                avg_confidence=avg_conf,
            )
        )

    # Build biometric brief
    bio_brief: DossierBiometricBrief | None = None
    if session.biometric_results:
        bio_brief = DossierBiometricBrief(
            id=session.biometric_results.id,
            face_match_score=float(session.biometric_results.face_match_score)
            if session.biometric_results.face_match_score
            else None,
            liveness_score=float(session.biometric_results.liveness_score)
            if session.biometric_results.liveness_score
            else None,
            anti_spoofing_score=float(session.biometric_results.anti_spoofing_score)
            if session.biometric_results.anti_spoofing_score
            else None,
            processed_at=session.biometric_results.processed_at,
        )

    # Build decision briefs
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

    # Build AML alert briefs
    aml_briefs = [
        DossierAmlAlertBrief(
            id=a.id,
            alert_type=a.alert_type,
            match_score=float(a.match_score),
            status=a.status,
        )
        for a in session.aml_alerts
    ]

    # Current assignment
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
        user_phone=session.user.phone if session.user else None,
        documents=doc_briefs,
        biometric_result=bio_brief,
        has_consent=session.consent_record is not None,
        consent_method=session.consent_record.consent_method if session.consent_record else None,
        signed_at=session.consent_record.signed_at if session.consent_record else None,
        decisions=decision_briefs,
        aml_alerts=aml_briefs,
        assigned_agent_id=assigned_agent_id,
        assigned_agent_name=assigned_agent_name,
    )


# ---------------------------------------------------------------------------
# Review Decision — agent approves/rejects/flags a dossier
# ---------------------------------------------------------------------------

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
    """Submit a review decision on a KYC dossier.

    Per ADR-001 §3:
    - JEAN: APPROVED, REJECTED, INFO_REQUESTED
    - THOMAS: FRAUD_SUSPECT, INFO_REQUESTED
    - SYLVIE: all decisions (escalation override)

    Transitions per decision:
    - APPROVED → status=APPROVED, access_level=LIMITED_ACCESS
    - REJECTED → status=REJECTED, access_level=GUEST
    - INFO_REQUESTED → status=PENDING_INFO, access_level=RESTRICTED
    - FRAUD_SUSPECT → status=FRAUD_SUSPECT, access_level=DISABLED

    Access: JEAN, THOMAS, SYLVIE (role-dependent decisions)
    """
    # Fetch session first (need status for state-aware role check)
    result = await db.execute(
        select(KYCSession)
        .options(selectinload(KYCSession.assignments))
        .where(KYCSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Dossier not found")

    # Only reviewable states (ADR-001: PENDING_AGENT_REVIEW or FRAUD_SUSPECT)
    reviewable = _REVIEW_STATES | {LifecycleState.FRAUD_SUSPECT}
    if session.status not in reviewable:
        raise HTTPException(
            status_code=400,
            detail=f"Dossier in status '{session.status}' cannot be reviewed. "
            f"Expected one of: {sorted(reviewable)}",
        )

    # State-aware role check (ADR-001 §3)
    if session.status == LifecycleState.FRAUD_SUSPECT:
        # From FRAUD_SUSPECT, only REJECTED is allowed (investigation clear)
        allowed = _ROLE_DECISIONS_FRAUD.get(current_agent.role, set())
        if body.decision != "REJECTED" or "REJECTED" not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"From FRAUD_SUSPECT, only REJECTED is allowed (investigation clear). "
                f"Role '{current_agent.role.value}' is not authorized to clear this state.",
            )
    else:
        # From PENDING_AGENT_REVIEW, use standard role-based decisions
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

    # Compute new status and access level per ADR-001
    decision_to_status = {
        "APPROVED": LifecycleState.APPROVED,
        "REJECTED": LifecycleState.REJECTED,
        "INFO_REQUESTED": LifecycleState.PENDING_INFO,
        "FRAUD_SUSPECT": LifecycleState.FRAUD_SUSPECT,
    }
    new_status = decision_to_status.get(body.decision)
    if not new_status:
        raise HTTPException(status_code=400, detail=f"Invalid decision: {body.decision}")

    new_access_level = LIFECYCLE_TO_ACCESS_TIER.get(new_status, AccessTier.RESTRICTED)

    # Apply transition
    old_status = session.status
    old_access_level = session.access_level
    session.status = new_status
    session.access_level = new_access_level
    now = datetime.now(timezone.utc)

    if new_status == LifecycleState.APPROVED:
        session.completed_at = now

    # Create ValidationDecision record
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

    # Complete current assignment if any
    for assignment in session.assignments:
        if assignment.is_current and assignment.completed_at is None:
            assignment.completed_at = now
            assignment.is_current = False

    # Audit log (COBAC R-2023/01 compliance)
    audit = AuditLog(
        id=uuid.uuid4(),
        action=f"KYC_REVIEW_{body.decision}",
        table_name="kyc_sessions",
        record_id=str(session.id),
        old_data={"status": old_status, "access_level": old_access_level},
        new_data={"status": new_status, "access_level": new_access_level},
        performed_by=current_agent.id,
        performed_at=now,
        client_ip=request.client.host if request.client else None,
    )
    db.add(audit)

    # Create user notification about the decision
    notification_messages = {
        "APPROVED": "Votre dossier KYC a été approuvé ! Vous pouvez désormais accéder à vos services.",
        "REJECTED": f"Votre dossier KYC a été refusé. Motif : {body.reason}. Vous pouvez recommencer la procédure.",
        "INFO_REQUESTED": f"Des informations supplémentaires sont requises pour votre dossier : {body.reason}. Veuillez vous connecter pour les fournir.",
        "FRAUD_SUSPECT": "Votre dossier est en cours de vérification approfondie. Notre équipe vous contactera.",
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

    await db.commit()

    logger.info(
        f"Agent {current_agent.id} ({current_agent.role.value}) reviewed session {session.id}: "
        f"{body.decision} → status={new_status}, access_level={new_access_level}"
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


# ---------------------------------------------------------------------------
# Assign Dossier — route dossier to a specific agent
# ---------------------------------------------------------------------------

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
    """Assign a dossier to a specific agent for review.

    Access: JEAN, SYLVIE, ADMIN_IT (Thomas focuses on AML, not manual assignment)
    """
    # Verify session exists and is reviewable
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

    # Verify target agent exists and is available
    result = await db.execute(select(Agent).where(Agent.id == body.agent_id))
    target_agent = result.scalar_one_or_none()
    if not target_agent:
        raise HTTPException(status_code=404, detail="Target agent not found")
    if not target_agent.is_available:
        raise HTTPException(status_code=400, detail="Target agent is not available")

    # Mark any current assignment as completed
    result = await db.execute(
        select(DossierAssignment).where(
            DossierAssignment.session_id == session_id,
            DossierAssignment.is_current == True,  # noqa: E712
            DossierAssignment.completed_at == None,  # noqa: E711
        )
    )
    current_assignment = result.scalar_one_or_none()
    if current_assignment:
        current_assignment.completed_at = datetime.now(timezone.utc)
        current_assignment.is_current = False

    # Create new assignment
    now = datetime.now(timezone.utc)
    assignment = DossierAssignment(
        id=uuid.uuid4(),
        session_id=session_id,
        agent_id=body.agent_id,
        assigned_at=now,
        is_current=True,
    )
    db.add(assignment)

    # Update agent's active dossier count
    target_agent.active_dossier_count = (target_agent.active_dossier_count or 0) + 1

    # Audit log
    audit = AuditLog(
        id=uuid.uuid4(),
        action="DOSSIER_ASSIGN",
        table_name="dossier_assignments",
        record_id=str(session_id),
        new_data={"agent_id": str(body.agent_id), "agent_name": target_agent.name},
        performed_by=_agent.id,
        performed_at=now,
        client_ip=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    logger.info(
        f"Dossier {session_id} assigned to agent {target_agent.name} ({body.agent_id})"
    )

    return AssignDossierResponse(
        session_id=session_id,
        agent_id=body.agent_id,
        agent_name=target_agent.name,
        assigned_at=now,
    )


# ---------------------------------------------------------------------------
# Audit Logs
# ---------------------------------------------------------------------------

@router.get(
    "/audit-logs",
    response_model=PageResponse[AuditLogSchema],
)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_audit_logs(
    request: Request,
    page: PageParams = Depends(),
    _agent: Agent = Depends(
        require_agent_role(AgentRole.THOMAS, AgentRole.SYLVIE, AgentRole.ADMIN_IT)
    ),
    db: AsyncSession = Depends(get_db),
):
    """Paginated audit log — most recent first.

    Access: THOMAS, SYLVIE, ADMIN_IT
    """
    query = select(AuditLog).order_by(AuditLog.performed_at.desc())
    return await paginate(db, query, page, AuditLogSchema)
