import uuid as _uuid

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import app.db.base  # noqa — ensures all mappers are registered
from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.pagination import PageParams, PageResponse, paginate
from app.core.security import get_current_agent, require_agent_role, hash_password
from app.core.logging import logger
from app.db.session import get_db
from app.modules.auth.models import AgentRole, Agent, User
from app.modules.auth.schemas import (
    AdminAgentCreateRequest,
    AdminAgentUpdateRequest,
    AdminAgentResetPasswordRequest,
    AdminAgentResponse,
)
from app.modules.admin.schemas import UserSchema
from app.modules.audit.models import AuditLog

router = APIRouter()


@router.get("/")
async def get_root(_agent=Depends(require_agent_role(AgentRole.ADMIN_IT))):
    return {"module": "admin", "status": "initialized"}


@router.get(
    "/users",
    response_model=PageResponse[UserSchema],
    dependencies=[Depends(require_agent_role(AgentRole.ADMIN_IT))],
)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_users(
    request: Request,
    current_agent: User = Depends(get_current_agent),
    page: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Paginated user list — most recently created first.

    Access: ADMIN_IT only
    """
    query = select(User).order_by(User.created_at.desc())
    return await paginate(db, query, page, UserSchema)


# ============================================================
# AGENT CRUD (Story 1.4 — ADMIN_IT)
# ============================================================


def _agent_to_response(agent: Agent) -> AdminAgentResponse:
    return AdminAgentResponse(
        id=str(agent.id),
        name=agent.name,
        email=agent.email,
        role=agent.role.value if hasattr(agent.role, "value") else str(agent.role),
        agency_id=str(agent.agency_id) if agent.agency_id else None,
        is_available=agent.is_available,
        active_dossier_count=agent.active_dossier_count,
        last_activity_at=agent.last_activity_at.isoformat() if agent.last_activity_at else None,
    )


@router.get("/agents", response_model=PageResponse[AdminAgentResponse])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_agents(
    request: Request,
    _agent: Agent = Depends(require_agent_role(AgentRole.ADMIN_IT)),
    page: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Paginated agent list. Access: ADMIN_IT only."""
    query = select(Agent).order_by(Agent.name.asc())
    total = (await db.execute(select(func.count()).select_from(Agent))).scalar_one()
    result = await db.execute(query.offset(page.offset).limit(page.limit))
    agents = result.scalars().all()
    return PageResponse[AdminAgentResponse](
        items=[_agent_to_response(agent) for agent in agents],
        total=total,
        page=page.page,
        pages=(total + page.limit - 1) // page.limit if total else 1,
        limit=page.limit,
    )


def _agent_audit_payload(agent: Agent) -> dict:
    return {
        "agent_id": str(agent.id),
        "name": agent.name,
        "email": agent.email,
        "role": agent.role.value if hasattr(agent.role, "value") else str(agent.role),
        "agency_id": str(agent.agency_id) if agent.agency_id else None,
        "is_available": agent.is_available,
    }


def _add_admin_audit(
    db: AsyncSession,
    *,
    action: str,
    target_agent: Agent,
    admin_agent: Agent,
    request: Request,
    old_data: dict | None = None,
    new_data: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            id=_uuid.uuid4(),
            action=action,
            table_name="agents",
            record_id=str(target_agent.id),
            old_data=old_data,
            new_data=new_data,
            performed_by=admin_agent.id,
            performed_at=datetime.now(timezone.utc),
            client_ip=request.client.host if request.client else None,
        )
    )


