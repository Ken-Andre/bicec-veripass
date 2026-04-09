"""Module Service layer AML/CFT."""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from sqlalchemy.orm import selectinload
from app.core.logging import logger
from app.modules.aml.models import BatchJob
from app.modules.kyc.models import KYCSession, AmlAlert, AmlAlertStatus, DuplicateCheck
from app.modules.admin.models import Agency
from app.modules.auth.models import Agent


async def get_aml_alerts(db: AsyncSession) -> list[dict]:
    """Récupère toutes les alertes AML en attente."""
    logger.info("Fetching AML alerts")
    result = await db.execute(
        select(AmlAlert)
        .options(selectinload(AmlAlert.pep_sanctions))
        .where(AmlAlert.status == AmlAlertStatus.PENDING)
        .order_by(AmlAlert.created_at.desc())
    )
    alerts = result.scalars().all()

    response_data = []
    for alert in alerts:
        # Fetch client name from KYC session
        kyc_result = await db.execute(
            select(KYCSession.client_name).where(KYCSession.id == alert.session_id)
        )
        client_name = kyc_result.scalar_one_or_none() or "Unknown"

        response_data.append(
            {
                "id": str(alert.id),
                "session_id": str(alert.session_id),
                "client_name": client_name,
                "niu": "",  # Will be populated from KYC session if needed
                "severity": "HIGH",  # TODO: Compute from match_score
                "status": alert.status.value,
                "hits": [],  # TODO: Populate from pep_sanctions
                "created_at": alert.created_at,
                "reviewed_by": str(alert.cleared_by) if alert.cleared_by else None,
                "reviewed_at": alert.resolved_at,
                "justification": alert.justification,
            }
        )

    return response_data


async def get_niu_conflicts(db: AsyncSession) -> list[dict]:
    """Récupère tous les conflits (Dedup) détectés.
    Now using master DuplicateCheck model from KYC module.
    """
    logger.info("Fetching NIU/Dedup conflicts")
    result = await db.execute(
        select(DuplicateCheck)
        # .where(DuplicateCheck.resolution == None) # Simplified
        .order_by(DuplicateCheck.id.desc())
    )
    conflicts = result.scalars().all()

    response_data = []
    for conflict in conflicts:
        # Fetch session A details
        session_a_result = await db.execute(
            select(KYCSession.client_name, KYCSession.created_at).where(
                KYCSession.id == conflict.session_id_new
            )
        )
        session_a_row = session_a_result.first()
        session_a_name = session_a_row[0] if session_a_row else "Unknown"
        session_a_created = (
            session_a_row[1].isoformat() if session_a_row and session_a_row[1] else ""
        )

        # Fetch session B details
        session_b_result = await db.execute(
            select(KYCSession.client_name, KYCSession.created_at).where(
                KYCSession.id == conflict.session_id_existing
            )
        )
        session_b_row = session_b_result.first()
        session_b_name = session_b_row[0] if session_b_row else "Unknown"
        session_b_created = (
            session_b_row[1].isoformat() if session_b_row and session_b_row[1] else ""
        )

        response_data.append(
            {
                "id": str(conflict.id),
                "niu": conflict.niu,
                "sessionA": {
                    "id": str(conflict.session_id_new),
                    "clientName": session_a_name,
                    "createdAt": session_a_created,
                    "confidence": float(conflict.similarity_score),
                },
                "sessionB": {
                    "id": str(conflict.session_id_existing),
                    "clientName": session_b_name,
                    "createdAt": session_b_created,
                    "confidence": float(conflict.similarity_score),
                },
                "similarityScore": float(conflict.similarity_score),
                "status": conflict.status,
            }
        )

    return response_data


