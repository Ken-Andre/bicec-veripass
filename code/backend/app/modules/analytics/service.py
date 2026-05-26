"""Analytics service backed by the PostgreSQL dwh schema.

The operational tables in public remain the source of truth. The dwh schema is
the analytics read model used by dashboards; writes here are best-effort and
must not block KYC/AML workflows.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.logging import logger
from app.db.session import check_db_connection
from app.core.redis import check_redis_connection
from app.modules.admin.models import Agency
from app.modules.aml.models import BatchJob
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
