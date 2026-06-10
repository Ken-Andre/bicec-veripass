from datetime import date

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.security import require_agent_role
from app.db.session import get_db
from app.modules.auth.models import AgentRole

from app.modules.analytics import service as analytics_service
from app.modules.analytics.schemas import (
    BusinessMetricBaselineCreate,
    BusinessMetricBaselineUpdate,
)

router = APIRouter()


@router.get("/")
async def get_root():
    return {"module": "analytics", "status": "initialized"}


@router.get("/dashboard")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_dashboard(
    request: Request,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    agency_id: str | None = Query(None),
    channel: str | None = Query(None),
    doc_type: str | None = Query(None),
    agent_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.SYLVIE, AgentRole.ADMIN_IT, AgentRole.THOMAS)),
):
    """Analytics dashboard — KPIs, funnel metrics, agent performance.

    Access: SYLVIE, ADMIN_IT, THOMAS
    """
    stats = await analytics_service.get_dashboard_stats(
        db,
        role=_agent.role,
        date_from=date_from,
        date_to=date_to,
        agency_id=agency_id,
        channel=channel,
        doc_type=doc_type,
        agent_id=agent_id,
    )
    return stats


def _filters(
    date_from: date | None,
    date_to: date | None,
    agency_id: str | None,
    channel: str | None,
    doc_type: str | None,
    agent_id: str | None,
) -> dict:
    return {
        "date_from": date_from,
        "date_to": date_to,
        "agency_id": agency_id,
        "channel": channel,
        "doc_type": doc_type,
        "agent_id": agent_id,
    }


@router.get("/funnel")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_funnel(
    request: Request,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    agency_id: str | None = Query(None),
    channel: str | None = Query(None),
    doc_type: str | None = Query(None),
    agent_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.SYLVIE, AgentRole.ADMIN_IT)),
):
    return await analytics_service.get_funnel_metrics(
        db, **_filters(date_from, date_to, agency_id, channel, doc_type, agent_id)
    )


@router.get("/documents/performance")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_documents_performance(
    request: Request,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    agency_id: str | None = Query(None),
    channel: str | None = Query(None),
    doc_type: str | None = Query(None),
    agent_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.SYLVIE, AgentRole.ADMIN_IT)),
):
    return await analytics_service.get_document_performance(
        db, **_filters(date_from, date_to, agency_id, channel, doc_type, agent_id)
    )


@router.get("/fraud")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_fraud(
    request: Request,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    agency_id: str | None = Query(None),
    channel: str | None = Query(None),
    doc_type: str | None = Query(None),
    agent_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.SYLVIE, AgentRole.THOMAS)),
):
    return await analytics_service.get_fraud_metrics(
        db, **_filters(date_from, date_to, agency_id, channel, doc_type, agent_id)
    )


@router.get("/compliance")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_compliance(
    request: Request,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    agency_id: str | None = Query(None),
    channel: str | None = Query(None),
    doc_type: str | None = Query(None),
    agent_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.SYLVIE, AgentRole.THOMAS)),
):
    return await analytics_service.get_compliance_metrics(
        db, **_filters(date_from, date_to, agency_id, channel, doc_type, agent_id)
    )


@router.get("/operations")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_operations(
    request: Request,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    agency_id: str | None = Query(None),
    channel: str | None = Query(None),
    doc_type: str | None = Query(None),
    agent_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.SYLVIE)),
):
    return await analytics_service.get_operations_metrics(
        db, **_filters(date_from, date_to, agency_id, channel, doc_type, agent_id)
    )


@router.get("/marketing")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_marketing(
    request: Request,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    agency_id: str | None = Query(None),
    channel: str | None = Query(None),
    doc_type: str | None = Query(None),
    agent_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.SYLVIE)),
):
    return await analytics_service.get_marketing_metrics(
        db, **_filters(date_from, date_to, agency_id, channel, doc_type, agent_id)
    )


@router.get("/qa")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_qa(
    request: Request,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    agency_id: str | None = Query(None),
    channel: str | None = Query(None),
    doc_type: str | None = Query(None),
    agent_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.SYLVIE, AgentRole.ADMIN_IT)),
):
    return await analytics_service.get_qa_metrics(
        db, **_filters(date_from, date_to, agency_id, channel, doc_type, agent_id)
    )


@router.get("/technical")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_technical(
    request: Request,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    agency_id: str | None = Query(None),
    channel: str | None = Query(None),
    doc_type: str | None = Query(None),
    agent_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.SYLVIE, AgentRole.ADMIN_IT)),
):
    return await analytics_service.get_technical_metrics(
        db, **_filters(date_from, date_to, agency_id, channel, doc_type, agent_id)
    )


@router.get("/business-baseline")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_business_baseline(
    request: Request,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    agency_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.SYLVIE, AgentRole.ADMIN_IT)),
):
    return await analytics_service.get_business_baseline(
        db,
        date_from=date_from,
        date_to=date_to,
        agency_id=agency_id,
    )


@router.post("/business-baseline")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def create_business_baseline(
    request: Request,
    body: BusinessMetricBaselineCreate,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.SYLVIE, AgentRole.ADMIN_IT)),
):
    return await analytics_service.create_business_baseline(db, body, _agent)


@router.put("/business-baseline")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def update_business_baseline(
    request: Request,
    body: BusinessMetricBaselineUpdate,
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.SYLVIE, AgentRole.ADMIN_IT)),
):
    return await analytics_service.update_business_baseline(db, body, _agent)


@router.get("/business-case")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_business_case(
    request: Request,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    agency_id: str | None = Query(None),
    channel: str | None = Query(None),
    doc_type: str | None = Query(None),
    agent_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.SYLVIE, AgentRole.ADMIN_IT)),
):
    return await analytics_service.get_business_case(
        db, **_filters(date_from, date_to, agency_id, channel, doc_type, agent_id)
    )


@router.get("/business-case/export")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def export_business_case(
    request: Request,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    agency_id: str | None = Query(None),
    channel: str | None = Query(None),
    doc_type: str | None = Query(None),
    agent_id: str | None = Query(None),
    format: str = Query("html", pattern="^(html|json)$"),
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.SYLVIE, AgentRole.ADMIN_IT)),
):
    payload = await analytics_service.get_business_case(
        db, **_filters(date_from, date_to, agency_id, channel, doc_type, agent_id)
    )
    if format == "json":
        return payload
    html = analytics_service.build_business_case_export_html(payload)
    return Response(
        content=html,
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="veripass-business-case.html"'},
    )


@router.get("/export")
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def export_analytics(
    request: Request,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    agency_id: str | None = Query(None),
    channel: str | None = Query(None),
    doc_type: str | None = Query(None),
    agent_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _agent=Depends(require_agent_role(AgentRole.SYLVIE, AgentRole.ADMIN_IT, AgentRole.THOMAS)),
):
    return await analytics_service.export_analytics(
        db, **_filters(date_from, date_to, agency_id, channel, doc_type, agent_id)
    )