async def get_agencies(db: AsyncSession) -> list[dict]:
    """Récupère toutes les agences (Unified Model)."""
    logger.info("Fetching agencies")
    result = await db.execute(select(Agency).order_by(Agency.name))
    agencies = result.scalars().all()

    response_data = []
    for agency in agencies:
        # Count agents in this agency
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
    """Récupère tous les jobs batch en cours."""
    logger.info("Fetching batch jobs")
    result = await db.execute(select(BatchJob).order_by(BatchJob.created_at.desc()))
    jobs = result.scalars().all()

    response_data = []
    for job in jobs:
        response_data.append(
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
        )

    return response_data


async def clear_aml_alert(db: AsyncSession, alert_id: str, justification: str) -> bool:
    """Classe une alerte AML sans suite."""
    logger.info(f"Clearing AML alert {alert_id}")
    await db.execute(
        update(AmlAlert)
        .where(AmlAlert.id == alert_id)
        .values(
            status=AmlAlertStatus.CLEARED,
            justification=justification,
            resolved_at=func.now(),
        )
    )
    await db.commit()
    return True


async def confirm_aml_alert(
    db: AsyncSession, alert_id: str, justification: str
) -> bool:
    """Confirme un risque AML."""
    logger.info(f"Confirming AML alert {alert_id}")
    await db.execute(
        update(AmlAlert)
        .where(AmlAlert.id == alert_id)
        .values(
            status=AmlAlertStatus.CONFIRMED,
            justification=justification,
            resolved_at=func.now(),
        )
    )
    await db.commit()
    return True


async def escalate_aml_alert(db: AsyncSession, alert_id: str, reason: str) -> bool:
    """Escale une alerte AML."""
    logger.info(f"Escalating AML alert {alert_id}")
    await db.execute(
        update(AmlAlert)
        .where(AmlAlert.id == alert_id)
        .values(
            status=AmlAlertStatus.ESCALATED,
            justification=reason,
        )
    )
    await db.commit()
    return True


async def resolve_niu_conflict(
    db: AsyncSession,
    conflict_id: str,
    action: str,  # MERGED ou FRAUD
    justification: str,
) -> bool:
    """Résout un conflit NIU."""
    logger.info(f"Resolving NIU conflict {conflict_id} as {action}")
    await db.execute(
        update(DuplicateCheck)  # Update master KYC model
        .where(DuplicateCheck.id == conflict_id)
        .values(
            resolution=action,
            # justification=justification, # DuplicateCheck might not have justification?
            resolved_at=func.now(),
        )
    )
    await db.commit()
    return True


async def create_agency(db: AsyncSession, code: str, name: str, city: str) -> dict:
    """Crée une nouvelle agence."""
    logger.info(f"Creating agency {code} - {name}")
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
    """Met à jour une agence existante."""
    logger.info(f"Updating agency {agency_id}")

    # Map isActive to is_active for DB update
    update_values = {}
    if "is_active" in kwargs:
        update_values["is_active"] = kwargs.pop("is_active")
    update_values.update(kwargs)

    if not update_values:
        return None

    await db.execute(
        update(Agency).where(Agency.id == agency_id).values(**update_values)
    )
    await db.commit()

    # Fetch updated agency
    result = await db.execute(select(Agency).where(Agency.id == agency_id))
    agency = result.scalar_one_or_none()

    if agency:
        return {
            "id": str(agency.id),
            "code": agency.code,
            "name": agency.name,
            "city": agency.city,
            "isActive": agency.is_active,
            "agentCount": 0,
        }
    return None


async def delete_agency(db: AsyncSession, agency_id: str) -> bool:
    """Supprime une agence."""
    logger.info(f"Deleting agency {agency_id}")
    await db.execute(
        update(Agency).where(Agency.id == agency_id).values(is_active=False)
    )
    await db.commit()
    return True


async def trigger_amplitude_batch(db: AsyncSession, session_ids: list[str]) -> str:
    """Lance un job batch de provisionnement Amplitude."""
    logger.info(f"Triggering batch job for {len(session_ids)} sessions")
    job = BatchJob(
        job_type="AMPLITUDDE_PROVISIONING",
        status="PENDING",
        total_items=len(session_ids),
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    # TODO: Trigger Celery task for actual processing
    return str(job.id)
