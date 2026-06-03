"""Analytics service backed by the PostgreSQL dwh schema.

The operational tables in public remain the source of truth. The dwh schema is
the analytics read model used by dashboards; writes here are best-effort and
must not block KYC/AML workflows.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from html import escape
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.logging import logger
from app.db.session import check_db_connection
from app.core.redis import check_redis_connection
from app.modules.admin.models import Agency
from app.modules.aml.models import BatchJob
from app.modules.analytics.models import BusinessMetricBaseline
from app.modules.audit.models import AuditLog
from app.modules.auth.models import Agent, AgentRole, User
from app.modules.kyc.models import (
    AmlAlert,
    BiometricResult,
    ConsentRecord,
    Document,
    DuplicateCheck,
    DossierAssignment,
    KYCSession,
    OCRField,
    SupportThread,
    ValidationDecision,
)


TERMINAL_STATUSES = {"APPROVED", "REJECTED", "FRAUD_SUSPECT", "ABANDONED", "DISABLED"}
OPEN_AML_STATUS = "OPEN"
OPEN_AML_STATUSES = {"OPEN", "CONFIRMED", "ESCALATED", "PENDING"}
BASELINE_REQUIRED = "Baseline requise"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _pct(numerator: int | float, denominator: int | float) -> int:
    return int((float(numerator) / float(denominator)) * 100) if denominator else 0


def _format_duration(seconds: float | int | None) -> str:
    if not seconds:
        return "0m"
    seconds = float(seconds)
    if seconds >= 3600:
        return f"{seconds / 3600:.1f}h"
    if seconds >= 60:
        return f"{seconds / 60:.0f}m"
    return f"{seconds:.0f}s"


def _format_ms(ms: float | int | None) -> str:
    if not ms:
        return "0ms"
    ms = float(ms)
    if ms >= 1000:
        return f"{ms / 1000:.1f}s"
    return f"{ms:.0f}ms"


def _format_pct_ratio(value: float | int | None) -> str:
    return f"{int(float(value or 0) * 100)}%"


def _filters(
    *,
    date_column: str,
    agency_column: str | None = None,
    channel_column: str | None = None,
    agent_column: str | None = None,
    doc_type_column: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    agency_id: str | None = None,
    channel: str | None = None,
    agent_id: str | None = None,
    doc_type: str | None = None,
) -> tuple[str, dict[str, Any]]:
    clauses: list[str] = []
    params: dict[str, Any] = {}
    if date_from:
        clauses.append(f"{date_column} >= :date_from")
        params["date_from"] = date_from
    if date_to:
        clauses.append(f"{date_column} <= :date_to")
        params["date_to"] = date_to
    if agency_id and agency_column:
        clauses.append(f"{agency_column} = :agency_id")
        params["agency_id"] = agency_id
    if channel and channel_column:
        clauses.append(f"{channel_column} = :channel")
        params["channel"] = channel
    if agent_id and agent_column:
        clauses.append(f"{agent_column} = :agent_id")
        params["agent_id"] = agent_id
    if doc_type and doc_type_column:
        clauses.append(f"{doc_type_column} = :doc_type")
        params["doc_type"] = doc_type
    return (" WHERE " + " AND ".join(clauses)) if clauses else "", params


def _parse_uuid(value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(str(value))
    except ValueError:
        return None


def _datetime_bounds(date_from: date | None, date_to: date | None) -> tuple[datetime | None, datetime | None]:
    start = datetime.combine(date_from, time.min, tzinfo=timezone.utc) if date_from else None
    end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone.utc) if date_to else None
    return start, end


def _kyc_conditions(filters: dict[str, Any], date_attr: Any = KYCSession.started_at) -> list[Any]:
    conditions: list[Any] = []
    start, end = _datetime_bounds(filters.get("date_from"), filters.get("date_to"))
    agency_uuid = _parse_uuid(filters.get("agency_id"))
    if start is not None:
        conditions.append(date_attr >= start)
    if end is not None:
        conditions.append(date_attr < end)
    if agency_uuid is not None:
        conditions.append(KYCSession.agency_id == agency_uuid)
    return conditions


async def _scalar(db: AsyncSession, sql: str, params: dict[str, Any] | None = None) -> Any:
    result = await db.execute(text(sql), params or {})
    return result.scalar()


async def _mappings(db: AsyncSession, sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    result = await db.execute(text(sql), params or {})
    return [dict(row) for row in result.mappings().all()]


async def _dwh_table_exists(db: AsyncSession, table_name: str) -> bool:
    try:
        exists = await _scalar(db, "SELECT to_regclass(:name) IS NOT NULL", {"name": table_name})
        return bool(exists)
    except Exception:
        return False


async def _ensure_funnel_partition(db: AsyncSession, session_date: date) -> None:
    del session_date
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS dwh.fact_kyc_funnel_default
            PARTITION OF dwh.fact_kyc_funnel
            DEFAULT
            """
        )
    )


async def _get_or_create_time_dim(db: AsyncSession, occurred_at: datetime) -> uuid.UUID | None:
    occurred_at = _as_utc(occurred_at) or _utc_now()
    existing = await _scalar(
        db,
        """
        SELECT id FROM dwh.dim_time
        WHERE full_timestamp = :full_timestamp
        LIMIT 1
        """,
        {"full_timestamp": occurred_at},
    )
    if existing:
        return existing
    time_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO dwh.dim_time
            (id, full_timestamp, date, hour, day_of_week, week, month, year)
            VALUES (:id, :full_timestamp, :date, :hour, :day_of_week, :week, :month, :year)
            """
        ),
        {
            "id": time_id,
            "full_timestamp": occurred_at,
            "date": occurred_at.date(),
            "hour": occurred_at.hour,
            "day_of_week": occurred_at.isoweekday(),
            "week": int(occurred_at.strftime("%V")),
            "month": occurred_at.month,
            "year": occurred_at.year,
        },
    )
    return time_id


async def _get_or_create_user_dim(db: AsyncSession, user_id: uuid.UUID | None) -> uuid.UUID | None:
    if not user_id:
        return None
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
        {"lock_key": f"dwh.dim_users:{user_id}"},
    )
    existing = await _scalar(
        db,
        "SELECT id FROM dwh.dim_users WHERE source_user_id = :user_id LIMIT 1",
        {"user_id": user_id},
    )
    if existing:
        return existing
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    dim_id = uuid.uuid4()
    phone_prefix = None
    if user and user.phone:
        phone_prefix = user.phone[:4]
    created_at = _as_utc(user.created_at) if user else _utc_now()
    await db.execute(
        text(
            """
            INSERT INTO dwh.dim_users
            (id, source_user_id, phone_prefix, language, cohort_month)
            VALUES (:id, :source_user_id, :phone_prefix, :language, :cohort_month)
            """
        ),
        {
            "id": dim_id,
            "source_user_id": user_id,
            "phone_prefix": phone_prefix,
            "language": user.language if user else None,
            "cohort_month": date(created_at.year, created_at.month, 1),
        },
    )
    return dim_id


async def _get_or_create_agency_dim(db: AsyncSession, agency_id: uuid.UUID | None) -> uuid.UUID | None:
    if not agency_id:
        return None
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
        {"lock_key": f"dwh.dim_agencies:{agency_id}"},
    )
    existing = await _scalar(
        db,
        "SELECT id FROM dwh.dim_agencies WHERE source_agency_id = :agency_id LIMIT 1",
        {"agency_id": agency_id},
    )
    if existing:
        return existing
    agency = (await db.execute(select(Agency).where(Agency.id == agency_id))).scalar_one_or_none()
    dim_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO dwh.dim_agencies
            (id, source_agency_id, name, city, region)
            VALUES (:id, :source_agency_id, :name, :city, :region)
            """
        ),
        {
            "id": dim_id,
            "source_agency_id": agency_id,
            "name": agency.name if agency else None,
            "city": agency.city if agency else None,
            "region": getattr(agency, "location", None) if agency else None,
        },
    )
    return dim_id


