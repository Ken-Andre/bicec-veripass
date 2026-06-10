"""Authenticated mobile support API."""

import hashlib
import re
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.kyc.models import Document, KYCSession, Notification, SupportMessage, SupportThread
from app.modules.support.schemas import (
    SupportAttachmentResponse,
    SupportAttachmentLimitsResponse,
    SupportMessageCreate,
    SupportMessageResponse,
    SupportThreadResponse,
)

router = APIRouter()

ALLOWED_ATTACHMENT_TYPES = {
    "image/jpeg",
    "image/png",
    "application/pdf",
}
MAX_MESSAGE_CHARS = 4000
SUPPORT_IMAGE_MAX_SIZE_MB = 4
SUPPORT_PDF_MAX_SIZE_MB = 6
SUPPORT_PDF_MAX_PAGES = 5


def _count_pdf_pages(content: bytes) -> int:
    try:
        import pypdfium2 as pdfium

        return len(pdfium.PdfDocument(content))
    except Exception:
        return len(re.findall(rb"/Type\s*/Page\b", content))


def _attachment_filename(path: str | None) -> str | None:
    if not path:
        return None
    name = Path(path).name
    parts = name.split("_", 1)
    return parts[1] if len(parts) == 2 else name


async def _get_or_create_support_thread(
    db: AsyncSession, current_user: User
) -> SupportThread:
    session_result = await db.execute(
        select(KYCSession)
        .where(KYCSession.user_id == current_user.id)
        .order_by(KYCSession.started_at.desc())
        .limit(1)
    )
    session = session_result.scalar_one_or_none()
    if session is None:
        session = KYCSession(
            user_id=current_user.id,
            status="DRAFT",
            access_level="RESTRICTED",
            last_step_completed="SUPPORT_STARTED",
        )
        db.add(session)
        await db.flush()

    thread_result = await db.execute(
        select(SupportThread)
        .where(SupportThread.session_id == session.id, SupportThread.status == "OPEN")
        .order_by(SupportThread.created_at.desc())
        .limit(1)
    )
    thread = thread_result.scalar_one_or_none()
    if thread is None:
        thread = SupportThread(session_id=session.id, status="OPEN")
        db.add(thread)
        await db.flush()
    return thread


def _to_message_response(message: SupportMessage) -> SupportMessageResponse:
    sender = "user" if message.sender_type == "MARIE" else "agent"
    return SupportMessageResponse(
        id=message.id,
        thread_id=message.thread_id,
        sender=sender,
        content=message.content,
        attachment_path=message.attachment_path,
        attachment_sha256=message.attachment_sha256,
        attachment_filename=_attachment_filename(message.attachment_path),
        created_at=message.sent_at,
    )


async def _validate_and_store_attachment(
    *,
    file: UploadFile,
    current_user: User,
    client_sha256: str | None,
) -> SupportAttachmentResponse:
    if file.content_type not in ALLOWED_ATTACHMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Format non supporte. Utilisez JPG, PNG ou PDF.",
        )

    content = await file.read()
    max_allowed_size = settings.MAX_DOCUMENT_SIZE_MB * 1024 * 1024
    if len(content) > max_allowed_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Fichier trop volumineux. Limite: {settings.MAX_DOCUMENT_SIZE_MB} Mo.",
        )

    if file.content_type in {"image/jpeg", "image/png"}:
        max_size = SUPPORT_IMAGE_MAX_SIZE_MB * 1024 * 1024
        if len(content) > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Image trop volumineuse. Limite: {SUPPORT_IMAGE_MAX_SIZE_MB} Mo.",
            )

    if file.content_type == "application/pdf":
        max_size = SUPPORT_PDF_MAX_SIZE_MB * 1024 * 1024
        if len(content) > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"PDF trop volumineux. Limite: {SUPPORT_PDF_MAX_SIZE_MB} Mo.",
            )
        page_count = _count_pdf_pages(content)
        if page_count < 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="PDF invalide ou sans page lisible.",
            )
        if page_count > SUPPORT_PDF_MAX_PAGES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"PDF trop long. Limite: {SUPPORT_PDF_MAX_PAGES} pages.",
            )

    digest = hashlib.sha256(content).hexdigest()
    if client_sha256 and client_sha256.lower() != digest:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Le hash du fichier ne correspond pas. Veuillez renvoyer le fichier.",
        )

    attachment_id = str(uuid.uuid4())
    safe_name = Path(file.filename or "attachment").name
    base_dir = Path(settings.STORAGE_PATH) / "support" / str(current_user.id)
    base_dir.mkdir(parents=True, exist_ok=True)
    target = base_dir / f"{attachment_id}_{safe_name}"

    async with aiofiles.open(target, "wb") as out:
        await out.write(content)

    return SupportAttachmentResponse(
        attachment_id=attachment_id,
        filename=safe_name,
        size=len(content),
        sha256=digest,
        content_type=file.content_type or "application/octet-stream",
        path=str(target),
    )


def _support_file_message(content: str | None, filename: str) -> str:
    text = (content or "").strip()
    if text:
        return text[:MAX_MESSAGE_CHARS]
    return f"Fichier envoye: {filename}"


