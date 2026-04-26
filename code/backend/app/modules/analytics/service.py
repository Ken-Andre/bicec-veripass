"""Module service layer logic."""
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from app.modules.kyc.models import KYCSession, AmlAlert, ValidationDecision
from app.modules.auth.models import Agent

async def get_dashboard_stats(db: AsyncSession):
    # 1. Dossiers en attente (SUBMITTED, PENDING)
    pending_query = select(func.count(KYCSession.id)).where(KYCSession.status.in_(["SUBMITTED", "PENDING"]))
    pending_count = (await db.execute(pending_query)).scalar() or 0

    # 2. Validés aujourd'hui (COMPLETED with completed_at >= today)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    validated_query = select(func.count(KYCSession.id)).where(
        and_(
            KYCSession.status == "COMPLETED",
            KYCSession.completed_at >= today_start
        )
    )
    validated_today = (await db.execute(validated_query)).scalar() or 0

    # 3. Alertes AML (OPEN)
    aml_query = select(func.count(AmlAlert.id)).where(AmlAlert.status == "OPEN")
    aml_alerts = (await db.execute(aml_query)).scalar() or 0

    # 4. À traiter (SUBMITTED - ready for review)
    todo_query = select(func.count(KYCSession.id)).where(KYCSession.status == "SUBMITTED")
    to_treat = (await db.execute(todo_query)).scalar() or 0

    # 5. Recent Activity (last 5 decisions joined with Agent)
    activity_query = (
        select(ValidationDecision)
        .options(joinedload(ValidationDecision.agent))
        .order_by(ValidationDecision.decided_at.desc())
        .limit(5)
    )
    recent_decisions = (await db.execute(activity_query)).scalars().all()
    
    recent_activity = []
    for d in recent_decisions:
        agent_name = d.agent.name if d.agent else "Système"
        decision_label = d.decision
        if decision_label == "APPROVED":
            label = "Dossier validé"
        elif decision_label == "REJECTED":
            label = "Dossier rejeté"
        else:
            label = f"Decision {decision_label}"

        recent_activity.append({
            "action": f"{label} #{str(d.session_id)[:8]}",
            "time": d.decided_at.isoformat(),
            "user": agent_name
        })

    return {
        "summary": [
            {"name": "Dossiers en attente", "value": str(pending_count), "icon": "Clock", "color": "text-yellow-600"},
            {"name": "Validés aujourd'hui", "value": str(validated_today), "icon": "CheckCircle", "color": "text-green-600"},
            {"name": "Alertes AML", "value": str(aml_alerts), "icon": "AlertTriangle", "color": "text-red-600"},
            {"name": "À traiter", "value": str(to_treat), "icon": "FileCheck", "color": "text-blue-600"},
        ],
        "recent_activity": recent_activity,
        "sla": {
            "avg_validation_time": "1.5h",
            "sla_respect_rate": "92%",
            "late_dossiers": 0
        }
    }