@router.post("/agents", response_model=AdminAgentResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def create_agent(
    request: Request,
    body: AdminAgentCreateRequest,
    _agent: Agent = Depends(require_agent_role(AgentRole.ADMIN_IT)),
    db: AsyncSession = Depends(get_db),
):
    """Create a new agent account. Access: ADMIN_IT only."""
    # Check for duplicate email
    existing = await db.execute(select(Agent).where(Agent.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Agent with email '{body.email}' already exists.",
        )

    agency_id = _uuid.UUID(body.agency_id) if body.agency_id else None
    agent = Agent(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=AgentRole(body.role),
        agency_id=agency_id,
    )
    db.add(agent)
    await db.flush()
    _add_admin_audit(
        db,
        action="ADMIN_AGENT_CREATE",
        target_agent=agent,
        admin_agent=_agent,
        request=request,
        new_data=_agent_audit_payload(agent),
    )
    await db.commit()
    await db.refresh(agent)

    logger.info(f"Agent created: {agent.email} (role={agent.role}) by admin")
    return _agent_to_response(agent)


@router.patch("/agents/{agent_id}", response_model=AdminAgentResponse)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def update_agent(
    request: Request,
    agent_id: str,
    body: AdminAgentUpdateRequest,
    _agent: Agent = Depends(require_agent_role(AgentRole.ADMIN_IT)),
    db: AsyncSession = Depends(get_db),
):
    """Update agent account fields. Access: ADMIN_IT only."""
    try:
        parsed_uuid = _uuid.UUID(agent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid agent ID format.")

    result = await db.execute(select(Agent).where(Agent.id == parsed_uuid))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    old_data = _agent_audit_payload(agent)
    if body.name is not None:
        agent.name = body.name
    if body.email is not None:
        # Check for duplicate email (excluding self)
        existing = await db.execute(
            select(Agent).where(Agent.email == body.email, Agent.id != parsed_uuid)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Agent with email '{body.email}' already exists.",
            )
        agent.email = body.email
    if body.role is not None:
        agent.role = AgentRole(body.role)
    if body.is_available is not None:
        agent.is_available = body.is_available
    if body.agency_id is not None:
        agent.agency_id = _uuid.UUID(body.agency_id) if body.agency_id else None

    _add_admin_audit(
        db,
        action="ADMIN_AGENT_UPDATE",
        target_agent=agent,
        admin_agent=_agent,
        request=request,
        old_data=old_data,
        new_data=_agent_audit_payload(agent),
    )
    await db.commit()
    await db.refresh(agent)

    logger.info(f"Agent updated: {agent.email} by admin")
    return _agent_to_response(agent)


@router.post("/agents/{agent_id}/reset-password")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def reset_agent_password(
    request: Request,
    agent_id: str,
    body: AdminAgentResetPasswordRequest,
    _agent: Agent = Depends(require_agent_role(AgentRole.ADMIN_IT)),
    db: AsyncSession = Depends(get_db),
):
    """Reset an agent's password. Access: ADMIN_IT only."""
    try:
        parsed_uuid = _uuid.UUID(agent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid agent ID format.")

    result = await db.execute(select(Agent).where(Agent.id == parsed_uuid))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    agent.password_hash = hash_password(body.new_password)
    _add_admin_audit(
        db,
        action="ADMIN_AGENT_PASSWORD_RESET",
        target_agent=agent,
        admin_agent=_agent,
        request=request,
        new_data={"agent_id": str(agent.id), "password_reset": True},
    )
    await db.commit()

    logger.info(f"Agent password reset: {agent.email} by admin")
    return {"status": "success", "message": "Password reset successfully"}


@router.delete("/agents/{agent_id}", status_code=status.HTTP_200_OK)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def deactivate_agent(
    request: Request,
    agent_id: str,
    _agent: Agent = Depends(require_agent_role(AgentRole.ADMIN_IT)),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate an agent (set is_available=False, cannot be deleted due to FK constraints). Access: ADMIN_IT only."""
    try:
        parsed_uuid = _uuid.UUID(agent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid agent ID format.")

    result = await db.execute(select(Agent).where(Agent.id == parsed_uuid))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    old_data = _agent_audit_payload(agent)
    agent.is_available = False
    _add_admin_audit(
        db,
        action="ADMIN_AGENT_DEACTIVATE",
        target_agent=agent,
        admin_agent=_agent,
        request=request,
        old_data=old_data,
        new_data=_agent_audit_payload(agent),
    )
    await db.commit()

    logger.info(f"Agent deactivated: {agent.email} by admin")
    return {"status": "success", "message": "Agent deactivated"}
