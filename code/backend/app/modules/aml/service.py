"""AML/CFT service layer."""

from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.logging import logger
from app.modules.admin.models import Agency
from app.modules.aml.models import AmlListImport, BatchJob
from app.modules.audit.models import AuditLog
from app.modules.analytics.service import track_event_best_effort
from app.modules.auth.models import Agent
from app.modules.kyc.models import AmlAlert, AmlAlertStatus, DuplicateCheck, KYCSession, PEPSanctions
from app.modules.notifications.service import (
    create_global_notification,
    create_user_notification,
)


def _normalized_alert_status(status: str) -> str:
    return "OPEN" if status == "PENDING" else status


def _alert_severity(score: float) -> str:
    if score >= 0.85:
        return "CRITICAL"
    if score >= 0.70:
        return "HIGH"
    if score >= 0.50:
        return "MEDIUM"
    return "LOW"


def _alert_hits(alert: AmlAlert) -> list[dict]:
    if not alert.pep_sanctions:
        return []
    programs = alert.pep_sanctions.programs or []
    program_text = " ".join(programs).upper()
    list_type = "SANCTIONS" if "SANCTION" in program_text else "PEP"
    return [
        {
            "id": str(alert.pep_sanctions.id),
            "listName": alert.pep_sanctions.source,
            "matchedName": alert.pep_sanctions.full_name,
            "matchScore": float(alert.match_score),
            "listType": list_type,
            "country": alert.pep_sanctions.nationality,
            "details": f"Programs: {', '.join(programs)}" if programs else None,
        }
    ]


AML_IMPORT_TEMPLATE_HEADERS = [
    "source",
    "list_type",
    "entity_type",
    "full_name",
    "aliases",
    "date_of_birth",
    "nationality",
    "programs",
    "is_active",
]

AML_LIST_TYPES = {"PEP", "SANCTIONS", "ADVERSE_MEDIA"}


def aml_import_template_csv() -> str:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=AML_IMPORT_TEMPLATE_HEADERS)
    writer.writeheader()
    writer.writerow(
        {
            "source": "BICEC_INTERNAL",
            "list_type": "PEP",
            "entity_type": "INDIVIDUAL",
            "full_name": "EXAMPLE NAME",
            "aliases": "EXAMPLE ALIAS;OTHER ALIAS",
            "date_of_birth": "1970-01-31",
            "nationality": "CM",
            "programs": "Internal watchlist",
            "is_active": "true",
        }
    )
    return output.getvalue()


def _split_csv_values(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.replace("|", ";").split(";") if part.strip()]


def _parse_import_date(value: str | None):
    if not value:
        return None
    raw = value.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(raw[:10], fmt).date()
        except ValueError:
            continue
    raise ValueError("date_of_birth must use YYYY-MM-DD or DD/MM/YYYY")


def _parse_bool(value: str | None) -> bool:
    if value is None or value == "":
        return True
    return value.strip().lower() in {"1", "true", "yes", "y", "oui", "active"}


def _read_aml_csv(csv_text: str) -> tuple[list[dict], list[dict]]:
    reader = csv.DictReader(io.StringIO(csv_text))
    missing_headers = sorted(set(AML_IMPORT_TEMPLATE_HEADERS) - set(reader.fieldnames or []))
    if missing_headers:
        return [], [{"row": 1, "message": f"Missing columns: {', '.join(missing_headers)}"}]

    rows: list[dict] = []
    errors: list[dict] = []
    for row_number, row in enumerate(reader, start=2):
        try:
            source = (row.get("source") or "BICEC_INTERNAL").strip() or "BICEC_INTERNAL"
            list_type = (row.get("list_type") or "PEP").strip().upper()
            if list_type not in AML_LIST_TYPES:
                raise ValueError("list_type must be PEP, SANCTIONS, or ADVERSE_MEDIA")
            full_name = (row.get("full_name") or "").strip()
            if not full_name:
                raise ValueError("full_name is required")
            entity_type = (row.get("entity_type") or "INDIVIDUAL").strip().upper()
            programs = _split_csv_values(row.get("programs"))
            if list_type not in programs:
                programs.insert(0, list_type)
            rows.append(
                {
                    "source": source,
                    "list_type": list_type,
                    "entity_type": entity_type,
                    "full_name": full_name,
                    "aliases": _split_csv_values(row.get("aliases")) or None,
                    "date_of_birth": _parse_import_date(row.get("date_of_birth")),
                    "nationality": (row.get("nationality") or "").strip() or None,
                    "programs": programs or None,
                    "is_active": _parse_bool(row.get("is_active")),
                }
            )
        except ValueError as exc:
            errors.append({"row": row_number, "message": str(exc)})
    return rows, errors


