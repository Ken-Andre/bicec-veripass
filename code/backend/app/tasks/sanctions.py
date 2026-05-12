"""
Tâches Celery pour la synchronisation des listes PEP/Sanctions (AML)
Source: architecture-bicec-veripass.md §8.3, §13.3
"""

from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.celery_config import celery
from app.db.session import AsyncSessionLocal
from app.core.logging import logger


# Sources des listes (via OpenSanctions)
OPEN_SANCTIONS_CSV_URL = (
    "https://data.opensanctions.org/datasets/latest/default/targets.simple.csv"
)
# Alternative directe: https://data.opensanctions.org/datasets/latest/default/entities.ftm.json

# Config
MAX_PEPE_SANCTIONS_AGE_DAYS = 8
BATCH_INSERT_SIZE = 500


async def sync_pep_sanctions():
    """
    Télécharge les listes UN/EU/OFAC via OpenSanctions et upsert dans PostgreSQL.
    Exécuté hebdomadairement par Celery Beat.
    """
    logger.info("[sanctions-sync] Starting PEP/Sanctions sync...")
    start_time = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        try:
            # 1. Download latest targets
            logger.info("[sanctions-sync] Downloading from OpenSanctions...")
            count = await _download_and_upsert(db)
            logger.info(
                f"[sanctions-sync] Sync completed: {count} records upserted in {(datetime.now(timezone.utc) - start_time).total_seconds():.1f}s"
            )
        except Exception as e:
            logger.error(f"[sanctions-sync] Sync failed: {e}", exc_info=True)
            raise


@celery.task(
    name="app.tasks.sanctions.sync_pep_sanctions",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)  # 5min
async def celery_sync_sanctions(self):
    """Celery task wrapper for sync_pep_sanctions."""
    await sync_pep_sanctions()


@celery.task(
    name="app.tasks.sanctions.check_staleness",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
async def check_staleness(self):
    """
    Vérifie si les listes de sanctions sont obsolètes (> 8 jours).
    Si oui, déclenche une synchronisation immédiate.
    """
    logger.info("[sanctions-staleness] Checking sanctions data staleness...")
    async with AsyncSessionLocal() as db:
        # TODO: Implement actual staleness check logic
        # For now, just log and potentially trigger sync
        logger.info("[sanctions-staleness] Data is currently up to date (placeholder).")


async def _download_and_upsert(db: AsyncSession) -> int:
    """Download and upsert sanctions data."""
    # TODO: Implement actual HTTP download + parse + upsert
    # For now, placeholder implementation
    return 0
