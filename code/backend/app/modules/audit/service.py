"""Audit service helpers backed by the audit_log table."""

import uuid
from collections import Counter
from datetime import datetime, timezone
from html import escape
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
    if end.hour == 0 and end.minute == 0 and end.second == 0 and end.microsecond == 0:
        end = end.replace(hour=23, minute=59, second=59, microsecond=999999)

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


def _fmt_datetime(value: str | None) -> str:
    if not value:
        return "-"
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return escape(value)
    return parsed.astimezone(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")


def _fmt_value(value: object) -> str:
    if value is None or value == "":
        return "-"
    return escape(str(value))


def build_cobac_audit_report_html(
    entries: list[dict],
    date_from: str,
    date_to: str,
    generated_by: str | None = None,
) -> str:
    """Build a self-contained COBAC audit report ready for browser/PDF export."""
    action_counts = Counter(entry.get("action") or "UNKNOWN" for entry in entries)
    actor_counts = Counter(entry.get("performed_by") or "SYSTEM" for entry in entries)
    table_counts = Counter(entry.get("table_name") or "N/A" for entry in entries)
    decision_actions = {
        "KYC_REVIEW_APPROVED",
        "KYC_REVIEW_REJECTED",
        "KYC_REVIEW_INFO_REQUESTED",
        "AML_CLEAR",
        "AML_CONFIRM",
        "AML_ESCALATE",
    }
    decision_count = sum(
        count for action, count in action_counts.items() if action in decision_actions
    )
    system_count = action_counts.get("SYSTEM_AUTO", 0) + action_counts.get(
        "DOSSIER_AUTO_ASSIGN", 0
    )

    rows = []
    for index, entry in enumerate(entries, start=1):
        old_data = entry.get("old_data") or {}
        new_data = entry.get("new_data") or {}
        previous_state = old_data.get("status") or old_data.get("previous_state") or "-"
        new_state = new_data.get("status") or new_data.get("new_state") or "-"
        rationale = (
            new_data.get("rationale")
            or new_data.get("reason")
            or new_data.get("justification")
            or "-"
        )
        actor = new_data.get("agent_name") or entry.get("performed_by") or "SYSTEM"
        transition = (
            f"{_fmt_value(previous_state)} -> {_fmt_value(new_state)}"
            if previous_state != "-" or new_state != "-"
            else "-"
        )
        rows.append(
            "<tr>"
            f"<td>{index}</td>"
            f"<td>{_fmt_datetime(entry.get('timestamp'))}</td>"
            f"<td>{_fmt_value(entry.get('action'))}</td>"
            f"<td>{_fmt_value(actor)}</td>"
            f"<td>{_fmt_value(entry.get('table_name'))}</td>"
            f"<td>{_fmt_value(entry.get('record_id'))}</td>"
            f"<td>{transition}</td>"
            f"<td>{_fmt_value(rationale)}</td>"
            f"<td>{_fmt_value(entry.get('client_ip'))}</td>"
            "</tr>"
        )

    top_actions = "".join(
        f"<li><strong>{escape(action)}</strong><span>{count}</span></li>"
        for action, count in action_counts.most_common(8)
    ) or "<li><strong>Aucune action</strong><span>0</span></li>"
    top_tables = "".join(
        f"<li><strong>{escape(table)}</strong><span>{count}</span></li>"
        for table, count in table_counts.most_common(6)
    ) or "<li><strong>Aucune table</strong><span>0</span></li>"
    actor_total = len(actor_counts)
    generated_at = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")
    generated_by_label = generated_by or "VeriPass Back Office"
    record_total = len({entry.get("record_id") for entry in entries if entry.get("record_id")})
    aml_total = sum(count for action, count in action_counts.items() if action.startswith("AML_"))
    kyc_total = sum(count for action, count in action_counts.items() if action.startswith("KYC_"))

    return f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Rapport COBAC - Journal d'audit VeriPass</title>
  <style>
    @page {{ size: A4 landscape; margin: 14mm; }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #ffffff; }}
    header {{ border-bottom: 3px solid #0f172a; padding-bottom: 18px; margin-bottom: 22px; }}
    .eyebrow {{ color: #475569; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }}
    h1 {{ margin: 8px 0 6px; font-size: 28px; }}
    .subtitle {{ margin: 0; color: #475569; font-size: 14px; }}
    .meta {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0 22px; }}
    .metric {{ border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; }}
    .metric span {{ display: block; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; }}
    .metric strong {{ display: block; margin-top: 6px; font-size: 22px; }}
    .section {{ break-inside: avoid; margin: 22px 0; }}
    h2 {{ margin: 0 0 10px; font-size: 18px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }}
    .summary {{ display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }}
    ul {{ list-style: none; margin: 0; padding: 0; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }}
    li {{ display: flex; justify-content: space-between; gap: 16px; padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }}
    li:last-child {{ border-bottom: 0; }}
    table {{ width: 100%; border-collapse: collapse; font-size: 11px; }}
    th {{ background: #f1f5f9; text-align: left; color: #334155; }}
    th, td {{ border: 1px solid #cbd5e1; padding: 7px; vertical-align: top; }}
    td:nth-child(6), td:nth-child(8) {{ max-width: 180px; word-break: break-word; }}
    .notice {{ border-left: 4px solid #0f172a; background: #f8fafc; padding: 12px 14px; color: #334155; font-size: 13px; }}
    footer {{ margin-top: 22px; padding-top: 12px; border-top: 1px solid #cbd5e1; color: #64748b; font-size: 11px; }}
  </style>
</head>
<body>
  <header>
    <div class="eyebrow">BICEC VeriPass - Controle permanent</div>
    <h1>Rapport COBAC du journal d'audit</h1>
    <p class="subtitle">Trace complete des actions systeme, agents et decisions KYC sur la periode demandee.</p>
  </header>

  <section class="meta">
    <div class="metric"><span>Periode</span><strong>{escape(date_from)} - {escape(date_to)}</strong></div>
    <div class="metric"><span>Actions auditees</span><strong>{len(entries)}</strong></div>
    <div class="metric"><span>Acteurs distincts</span><strong>{actor_total}</strong></div>
    <div class="metric"><span>Decisions controlees</span><strong>{decision_count}</strong></div>
  </section>

  <section class="section">
    <h2>Synthese de conformite</h2>
    <div class="notice">
      Rapport genere le {generated_at} par {_fmt_value(generated_by_label)}.
      Les donnees ci-dessous proviennent de la table d'audit operationnelle VeriPass.
      Ce document est destine aux controles internes et aux demandes de justification regulateur.
    </div>
  </section>

  <section class="section summary">
    <div>
      <h2>Actions principales</h2>
      <ul>{top_actions}</ul>
    </div>
    <div>
      <h2>Objets impactes</h2>
      <ul>{top_tables}</ul>
    </div>
  </section>

  <section class="meta">
    <div class="metric"><span>Actions systeme</span><strong>{system_count}</strong></div>
    <div class="metric"><span>Actions AML</span><strong>{aml_total}</strong></div>
    <div class="metric"><span>Actions KYC</span><strong>{kyc_total}</strong></div>
    <div class="metric"><span>Sessions / records</span><strong>{record_total}</strong></div>
  </section>

  <section class="section">
    <h2>Journal detaille</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Date UTC</th>
          <th>Action</th>
          <th>Acteur</th>
          <th>Objet</th>
          <th>Reference</th>
          <th>Transition</th>
          <th>Justification</th>
          <th>IP</th>
        </tr>
      </thead>
      <tbody>
        {''.join(rows) if rows else '<tr><td colspan="9">Aucune entree audit sur la periode.</td></tr>'}
      </tbody>
    </table>
  </section>

  <footer>
    VeriPass Back Office - Rapport COBAC genere automatiquement. Les informations personnelles brutes ne sont pas ajoutees au rapport.
  </footer>
</body>
</html>"""