async def _get_or_create_agent_dim(db: AsyncSession, agent_id: uuid.UUID | None) -> uuid.UUID | None:
    if not agent_id:
        return None
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
        {"lock_key": f"dwh.dim_agents:{agent_id}"},
    )
    existing = await _scalar(
        db,
        "SELECT id FROM dwh.dim_agents WHERE source_agent_id = :agent_id LIMIT 1",
        {"agent_id": agent_id},
    )
    if existing:
        return existing
    agent = (await db.execute(select(Agent).where(Agent.id == agent_id))).scalar_one_or_none()
    agency_dim_id = await _get_or_create_agency_dim(db, agent.agency_id if agent else None)
    dim_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO dwh.dim_agents
            (id, source_agent_id, agency_dim_id, name, role)
            VALUES (:id, :source_agent_id, :agency_dim_id, :name, :role)
            """
        ),
        {
            "id": dim_id,
            "source_agent_id": agent_id,
            "agency_dim_id": agency_dim_id,
            "name": agent.name if agent else None,
            "role": agent.role.value if agent and hasattr(agent.role, "value") else str(agent.role) if agent else None,
        },
    )
    return dim_id


def _event_to_stage(event_type: str, step: str | None = None) -> str:
    return {
        "KYC_SESSION_STARTED": "started",
        "CONSENT_SUBMITTED": "consent",
        "DOCUMENT_UPLOADED": step or "document_uploaded",
        "OCR_REVIEW_CONFIRMED": "ocr_review",
        "LIVENESS_PASSED": "liveness",
        "KYC_SUBMITTED": "submitted",
        "KYC_APPROVED": "approved",
        "KYC_REJECTED": "rejected",
        "KYC_FRAUD_SUSPECT": "fraud_suspect",
    }.get(event_type, step or event_type.lower())


async def refresh_funnel_snapshot(db: AsyncSession, session_id: uuid.UUID) -> None:
    session = (
        await db.execute(select(KYCSession).where(KYCSession.id == session_id))
    ).scalar_one_or_none()
    if not session:
        return
    started_at = _as_utc(session.started_at) or _utc_now()
    session_date = started_at.date()
    await _ensure_funnel_partition(db, session_date)

    user_dim_id = await _get_or_create_user_dim(db, session.user_id)
    agency_dim_id = await _get_or_create_agency_dim(db, session.agency_id)
    time_dim_id = await _get_or_create_time_dim(db, started_at)
    final_status = session.status if session.status in TERMINAL_STATUSES else None
    end_at = _as_utc(session.completed_at) or (_utc_now() if final_status else None)
    duration = int((end_at - started_at).total_seconds()) if end_at else None
    dropout_step = session.last_step_completed if session.status == "ABANDONED" else None
    conversion_stage = session.last_step_completed or session.status

    await db.execute(
        text("DELETE FROM dwh.fact_kyc_funnel WHERE session_id = :session_id"),
        {"session_id": session_id},
    )
    await db.execute(
        text(
            """
            INSERT INTO dwh.fact_kyc_funnel
            (session_id, user_dim_id, agency_dim_id, time_dim_id, session_date,
             current_status, final_status, niu_type, total_duration_seconds,
             dropout_step, conversion_stage)
            VALUES
            (:session_id, :user_dim_id, :agency_dim_id, :time_dim_id, :session_date,
             :current_status, :final_status, :niu_type, :total_duration_seconds,
             :dropout_step, :conversion_stage)
            """
        ),
        {
            "session_id": session_id,
            "user_dim_id": user_dim_id,
            "agency_dim_id": agency_dim_id,
            "time_dim_id": time_dim_id,
            "session_date": session_date,
            "current_status": session.status,
            "final_status": final_status,
            "niu_type": session.niu_type,
            "total_duration_seconds": duration,
            "dropout_step": dropout_step,
            "conversion_stage": conversion_stage,
        },
    )


async def record_ocr_performance(db: AsyncSession, document_id: uuid.UUID) -> None:
    document = (
        await db.execute(
            select(Document)
            .options(joinedload(Document.ocr_fields))
            .where(Document.id == document_id)
        )
    ).unique().scalar_one_or_none()
    if not document:
        return

    occurred_at = _as_utc(document.captured_at) or _utc_now()
    time_dim_id = await _get_or_create_time_dim(db, occurred_at)
    confidences = [
        float(field.confidence_score)
        for field in document.ocr_fields
        if field.confidence_score is not None
    ]
    confidence_avg = sum(confidences) / len(confidences) if confidences else None
    low_count = sum(1 for value in confidences if value < float(settings.OCR_CONFIDENCE_THRESHOLD))
    human_needed = any(field.human_corrected for field in document.ocr_fields) or document.ocr_status in {"PARTIAL", "FAILED", "MANUAL"}
    raw = document.ocr_raw_json if isinstance(document.ocr_raw_json, dict) else {}
    duration_ms = raw.get("process_time_ms") or raw.get("processing_duration_ms")
    if isinstance(raw.get("previous"), dict):
        duration_ms = duration_ms or raw["previous"].get("process_time_ms")

    await db.execute(
        text("DELETE FROM dwh.fact_ocr_performance WHERE document_id = :document_id"),
        {"document_id": document_id},
    )
    await db.execute(
        text(
            """
            INSERT INTO dwh.fact_ocr_performance
            (session_id, document_id, time_dim_id, extraction_date, engine,
             processing_duration_ms, confidence_avg, low_confidence_fields_count,
             human_correction_needed)
            VALUES
            (:session_id, :document_id, :time_dim_id, :extraction_date, :engine,
             :processing_duration_ms, :confidence_avg, :low_confidence_fields_count,
             :human_correction_needed)
            """
        ),
        {
            "session_id": document.session_id,
            "document_id": document.id,
            "time_dim_id": time_dim_id,
            "extraction_date": occurred_at.date(),
            "engine": document.ocr_engine,
            "processing_duration_ms": int(float(duration_ms)) if duration_ms else None,
            "confidence_avg": confidence_avg,
            "low_confidence_fields_count": low_count,
            "human_correction_needed": human_needed,
        },
    )


async def track_event(
    db: AsyncSession,
    *,
    event_type: str,
    session_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    agent_id: uuid.UUID | None = None,
    agency_id: uuid.UUID | None = None,
    occurred_at: datetime | None = None,
    source: str = "backend",
    channel: str = "direct",
    device_type: str | None = None,
    step: str | None = None,
    status: str | None = None,
    duration_ms: int | None = None,
    metadata: dict[str, Any] | None = None,
    request_id: uuid.UUID | None = None,
) -> None:
    if not await _dwh_table_exists(db, "dwh.fact_kyc_events"):
        return
    occurred_at = _as_utc(occurred_at) or _utc_now()
    resolved_user_id = user_id
    resolved_agency_id = agency_id
    if session_id and (not resolved_user_id or not resolved_agency_id):
        session = (
            await db.execute(select(KYCSession).where(KYCSession.id == session_id))
        ).scalar_one_or_none()
        if session:
            resolved_user_id = resolved_user_id or session.user_id
            resolved_agency_id = resolved_agency_id or session.agency_id

    time_dim_id = await _get_or_create_time_dim(db, occurred_at)
    user_dim_id = await _get_or_create_user_dim(db, resolved_user_id)
    agency_dim_id = await _get_or_create_agency_dim(db, resolved_agency_id)
    agent_dim_id = await _get_or_create_agent_dim(db, agent_id)
    await db.execute(
        text(
            """
            INSERT INTO dwh.fact_kyc_events
            (id, event_type, session_id, user_dim_id, agency_dim_id, agent_dim_id,
             time_dim_id, occurred_at, source, channel, device_type, step, status,
             duration_ms, metadata, request_id)
            VALUES
            (:id, :event_type, :session_id, :user_dim_id, :agency_dim_id, :agent_dim_id,
             :time_dim_id, :occurred_at, :source, :channel, :device_type, :step, :status,
             :duration_ms, CAST(:metadata AS jsonb), :request_id)
            """
        ),
        {
            "id": uuid.uuid4(),
            "event_type": event_type,
            "session_id": session_id,
            "user_dim_id": user_dim_id,
            "agency_dim_id": agency_dim_id,
            "agent_dim_id": agent_dim_id,
            "time_dim_id": time_dim_id,
            "occurred_at": occurred_at,
            "source": source,
            "channel": channel or "direct",
            "device_type": device_type,
            "step": step,
            "status": status,
            "duration_ms": duration_ms,
            "metadata": __import__("json").dumps(metadata or {}),
            "request_id": request_id,
        },
    )
    if session_id:
        await refresh_funnel_snapshot(db, session_id)


async def _track_event_once(
    db: AsyncSession,
    *,
    event_type: str,
    session_id: uuid.UUID,
    metadata_key: str | None = None,
    metadata_value: str | None = None,
    **kwargs: Any,
) -> None:
    params: dict[str, Any] = {"event_type": event_type, "session_id": session_id}
    extra_clause = ""
    if metadata_key and metadata_value:
        if metadata_key not in {"document_id", "decision_id", "alert_id", "duplicate_check_id"}:
            raise ValueError("Unsupported analytics metadata key")
        extra_clause = f" AND metadata ->> '{metadata_key}' = :metadata_value"
        params["metadata_value"] = metadata_value
    exists = await _scalar(
        db,
        f"""
        SELECT 1
        FROM dwh.fact_kyc_events
        WHERE event_type = :event_type
          AND session_id = :session_id
          {extra_clause}
        LIMIT 1
        """,
        params,
    )
    if exists:
        return
    await track_event(db, event_type=event_type, session_id=session_id, **kwargs)


async def track_event_best_effort(db: AsyncSession, **kwargs: Any) -> None:
    had_transaction = db.in_transaction()
    try:
        async with db.begin_nested():
            await track_event(db, **kwargs)
        if not had_transaction:
            await db.commit()
    except Exception as exc:
        logger.warning("Analytics DWH event skipped (%s): %s", kwargs.get("event_type"), exc)


async def record_ocr_performance_best_effort(db: AsyncSession, document_id: uuid.UUID) -> None:
    had_transaction = db.in_transaction()
    try:
        async with db.begin_nested():
            await record_ocr_performance(db, document_id)
        if not had_transaction:
            await db.commit()
    except Exception as exc:
        logger.warning("OCR DWH fact skipped for document %s: %s", document_id, exc)


async def _event_counts(db: AsyncSession, event_types: list[str], **filters: Any) -> dict[str, int]:
    where, params = _filters(
        date_column="occurred_at::date",
        agency_column="da.source_agency_id::text",
        channel_column="e.channel",
        agent_column="dag.source_agent_id::text",
        date_from=filters.get("date_from"),
        date_to=filters.get("date_to"),
        agency_id=filters.get("agency_id"),
        channel=filters.get("channel"),
        agent_id=filters.get("agent_id"),
    )
    params["event_types"] = event_types
    rows = await _mappings(
        db,
        f"""
        SELECT e.event_type, COUNT(DISTINCT e.session_id) AS total
        FROM dwh.fact_kyc_events e
        LEFT JOIN dwh.dim_agencies da ON da.id = e.agency_dim_id
        LEFT JOIN dwh.dim_agents dag ON dag.id = e.agent_dim_id
        {where}
        {"AND" if where else "WHERE"} e.event_type = ANY(CAST(:event_types AS text[]))
        GROUP BY e.event_type
        """,
        params,
    )
    return {row["event_type"]: int(row["total"] or 0) for row in rows}


async def get_funnel_metrics(db: AsyncSession, **filters: Any) -> dict[str, Any]:
    try:
        events_exist = await _scalar(db, "SELECT COUNT(*) FROM dwh.fact_kyc_events")
    except Exception:
        events_exist = 0
    if events_exist:
        counts = await _event_counts(
            db,
            [
                "KYC_SESSION_STARTED",
                "CONSENT_SUBMITTED",
                "DOCUMENT_UPLOADED",
                "OCR_REVIEW_CONFIRMED",
                "LIVENESS_PASSED",
                "KYC_SUBMITTED",
                "KYC_APPROVED",
            ],
            **filters,
        )
        total = counts.get("KYC_SESSION_STARTED", 0)
        steps = [
            ("Début onboarding", "KYC_SESSION_STARTED"),
            ("CGU signées", "CONSENT_SUBMITTED"),
            ("Document capturé", "DOCUMENT_UPLOADED"),
            ("OCR confirmé", "OCR_REVIEW_CONFIRMED"),
            ("Liveness validé", "LIVENESS_PASSED"),
            ("Dossier soumis", "KYC_SUBMITTED"),
            ("Activé / Validé", "KYC_APPROVED"),
        ]
        return {
            "total": total,
            "steps": [
                {"step": label, "count": counts.get(event, 0), "rate": _pct(counts.get(event, 0), total)}
                for label, event in steps
            ],
        }

    total_sessions = int((await db.execute(select(func.count(KYCSession.id)))).scalar() or 0)
    consent_count = int((await db.execute(select(func.count(ConsentRecord.id)))).scalar() or 0)
    doc_count = int(
        (await db.execute(select(func.count(Document.session_id.distinct())))).scalar() or 0
    )
    liveness_count = int(
        (await db.execute(select(func.count(BiometricResult.session_id.distinct())))).scalar() or 0
    )
    submitted_count = int(
        (await db.execute(select(func.count(KYCSession.id)).where(KYCSession.submitted_at.is_not(None)))).scalar() or 0
    )
    approved_count = int(
        (await db.execute(select(func.count(KYCSession.id)).where(KYCSession.status == "APPROVED"))).scalar() or 0
    )
    return {
        "total": total_sessions,
        "steps": [
            {"step": "Début onboarding", "count": total_sessions, "rate": 100 if total_sessions else 0},
            {"step": "CGU signées", "count": consent_count, "rate": _pct(consent_count, total_sessions)},
            {"step": "Document capturé", "count": doc_count, "rate": _pct(doc_count, total_sessions)},
            {"step": "Liveness validé", "count": liveness_count, "rate": _pct(liveness_count, total_sessions)},
            {"step": "Dossier soumis", "count": submitted_count, "rate": _pct(submitted_count, total_sessions)},
            {"step": "Activé / Validé", "count": approved_count, "rate": _pct(approved_count, total_sessions)},
        ],
    }


async def get_document_performance(db: AsyncSession, **filters: Any) -> dict[str, Any]:
    where, params = _filters(
        date_column="f.extraction_date",
        agency_column="ks.agency_id::text",
        doc_type_column="d.doc_type",
        date_from=filters.get("date_from"),
        date_to=filters.get("date_to"),
        agency_id=filters.get("agency_id"),
        doc_type=filters.get("doc_type"),
    )
    try:
        row = (
            await _mappings(
                db,
                f"""
                SELECT COUNT(*) AS total,
                       AVG(f.processing_duration_ms) AS avg_ms,
                       AVG(f.confidence_avg) AS avg_confidence,
                       SUM(CASE WHEN f.human_correction_needed THEN 1 ELSE 0 END) AS correction_needed,
                       SUM(CASE WHEN f.engine IS NOT NULL THEN 1 ELSE 0 END) AS extracted_count
                FROM dwh.fact_ocr_performance f
                LEFT JOIN documents d ON d.id = f.document_id
                LEFT JOIN kyc_sessions ks ON ks.id = f.session_id
                {where}
                """,
                params,
            )
        )[0]
    except Exception:
        row = {"total": 0, "avg_ms": 0, "avg_confidence": None, "correction_needed": 0, "extracted_count": 0}

    total = int(row.get("total") or 0)
    if total:
        status_rows = await _mappings(
            db,
            f"""
            SELECT COALESCE(d.ocr_status, 'UNKNOWN') AS status, COUNT(*) AS total
            FROM documents d
            JOIN dwh.fact_ocr_performance f ON f.document_id = d.id
            LEFT JOIN kyc_sessions ks ON ks.id = f.session_id
            {where}
            GROUP BY COALESCE(d.ocr_status, 'UNKNOWN')
            """,
            params,
        )
        statuses = {r["status"]: int(r["total"] or 0) for r in status_rows}
        correction_rate = _pct(int(row.get("correction_needed") or 0), total)
        return {
            "total_documents": total,
            "avg_ocr_speed": _format_ms(row.get("avg_ms")),
            "avg_ocr_confidence": _format_pct_ratio(row.get("avg_confidence")),
            "manual_correction_rate": f"{correction_rate}%",
            "cni_extracted_count": int(row.get("extracted_count") or 0),
            "status_counts": statuses,
        }

    total_fields = int((await db.execute(select(func.count(OCRField.id)))).scalar() or 0)
    corrected = int(
        (await db.execute(select(func.count(OCRField.id)).where(OCRField.human_corrected.is_(True)))).scalar() or 0
    )
    avg_conf = float((await db.execute(select(func.avg(OCRField.confidence_score)))).scalar() or 0)
    cni_count = int(
        (
            await db.execute(
                select(func.count(Document.session_id.distinct())).where(
                    Document.doc_type.in_(["CNI_RECTO", "CNI_VERSO"])
                )
            )
        ).scalar()
        or 0
    )
    return {
        "total_documents": int((await db.execute(select(func.count(Document.id)))).scalar() or 0),
        "avg_ocr_speed": "0ms",
        "avg_ocr_confidence": _format_pct_ratio(avg_conf),
        "manual_correction_rate": f"{_pct(corrected, total_fields)}%",
        "cni_extracted_count": cni_count,
        "status_counts": {},
    }


async def get_fraud_metrics(db: AsyncSession, **filters: Any) -> dict[str, Any]:
    try:
        counts = await _event_counts(
            db,
            ["LIVENESS_FAILED", "FACE_MATCH_FAILED", "KYC_FRAUD_SUSPECT", "NIU_CONFLICT_DETECTED"],
            **filters,
        )
        if counts:
            avg_bio = float((await db.execute(select(func.avg(BiometricResult.liveness_score)))).scalar() or 0)
            return {
                "liveness_failures": counts.get("LIVENESS_FAILED", 0),
                "fraud_suspects": counts.get("KYC_FRAUD_SUSPECT", 0),
                "niu_conflicts": counts.get("NIU_CONFLICT_DETECTED", 0),
                "face_match_failures": counts.get("FACE_MATCH_FAILED", 0),
                "avg_biometric_score": _format_pct_ratio(avg_bio),
            }
    except Exception:
        pass

    conditions = _kyc_conditions(filters)
    liveness_failures = int(
        (
            await db.execute(
                select(func.count(KYCSession.id)).where(
                    KYCSession.liveness_strike_count > 0,
                    *conditions,
                )
            )
        ).scalar()
        or 0
    )
    fraud_cases = int(
        (await db.execute(select(func.count(KYCSession.id)).where(KYCSession.status == "FRAUD_SUSPECT", *conditions))).scalar()
        or 0
    )
    niu_query = select(func.count(DuplicateCheck.id)).join(
        KYCSession,
        KYCSession.id == DuplicateCheck.session_id_new,
    ).where(*conditions)
    niu_conflicts = int((await db.execute(niu_query)).scalar() or 0)
    avg_bio = float(
        (
            await db.execute(
                select(func.avg(BiometricResult.liveness_score))
                .join(KYCSession, KYCSession.id == BiometricResult.session_id)
                .where(*conditions)
            )
        ).scalar()
        or 0
    )
    face_failures = int(
        (
            await db.execute(
                select(func.count(BiometricResult.id))
                .join(KYCSession, KYCSession.id == BiometricResult.session_id)
                .where(BiometricResult.face_match_status == "FAILED", *conditions)
            )
        ).scalar()
        or 0
    )
    return {
        "liveness_failures": liveness_failures,
        "fraud_suspects": fraud_cases,
        "niu_conflicts": niu_conflicts,
        "face_match_failures": face_failures,
        "avg_biometric_score": _format_pct_ratio(avg_bio),
    }


async def get_compliance_metrics(db: AsyncSession, **filters: Any) -> dict[str, Any]:
    conditions = _kyc_conditions(filters)
    alert_base = select(func.count(AmlAlert.id)).join(KYCSession, KYCSession.id == AmlAlert.session_id)
    open_alerts = int((await db.execute(alert_base.where(AmlAlert.status == OPEN_AML_STATUS, *conditions))).scalar() or 0)
    cleared = int((await db.execute(alert_base.where(AmlAlert.status == "CLEARED", *conditions))).scalar() or 0)
    confirmed = int((await db.execute(alert_base.where(AmlAlert.status == "CONFIRMED", *conditions))).scalar() or 0)
    total_alerts = open_alerts + cleared + confirmed
    total_sessions = int((await db.execute(select(func.count(KYCSession.id)).where(*conditions))).scalar() or 0)
    screened_sessions = int(
        (
            await db.execute(
                select(func.count(AmlAlert.session_id.distinct()))
                .join(KYCSession, KYCSession.id == AmlAlert.session_id)
                .where(*conditions)
            )
        ).scalar()
        or 0
    )
    consent_sessions = int(
        (
            await db.execute(
                select(func.count(ConsentRecord.session_id.distinct()))
                .join(KYCSession, KYCSession.id == ConsentRecord.session_id)
                .where(*conditions)
            )
        ).scalar()
        or 0
    )
    return {
        "open_alerts": open_alerts,
        "cleared_alerts": cleared,
        "confirmed_alerts": confirmed,
        "total_alerts": total_alerts,
        "pep_sanctions_check_rate": f"{_pct(screened_sessions, total_sessions)}%",
        "consent_coverage_rate": f"{_pct(consent_sessions, total_sessions)}%",
    }


async def get_operations_metrics(db: AsyncSession, **filters: Any) -> dict[str, Any]:
    started_conditions = _kyc_conditions(filters)
    completed_conditions = _kyc_conditions(filters, KYCSession.completed_at)
    pending = int(
        (
            await db.execute(
                select(func.count(KYCSession.id)).where(
                    KYCSession.status.in_(["PENDING_AGENT_REVIEW", "PENDING_KYC", "PENDING_INFO"]),
                    *started_conditions,
                )
            )
        ).scalar()
        or 0
    )
    to_treat = int(
        (await db.execute(select(func.count(KYCSession.id)).where(KYCSession.status == "PENDING_AGENT_REVIEW", *started_conditions))).scalar()
        or 0
    )
    today_start, today_end = _datetime_bounds(_utc_now().date(), _utc_now().date())
    validation_window = completed_conditions or [KYCSession.completed_at >= today_start, KYCSession.completed_at < today_end]
    validated_today = int(
        (
            await db.execute(
                select(func.count(KYCSession.id)).where(
                    KYCSession.status == "APPROVED",
                    *validation_window,
                )
            )
        ).scalar()
        or 0
    )
    completed = (
        await db.execute(
            select(KYCSession).where(
                KYCSession.completed_at.is_not(None),
                KYCSession.submitted_at.is_not(None),
                *completed_conditions,
            )
        )
    ).scalars().all()
    durations = [
        (_as_utc(s.completed_at) - _as_utc(s.submitted_at)).total_seconds()
        for s in completed
        if s.completed_at and s.submitted_at
    ]
    late = sum(1 for seconds in durations if seconds > 7200)
    active_support_threads = int(
        (
            await db.execute(
                select(func.count(SupportThread.id))
                .join(KYCSession, KYCSession.id == SupportThread.session_id)
                .where(SupportThread.status == "OPEN", *started_conditions)
            )
        ).scalar()
        or 0
    )
    audit_conditions = []
    start, end = _datetime_bounds(filters.get("date_from"), filters.get("date_to"))
    if start is not None:
        audit_conditions.append(AuditLog.performed_at >= start)
    if end is not None:
        audit_conditions.append(AuditLog.performed_at < end)
    passcode_resets = int(
        (await db.execute(select(func.count(AuditLog.id)).where(AuditLog.action.ilike("%PASSCODE%"), *audit_conditions))).scalar() or 0
    )
    card_requests = int(
        (await db.execute(select(func.count(AuditLog.id)).where(AuditLog.action.ilike("%CARD%"), *audit_conditions))).scalar() or 0
    )
    agents = (await db.execute(select(Agent).where(Agent.role == AgentRole.JEAN))).scalars().all()
    agent_ids = [agent.id for agent in agents]
    active_load: dict[uuid.UUID, int] = {agent_id: 0 for agent_id in agent_ids}
    completed_by_agent: dict[uuid.UUID, int] = {agent_id: 0 for agent_id in agent_ids}
    if agent_ids:
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
                KYCSession.status.in_(["PENDING_AGENT_REVIEW", "PENDING_KYC", "PENDING_INFO"]),
                *started_conditions,
            )
            .group_by(DossierAssignment.agent_id)
        )
        for agent_id, count in active_rows.all():
            active_load[agent_id] = int(count or 0)

        decision_conditions = []
        decision_start, decision_end = _datetime_bounds(
            filters.get("date_from"), filters.get("date_to")
        )
        if decision_start is not None:
            decision_conditions.append(ValidationDecision.decided_at >= decision_start)
        if decision_end is not None:
            decision_conditions.append(ValidationDecision.decided_at < decision_end)
        decision_rows = await db.execute(
            select(
                ValidationDecision.agent_id,
                func.count(func.distinct(ValidationDecision.session_id)),
            )
            .where(
                ValidationDecision.agent_id.in_(agent_ids),
                *decision_conditions,
            )
            .group_by(ValidationDecision.agent_id)
        )
        for agent_id, count in decision_rows.all():
            completed_by_agent[agent_id] = int(count or 0)

    agent_performance = []
    for agent in agents:
        agent_performance.append(
            {
                "name": agent.name,
                "role": agent.role.value if hasattr(agent.role, "value") else str(agent.role),
                "dossiers": active_load.get(agent.id, 0),
                "active_queue": active_load.get(agent.id, 0),
                "completed": completed_by_agent.get(agent.id, 0),
                "avgTime": _format_duration(sum(durations) / len(durations) if durations else 0),
                "slaRate": _pct(len(durations) - late, len(durations)),
            }
        )
    return {
        "pending_count": pending,
        "to_treat": to_treat,
        "validated_today": validated_today,
        "sla": {
            "avg_validation_time": _format_duration(sum(durations) / len(durations) if durations else 0),
            "sla_respect_rate": f"{_pct(len(durations) - late, len(durations))}%",
            "late_dossiers": late,
        },
        "customer_operations": {
            "active_support_threads": active_support_threads,
            "passcode_resets": passcode_resets,
            "visa_mastercard_delivery": card_requests,
        },
        "agent_performance": agent_performance,
    }


async def get_marketing_metrics(db: AsyncSession, **filters: Any) -> dict[str, Any]:
    where, params = _filters(
        date_column="e.occurred_at::date",
        agency_column="da.source_agency_id::text",
        channel_column="e.channel",
        agent_column="dag.source_agent_id::text",
        date_from=filters.get("date_from"),
        date_to=filters.get("date_to"),
        agency_id=filters.get("agency_id"),
        channel=filters.get("channel"),
        agent_id=filters.get("agent_id"),
    )
    try:
        rows = await _mappings(
            db,
            f"""
            SELECT e.channel,
                   COUNT(DISTINCT e.session_id) AS sessions,
                   COUNT(DISTINCT CASE WHEN e.event_type = 'KYC_APPROVED' THEN e.session_id END) AS approved
            FROM dwh.fact_kyc_events e
            LEFT JOIN dwh.dim_agencies da ON da.id = e.agency_dim_id
            LEFT JOIN dwh.dim_agents dag ON dag.id = e.agent_dim_id
            {where}
            GROUP BY e.channel
            ORDER BY sessions DESC
            """,
            params,
        )
    except Exception:
        rows = []
    channels = [
        {
            "channel": row["channel"] or "direct",
            "sessions": int(row["sessions"] or 0),
            "approved": int(row["approved"] or 0),
            "conversion_rate": f"{_pct(int(row['approved'] or 0), int(row['sessions'] or 0))}%",
        }
        for row in rows
    ]
    if not channels:
        total = int((await db.execute(select(func.count(KYCSession.id)))).scalar() or 0)
        approved = int((await db.execute(select(func.count(KYCSession.id)).where(KYCSession.status == "APPROVED"))).scalar() or 0)
        channels = [{"channel": "direct", "sessions": total, "approved": approved, "conversion_rate": f"{_pct(approved, total)}%"}]
    return {"channels": channels}


async def get_qa_metrics(db: AsyncSession, **filters: Any) -> dict[str, Any]:
    doc_conditions = _kyc_conditions(filters, Document.captured_at)
    if filters.get("doc_type"):
        doc_conditions.append(Document.doc_type == filters["doc_type"])
    doc_base = select(func.count(Document.id)).join(KYCSession, KYCSession.id == Document.session_id)
    ocr_failed = int((await db.execute(doc_base.where(Document.ocr_status == "FAILED", *doc_conditions))).scalar() or 0)
    partial = int((await db.execute(doc_base.where(Document.ocr_status == "PARTIAL", *doc_conditions))).scalar() or 0)

    audit_conditions = []
    start, end = _datetime_bounds(filters.get("date_from"), filters.get("date_to"))
    if start is not None:
        audit_conditions.append(AuditLog.performed_at >= start)
    if end is not None:
        audit_conditions.append(AuditLog.performed_at < end)
    audit_errors = int((await db.execute(select(func.count(AuditLog.id)).where(AuditLog.action.ilike("%ERROR%"), *audit_conditions))).scalar() or 0)
    celery_failed = int((await db.execute(select(func.count(BatchJob.id)).where(BatchJob.status.in_(["FAILED", "ERROR"])))).scalar() or 0)
    return {
        "ocr_failed": ocr_failed,
        "ocr_partial": partial,
        "audit_error_events": audit_errors,
        "celery_failed_jobs": celery_failed,
    }


async def get_technical_metrics(db: AsyncSession, **filters: Any) -> dict[str, Any]:
    db_ok = await check_db_connection()
    redis_ok = await check_redis_connection()
    qa = await get_qa_metrics(db, **filters)
    return {
        "db": "ok" if db_ok else "error",
        "redis": "ok" if redis_ok else "error",
        "sentry_proxy": "configured" if settings.SENTRY_DSN else "disabled",
        "environment": settings.ENVIRONMENT,
        "qa": qa,
    }


def _num(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _int_num(value: Any, default: int = 0) -> int:
    try:
        return int(value or default)
    except (TypeError, ValueError):
        return default


def _safe_div(numerator: float | int, denominator: float | int) -> float:
    denominator = float(denominator or 0)
    return float(numerator or 0) / denominator if denominator else 0.0


def _format_ratio(value: float | int | None) -> str:
    return f"{_num(value) * 100:.1f}%"


def _format_percent_value(value: float | int | None) -> str:
    return f"{_num(value):.1f}%"


def _format_xaf(value: float | int | None) -> str:
    amount = _num(value)
    return f"{amount:,.0f} XAF".replace(",", " ")


def _metric(raw: Any, display: str, unit: str | None = None) -> dict[str, Any]:
    payload = {"raw": raw, "display": display}
    if unit:
        payload["unit"] = unit
    return payload


def _ratio_metric(value: float | int | None) -> dict[str, Any]:
    raw = _num(value)
    return _metric(raw, _format_ratio(raw), "ratio")


def _count_metric(value: int | float | None) -> dict[str, Any]:
    raw = _int_num(value)
    return _metric(raw, str(raw), "count")


def _duration_seconds_metric(value: float | int | None) -> dict[str, Any]:
    raw = _num(value)
    return _metric(raw, _format_duration(raw), "seconds")


def _money_metric(value: float | int | None, baseline_required: bool = False) -> dict[str, Any]:
    if baseline_required:
        return _metric(None, BASELINE_REQUIRED, "XAF")
    raw = _num(value)
    return _metric(raw, _format_xaf(raw), "XAF")


def _baseline_value(baseline: dict[str, Any], key: str, default: float = 0.0) -> float:
    return _num(baseline.get(key), default)


def calculate_business_case_metrics(
    baseline: dict[str, Any] | None,
    actual: dict[str, Any],
) -> dict[str, Any]:
    """Compute business KPIs from declarative BICEC baseline and VeriPass facts."""

    started = _int_num(actual.get("started_count"))
    submitted = _int_num(actual.get("submitted_count"))
    approved = _int_num(actual.get("approved_count"))
    approved_without_info = _int_num(actual.get("approved_without_info_count"))
    abandoned = _int_num(actual.get("abandoned_count"))
    info_requested = _int_num(actual.get("info_requested_sessions"))
    resubmitted = _int_num(actual.get("resubmitted_count"))
    ocr_fields = _int_num(actual.get("ocr_fields_count"))
    ocr_corrected = _int_num(actual.get("ocr_corrected_count"))
    decision_count = _int_num(actual.get("decision_count"))
    late_decisions = _int_num(actual.get("late_decisions_count"))
    aml_alert_sessions = _int_num(actual.get("aml_alert_sessions"))
    aml_alert_count = _int_num(actual.get("aml_alert_count"))
    risk_blocked_open = _int_num(actual.get("risk_blocked_open_count"))

    first_time_right_rate = _safe_div(approved_without_info, submitted)
    complement_request_rate = _safe_div(info_requested, submitted)
    resubmission_rate = _safe_div(resubmitted, submitted)
    ocr_correction_rate = _safe_div(ocr_corrected, ocr_fields)
    abandonment_rate = _safe_div(abandoned, started)
    conversion_rate = _safe_div(approved, started)
    sla_respected_rate = _safe_div(decision_count - late_decisions, decision_count)
    aml_alert_rate = _safe_div(aml_alert_sessions, submitted)

    baseline_required = baseline is None
    finance = {
        "current_cost_per_dossier": _money_metric(None, baseline_required=True),
        "veripass_cost_per_dossier": _money_metric(None, baseline_required=True),
        "operational_savings_monthly": _money_metric(None, baseline_required=True),
        "compliance_gain_monthly": _money_metric(None, baseline_required=True),
        "commercial_gain_monthly": _money_metric(None, baseline_required=True),
        "pilot_gain": _money_metric(None, baseline_required=True),
        "pilot_cost": _money_metric(None, baseline_required=True),
        "roi_percent": _metric(None, BASELINE_REQUIRED, "percent"),
    }
    direction = {
        "pilot_abandonment_rate": _ratio_metric(abandonment_rate),
        "start_to_approved_conversion_rate": _ratio_metric(conversion_rate),
        "conversion_uplift_vs_baseline": _metric(None, BASELINE_REQUIRED, "ratio"),
        "estimated_commercial_value": _money_metric(None, baseline_required=True),
    }
    compliance_extra = {
        "audit_export_time_saved_hours": _metric(None, BASELINE_REQUIRED, "hours"),
    }

    if baseline:
        monthly_volume = _baseline_value(baseline, "monthly_kyc_volume", submitted or started)
        hourly_cost = _baseline_value(baseline, "hourly_staff_cost_xaf")
        branch_minutes = _baseline_value(baseline, "current_branch_minutes_per_dossier")
        backoffice_minutes = _baseline_value(baseline, "current_backoffice_minutes_per_dossier")
        current_cost_per_dossier = ((branch_minutes + backoffice_minutes) / 60) * hourly_cost

        avg_review_minutes = _num(actual.get("avg_review_duration_ms")) / 60000
        pilot_dossiers = submitted or monthly_volume
        pilot_labor_cost_per_dossier = (avg_review_minutes / 60) * hourly_cost
        pilot_run_cost_per_dossier = _safe_div(
            _baseline_value(baseline, "pilot_monthly_run_cost_xaf"),
            pilot_dossiers,
        )
        veripass_cost_per_dossier = pilot_labor_cost_per_dossier + pilot_run_cost_per_dossier

        operational_savings_monthly = max(current_cost_per_dossier - veripass_cost_per_dossier, 0) * pilot_dossiers
        avoided_rework = monthly_volume * max(_baseline_value(baseline, "current_incomplete_rate") - complement_request_rate, 0)
        audit_hours_saved = max(
            _baseline_value(baseline, "current_audit_assembly_hours")
            - _baseline_value(baseline, "veripass_audit_export_hours"),
            0,
        )
        compliance_gain_monthly = (
            _baseline_value(baseline, "audit_requests_per_period") * audit_hours_saved * hourly_cost
            + avoided_rework * _baseline_value(baseline, "average_rework_cost_xaf")
        )
        baseline_conversion_rate = max(1 - _baseline_value(baseline, "current_abandonment_rate"), 0)
        conversion_uplift = conversion_rate - baseline_conversion_rate
        commercial_gain_monthly = (
            max(conversion_uplift, 0)
            * monthly_volume
            * _baseline_value(baseline, "avg_customer_12m_value_xaf")
        )
        pilot_duration_months = max(_int_num(baseline.get("pilot_duration_months"), 1), 1)
        pilot_setup_cost = _baseline_value(baseline, "pilot_setup_cost_xaf")
        pilot_monthly_run_cost = _baseline_value(baseline, "pilot_monthly_run_cost_xaf")
        pilot_cost = (
            pilot_setup_cost
            + pilot_monthly_run_cost * pilot_duration_months
            + pilot_labor_cost_per_dossier * monthly_volume * pilot_duration_months
        )
        pilot_gain = (
            operational_savings_monthly + compliance_gain_monthly + commercial_gain_monthly
        ) * pilot_duration_months
        roi_percent = ((pilot_gain - pilot_cost) / pilot_cost * 100) if pilot_cost > 0 else None

        finance = {
            "current_cost_per_dossier": _money_metric(current_cost_per_dossier),
            "veripass_cost_per_dossier": _money_metric(veripass_cost_per_dossier),
            "operational_savings_monthly": _money_metric(operational_savings_monthly),
            "compliance_gain_monthly": _money_metric(compliance_gain_monthly),
            "commercial_gain_monthly": _money_metric(commercial_gain_monthly),
            "pilot_gain": _money_metric(pilot_gain),
            "pilot_cost": _money_metric(pilot_cost),
            "roi_percent": _metric(
                roi_percent,
                _format_percent_value(roi_percent) if roi_percent is not None else "N/A",
                "percent",
            ),
        }
        direction = {
            "pilot_abandonment_rate": _ratio_metric(abandonment_rate),
            "start_to_approved_conversion_rate": _ratio_metric(conversion_rate),
            "conversion_uplift_vs_baseline": _ratio_metric(conversion_uplift),
            "estimated_commercial_value": _money_metric(commercial_gain_monthly),
        }
        compliance_extra = {
            "audit_export_time_saved_hours": _metric(audit_hours_saved, f"{audit_hours_saved:.1f}h", "hours"),
        }

    return {
        "baseline_required": baseline_required,
        "network_quality": {
            "first_time_right_rate": _ratio_metric(first_time_right_rate),
            "complement_request_rate": _ratio_metric(complement_request_rate),
            "resubmission_rate": _ratio_metric(resubmission_rate),
            "ocr_correction_rate": _ratio_metric(ocr_correction_rate),
            "start_to_submit_delay": _duration_seconds_metric(actual.get("avg_start_to_submit_seconds")),
        },
        "operations": {
            "submit_to_decision_delay": _duration_seconds_metric(actual.get("avg_submit_to_decision_seconds")),
            "average_agent_review_duration": _metric(
                _num(actual.get("avg_review_duration_ms")),
                _format_duration(_num(actual.get("avg_review_duration_ms")) / 1000),
                "milliseconds",
            ),
            "sla_respected_rate": _ratio_metric(sla_respected_rate),
            "late_dossiers": _count_metric(late_decisions),
        },
        "finance": finance,
        "direction": direction,
        "compliance": {
            "aml_alert_rate": _ratio_metric(aml_alert_rate),
            "aml_alert_count": _count_metric(aml_alert_count),
            "risk_blocked_open_count": _count_metric(risk_blocked_open),
            **compliance_extra,
        },
    }


BASELINE_FIELDS = [
    "id",
    "period_start",
    "period_end",
    "agency_id",
    "monthly_kyc_volume",
    "current_avg_days_to_validate",
    "current_branch_minutes_per_dossier",
    "current_backoffice_minutes_per_dossier",
    "current_incomplete_rate",
    "current_complement_rate",
    "current_abandonment_rate",
    "hourly_staff_cost_xaf",
    "avg_customer_12m_value_xaf",
    "audit_requests_per_period",
    "current_audit_assembly_hours",
    "veripass_audit_export_hours",
    "average_rework_cost_xaf",
    "current_aml_sensitive_case_rate",
    "pilot_setup_cost_xaf",
    "pilot_monthly_run_cost_xaf",
    "pilot_duration_months",
    "source_note",
    "validated_by",
    "validated_at",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
]


def _json_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _baseline_to_dict(baseline: BusinessMetricBaseline | None) -> dict[str, Any] | None:
    if baseline is None:
        return None
    return {field: _json_value(getattr(baseline, field)) for field in BASELINE_FIELDS}


def _agent_uuid(agent: Agent | Any) -> uuid.UUID | None:
    agent_id = getattr(agent, "id", None)
    return agent_id if isinstance(agent_id, uuid.UUID) else None


async def _find_business_baseline_record(
    db: AsyncSession,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    agency_id: str | None = None,
) -> BusinessMetricBaseline | None:
    conditions: list[Any] = []
    if date_from:
        conditions.append(BusinessMetricBaseline.period_end >= date_from)
    if date_to:
        conditions.append(BusinessMetricBaseline.period_start <= date_to)

    agency_uuid = _parse_uuid(agency_id)
    if agency_uuid:
        query = (
            select(BusinessMetricBaseline)
            .where(
                *conditions,
                (BusinessMetricBaseline.agency_id == agency_uuid) | BusinessMetricBaseline.agency_id.is_(None),
            )
            .order_by(
                (BusinessMetricBaseline.agency_id == agency_uuid).desc(),
                BusinessMetricBaseline.updated_at.desc(),
                BusinessMetricBaseline.created_at.desc(),
            )
        )
    else:
        query = (
            select(BusinessMetricBaseline)
            .where(*conditions, BusinessMetricBaseline.agency_id.is_(None))
            .order_by(BusinessMetricBaseline.updated_at.desc(), BusinessMetricBaseline.created_at.desc())
        )
    return (await db.execute(query.limit(1))).scalar_one_or_none()


async def get_business_baseline(
    db: AsyncSession,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    agency_id: str | None = None,
) -> dict[str, Any] | None:
    return _baseline_to_dict(
        await _find_business_baseline_record(
            db,
            date_from=date_from,
            date_to=date_to,
            agency_id=agency_id,
        )
    )


async def create_business_baseline(db: AsyncSession, payload: Any, agent: Agent) -> dict[str, Any]:
    now = _utc_now()
    agent_id = _agent_uuid(agent)
    data = payload.model_dump()
    baseline = BusinessMetricBaseline(
        **data,
        created_by=agent_id,
        updated_by=agent_id,
        validated_by=agent_id,
        validated_at=now,
    )
    db.add(baseline)
    await db.commit()
    await db.refresh(baseline)
    return _baseline_to_dict(baseline) or {}


async def update_business_baseline(db: AsyncSession, payload: Any, agent: Agent) -> dict[str, Any]:
    data = payload.model_dump()
    baseline_id = data.pop("id", None)
    if baseline_id:
        baseline = (
            await db.execute(select(BusinessMetricBaseline).where(BusinessMetricBaseline.id == baseline_id))
        ).scalar_one_or_none()
    else:
        baseline = await _find_business_baseline_record(
            db,
            date_from=data.get("period_start"),
            date_to=data.get("period_end"),
            agency_id=str(data.get("agency_id")) if data.get("agency_id") else None,
        )
    if baseline is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business baseline not found")

    for key, value in data.items():
        setattr(baseline, key, value)
    agent_id = _agent_uuid(agent)
    baseline.updated_by = agent_id
    baseline.validated_by = agent_id
    baseline.validated_at = _utc_now()
    await db.commit()
    await db.refresh(baseline)
    return _baseline_to_dict(baseline) or {}


async def _business_actuals(db: AsyncSession, **filters: Any) -> dict[str, Any]:
    session_conditions = _kyc_conditions(filters)
    agency_uuid = _parse_uuid(filters.get("agency_id"))

    started_count = _int_num(
        (await db.execute(select(func.count(KYCSession.id)).where(*session_conditions))).scalar()
    )
    submitted_count = _int_num(
        (
            await db.execute(
                select(func.count(KYCSession.id)).where(
                    KYCSession.submitted_at.is_not(None),
                    *session_conditions,
                )
            )
        ).scalar()
    )
    approved_count = _int_num(
        (
            await db.execute(
                select(func.count(KYCSession.id)).where(
                    KYCSession.status == "APPROVED",
                    *session_conditions,
                )
            )
        ).scalar()
    )
    abandoned_count = _int_num(
        (
            await db.execute(
                select(func.count(KYCSession.id)).where(
                    KYCSession.status == "ABANDONED",
                    *session_conditions,
                )
            )
        ).scalar()
    )

    info_subquery = select(ValidationDecision.session_id).where(ValidationDecision.decision == "INFO_REQUESTED")
    approved_without_info_count = _int_num(
        (
            await db.execute(
                select(func.count(KYCSession.id)).where(
                    KYCSession.status == "APPROVED",
                    ~KYCSession.id.in_(info_subquery),
                    *session_conditions,
                )
            )
        ).scalar()
    )
    info_requested_sessions = _int_num(
        (
            await db.execute(
                select(func.count(func.distinct(ValidationDecision.session_id)))
                .join(KYCSession, KYCSession.id == ValidationDecision.session_id)
                .where(ValidationDecision.decision == "INFO_REQUESTED", *session_conditions)
            )
        ).scalar()
    )

    audit_conditions = []
    start, end = _datetime_bounds(filters.get("date_from"), filters.get("date_to"))
    if start is not None:
        audit_conditions.append(AuditLog.performed_at >= start)
    if end is not None:
        audit_conditions.append(AuditLog.performed_at < end)
    resubmitted_count = _int_num(
        (
            await db.execute(
                select(func.count(func.distinct(AuditLog.record_id))).where(
                    AuditLog.action == "KYC_RESUBMIT",
                    *audit_conditions,
                )
            )
        ).scalar()
    )

    doc_conditions = _kyc_conditions(filters, Document.captured_at)
    if filters.get("doc_type"):
        doc_conditions.append(Document.doc_type == filters["doc_type"])
    ocr_base = select(func.count(OCRField.id)).join(Document, Document.id == OCRField.document_id).join(KYCSession, KYCSession.id == Document.session_id)
    ocr_fields_count = _int_num((await db.execute(ocr_base.where(*doc_conditions))).scalar())
    ocr_corrected_count = _int_num(
        (await db.execute(ocr_base.where(OCRField.human_corrected == True, *doc_conditions))).scalar()  # noqa: E712
    )

    avg_start_to_submit_seconds = _num(
        (
            await db.execute(
                select(func.avg(func.extract("epoch", KYCSession.submitted_at - KYCSession.started_at))).where(
                    KYCSession.submitted_at.is_not(None),
                    *session_conditions,
                )
            )
        ).scalar()
    )
    avg_submit_to_decision_seconds = _num(
        (
            await db.execute(
                select(func.avg(func.extract("epoch", ValidationDecision.decided_at - KYCSession.submitted_at)))
                .join(KYCSession, KYCSession.id == ValidationDecision.session_id)
                .where(KYCSession.submitted_at.is_not(None), *session_conditions)
            )
        ).scalar()
    )
    avg_review_duration_ms = _num(
        (
            await db.execute(
                select(func.avg(ValidationDecision.review_duration_ms))
                .join(KYCSession, KYCSession.id == ValidationDecision.session_id)
                .where(ValidationDecision.review_duration_ms.is_not(None), *session_conditions)
            )
        ).scalar()
    )
    decision_count = _int_num(
        (
            await db.execute(
                select(func.count(ValidationDecision.id))
                .join(KYCSession, KYCSession.id == ValidationDecision.session_id)
                .where(*session_conditions)
            )
        ).scalar()
    )
    late_decisions_count = _int_num(
        (
            await db.execute(
                select(func.count(ValidationDecision.id))
                .join(KYCSession, KYCSession.id == ValidationDecision.session_id)
                .where(
                    KYCSession.submitted_at.is_not(None),
                    func.extract("epoch", ValidationDecision.decided_at - KYCSession.submitted_at) > 7200,
                    *session_conditions,
                )
            )
        ).scalar()
    )

    aml_query_conditions = _kyc_conditions(filters, AmlAlert.created_at)
    aml_alert_count = _int_num(
        (
            await db.execute(
                select(func.count(AmlAlert.id))
                .join(KYCSession, KYCSession.id == AmlAlert.session_id)
                .where(*aml_query_conditions)
            )
        ).scalar()
    )
    aml_alert_sessions = _int_num(
        (
            await db.execute(
                select(func.count(func.distinct(AmlAlert.session_id)))
                .join(KYCSession, KYCSession.id == AmlAlert.session_id)
                .where(*aml_query_conditions)
            )
        ).scalar()
    )
    risk_block_conditions = [AmlAlert.status.in_(OPEN_AML_STATUSES), ~KYCSession.status.in_(["APPROVED", "REJECTED", "ABANDONED"])]
    if agency_uuid:
        risk_block_conditions.append(KYCSession.agency_id == agency_uuid)
    risk_blocked_open_count = _int_num(
        (
            await db.execute(
                select(func.count(func.distinct(KYCSession.id)))
                .join(AmlAlert, AmlAlert.session_id == KYCSession.id)
                .where(*risk_block_conditions)
            )
        ).scalar()
    )
    audit_export_events = _int_num(
        (
            await db.execute(
                select(func.count(AuditLog.id)).where(
                    AuditLog.action.ilike("%EXPORT%"),
                    *audit_conditions,
                )
            )
        ).scalar()
    )
    dwh_events_count = 0
    try:
        where, params = _filters(
            date_column="occurred_at::date",
            agency_column=None,
            channel_column="channel",
            date_from=filters.get("date_from"),
            date_to=filters.get("date_to"),
            channel=filters.get("channel"),
        )
        dwh_events_count = _int_num(await _scalar(db, f"SELECT COUNT(*) FROM dwh.fact_kyc_events{where}", params))
    except Exception:
        dwh_events_count = 0

    return {
        "started_count": started_count,
        "submitted_count": submitted_count,
        "approved_count": approved_count,
        "approved_without_info_count": approved_without_info_count,
        "abandoned_count": abandoned_count,
        "info_requested_sessions": info_requested_sessions,
        "resubmitted_count": resubmitted_count,
        "ocr_fields_count": ocr_fields_count,
        "ocr_corrected_count": ocr_corrected_count,
        "avg_start_to_submit_seconds": avg_start_to_submit_seconds,
        "avg_submit_to_decision_seconds": avg_submit_to_decision_seconds,
        "avg_review_duration_ms": avg_review_duration_ms,
        "decision_count": decision_count,
        "late_decisions_count": late_decisions_count,
        "aml_alert_sessions": aml_alert_sessions,
        "aml_alert_count": aml_alert_count,
        "risk_blocked_open_count": risk_blocked_open_count,
        "audit_export_events": audit_export_events,
        "dwh_events_count": dwh_events_count,
    }


BUSINESS_FORMULAS = [
    {
        "metric": "First-time-right",
        "formula": "dossiers approuves sans INFO_REQUESTED / dossiers soumis",
        "source": "validation_decisions + kyc_sessions",
    },
    {
        "metric": "Cout actuel par dossier",
        "formula": "(minutes agence actuelles + minutes backoffice actuelles) / 60 * cout horaire",
        "source": "baseline BICEC",
    },
    {
        "metric": "Cout VeriPass par dossier",
        "formula": "cout main-d'oeuvre pilote + cout mensuel run / dossiers pilote",
        "source": "review_duration_ms + baseline BICEC",
    },
    {
        "metric": "ROI pilote",
        "formula": "(gains pilote - couts pilote) / couts pilote * 100",
        "source": "baseline BICEC + metriques VeriPass",
    },
    {
        "metric": "Gain commercial",
        "formula": "uplift conversion vs baseline * volume mensuel * valeur client 12 mois",
        "source": "kyc_sessions + baseline BICEC",
    },
    {
        "metric": "Gain audit/conformite",
        "formula": "heures audit evitees * cout horaire + reprises evitees * cout reprise",
        "source": "audit_log + baseline BICEC",
    },
]


async def get_business_case(db: AsyncSession, **filters: Any) -> dict[str, Any]:
    baseline = await get_business_baseline(
        db,
        date_from=filters.get("date_from"),
        date_to=filters.get("date_to"),
        agency_id=filters.get("agency_id"),
    )
    actual = await _business_actuals(db, **filters)
    metrics = calculate_business_case_metrics(baseline, actual)
    return {
        "generated_at": _utc_now().isoformat(),
        "filters": {key: _json_value(value) for key, value in filters.items()},
        "baseline": baseline,
        "actuals": actual,
        "formulas": BUSINESS_FORMULAS,
        **metrics,
    }


def build_business_case_export_html(payload: dict[str, Any]) -> str:
    def row(label: str, metric: dict[str, Any]) -> str:
        return (
            "<tr>"
            f"<th>{escape(label)}</th>"
            f"<td>{escape(str(metric.get('display', '')))}</td>"
            f"<td>{escape(str(metric.get('raw', '')))}</td>"
            "</tr>"
        )

    sections = [
        ("Reseau / qualite dossier", payload.get("network_quality", {})),
        ("Operations", payload.get("operations", {})),
        ("Finance", payload.get("finance", {})),
        ("Direction", payload.get("direction", {})),
        ("Conformite", payload.get("compliance", {})),
    ]
    section_html = []
    for title, metrics in sections:
        rows = "".join(row(key.replace("_", " "), value) for key, value in metrics.items())
        section_html.append(
            f"<h2>{escape(title)}</h2><table><thead><tr><th>Metrique</th><th>Affichage</th><th>Raw</th></tr></thead><tbody>{rows}</tbody></table>"
        )
    formula_rows = "".join(
        "<tr>"
        f"<td>{escape(item['metric'])}</td>"
        f"<td>{escape(item['formula'])}</td>"
        f"<td>{escape(item['source'])}</td>"
        "</tr>"
        for item in payload.get("formulas", [])
    )
    baseline_status = "Baseline requise" if payload.get("baseline_required") else "Baseline validee"
    return f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>VeriPass - Pilotage & ROI</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 32px; color: #0f172a; }}
    h1 {{ margin-bottom: 4px; }}
    h2 {{ margin-top: 28px; }}
    .meta {{ color: #475569; margin-bottom: 20px; }}
    .badge {{ display: inline-block; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }}
    table {{ border-collapse: collapse; width: 100%; margin-top: 8px; }}
    th, td {{ border: 1px solid #e2e8f0; padding: 8px; text-align: left; vertical-align: top; }}
    th {{ background: #f8fafc; }}
  </style>
</head>
<body>
  <h1>VeriPass - Pilotage & ROI</h1>
  <p class="meta">Genere le {escape(str(payload.get("generated_at", "")))} - <span class="badge">{escape(baseline_status)}</span></p>
  {''.join(section_html)}
  <h2>Formules</h2>
  <table><thead><tr><th>Metrique</th><th>Formule</th><th>Source</th></tr></thead><tbody>{formula_rows}</tbody></table>
</body>
</html>"""


