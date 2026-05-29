"""AML/CFT API routes."""

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.security import require_agent_role
from app.db.session import get_db
from app.modules.aml import service
from app.modules.aml.schemas import (
    AgencyCreate,
    AgencyResponse,
    AgencyUpdate,
    AmlAlertAction,
    AmlAlertResponse,
    AmlEscalation,
    AmlListImportReport,
    AmlListRegistryItem,
    BatchJobResponse,
    DocumentExpiryListResponse,
    GlobalNotificationRequest,
    GlobalNotificationResponse,
    NiuConflictResolve,
    NiuConflictResponse,
)
from app.modules.auth.models import Agent, AgentRole

router = APIRouter()


@router.get("/")
async def get_root(
    _agent=Depends(require_agent_role(AgentRole.THOMAS, AgentRole.SYLVIE, AgentRole.ADMIN_IT)),
):
    return {"module": "aml", "status": "active"}


@router.get("/alerts", response_model=list[AmlAlertResponse])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_aml_alerts(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.THOMAS, AgentRole.SYLVIE)),
):
    return await service.get_aml_alerts(db)


@router.get("/alerts/{alert_id}", response_model=AmlAlertResponse)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_aml_alert(
    request: Request,
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.THOMAS, AgentRole.SYLVIE)),
):
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
    success = await service.clear_aml_alert(db, alert_id, body.justification, agent)
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
    success = await service.confirm_aml_alert(
        db,
        alert_id,
        body.justification,
        agent,
        request.client.host if request.client else None,
    )
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
    success = await service.escalate_aml_alert(db, alert_id, body.reason, agent)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "escalated", "alert_id": alert_id}


@router.get("/niu-conflicts", response_model=list[NiuConflictResponse])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_niu_conflicts(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.THOMAS, AgentRole.SYLVIE)),
):
    return await service.get_niu_conflicts(db)


@router.post("/niu-conflicts/{conflict_id}/resolve")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def resolve_niu_conflict(
    request: Request,
    conflict_id: str,
    body: NiuConflictResolve,
    db: AsyncSession = Depends(get_db),
    agent=Depends(require_agent_role(AgentRole.THOMAS)),
):
    success = await service.resolve_niu_conflict(
        db,
        conflict_id,
        body.action.value,
        body.justification,
        agent,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Conflict not found")
    return {"status": body.action.value, "conflict_id": conflict_id}


@router.get("/document-expiry", response_model=DocumentExpiryListResponse)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_document_expiry(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.THOMAS, AgentRole.SYLVIE)),
):
    return await service.get_document_expiry_alerts(db, page=page, limit=limit)


@router.get("/lists", response_model=list[AmlListRegistryItem])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_aml_lists(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.THOMAS, AgentRole.SYLVIE, AgentRole.ADMIN_IT)),
):
    return await service.get_aml_list_registry(db)


@router.get("/lists/template")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def download_aml_list_template(
    request: Request,
    _agent=Depends(require_agent_role(AgentRole.THOMAS, AgentRole.ADMIN_IT)),
):
    return Response(
        content=service.aml_import_template_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="bicec_aml_list_template.csv"'},
    )


@router.post("/lists/import/dry-run", response_model=AmlListImportReport)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def dry_run_aml_list_import(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    agent: Agent = Depends(require_agent_role(AgentRole.THOMAS, AgentRole.ADMIN_IT)),
):
    content = (await file.read()).decode("utf-8-sig")
    return await service.import_aml_list_csv(
        db,
        csv_text=content,
        filename=file.filename,
        dry_run=True,
        agent=agent,
    )


@router.post("/lists/import", response_model=AmlListImportReport)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def confirm_aml_list_import(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    agent: Agent = Depends(require_agent_role(AgentRole.THOMAS, AgentRole.ADMIN_IT)),
):
    content = (await file.read()).decode("utf-8-sig")
    return await service.import_aml_list_csv(
        db,
        csv_text=content,
        filename=file.filename,
        dry_run=False,
        agent=agent,
    )


@router.post("/notify-global", response_model=GlobalNotificationResponse)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def notify_global(
    request: Request,
    body: GlobalNotificationRequest,
    db: AsyncSession = Depends(get_db),
    agent=Depends(require_agent_role(AgentRole.THOMAS, AgentRole.SYLVIE)),
):
    result = await service.notify_global_regulatory_event(
        db,
        notification_type=body.type,
        message=body.message,
        reason=body.reason,
        agent=agent,
    )
    return {"created": result["created"], "eventKey": result["event_key"]}


@router.get("/agencies", response_model=list[AgencyResponse])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_agencies(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.THOMAS, AgentRole.ADMIN_IT, AgentRole.SYLVIE)),
):
    return await service.get_agencies(db)


@router.post("/agencies", status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def create_agency(
    request: Request,
    body: AgencyCreate,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.ADMIN_IT, AgentRole.THOMAS)),
):
    return await service.create_agency(db, body.code, body.name, body.city)


@router.put("/agencies/{agency_id}")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def update_agency_route(
    request: Request,
    agency_id: str,
    body: AgencyUpdate,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.ADMIN_IT, AgentRole.THOMAS)),
):
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
    success = await service.delete_agency(db, agency_id)
    if not success:
        raise HTTPException(status_code=404, detail="Agency not found")


@router.get("/batch-jobs", response_model=list[BatchJobResponse])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_batch_jobs(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.THOMAS, AgentRole.SYLVIE)),
):
    return await service.get_batch_jobs(db)


@router.post("/batch-jobs/trigger", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def trigger_batch_job(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.THOMAS)),
):
    job_id = await service.trigger_amplitude_batch(db, [])
    return {"job_id": job_id, "status": "triggered"}