def _list_type_from_programs(programs: list[str] | None) -> str:
    program_text = " ".join(programs or []).upper()
    if "ADVERSE" in program_text:
        return "ADVERSE_MEDIA"
    if "SANCTION" in program_text:
        return "SANCTIONS"
    return "PEP"


def _alert_response(alert: AmlAlert, session: KYCSession | None) -> dict:
    score = float(alert.match_score)
    return {
        "id": str(alert.id),
        "sessionId": str(alert.session_id),
        "clientName": (session.client_name if session else None) or "Unknown",
        "niu": (session.niu_number if session else None) or "",
        "severity": _alert_severity(score),
        "status": _normalized_alert_status(str(alert.status)),
        "hits": _alert_hits(alert),
        "createdAt": alert.created_at,
        "reviewedBy": str(alert.cleared_by) if alert.cleared_by else None,
        "reviewedAt": alert.resolved_at,
        "justification": alert.justification,
    }


async def _load_alert(db: AsyncSession, alert_id: str) -> AmlAlert | None:
    try:
        alert_uuid = uuid.UUID(str(alert_id))
    except ValueError:
        return None
    result = await db.execute(
        select(AmlAlert)
        .options(
            joinedload(AmlAlert.kyc_session),
            joinedload(AmlAlert.pep_sanctions),
        )
        .where(AmlAlert.id == alert_uuid)
    )
    return result.scalar_one_or_none()


async def get_aml_alert_by_id(db: AsyncSession, alert_id: str) -> Optional[dict]:
    logger.info("Fetching AML alert by id: %s", alert_id)
    alert = await _load_alert(db, alert_id)
    if not alert:
        return None
    return _alert_response(alert, alert.kyc_session)


async def get_aml_alerts(db: AsyncSession) -> list[dict]:
    logger.info("Fetching AML alerts")
    result = await db.execute(
        select(AmlAlert)
        .options(
            selectinload(AmlAlert.pep_sanctions),
            joinedload(AmlAlert.kyc_session),
        )
        .order_by(AmlAlert.created_at.desc())
        .limit(200)
    )
    return [_alert_response(alert, alert.kyc_session) for alert in result.scalars().all()]


async def get_niu_conflicts(db: AsyncSession) -> list[dict]:
    logger.info("Fetching NIU/Dedup conflicts")
    result = await db.execute(select(DuplicateCheck).order_by(DuplicateCheck.id.desc()))
    conflicts = result.scalars().all()

    response_data = []
    for conflict in conflicts:
        session_a_result = await db.execute(
            select(KYCSession.client_name, KYCSession.started_at).where(
                KYCSession.id == conflict.session_id_new
            )
        )
        session_a_row = session_a_result.first()
        session_a_name = (session_a_row[0] if session_a_row else None) or "Unknown"
        session_a_created = session_a_row[1].isoformat() if session_a_row and session_a_row[1] else ""

        session_b_result = await db.execute(
            select(KYCSession.client_name, KYCSession.started_at).where(
                KYCSession.id == conflict.session_id_existing
            )
        )
        session_b_row = session_b_result.first()
        session_b_name = (session_b_row[0] if session_b_row else None) or "Unknown"
        session_b_created = session_b_row[1].isoformat() if session_b_row and session_b_row[1] else ""

        similarity = float(getattr(conflict, "similarity_score", 1.0) or 1.0)
        response_data.append(
            {
                "id": str(conflict.id),
                "niu": getattr(conflict, "niu_number", None) or "N/A",
                "sessionA": {
                    "id": str(conflict.session_id_new),
                    "clientName": session_a_name,
                    "createdAt": session_a_created,
                    "confidence": similarity,
                },
                "sessionB": {
                    "id": str(conflict.session_id_existing),
                    "clientName": session_b_name,
                    "createdAt": session_b_created,
                    "confidence": similarity,
                },
                "similarityScore": similarity,
                "status": getattr(conflict, "status", None) or conflict.resolution or "OPEN",
            }
        )

    return response_data


