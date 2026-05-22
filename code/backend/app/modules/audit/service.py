"""Audit service helpers backed by the audit_log table."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.modules.audit.models import AuditLog
from app.modules.auth.models import Agent


async def get_audit_log(
    db: AsyncSession,
    session_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    limit: int = 100,
) -> list[dict]:
    """Return recent audit entries in the shape expected by the backoffice UI."""
    logger.info(
        "Fetching audit log (session_id=%s, agent_id=%s, limit=%s)",
        session_id,
        agent_id,
        limit,
    )
    query = select(AuditLog).order_by(AuditLog.performed_at.desc()).limit(limit)
    if session_id:
        query = query.where(AuditLog.record_id == session_id)
    if agent_id:
        try:
            query = query.where(AuditLog.performed_by == uuid.UUID(agent_id))
        except ValueError:
            return []

    result = await db.execute(query)
    logs = result.scalars().all()

    agent_ids = [log.performed_by for log in logs if log.performed_by is not None]
    agent_names: dict[uuid.UUID, str] = {}
    if agent_ids:
        agents_result = await db.execute(select(Agent).where(Agent.id.in_(agent_ids)))
        agent_names = {agent.id: agent.name for agent in agents_result.scalars().all()}

    entries: list[dict] = []
    for log in logs:
        old_data = log.old_data or {}
        new_data = log.new_data or {}
        entries.append(
            {
                "id": str(log.id),
                "timestamp": log.performed_at,
                "agentId": str(log.performed_by) if log.performed_by else "",
                "agentName": new_data.get("agent_name")
                or (agent_names.get(log.performed_by, "") if log.performed_by else ""),
                "actionType": log.action,
                "previousState": old_data.get("status") or old_data.get("previous_state"),
                "newState": new_data.get("status") or new_data.get("new_state"),
                "rationale": new_data.get("rationale") or new_data.get("reason"),
                "sessionId": log.record_id,
                "metadata": {
                    "table_name": log.table_name,
                    "old_data": old_data,
                    "new_data": new_data,
                    "client_ip": log.client_ip,
                },
            }
        )
    return entries


async def log_action(
    db: AsyncSession,
    agent_id: str,
    agent_name: str,
    action_type: str,
    previous_state: str,
    new_state: str,
    rationale: str,
    session_id: str,
    metadata: Optional[dict] = None,
) -> str:
    """Persist an auditable action on a KYC session."""
    logger.info("Logging action %s for agent %s", action_type, agent_id)
    entry = AuditLog(
        id=uuid.uuid4(),
        action=action_type,
        table_name="kyc_sessions",
        record_id=session_id,
        old_data={"status": previous_state},
        new_data={
            "status": new_state,
            "agent_name": agent_name,
            "rationale": rationale,
            **(metadata or {}),
        },
        performed_by=uuid.UUID(agent_id) if agent_id else None,
        performed_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    await db.commit()
    return str(entry.id)


async def export_audit_log_cobac(
    db: AsyncSession,
    date_from: str,
    date_to: str,
) -> list[dict]:
    """Export audit entries over a date range in a regulator-readable shape."""
    logger.info("Exporting audit log COBAC %s to %s", date_from, date_to)
    try:
        start = datetime.fromisoformat(date_from)
        end = datetime.fromisoformat(date_to)
    except ValueError:
        return []
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)

    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.performed_at >= start, AuditLog.performed_at <= end)
        .order_by(AuditLog.performed_at.asc())
    )
    return [
        {
            "id": str(log.id),
            "timestamp": log.performed_at.isoformat() if log.performed_at else None,
            "action": log.action,
            "table_name": log.table_name,
            "record_id": log.record_id,
            "performed_by": str(log.performed_by) if log.performed_by else None,
            "old_data": log.old_data or {},
            "new_data": log.new_data or {},
            "client_ip": log.client_ip,
        }
        for log in result.scalars().all()
    ]