async def get_dashboard_stats(db: AsyncSession, role: str = "SYLVIE", **filters: Any) -> dict[str, Any]:
    role_value = role.value if hasattr(role, "value") else str(role)
    funnel = await get_funnel_metrics(db, **filters)
    documents = await get_document_performance(db, **filters)
    fraud = await get_fraud_metrics(db, **filters)
    compliance = await get_compliance_metrics(db, **filters)
    operations = await get_operations_metrics(db, **filters)
    marketing = await get_marketing_metrics(db, **filters)
    qa = await get_qa_metrics(db, **filters)

    if role_value == AgentRole.ADMIN_IT.value:
        return {
            "role": role_value,
            "summary": [
                {"name": "OCR failed", "value": str(qa["ocr_failed"]), "icon": "AlertTriangle", "color": "text-red-600"},
                {"name": "OCR partial", "value": str(qa["ocr_partial"]), "icon": "FileText", "color": "text-yellow-600"},
                {"name": "Erreurs auditables", "value": str(qa["audit_error_events"]), "icon": "BarChart3", "color": "text-orange-600"},
                {"name": "Jobs Celery failed", "value": str(qa["celery_failed_jobs"]), "icon": "Wrench", "color": "text-red-600"},
            ],
            "qa": qa,
        }

    activity_query = (
        select(ValidationDecision)
        .options(joinedload(ValidationDecision.agent))
        .order_by(ValidationDecision.decided_at.desc())
        .limit(5)
    )
    recent_decisions = (await db.execute(activity_query)).scalars().all()
    recent_activity = [
        {
            "action": f"{decision.decision} #{str(decision.session_id)[:8]}",
            "time": decision.decided_at.isoformat(),
            "user": decision.agent.name if decision.agent else "Système",
        }
        for decision in recent_decisions
    ]
    approved = next((step["count"] for step in funnel["steps"] if "Valid" in step["step"] or "Activé" in step["step"]), 0)
    total = funnel["total"]
    conversion_rate = _pct(approved, total)
    abandoned = 0
    try:
        abandoned = int(await _scalar(db, "SELECT COUNT(*) FROM dwh.fact_kyc_funnel WHERE dropout_step IS NOT NULL") or 0)
    except Exception:
        abandoned = int((await db.execute(select(func.count(KYCSession.id)).where(KYCSession.status == "ABANDONED"))).scalar() or 0)

    payload = {
        "role": role_value,
        "summary": [
            {"name": "Dossiers en attente", "value": str(operations["pending_count"]), "icon": "Clock", "color": "text-yellow-600"},
            {"name": "Validés aujourd'hui", "value": str(operations["validated_today"]), "icon": "CheckCircle", "color": "text-green-600"},
            {"name": "Alertes AML", "value": str(compliance["open_alerts"]), "icon": "AlertTriangle", "color": "text-red-600"},
            {"name": "À traiter", "value": str(operations["to_treat"]), "icon": "FileCheck", "color": "text-blue-600"},
        ],
        "conversion_metrics": {
            "conversion_rate": f"{conversion_rate}%",
            "abandon_rate": f"{_pct(abandoned, total)}%",
            "total_onboardings": total,
        },
        "funnel": funnel["steps"],
        "document_performance": documents,
        "fraud_gaps": fraud,
        "compliance_kpis": compliance,
        "agent_performance": operations["agent_performance"],
        "recent_activity": recent_activity,
        "sla": operations["sla"],
        "customer_operations": operations["customer_operations"],
        "marketing": marketing,
        "qa": qa,
    }
    if role_value == AgentRole.THOMAS.value:
        return {
            "role": role_value,
            "summary": [
                {"name": "Alertes AML", "value": str(compliance["open_alerts"]), "icon": "AlertTriangle", "color": "text-red-600"},
                {"name": "Conflits NIU", "value": str(fraud["niu_conflicts"]), "icon": "GitMerge", "color": "text-orange-600"},
                {"name": "Alertes confirmées", "value": str(compliance["confirmed_alerts"]), "icon": "ShieldAlert", "color": "text-red-600"},
                {"name": "Faux positifs classés", "value": str(compliance["cleared_alerts"]), "icon": "CheckCircle", "color": "text-green-600"},
            ],
            "compliance_kpis": compliance,
            "fraud_gaps": fraud,
        }
    return payload