async def get_agencies(db: AsyncSession) -> list[dict]:
    logger.info("Fetching agencies")
    result = await db.execute(select(Agency).order_by(Agency.name))
    agencies = result.scalars().all()

    response_data = []
    for agency in agencies:
        agent_count_result = await db.execute(
            select(func.count()).select_from(Agent).where(Agent.agency_id == agency.id)
        )
        agent_count = agent_count_result.scalar() or 0
        response_data.append(
            {
                "id": str(agency.id),
                "code": agency.code,
                "name": agency.name,
                "city": agency.city or "Unknown",
                "isActive": agency.is_active,
                "agentCount": agent_count,
            }
        )

    return response_data


async def get_batch_jobs(db: AsyncSession) -> list[dict]:
    logger.info("Fetching batch jobs")
    result = await db.execute(select(BatchJob).order_by(BatchJob.created_at.desc()))
    return [
        {
            "id": str(job.id),
            "type": job.job_type,
            "status": job.status,
            "totalItems": job.total_items,
            "processedItems": job.processed_items,
            "failedItems": job.failed_items,
            "startedAt": job.started_at,
            "completedAt": job.completed_at,
        }
        for job in result.scalars().all()
    ]


async def get_aml_list_registry(db: AsyncSession) -> list[dict]:
    logger.info("Fetching AML list registry")
    source_rows = await db.execute(
        select(
            PEPSanctions.source,
            func.count(PEPSanctions.id),
            func.max(PEPSanctions.last_synced_at),
        )
        .where(PEPSanctions.is_active == True)  # noqa: E712
        .group_by(PEPSanctions.source)
        .order_by(PEPSanctions.source.asc())
    )
    registry_by_source: dict[str, dict] = {}
    for source, active_count, latest_synced_at in source_rows.all():
        import_result = await db.execute(
            select(AmlListImport)
            .where(AmlListImport.source == source)
            .order_by(AmlListImport.created_at.desc())
            .limit(1)
        )
        latest_import = import_result.scalar_one_or_none()

        type_result = await db.execute(
            select(PEPSanctions.programs)
            .where(
                PEPSanctions.source == source,
                PEPSanctions.is_active == True,  # noqa: E712
            )
            .limit(1)
        )
        programs = type_result.scalar_one_or_none()
        registry_by_source[source] = {
            "source": source,
            "listType": latest_import.list_type if latest_import else _list_type_from_programs(programs),
            "activeCount": int(active_count or 0),
            "latestSyncedAt": latest_synced_at.isoformat() if latest_synced_at else None,
            "latestImportId": str(latest_import.id) if latest_import else None,
            "latestImportStatus": latest_import.status if latest_import else None,
            "latestImportAt": latest_import.created_at if latest_import else None,
            "importedBy": str(latest_import.created_by) if latest_import and latest_import.created_by else None,
        }

    import_rows = await db.execute(
        select(AmlListImport).order_by(AmlListImport.created_at.desc())
    )
    for import_record in import_rows.scalars().all():
        if import_record.source in registry_by_source:
            continue
        registry_by_source[import_record.source] = {
            "source": import_record.source,
            "listType": import_record.list_type,
            "activeCount": 0,
            "latestSyncedAt": None,
            "latestImportId": str(import_record.id),
            "latestImportStatus": import_record.status,
            "latestImportAt": import_record.created_at,
            "importedBy": str(import_record.created_by) if import_record.created_by else None,
        }
    return sorted(registry_by_source.values(), key=lambda item: item["source"].lower())


