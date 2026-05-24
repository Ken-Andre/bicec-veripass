"""Module AML/CFT API Routes."""

from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.security import require_agent_role
from app.db.session import get_db
from app.modules.auth.models import AgentRole
from app.modules.aml import service
from app.modules.aml.schemas import (
    AmlAlertResponse,
    AmlAlertAction,
    AmlEscalation,
    NiuConflictResponse,
    NiuConflictResolve,
    AgencyResponse,
    AgencyCreate,
    AgencyUpdate,
    BatchJobResponse,
)

router = APIRouter()


@router.get("/")
async def get_root(_agent=Depends(require_agent_role(AgentRole.THOMAS, AgentRole.SYLVIE, AgentRole.ADMIN_IT))):
    return {"module": "aml", "status": "active"}


# ===== AML Alerts =====
@router.get("/alerts", response_model=list[AmlAlertResponse])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_aml_alerts(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.THOMAS, AgentRole.SYLVIE)),
):
    """Liste des alertes AML en attente."""
    alerts = await service.get_aml_alerts(db)
    return alerts


@router.get("/alerts/{alert_id}", response_model=AmlAlertResponse)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_aml_alert(
    request: Request,
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.THOMAS, AgentRole.SYLVIE)),
):
    """Détails d'une alerte AML spécifique."""
    alert = await service.get_aml_alert_by_id(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.post("/alerts/{alert_id}/clear")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def clear_aml_alert(
    request: Request,
    alert_id: str,
    body: AmlAlertAction,
    db: AsyncSession = Depends(get_db),
    agent=Depends(require_agent_role(AgentRole.THOMAS)),
):
    """Classe une alerte AML sans suite (faux positif)."""
    success = await service.clear_aml_alert(db, alert_id, body.justification)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "cleared", "alert_id": alert_id}


@router.post("/alerts/{alert_id}/confirm")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def confirm_aml_alert(
    request: Request,
    alert_id: str,
    body: AmlAlertAction,
    db: AsyncSession = Depends(get_db),
    agent=Depends(require_agent_role(AgentRole.THOMAS)),
):
    """Confirme un risque AML."""
    success = await service.confirm_aml_alert(db, alert_id, body.justification)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "confirmed", "alert_id": alert_id}


@router.post("/alerts/{alert_id}/escalate")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def escalate_aml_alert(
    request: Request,
    alert_id: str,
    body: AmlEscalation,
    db: AsyncSession = Depends(get_db),
    agent=Depends(require_agent_role(AgentRole.THOMAS, AgentRole.SYLVIE)),
):
    """Escale une alerte AML au niveau supérieur."""
    success = await service.escalate_aml_alert(db, alert_id, body.reason)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "escalated", "alert_id": alert_id}


# ===== NIU Conflicts =====
@router.get("/niu-conflicts", response_model=list[NiuConflictResponse])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_niu_conflicts(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.THOMAS, AgentRole.SYLVIE)),
):
    """Liste des conflits NIU détectés (déduplication)."""
    conflicts = await service.get_niu_conflicts(db)
    return conflicts


@router.post("/niu-conflicts/{conflict_id}/resolve")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def resolve_niu_conflict(
    request: Request,
    conflict_id: str,
    body: NiuConflictResolve,
    db: AsyncSession = Depends(get_db),
    agent=Depends(require_agent_role(AgentRole.THOMAS)),
):
    """Résout un conflit NIU (fusion ou fraude)."""
    success = await service.resolve_niu_conflict(
        db, conflict_id, body.action.value, body.justification
    )
    if not success:
        raise HTTPException(status_code=404, detail="Conflict not found")
    return {"status": body.action.value, "conflict_id": conflict_id}


# ===== Agencies =====
@router.get("/agencies", response_model=list[AgencyResponse])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_agencies(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(
        require_agent_role(AgentRole.THOMAS, AgentRole.ADMIN_IT, AgentRole.SYLVIE)
    ),
):
    """Liste de toutes les agences."""
    agencies = await service.get_agencies(db)
    return agencies


@router.post("/agencies", status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def create_agency(
    request: Request,
    body: AgencyCreate,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.ADMIN_IT, AgentRole.THOMAS)),
):
    """Crée une nouvelle agence."""
    agency = await service.create_agency(db, body.code, body.name, body.city)
    return agency


@router.put("/agencies/{agency_id}")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def update_agency_route(
    request: Request,
    agency_id: str,
    body: AgencyUpdate,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.ADMIN_IT, AgentRole.THOMAS)),
):
    """Met à jour une agence."""
    update_dict = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    agency = await service.update_agency(db, agency_id, **update_dict)
    if not agency:
        raise HTTPException(status_code=404, detail="Agency not found")
    return agency


@router.delete("/agencies/{agency_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def delete_agency_route(
    request: Request,
    agency_id: str,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.ADMIN_IT, AgentRole.THOMAS)),
):
    """Supprime une agence."""
    success = await service.delete_agency(db, agency_id)
    if not success:
        raise HTTPException(status_code=404, detail="Agency not found")


# ===== Batch Jobs =====
@router.get("/batch-jobs", response_model=list[BatchJobResponse])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_batch_jobs(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.THOMAS, AgentRole.SYLVIE)),
):
    """Liste des jobs batch de provisionnement Amplitude."""
    jobs = await service.get_batch_jobs(db)
    return jobs


@router.post("/batch-jobs/trigger", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def trigger_batch_job(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.THOMAS)),
):
    """Déclenche un job batch de provisionnement Amplitude."""
    # TODO: Récupérer les sessions en attente de provisionnement
    session_ids = []
    job_id = await service.trigger_amplitude_batch(db, session_ids)
    return {"job_id": job_id, "status": "triggered"}