async def export_analytics(db: AsyncSession, **filters: Any) -> dict[str, Any]:
    return {
        "dashboard": await get_dashboard_stats(db, **filters),
        "generated_at": _utc_now().isoformat(),
    }


async def backfill_dwh(db: AsyncSession) -> dict[str, int]:
    sessions = (await db.execute(select(KYCSession))).scalars().all()
    for session in sessions:
        await refresh_funnel_snapshot(db, session.id)
        await _track_event_once(
            db,
            event_type="KYC_SESSION_STARTED",
            session_id=session.id,
            user_id=session.user_id,
            agency_id=session.agency_id,
            occurred_at=session.started_at,
            step="start",
            status=session.status,
        )
        if session.submitted_at:
            await _track_event_once(
                db,
                event_type="KYC_SUBMITTED",
                session_id=session.id,
                occurred_at=session.submitted_at,
                step="submission",
                status=session.status,
            )
        if session.status in {"APPROVED", "REJECTED", "FRAUD_SUSPECT"} and session.completed_at:
            await _track_event_once(
                db,
                event_type=f"KYC_{session.status}",
                session_id=session.id,
                occurred_at=session.completed_at,
                step=session.status.lower(),
                status=session.status,
            )

    consents = (await db.execute(select(ConsentRecord))).scalars().all()
    for consent in consents:
        await _track_event_once(
            db,
            event_type="CONSENT_SUBMITTED",
            session_id=consent.session_id,
            occurred_at=consent.signed_at,
            step="consent",
            status="SIGNED",
        )

    documents = (await db.execute(select(Document))).scalars().all()
    for document in documents:
        await record_ocr_performance(db, document.id)
        metadata = {"document_id": str(document.id), "doc_type": document.doc_type}
        await _track_event_once(
            db,
            event_type="DOCUMENT_UPLOADED",
            session_id=document.session_id,
            occurred_at=document.captured_at,
            step=f"upload_{document.doc_type.lower()}",
            status=document.ocr_status,
            metadata=metadata,
            metadata_key="document_id",
            metadata_value=str(document.id),
        )
        if document.ocr_status in {"SUCCESS", "PARTIAL", "FAILED", "MANUAL"}:
            await _track_event_once(
                db,
                event_type="OCR_FAILED" if document.ocr_status == "FAILED" else "OCR_COMPLETED",
                session_id=document.session_id,
                occurred_at=document.captured_at,
                step="ocr",
                status=document.ocr_status,
                metadata=metadata | {"engine": document.ocr_engine},
                metadata_key="document_id",
                metadata_value=str(document.id),
            )

    biometrics = (await db.execute(select(BiometricResult))).scalars().all()
    for biometric in biometrics:
        if biometric.liveness_score is not None:
            await _track_event_once(
                db,
                event_type="LIVENESS_PASSED" if float(biometric.liveness_score) >= 0.7 else "LIVENESS_FAILED",
                session_id=biometric.session_id,
                occurred_at=biometric.processed_at,
                step="liveness",
                status="PASSED" if float(biometric.liveness_score) >= 0.7 else "FAILED",
            )
        if biometric.face_match_status == "FAILED":
            await _track_event_once(
                db,
                event_type="FACE_MATCH_FAILED",
                session_id=biometric.session_id,
                occurred_at=biometric.processed_at,
                step="face_match",
                status="FAILED",
            )

    alerts = (await db.execute(select(AmlAlert))).scalars().all()
    for alert in alerts:
        event_type = {
            "OPEN": "AML_ALERT_OPENED",
            "CLEARED": "AML_ALERT_CLEARED",
            "CONFIRMED": "AML_ALERT_CONFIRMED",
        }.get(alert.status)
        if event_type:
            await _track_event_once(
                db,
                event_type=event_type,
                session_id=alert.session_id,
                occurred_at=alert.created_at,
                step="aml_screening",
                status=alert.status,
                metadata={"alert_id": str(alert.id), "alert_type": alert.alert_type},
                metadata_key="alert_id",
                metadata_value=str(alert.id),
            )

    duplicates = (await db.execute(select(DuplicateCheck))).scalars().all()
    for duplicate in duplicates:
        if duplicate.match_type == "NIU":
            await _track_event_once(
                db,
                event_type="NIU_CONFLICT_DETECTED",
                session_id=duplicate.session_id_new,
                occurred_at=duplicate.created_at,
                step="duplicate_check",
                status=duplicate.status,
                metadata={"duplicate_check_id": str(duplicate.id)},
                metadata_key="duplicate_check_id",
                metadata_value=str(duplicate.id),
            )
    await db.commit()
    return {
        "sessions": len(sessions),
        "documents": len(documents),
        "consents": len(consents),
        "biometrics": len(biometrics),
        "aml_alerts": len(alerts),
        "duplicates": len(duplicates),
    }