async def import_aml_list_csv(
    db: AsyncSession,
    *,
    csv_text: str,
    filename: str | None,
    dry_run: bool,
    agent: Agent | None,
) -> dict:
    parsed_rows, errors = _read_aml_csv(csv_text)
    sources = {row["source"] for row in parsed_rows}
    list_types = {row["list_type"] for row in parsed_rows}
    if len(sources) > 1:
        errors.append({"row": 1, "message": "CSV must contain exactly one source per import"})
    if len(list_types) > 1:
        errors.append({"row": 1, "message": "CSV must contain exactly one list_type per import"})
    total_rows = len(parsed_rows) + len(errors)
    failed_rows = len(errors)
    imported_rows = 0 if dry_run or errors else len(parsed_rows)

    source = parsed_rows[0]["source"] if parsed_rows else "BICEC_INTERNAL"
    list_type = parsed_rows[0]["list_type"] if parsed_rows else "PEP"
    status_value = "DRY_RUN" if dry_run else ("FAILED" if errors else "IMPORTED")
    import_record: AmlListImport | None = None
    now = datetime.now(timezone.utc)

    if not dry_run:
        import_record = AmlListImport(
            id=uuid.uuid4(),
            source=source,
            list_type=list_type,
            filename=filename,
            status=status_value,
            total_rows=total_rows,
            imported_rows=imported_rows,
            failed_rows=failed_rows,
            error_report=errors or None,
            created_by=agent.id if agent else None,
            completed_at=now,
        )
        db.add(import_record)

        if not errors:
            synced_date = now.date()
            for row in parsed_rows:
                result = await db.execute(
                    select(PEPSanctions).where(
                        PEPSanctions.source == row["source"],
                        PEPSanctions.full_name == row["full_name"],
                    )
                )
                entry = result.scalar_one_or_none()
                if entry is None:
                    entry = PEPSanctions(
                        id=uuid.uuid4(),
                        source=row["source"],
                        entity_type=row["entity_type"],
                        full_name=row["full_name"],
                    )
                    db.add(entry)

                entry.entity_type = row["entity_type"]
                entry.aliases = row["aliases"]
                entry.date_of_birth = row["date_of_birth"]
                entry.nationality = row["nationality"]
                entry.programs = row["programs"]
                entry.is_active = row["is_active"]
                entry.last_synced_at = synced_date

        db.add(
            AuditLog(
                id=uuid.uuid4(),
                action="AML_LIST_IMPORT",
                table_name="pep_sanctions",
                record_id=str(import_record.id),
                old_data={},
                new_data={
                    "source": source,
                    "list_type": list_type,
                    "status": status_value,
                    "total_rows": total_rows,
                    "imported_rows": imported_rows,
                    "failed_rows": failed_rows,
                    "filename": filename,
                },
                performed_by=agent.id if agent else None,
                performed_at=now,
            )
        )
        await db.commit()

    return {
        "importId": str(import_record.id) if import_record else None,
        "source": source,
        "listType": list_type,
        "dryRun": dry_run,
        "status": status_value,
        "totalRows": total_rows,
        "importedRows": imported_rows,
        "failedRows": failed_rows,
        "errors": errors,
    }


async def clear_aml_alert(
    db: AsyncSession,
    alert_id: str,
    justification: str,
    agent: Agent | None = None,
) -> bool:
    logger.info("Clearing AML alert %s", alert_id)
    alert = await _load_alert(db, alert_id)
    if alert is None:
        return False

    old_status = _normalized_alert_status(str(alert.status))
    now = datetime.now(timezone.utc)
    alert.status = AmlAlertStatus.CLEARED.value
    alert.justification = justification
    alert.resolved_at = now
    if agent:
        alert.cleared_by = agent.id

    db.add(
        AuditLog(
            id=uuid.uuid4(),
            action="AML_ALERT_CLEARED",
            table_name="aml_alerts",
            record_id=str(alert.id),
            old_data={"status": old_status},
            new_data={"status": "CLEARED", "justification": justification},
            performed_by=agent.id if agent else None,
            performed_at=now,
        )
    )
    await track_event_best_effort(
        db,
        event_type="AML_ALERT_CLEARED",
        session_id=alert.session_id,
        agent_id=agent.id if agent else None,
        occurred_at=now,
        step="aml_review",
        status="CLEARED",
        metadata={"alert_id": str(alert.id)},
    )
    await db.commit()
    return True


