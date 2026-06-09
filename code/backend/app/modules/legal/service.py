"""Service helpers for legal documents and consent proof."""

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Iterable

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.legal.models import LegalDocumentVersion
from app.modules.legal.schemas import AcceptedLegalDocument, normalize_legal_key, normalize_locale


REQUIRED_KYC_CONSENT_KEYS = ("cgu", "privacy", "data_processing")


def compute_content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _accepted_at_iso(value: datetime | None) -> str:
    return (value or datetime.now(timezone.utc)).isoformat()


async def get_latest_published(
    db: AsyncSession,
    document_key: str,
    locale: str = "fr",
) -> LegalDocumentVersion | None:
    key = normalize_legal_key(document_key)
    normalized_locale = normalize_locale(locale)
    result = await db.execute(
        select(LegalDocumentVersion)
        .where(
            LegalDocumentVersion.document_key == key,
            LegalDocumentVersion.locale == normalized_locale,
            LegalDocumentVersion.status == "PUBLISHED",
        )
        .order_by(
            LegalDocumentVersion.effective_at.desc().nullslast(),
            LegalDocumentVersion.published_at.desc().nullslast(),
            LegalDocumentVersion.created_at.desc(),
        )
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_published_by_version(
    db: AsyncSession,
    document_key: str,
    locale: str,
    version: str,
) -> LegalDocumentVersion | None:
    key = normalize_legal_key(document_key)
    normalized_locale = normalize_locale(locale)
    result = await db.execute(
        select(LegalDocumentVersion).where(
            LegalDocumentVersion.document_key == key,
            LegalDocumentVersion.locale == normalized_locale,
            LegalDocumentVersion.version == version,
            LegalDocumentVersion.status == "PUBLISHED",
        )
    )
    return result.scalar_one_or_none()


async def resolve_accepted_documents(
    db: AsyncSession,
    accepted_documents: list[AcceptedLegalDocument] | None,
    *,
    required_keys: Iterable[str] = REQUIRED_KYC_CONSENT_KEYS,
    fallback_locale: str = "fr",
) -> list[dict]:
    """Resolve and verify the legal versions captured with a consent.

    Missing client-provided versions are filled from the latest published
    document to preserve backwards compatibility with older mobile builds.
    """
    requested = {normalize_legal_key(item.document_key): item for item in (accepted_documents or [])}
    resolved: list[dict] = []

    for raw_key in required_keys:
        key = normalize_legal_key(raw_key)
        request_item = requested.get(key)
        locale = normalize_locale(request_item.locale if request_item else fallback_locale)

        document: LegalDocumentVersion | None = None
        if request_item and request_item.document_id:
            result = await db.execute(
                select(LegalDocumentVersion).where(LegalDocumentVersion.id == request_item.document_id)
            )
            document = result.scalar_one_or_none()
            if not document or document.document_key != key or document.status != "PUBLISHED":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Accepted legal document '{key}' does not match a published document.",
                )
        elif request_item and request_item.version:
            document = await get_published_by_version(db, key, locale, request_item.version)
        else:
            document = await get_latest_published(db, key, locale)

        if not document:
            # Keep the consent flow compatible if a deployment has not seeded legal docs yet.
            resolved.append(
                {
                    "document_key": key,
                    "locale": locale,
                    "missing": True,
                    "accepted_at": _accepted_at_iso(request_item.accepted_at if request_item else None),
                }
            )
            continue

        if request_item and request_item.content_hash and request_item.content_hash != document.content_hash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Accepted legal document '{key}' hash does not match the published version.",
            )

        resolved.append(
            {
                "document_key": document.document_key,
                "document_id": str(document.id),
                "locale": document.locale,
                "version": document.version,
                "content_hash": document.content_hash,
                "title": document.title,
                "accepted_at": _accepted_at_iso(request_item.accepted_at if request_item else None),
            }
        )

    return resolved


def coerce_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid legal document ID.")
