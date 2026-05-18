"""Celery OCR tasks for GLM fallback."""

from __future__ import annotations

import asyncio
import base64
import json
import os
from uuid import UUID

# CRITICAL: Import app.db first to register all SQLAlchemy models
# This prevents "expression 'User' failed to locate a name ('User')" errors
# by ensuring all mappers are configured before any ORM operations
import app.db  # noqa: F401

import httpx
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.celery_config import celery
from app.core.logging import logger
from app.core.crypto import compress_image, encrypt, decrypt
from app.db.session import AsyncSessionLocal
from app.modules.kyc.service import process_glm_fallback
from app.modules.kyc.models import Document, OCRField


async def _run_glm_ocr_fallback(document_id: str) -> dict:
    async with AsyncSessionLocal() as db:
        return await process_glm_fallback(document_id=UUID(document_id), db=db)


async def _run_cloud_ocr(document_id: str) -> dict:
    cloud_url = os.environ["OCR_CLOUD_URL"]
    api_key = os.environ["OCR_CLOUD_API_KEY"]
    storage_path = os.environ.get("STORAGE_PATH", "/data/documents")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Document)
            .options(selectinload(Document.ocr_fields))
            .where(Document.id == UUID(document_id))
        )
        document = result.scalar_one_or_none()
        if not document:
            raise ValueError(f"Document {document_id} not found")

        prompt = _build_glm_prompt(document)

        image_rel_path = document.file_path.lstrip("/")
        image_full_path = os.path.join(storage_path, image_rel_path)
        with open(image_full_path, "rb") as f:
            raw_bytes = f.read()

        compressed = compress_image(raw_bytes)
        encrypted_blob = encrypt(compressed)

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                cloud_url,
                json={
                    "image": base64.b64encode(encrypted_blob).decode(),
                    "prompt": prompt,
                },
                headers={"X-API-Key": api_key},
            )
            resp.raise_for_status()
            encrypted_response = base64.b64decode(resp.json()["result"])

        plaintext = decrypt(encrypted_response)
        cloud_json: dict = json.loads(plaintext)

        return await _merge_cloud_result(db, document, cloud_json)


def _build_glm_prompt(document: Document) -> str:
    detected_side = "verso" if "VERSO" in (document.doc_type or "").upper() else "recto"
    return f"Extract all visible fields from this {detected_side} of a Cameroonian CNI card."


async def _merge_cloud_result(db, document: Document, cloud_json: dict) -> dict:
    fields = cloud_json.get("fields", cloud_json)
    existing_by_name = {f.field_name: f for f in document.ocr_fields}
    for field_name, extracted_value in fields.items():
        if extracted_value is None:
            continue
        existing = existing_by_name.get(field_name)
        if existing:
            existing.extracted_value = extracted_value
        else:
            db.add(OCRField(
                document_id=document.id,
                field_name=field_name,
                extracted_value=str(extracted_value),
                confidence_score=cloud_json.get("confidences", {}).get(field_name, 0.0),
            ))
    document.ocr_engine = "GLM_CLOUD"
    await db.commit()
    return {"document_id": str(document.id), "fields": fields}


@celery.task(
    name="app.tasks.ocr.run_glm_ocr_fallback",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def run_glm_ocr_fallback_task(self, document_id: str) -> dict:
    """Run GLM OCR fallback for a document with low Paddle confidence.

    Routes to local GLM-OCR or Oracle Cloud GLM-OCR depending on OCR_ONLINE env var.
    """
    try:
        if os.getenv("OCR_ONLINE", "").lower() in ("true", "1", "yes"):
            return asyncio.run(_run_cloud_ocr(document_id))
        return asyncio.run(_run_glm_ocr_fallback(document_id))
    except Exception as exc:
        logger.error(
            "GLM OCR fallback failed for document %s: %s",
            document_id,
            exc,
            exc_info=True,
        )
        raise self.retry(exc=exc)