async def confirm_aml_alert(
    db: AsyncSession,
    alert_id: str,
    justification: str,
    agent: Agent | None = None,
    client_ip: str | None = None,
) -> bool:
    logger.info("Confirming AML alert %s", alert_id)
    alert = await _load_alert(db, alert_id)
    if alert is None or alert.kyc_session is None:
        return False

    session = alert.kyc_session
    now = datetime.now(timezone.utc)
    old_status = session.status
    old_access = session.access_level

    alert.status = AmlAlertStatus.CONFIRMED.value
    alert.justification = justification
    alert.resolved_at = now
    if agent:
        alert.cleared_by = agent.id

    session.status = "FRAUD_SUSPECT"
    session.access_level = "DISABLED"
    session.priority_flag = True
    session.escalated_at = now

    db.add(
        AuditLog(
            id=uuid.uuid4(),
            action="AML_ALERT_CONFIRMED_FREEZE",
            table_name="kyc_sessions",
            record_id=str(session.id),
            old_data={"status": old_status, "access_level": old_access},
            new_data={
                "status": session.status,
                "access_level": session.access_level,
                "alert_id": str(alert.id),
                "justification": justification,
            },
            performed_by=agent.id if agent else None,
            performed_at=now,
            client_ip=client_ip,
        )
    )
    await track_event_best_effort(
        db,
        event_type="AML_ALERT_CONFIRMED",
        session_id=session.id,
        user_id=session.user_id,
        agent_id=agent.id if agent else None,
        agency_id=session.agency_id,
        occurred_at=now,
        step="aml_review",
        status="CONFIRMED",
        metadata={"alert_id": str(alert.id)},
    )
    await create_user_notification(
        db,
        user_id=session.user_id,
        notification_type="COMPLIANCE_ACCOUNT_REVIEW",
        message=(
            "Votre compte fait l'objet d'une verification de conformite. "
            "L'acces a certains services est temporairement suspendu."
        ),
        payload={
            "event_key": f"aml-confirmed:{alert.id}",
            "session_id": str(session.id),
            "alert_id": str(alert.id),
            "status": session.status,
        },
        official=True,
        subject="Verification de conformite BICEC VeriPass",
    )
    await db.commit()
    return True


async def escalate_aml_alert(
    db: AsyncSession,
    alert_id: str,
    reason: str,
    agent: Agent | None = None,
) -> bool:
    logger.info("Escalating AML alert %s", alert_id)
    alert = await _load_alert(db, alert_id)
    if alert is None:
        return False

    alert.status = AmlAlertStatus.ESCALATED.value
    alert.justification = reason
    alert.resolved_at = datetime.now(timezone.utc)
    if agent:
        alert.cleared_by = agent.id
    await track_event_best_effort(
        db,
        event_type="AML_ALERT_ESCALATED",
        session_id=alert.session_id,
        agent_id=agent.id if agent else None,
        step="aml_review",
        status="ESCALATED",
        metadata={"alert_id": str(alert.id)},
    )
    await db.commit()
    return True


async def resolve_niu_conflict(
    db: AsyncSession,
    conflict_id: str,
    action: str,
    justification: str,
    agent: Agent | None = None,
) -> bool:
    logger.info("Resolving NIU conflict %s as %s", conflict_id, action)
    result = await db.execute(select(DuplicateCheck).where(DuplicateCheck.id == conflict_id))
    conflict = result.scalar_one_or_none()
    if conflict is None:
        return False

    now = datetime.now(timezone.utc)
    conflict.resolution = action
    conflict.resolved_at = now
    if agent:
        conflict.resolved_by = agent.id

    db.add(
        AuditLog(
            id=uuid.uuid4(),
            action=f"NIU_CONFLICT_{action}",
            table_name="duplicate_checks",
            record_id=str(conflict.id),
            old_data={"resolution": None},
            new_data={"resolution": action, "justification": justification},
            performed_by=agent.id if agent else None,
            performed_at=now,
        )
    )

    if action == "FRAUD":
        for session_id in {conflict.session_id_new, conflict.session_id_existing}:
            session_result = await db.execute(
                select(KYCSession).where(KYCSession.id == session_id)
            )
            session = session_result.scalar_one_or_none()
            if session:
                session.status = "FRAUD_SUSPECT"
                session.access_level = "DISABLED"
                session.priority_flag = True

    await track_event_best_effort(
        db,
        event_type="NIU_CONFLICT_DETECTED",
        session_id=conflict.session_id_new,
        agent_id=agent.id if agent else None,
        step="dedup",
        status=action,
        metadata={"conflict_id": str(conflict.id), "justification": justification},
    )

    await db.commit()
    return True


