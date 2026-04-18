"""Celery OCR tasks for GLM fallback."""

from __future__ import annotations

import asyncio
from uuid import UUID

# CRITICAL: Import app.db first to register all SQLAlchemy models
# This prevents "expression 'User' failed to locate a name ('User')" errors
# by ensuring all mappers are configured before any ORM operations
import app.db  # noqa: F401

from app.core.celery_config import celery
from app.core.logging import logger
from app.db.session import AsyncSessionLocal
from app.modules.kyc.service import process_glm_fallback


async def _run_glm_ocr_fallback(document_id: str) -> dict:
    async with AsyncSessionLocal() as db:
        return await process_glm_fallback(document_id=UUID(document_id), db=db)


@celery.task(
    name="app.tasks.ocr.run_glm_ocr_fallback",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def run_glm_ocr_fallback_task(self, document_id: str) -> dict:
    """Run GLM OCR fallback for a document with low Paddle confidence."""
    try:
        return asyncio.run(_run_glm_ocr_fallback(document_id))
    except Exception as exc:
        logger.error(
            "GLM OCR fallback failed for document %s: %s",
            document_id,
            exc,
            exc_info=True,
        )
        raise self.retry(exc=exc)
