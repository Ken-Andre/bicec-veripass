"""Celery tasks for PEP/sanctions data sync and freshness checks."""

from __future__ import annotations

import asyncio
import csv
import io
import os
from datetime import datetime, timezone

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.celery_config import celery
from app.core.logging import logger
from app.db.session import AsyncSessionLocal
from app.modules.kyc.models import PEPSanctions


OPEN_SANCTIONS_CSV_URL = (
    "https://data.opensanctions.org/datasets/latest/default/targets.simple.csv"
)

MAX_PEPE_SANCTIONS_AGE_DAYS = 8
BATCH_INSERT_SIZE = 500


async def sync_pep_sanctions() -> int:
    """Download OpenSanctions CSV and upsert active PEP/sanctions targets."""
    logger.info("[sanctions-sync] Starting PEP/Sanctions sync...")
    start_time = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        try:
            count = await _download_and_upsert(db)
            logger.info(
                "[sanctions-sync] Sync completed: %s records upserted in %.1fs",
                count,
                (datetime.now(timezone.utc) - start_time).total_seconds(),
            )
            return count
        except Exception as exc:
            logger.error("[sanctions-sync] Sync failed: %s", exc, exc_info=True)
            raise


@celery.task(
    name="app.tasks.sanctions.sync_pep_sanctions",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def celery_sync_sanctions(self):
    return asyncio.run(sync_pep_sanctions())


@celery.task(
    name="app.tasks.sanctions.check_staleness",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def check_staleness(self):
    return asyncio.run(_check_staleness())


async def _check_staleness() -> dict:
    logger.info("[sanctions-staleness] Checking sanctions data staleness...")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(func.max(PEPSanctions.last_synced_at)))
        last_synced = result.scalar_one_or_none()

    if last_synced is None:
        count = await sync_pep_sanctions()
        return {"status": "synced", "reason": "empty", "count": count}

    age_days = (datetime.now(timezone.utc).date() - last_synced).days
    if age_days > MAX_PEPE_SANCTIONS_AGE_DAYS:
        count = await sync_pep_sanctions()
        return {"status": "synced", "reason": "stale", "age_days": age_days, "count": count}

    return {"status": "fresh", "age_days": age_days}


async def _download_and_upsert(db: AsyncSession) -> int:
    max_rows = int(os.getenv("OPEN_SANCTIONS_MAX_ROWS", "5000"))
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        response = await client.get(OPEN_SANCTIONS_CSV_URL)
        response.raise_for_status()

    rows = csv.DictReader(io.StringIO(response.text))
    synced_date = datetime.now(timezone.utc).date()
    count = 0

    for row in rows:
        if count >= max_rows:
            break
        if str(row.get("target", "")).lower() in {"false", "0", "no"}:
            continue

        full_name = _pick(row, "caption", "name", "full_name", "names")
        if not full_name:
            continue

        source = _pick(row, "datasets", "dataset", "source") or "OpenSanctions"
        entity_type = _pick(row, "schema", "entity_type") or "UNKNOWN"
        nationality = _pick(row, "country", "countries", "nationality")
        dob = _parse_date(_pick(row, "birthDate", "birth_date", "date_of_birth"))
        programs = _split_values(_pick(row, "programs", "datasets", "dataset"))
        aliases = _split_values(_pick(row, "aliases", "alias", "weakAlias"))

        existing_result = await db.execute(
            select(PEPSanctions).where(
                PEPSanctions.source == source,
                PEPSanctions.full_name == full_name,
            )
        )
        entry = existing_result.scalar_one_or_none()
        if entry is None:
            entry = PEPSanctions(
                source=source,
                full_name=full_name,
                entity_type=entity_type,
            )
            db.add(entry)

        entry.aliases = aliases or None
        entry.date_of_birth = dob
        entry.nationality = nationality
        entry.programs = programs or None
        entry.is_active = True
        entry.last_synced_at = synced_date
        count += 1

        if count % BATCH_INSERT_SIZE == 0:
            await db.flush()

    await db.commit()
    return count


def _pick(row: dict, *keys: str) -> str | None:
    for key in keys:
        value = row.get(key)
        if value:
            return str(value).strip()
    return None


def _split_values(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.replace("|", ";").split(";") if part.strip()]


def _parse_date(value: str | None):
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(value[:10], fmt).date()
        except ValueError:
            continue
    return None
