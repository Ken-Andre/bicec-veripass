"""Authenticated mobile support API."""

import hashlib
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.kyc.models import KYCSession, Notification, SupportMessage, SupportThread
from app.modules.support.schemas import (
    SupportAttachmentResponse,
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
        created_at=message.sent_at,
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


@router.get("/threads/messages", response_model=list[SupportMessageResponse])
async def list_current_thread_messages_compat(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deprecated compatibility route for stale PWA clients.

    Canonical route: GET /support/threads/{thread_id}/messages.
    Remove after deployed service workers no longer request this path.
    """
    thread = await _get_or_create_support_thread(db, current_user)
    await db.flush()
    result = await db.execute(
        select(SupportMessage)
        .where(SupportMessage.thread_id == thread.id)
        .order_by(SupportMessage.sent_at.asc())
    )
    await db.commit()
    return [_to_message_response(message) for message in result.scalars().all()]


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


@router.post("/attachments", response_model=SupportAttachmentResponse, status_code=201)
async def upload_support_attachment(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_ATTACHMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Format non supporte. Utilisez JPG, PNG ou PDF.",
        )

    max_size = settings.MAX_DOCUMENT_SIZE_MB * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Fichier trop volumineux. Limite: {settings.MAX_DOCUMENT_SIZE_MB} Mo.",
        )

    digest = hashlib.sha256(content).hexdigest()
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