@router.get("/attachment-limits", response_model=SupportAttachmentLimitsResponse)
async def get_support_attachment_limits(
    current_user: User = Depends(get_current_user),
):
    return SupportAttachmentLimitsResponse(
        max_size_mb=settings.MAX_DOCUMENT_SIZE_MB,
        hard_max_size_mb=settings.MAX_DOCUMENT_SIZE_MB,
        image_max_size_mb=SUPPORT_IMAGE_MAX_SIZE_MB,
        pdf_max_size_mb=SUPPORT_PDF_MAX_SIZE_MB,
        pdf_max_pages=SUPPORT_PDF_MAX_PAGES,
        max_message_chars=MAX_MESSAGE_CHARS,
        allowed_content_types=sorted(ALLOWED_ATTACHMENT_TYPES),
        allowed_extensions=[".jpg", ".jpeg", ".png", ".pdf"],
    )


@router.get("/threads/current", response_model=SupportThreadResponse)
async def get_current_thread(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    thread = await _get_or_create_support_thread(db, current_user)
    await db.commit()
    await db.refresh(thread)
    return SupportThreadResponse(
        id=thread.id,
        session_id=thread.session_id,
        status=thread.status,
        created_at=thread.created_at,
    )


@router.get("/threads/{thread_id}/messages", response_model=list[SupportMessageResponse])
async def list_thread_messages(
    thread_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    thread_result = await db.execute(
        select(SupportThread)
        .join(KYCSession, KYCSession.id == SupportThread.session_id)
        .where(SupportThread.id == thread_id, KYCSession.user_id == current_user.id)
    )
    thread = thread_result.scalar_one_or_none()
    if thread is None:
        raise HTTPException(status_code=404, detail="Support thread not found.")

    result = await db.execute(
        select(SupportMessage)
        .where(SupportMessage.thread_id == thread.id)
        .order_by(SupportMessage.sent_at.asc())
    )
    return [_to_message_response(message) for message in result.scalars().all()]


@router.post(
    "/threads/{thread_id}/messages",
    response_model=SupportMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_thread_message(
    thread_id: uuid.UUID,
    body: SupportMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    thread_result = await db.execute(
        select(SupportThread)
        .join(KYCSession, KYCSession.id == SupportThread.session_id)
        .where(SupportThread.id == thread_id, KYCSession.user_id == current_user.id)
    )
    thread = thread_result.scalar_one_or_none()
    if thread is None:
        raise HTTPException(status_code=404, detail="Support thread not found.")

    message = SupportMessage(
        thread_id=thread.id,
        sender_type="MARIE",
        sender_id=current_user.id,
        content=body.content,
    )
    db.add(message)
    db.add(
        Notification(
            user_id=current_user.id,
            type="SUPPORT_MESSAGE_SENT",
            message="Votre message a ete envoye au support BICEC.",
            payload={"thread_id": str(thread.id)},
        )
    )
    await db.commit()
    await db.refresh(message)
    return _to_message_response(message)


@router.post(
    "/threads/{thread_id}/attachments",
    response_model=SupportMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_thread_attachment(
    thread_id: uuid.UUID,
    file: UploadFile = File(...),
    content: str | None = Form(default=None, max_length=MAX_MESSAGE_CHARS),
    sha256: str | None = Form(default=None, max_length=64),
    x_client_sha256: str | None = Header(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    thread_result = await db.execute(
        select(SupportThread)
        .join(KYCSession, KYCSession.id == SupportThread.session_id)
        .where(SupportThread.id == thread_id, KYCSession.user_id == current_user.id)
    )
    thread = thread_result.scalar_one_or_none()
    if thread is None:
        raise HTTPException(status_code=404, detail="Support thread not found.")

    attachment = await _validate_and_store_attachment(
        file=file,
        current_user=current_user,
        client_sha256=sha256 or x_client_sha256,
    )

    message = SupportMessage(
        thread_id=thread.id,
        sender_type="MARIE",
        sender_id=current_user.id,
        content=_support_file_message(content, attachment.filename),
        attachment_path=attachment.path,
        attachment_sha256=attachment.sha256,
    )
    document = Document(
        session_id=thread.session_id,
        doc_type="COMPLEMENTARY",
        file_path=attachment.path,
        sha256_hash=attachment.sha256,
        ocr_status="MANUAL",
        capture_quality_metrics={
            "source": "support_chat",
            "filename": attachment.filename,
            "content_type": attachment.content_type,
        },
        file_size_bytes=attachment.size,
    )
    db.add(document)
    db.add(message)
    db.add(
        Notification(
            user_id=current_user.id,
            type="SUPPORT_ATTACHMENT_SENT",
            message="Votre fichier complementaire a ete envoye au support BICEC.",
            payload={
                "thread_id": str(thread.id),
                "attachment_sha256": attachment.sha256,
                "filename": attachment.filename,
            },
        )
    )
    await db.commit()
    await db.refresh(message)
    response = _to_message_response(message)
    response.attachment_document_id = document.id
    return response


@router.post("/attachments", response_model=SupportAttachmentResponse, status_code=201)
async def upload_support_attachment(
    request: Request,
    file: UploadFile = File(...),
    sha256: str | None = Form(default=None, max_length=64),
    x_client_sha256: str | None = Header(default=None),
    current_user: User = Depends(get_current_user),
):
    return await _validate_and_store_attachment(
        file=file,
        current_user=current_user,
        client_sha256=sha256 or x_client_sha256,
    )
