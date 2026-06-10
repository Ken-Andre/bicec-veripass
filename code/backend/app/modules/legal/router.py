"""Routes for versioned legal documents."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.security import require_agent_role
from app.db.session import get_db
from app.modules.auth.models import Agent, AgentRole
from app.modules.legal.models import LegalDocumentVersion
from app.modules.legal.schemas import (
    LegalDocumentCreate,
    LegalDocumentResponse,
    LegalDocumentUpdate,
    normalize_legal_key,
    normalize_locale,
)
from app.modules.legal.service import coerce_uuid, compute_content_hash, get_latest_published

router = APIRouter()


@router.get("/documents", response_model=list[LegalDocumentResponse])
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def list_public_documents(
    request: Request,
    locale: str = Query("fr", max_length=10),
    db: AsyncSession = Depends(get_db),
):
    """Return latest published legal documents for the requested locale."""
    normalized_locale = normalize_locale(locale)
    documents: list[LegalDocumentVersion] = []
    for key in ("cgu", "privacy", "data_processing", "biometric"):
        document = await get_latest_published(db, key, normalized_locale)
        if document:
            documents.append(document)
    return documents


@router.get("/documents/{document_key}", response_model=LegalDocumentResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_public_document(
    request: Request,
    document_key: str,
    locale: str = Query("fr", max_length=10),
    db: AsyncSession = Depends(get_db),
):
    """Return the latest published legal document by key and locale."""
    document = await get_latest_published(db, normalize_legal_key(document_key), normalize_locale(locale))
    if not document:
        raise HTTPException(status_code=404, detail="Legal document not found.")
    return document


@router.get("/admin/documents", response_model=list[LegalDocumentResponse])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_admin_documents(
    request: Request,
    document_key: str | None = Query(None, max_length=64),
    locale: str | None = Query(None, max_length=10),
    status_filter: str | None = Query(None, alias="status", max_length=16),
    db: AsyncSession = Depends(get_db),
    _agent: Agent = Depends(require_agent_role(AgentRole.ADMIN_IT)),
):
    query = select(LegalDocumentVersion).order_by(
        LegalDocumentVersion.document_key.asc(),
        LegalDocumentVersion.locale.asc(),
        LegalDocumentVersion.created_at.desc(),
    )
    if document_key:
        query = query.where(LegalDocumentVersion.document_key == normalize_legal_key(document_key))
    if locale:
        query = query.where(LegalDocumentVersion.locale == normalize_locale(locale))
    if status_filter:
        query = query.where(LegalDocumentVersion.status == status_filter.strip().upper())
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("/admin/documents", response_model=LegalDocumentResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def create_admin_document(
    request: Request,
    body: LegalDocumentCreate,
    db: AsyncSession = Depends(get_db),
    agent: Agent = Depends(require_agent_role(AgentRole.ADMIN_IT)),
):
    now = datetime.now(timezone.utc)
    document = LegalDocumentVersion(
        document_key=body.document_key,
        locale=body.locale,
        version=body.version,
        title=body.title,
        content=body.content,
        content_format=body.content_format,
        content_hash=compute_content_hash(body.content),
        status=body.status,
        effective_at=body.effective_at,
        published_at=now if body.status == "PUBLISHED" else None,
        published_by=agent.id if body.status == "PUBLISHED" else None,
        created_by=agent.id,
        updated_by=agent.id,
    )
    db.add(document)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A legal document with the same key, locale and version already exists.",
        )
    await db.refresh(document)
    return document


@router.patch("/admin/documents/{document_id}", response_model=LegalDocumentResponse)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def update_admin_document(
    request: Request,
    document_id: str,
    body: LegalDocumentUpdate,
    db: AsyncSession = Depends(get_db),
    agent: Agent = Depends(require_agent_role(AgentRole.ADMIN_IT)),
):
    result = await db.execute(
        select(LegalDocumentVersion).where(LegalDocumentVersion.id == coerce_uuid(document_id))
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Legal document not found.")
    if document.status == "PUBLISHED" and (body.content is not None or body.title is not None):
        raise HTTPException(
            status_code=409,
            detail="Published legal documents are immutable. Create a new version instead.",
        )

    if body.title is not None:
        document.title = body.title
    if body.content is not None:
        document.content = body.content
        document.content_hash = compute_content_hash(body.content)
    if body.content_format is not None:
        document.content_format = body.content_format
    if body.effective_at is not None:
        document.effective_at = body.effective_at
    if body.status is not None:
        document.status = body.status
        if body.status == "PUBLISHED":
            document.published_at = datetime.now(timezone.utc)
            document.published_by = agent.id
    document.updated_by = agent.id

    await db.commit()
    await db.refresh(document)
    return document