async def create_agency(db: AsyncSession, code: str, name: str, city: str) -> dict:
    logger.info("Creating agency %s - %s", code, name)
    agency = Agency(code=code, name=name, city=city)
    db.add(agency)
    await db.commit()
    await db.refresh(agency)
    return {
        "id": str(agency.id),
        "code": agency.code,
        "name": agency.name,
        "city": agency.city,
        "isActive": agency.is_active,
        "agentCount": 0,
    }


async def update_agency(db: AsyncSession, agency_id: str, **kwargs) -> Optional[dict]:
    logger.info("Updating agency %s", agency_id)
    update_values = {}
    if "is_active" in kwargs:
        update_values["is_active"] = kwargs.pop("is_active")
    update_values.update(kwargs)

    if not update_values:
        return None

    await db.execute(update(Agency).where(Agency.id == agency_id).values(**update_values))
    await db.commit()

    result = await db.execute(select(Agency).where(Agency.id == agency_id))
    agency = result.scalar_one_or_none()
    if not agency:
        return None

    return {
        "id": str(agency.id),
        "code": agency.code,
        "name": agency.name,
        "city": agency.city,
        "isActive": agency.is_active,
        "agentCount": 0,
    }


async def delete_agency(db: AsyncSession, agency_id: str) -> bool:
    logger.info("Deleting agency %s", agency_id)
    await db.execute(update(Agency).where(Agency.id == agency_id).values(is_active=False))
    await db.commit()
    return True


async def trigger_amplitude_batch(db: AsyncSession, session_ids: list[str]) -> str:
    logger.info("Triggering batch job for %s sessions", len(session_ids))
    job = BatchJob(
        job_type="AMPLITUDE_PROVISIONING",
        status="PENDING",
        total_items=len(session_ids),
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return str(job.id)


async def get_document_expiry_alerts(
    db: AsyncSession,
    *,
    page: int = 1,
    limit: int = 25,
) -> dict:
    offset = (page - 1) * limit
    filters = [
        KYCSession.doc_expiry_flag == True,  # noqa: E712
        KYCSession.doc_expiry_deadline.is_not(None),
    ]
    count_result = await db.execute(select(func.count(KYCSession.id)).where(*filters))
    total = int(count_result.scalar_one() or 0)

    result = await db.execute(
        select(KYCSession)
        .options(selectinload(KYCSession.user))
        .where(*filters)
        .order_by(KYCSession.doc_expiry_deadline.asc())
        .offset(offset)
        .limit(limit)
    )

    now = datetime.now(timezone.utc)
    items = []
    for session in result.scalars().all():
        deadline = session.doc_expiry_deadline
        comparable_deadline = (
            deadline.replace(tzinfo=timezone.utc)
            if deadline and deadline.tzinfo is None
            else deadline
        )
        state = "expired" if comparable_deadline and comparable_deadline < now else "expiring"
        items.append(
            {
                "sessionId": str(session.id),
                "clientName": session.client_name or "Unknown",
                "status": session.status,
                "accessLevel": session.access_level,
                "expiryDate": deadline,
                "state": state,
                "notifiedAt": session.doc_expiry_notified_at,
                "contact": (session.user.phone or session.user.email) if session.user else None,
            }
        )
    return {"items": items, "total": total, "page": page, "limit": limit}


async def notify_global_regulatory_event(
    db: AsyncSession,
    *,
    notification_type: str,
    message: str,
    reason: str,
    agent: Agent | None = None,
) -> dict:
    event_key = f"global:{notification_type}:{uuid.uuid5(uuid.NAMESPACE_URL, message + reason)}"
    count = await create_global_notification(
        db,
        notification_type=notification_type,
        message=message,
        payload={"event_key": event_key, "reason": reason},
        official=True,
        subject="Information officielle BICEC VeriPass",
    )
    db.add(
        AuditLog(
            id=uuid.uuid4(),
            action="COMPLIANCE_GLOBAL_NOTIFICATION",
            table_name="notifications",
            record_id=event_key,
            new_data={"type": notification_type, "reason": reason, "count": count},
            performed_by=agent.id if agent else None,
            performed_at=datetime.now(timezone.utc),
        )
    )
    await db.commit()
    return {"created": count, "event_key": event_key}
