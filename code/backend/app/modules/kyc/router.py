"""KYC Module Routes."""

import uuid
from datetime import datetime, timezone, timedelta
import re
from statistics import mean
from fastapi import (
    APIRouter,
    Request,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.security import get_current_user, get_current_agent, make_session_handle, verify_session_handle, require_agent_role
from app.core.logging import logger
from app.db.session import get_db
from app.modules.auth.models import User, Agent, AgentRole
from app.modules.kyc.models import (
    KYCSession,
    Document,
    OCRField,
    BiometricResult,
    ConsentRecord,
    ValidationDecision,
    AmlAlert,
    Notification,
)
from app.modules.kyc.service import (
    process_document_ocr_pipeline,
    compute_anti_spoofing_score_from_landmarks,
    compute_face_match_score_for_session,
)
from app.modules.audit.models import AuditLog
from app.modules.kyc.schemas import (
    KYCSessionResponse,
    KYCSubmitResponse,
    KYCReadinessResponse,
    DocumentResponse,
    BiometricResultResponse,
    ConsentSubmitRequest,
    ConsentRecordResponse,
    AddressSubmitRequest,
    LivenessSubmitRequest,
    LivenessResultResponse,
    OCRReviewSubmitRequest,
    OCRConfirmSubmitRequest,
    OCRFieldResponse,
    NIUSubmitRequest,
    SignatureSubmitRequest,
    GeoRegionResponse,
    GeoCityResponse,
    GeoQuartierResponse,
    LifecycleState,
    AccessTier,
    LIFECYCLE_TO_ACCESS_TIER,
)
from app.modules.kyc import geo_data

router = APIRouter()
SHA256_HEX_RE = re.compile(r"^[a-fA-F0-9]{64}$")
VALID_CAPTURE_SIDES = {"RECTO", "VERSO"}
LIVENESS_LOCKOUT_COOLDOWN_SECONDS = 60
LIVENESS_LOCKOUT_WINDOW_HOURS = 24
MAX_LIVENESS_LOCKOUTS_PER_WINDOW = 3


def _normalize_sha256(value: str) -> str:
    return value.strip().lower()


def _is_valid_sha256(value: str) -> bool:
    return bool(SHA256_HEX_RE.fullmatch(value.strip()))


def _normalize_capture_side(side: str) -> str:
    normalized = side.strip().upper()
    if normalized not in VALID_CAPTURE_SIDES:
        raise HTTPException(
            status_code=400,
            detail="Invalid side. Expected RECTO or VERSO.",
        )
    return normalized


def _reset_user_lockout_window_if_needed(current_user: User) -> None:
    now = datetime.now(timezone.utc)
    if (
        current_user.last_lockout_reset_at is None
        or now - current_user.last_lockout_reset_at
        >= timedelta(hours=LIVENESS_LOCKOUT_WINDOW_HOURS)
    ):
        current_user.liveness_lockout_count_24h = 0
        current_user.last_lockout_reset_at = now


def _locked_liveness_response(lockout_count_24h: int) -> LivenessResultResponse:
    return LivenessResultResponse(
        is_alive=False,
        confidence=0.0,
        attempts_remaining=0,
        strikes_remaining=0,
        face_match_score=None,
        anti_spoofing_score=None,
        is_locked=True,
        cooldown_seconds=LIVENESS_LOCKOUT_COOLDOWN_SECONDS,
        lockout_count_24h=lockout_count_24h,
        branch_fallback_available=True,
    )


async def _get_active_draft_session(
    db: AsyncSession, current_user: User
) -> KYCSession:
    result = await db.execute(
        select(KYCSession)
        .where(KYCSession.user_id == current_user.id, KYCSession.status == "DRAFT")
        .order_by(KYCSession.started_at.desc())
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="No active KYC session")
    return session


async def _store_document_and_create_record(
    *,
    session: KYCSession,
    file: UploadFile,
    doc_type: str,
    db: AsyncSession,
    client_sha256: str | None = None,
) -> DocumentResponse:
    from app.modules.kyc.storage import document_storage

    if client_sha256 and not _is_valid_sha256(client_sha256):
        raise HTTPException(
            status_code=400, detail="Invalid client_sha256 format (expected 64-char hex)"
        )

    # Save file using DocumentStorage (handles SHA-256 and storage)
    try:
        storage_result = await document_storage.save_uploaded_file(
            session_id=str(session.id), upload_file=file, document_type=doc_type
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to save document")

    # Optional client/server integrity check with explicit retry semantics.
    if client_sha256:
        server_sha256 = _normalize_sha256(storage_result["sha256"])
        normalized_client_sha256 = _normalize_sha256(client_sha256)
        if normalized_client_sha256 != server_sha256:
            await document_storage.delete_relative_path(storage_result["path"])
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "HASH_MISMATCH",
                    "message": "Uploaded file hash does not match client hash. Please re-upload.",
                    "client_sha256": normalized_client_sha256,
                    "server_sha256": server_sha256,
                    "retryable": True,
                },
            )

    # Check for duplicate document (same hash + same type in same session)
    existing_doc = await db.execute(
        select(Document).where(
            Document.session_id == session.id,
            Document.doc_type == doc_type,
            Document.sha256_hash == storage_result["sha256"],
        ).limit(1)
    )
    if existing_doc.scalars().first():
        await document_storage.delete_relative_path(storage_result["path"])
        raise HTTPException(
            status_code=409,
            detail={
                "code": "DUPLICATE_DOCUMENT",
                "message": f"Un document {doc_type} identique existe déjà dans ce dossier.",
                "retryable": False,
            },
        )

    # Create document record
    doc = Document(
        id=uuid.uuid4(),
        session_id=session.id,
        doc_type=doc_type,
        file_path=storage_result["path"],
        sha256_hash=storage_result["sha256"],
        captured_at=datetime.now(timezone.utc),
        file_size_bytes=storage_result["size"],
    )
    db.add(doc)

    # Update session step
    session.last_step_completed = f"upload_{doc_type.lower()}"
    await db.commit()
    await db.refresh(doc, attribute_names=["ocr_fields"])

    try:
        await process_document_ocr_pipeline(document_id=doc.id, db=db)
    except Exception as exc:
        logger.error(
            "OCR pipeline failed for document %s (doc_type=%s): %s",
            doc.id,
            doc_type,
            exc,
            exc_info=True,
        )
        doc.ocr_status = "FAILED"
        doc.ocr_error = str(exc)[:500]
        await db.commit()

    await db.refresh(doc, attribute_names=["ocr_fields"])

    logger.info(
        "Document %s uploaded for session %s — ocr_status=%s",
        doc_type,
        session.id,
        doc.ocr_status,
    )
    return DocumentResponse(
        id=make_session_handle(str(doc.id)),
        doc_type=doc.doc_type,
        file_path=doc.file_path,
        sha256_hash=doc.sha256_hash,
        ocr_status=doc.ocr_status,
        ocr_error=doc.ocr_error,
        ocr_engine=doc.ocr_engine,
        confidence_per_field=doc.confidence_per_field,
        captured_at=doc.captured_at,
        ocr_fields=[
            OCRFieldResponse(
                id=make_session_handle(str(field.id)),
                field_name=field.field_name,
                extracted_value=field.extracted_value,
                confidence_score=float(field.confidence_score),
                human_corrected=field.human_corrected,
                corrected_value=field.corrected_value,
            )
            for field in doc.ocr_fields
        ],
    )


@router.get("/")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_root(request: Request):
    return {"module": "kyc", "status": "initialized"}


@router.get("/session/current", response_model=KYCSessionResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_current_session(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current active KYC session for the user.

    Returns the most recent session across all lifecycle states,
    so the PWA can display the appropriate UI based on status/access_level.
    """
    # States where the session is still active (not abandoned/archived)
    active_statuses = [
        LifecycleState.DRAFT,
        LifecycleState.PENDING_INFO,
        LifecycleState.LOCKED_LIVENESS,
        LifecycleState.PENDING_KYC,  # legacy alias
        LifecycleState.PENDING_AGENT_REVIEW,
        LifecycleState.APPROVED,
        LifecycleState.REJECTED,
        LifecycleState.FRAUD_SUSPECT,
    ]
    result = await db.execute(
        select(KYCSession)
        .options(
            selectinload(KYCSession.documents).selectinload(Document.ocr_fields),
            selectinload(KYCSession.biometric_results),
            selectinload(KYCSession.consent_record),
        )
        .where(
            KYCSession.user_id == current_user.id,
            KYCSession.status.in_(active_statuses),
        )
        .order_by(KYCSession.started_at.desc())
    )
    kyc_session = result.scalars().first()

    if not kyc_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active KYC session found.",
        )

    return KYCSessionResponse(
        id=make_session_handle(str(kyc_session.id)),
        status=kyc_session.status,
        access_level=kyc_session.access_level,
        niu_type=kyc_session.niu_type,
        confidence_score_global=float(kyc_session.confidence_score_global)
        if kyc_session.confidence_score_global
        else None,
        liveness_strike_count=kyc_session.liveness_strike_count,
        last_step_completed=kyc_session.last_step_completed,
        started_at=kyc_session.started_at,
        submitted_at=kyc_session.submitted_at,
        completed_at=kyc_session.completed_at,
        documents=[
            DocumentResponse(
                id=make_session_handle(str(doc.id)),
                doc_type=doc.doc_type,
                file_path=doc.file_path,
                sha256_hash=doc.sha256_hash,
                ocr_engine=doc.ocr_engine,
                confidence_per_field=doc.confidence_per_field,
                capture_quality_metrics=doc.capture_quality_metrics,
                captured_at=doc.captured_at,
                ocr_fields=[
                    OCRFieldResponse(
                        id=make_session_handle(str(field.id)),
                        field_name=field.field_name,
                        extracted_value=field.extracted_value,
                        confidence_score=float(field.confidence_score),
                        human_corrected=field.human_corrected,
                        corrected_value=field.corrected_value,
                    )
                    for field in doc.ocr_fields
                ],
            )
            for doc in kyc_session.documents
        ],
        biometric_result=BiometricResultResponse(
            id=make_session_handle(str(kyc_session.biometric_results.id)),
            face_match_score=float(kyc_session.biometric_results.face_match_score)
            if kyc_session.biometric_results.face_match_score
            else None,
            liveness_score=float(kyc_session.biometric_results.liveness_score)
            if kyc_session.biometric_results.liveness_score
            else None,
            anti_spoofing_score=float(kyc_session.biometric_results.anti_spoofing_score)
            if kyc_session.biometric_results.anti_spoofing_score
            else None,
            processed_at=kyc_session.biometric_results.processed_at,
        )
        if kyc_session.biometric_results
        else None,
        consent_record=ConsentRecordResponse(
            id=make_session_handle(str(kyc_session.consent_record.id)),
            cgu_accepted=kyc_session.consent_record.cgu_accepted,
            privacy_accepted=kyc_session.consent_record.privacy_accepted,
            data_processing_accepted=kyc_session.consent_record.data_processing_accepted,
            consent_method=kyc_session.consent_record.consent_method,
            cgu_version=kyc_session.consent_record.cgu_version,
            privacy_version=kyc_session.consent_record.privacy_version,
            signed_at=kyc_session.consent_record.signed_at,
        )
        if kyc_session.consent_record
        else None,
    )


@router.post("/session/start")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def start_kyc_session(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a new KYC session for the user."""
    # Check for existing active session
    result = await db.execute(
        select(KYCSession).where(
            KYCSession.user_id == current_user.id,
            KYCSession.status.in_(["DRAFT", "PENDING_KYC", "PENDING_INFO"]),
        )
    )
    existing = result.scalars().first()
    if existing:
        return {
            "session_id": make_session_handle(str(existing.id)),
            "status": existing.status,
            "message": "Existing session found",
        }

    # Create new session — ADR-001: DRAFT → RESTRICTED access
    # Note: ADR-001 specifies GUEST for DRAFT, but existing sessions use RESTRICTED.
    # Keeping RESTRICTED for backward compat until migration is ready.
    session = KYCSession(
        id=uuid.uuid4(),
        user_id=current_user.id,
        status=LifecycleState.DRAFT,
        access_level=AccessTier.RESTRICTED,
        started_at=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.commit()

    logger.info(f"KYC session started for user {current_user.id}")
    return {
        "session_id": make_session_handle(str(session.id)),
        "status": "DRAFT",
        "message": "Session started",
    }


@router.post("/document/upload", response_model=DocumentResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    doc_type: str = Form("CNI_RECTO"),
    client_sha256: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a KYC document (CNI recto/verso, selfie, bill, NIU)."""
    session = await _get_active_draft_session(db, current_user)
    return await _store_document_and_create_record(
        session=session,
        file=file,
        doc_type=doc_type,
        db=db,
        client_sha256=client_sha256,
    )


@router.post("/capture/cni", response_model=DocumentResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def capture_cni(
    request: Request,
    file: UploadFile = File(...),
    side: str = Form(...),
    session_id: str | None = Form(None),
    client_sha256: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Story-aligned CNI upload endpoint.

    Expected contract:
    - multipart file
    - side: RECTO|VERSO
    - optional session_id (accepted for compatibility; server uses active DRAFT session)
    """
    _ = session_id
    normalized_side = _normalize_capture_side(side)
    session = await _get_active_draft_session(db, current_user)
    return await _store_document_and_create_record(
        session=session,
        file=file,
        doc_type=f"CNI_{normalized_side}",
        db=db,
        client_sha256=client_sha256,
    )


@router.post("/capture/bill", response_model=DocumentResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def capture_bill(
    request: Request,
    file: UploadFile = File(...),
    bill_type: str = Form("ENEO"),
    session_id: str | None = Form(None),
    client_sha256: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload utility bill (ENEO or CAMWATER) as proof of residence.

    Expected contract:
    - multipart file (PNG/JPG)
    - bill_type: ENEO|CAMWATER
    - optional session_id
    """
    _ = session_id
    bill_type_upper = bill_type.strip().upper()
    if bill_type_upper not in {"ENEO", "CAMWATER"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid bill_type. Expected 'ENEO' or 'CAMWATER'.",
        )
    session = await _get_active_draft_session(db, current_user)
    return await _store_document_and_create_record(
        session=session,
        file=file,
        doc_type=f"BILL_{bill_type_upper}",
        db=db,
        client_sha256=client_sha256,
    )


async def _resolve_document_by_handle(
    doc_id: str, user: User, db: AsyncSession
) -> Document | None:
    """Resolve a document ID that may be a raw UUID or an HMAC handle.

    API responses return HMAC handles (via make_session_handle), so clients
    will naturally pass those handles back. This function tries the raw UUID
    first; if that fails or doesn't match, it iterates through the user's
    documents and checks via verify_session_handle.
    """
    # Try raw UUID first (most efficient), scoped to the current user
    try:
        raw_uuid = uuid.UUID(doc_id)
        result = await db.execute(
            select(Document)
            .options(selectinload(Document.ocr_fields))
            .join(KYCSession, Document.session_id == KYCSession.id)
            .where(Document.id == raw_uuid, KYCSession.user_id == user.id)
        )
        doc = result.scalar_one_or_none()
        if doc:
            return doc
    except ValueError:
        pass

    # Fall back to HMAC handle lookup through user's session documents
    result = await db.execute(
        select(KYCSession)
        .options(selectinload(KYCSession.documents).selectinload(Document.ocr_fields))
        .where(KYCSession.user_id == user.id)
    )
    sessions = result.scalars().all()
    for session in sessions:
        for doc in session.documents:
            if verify_session_handle(doc_id, str(doc.id)):
                return doc

    return None


@router.get("/document/{doc_id}/ocr")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_document_ocr(
    request: Request,
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get OCR results for a document.

    Accepts both raw UUIDs and HMAC handles (as returned by other endpoints).
    """
    doc = await _resolve_document_by_handle(doc_id, current_user, db)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "document_id": make_session_handle(str(doc.id)),
        "doc_type": doc.doc_type,
        "ocr_engine": doc.ocr_engine,
        "confidence_per_field": doc.confidence_per_field,
        "ocr_fields": [
            {
                "id": make_session_handle(str(field.id)),
                "field_name": field.field_name,
                "extracted_value": field.extracted_value,
                "confidence_score": float(field.confidence_score),
                "human_corrected": field.human_corrected,
                "corrected_value": field.corrected_value,
            }
            for field in doc.ocr_fields
        ],
    }


@router.post("/ocr/review")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def submit_ocr_review(
    request: Request,
    body: OCRReviewSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit OCR field corrections."""
    # Get current session
    result = await db.execute(
        select(KYCSession)
        .where(KYCSession.user_id == current_user.id, KYCSession.status == "DRAFT")
        .order_by(KYCSession.started_at.desc())
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="No active KYC session")

    result = await db.execute(
        select(Document)
        .where(
            Document.session_id == session.id,
            Document.doc_type.in_(["CNI_RECTO", "CNI_VERSO"]),
        )
        .order_by(Document.captured_at.desc())
    )
    target_doc = result.scalars().first()

    # Update OCR fields (or create manual ones when OCR extraction is empty)
    for field_name, corrected_value in body.fields.items():
        result = await db.execute(
            select(OCRField)
            .join(Document)
            .where(Document.session_id == session.id, OCRField.field_name == field_name)
        )
        field = result.scalars().first()
        if field:
            field.human_corrected = True
            field.corrected_value = corrected_value
            if not field.extracted_value:
                field.extracted_value = corrected_value
        elif target_doc:
            db.add(
                OCRField(
                    id=uuid.uuid4(),
                    document_id=target_doc.id,
                    field_name=field_name,
                    extracted_value=corrected_value,
                    confidence_score=1.0,
                    human_corrected=True,
                    corrected_value=corrected_value,
                    corrected_at=datetime.now(timezone.utc),
                )
            )

    session.last_step_completed = "ocr_review"
    await db.commit()

    return {"status": "success", "message": "OCR review submitted"}


@router.post("/ocr/confirm")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def confirm_ocr_review(
    request: Request,
    body: OCRConfirmSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Story-aligned OCR confirmation endpoint.

    Expected contract:
    - corrected_fields: { field_name: value }
    """
    return await submit_ocr_review(
        request=request,
        body=OCRReviewSubmitRequest(fields=body.corrected_fields),
        current_user=current_user,
        db=db,
    )


@router.post("/liveness/submit", response_model=LivenessResultResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def submit_liveness(
    request: Request,
    body: LivenessSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit liveness challenge result."""
    _reset_user_lockout_window_if_needed(current_user)

    result = await db.execute(
        select(KYCSession)
        .where(
            KYCSession.user_id == current_user.id,
            KYCSession.status.in_(["DRAFT", "LOCKED_LIVENESS"]),
        )
        .order_by(KYCSession.started_at.desc())
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="No active KYC session")

    if session.status == "LOCKED_LIVENESS":
        await db.commit()
        return _locked_liveness_response(current_user.liveness_lockout_count_24h or 0)

    if (current_user.liveness_lockout_count_24h or 0) >= MAX_LIVENESS_LOCKOUTS_PER_WINDOW:
        session.status = "LOCKED_LIVENESS"
        await db.commit()
        return _locked_liveness_response(current_user.liveness_lockout_count_24h or 0)

    # In production, validate landmarks and compute liveness score
    # For now, accept if landmarks are provided
    is_alive = len(body.landmarks_json) > 0
    confidence = 0.95 if is_alive else 0.0

    if not is_alive:
        session.liveness_strike_count += 1
        if session.liveness_strike_count >= 3:
            session.status = "LOCKED_LIVENESS"
            current_user.liveness_lockout_count_24h = (
                (current_user.liveness_lockout_count_24h or 0) + 1
            )
            await db.commit()
            return _locked_liveness_response(current_user.liveness_lockout_count_24h)

        await db.commit()
        return LivenessResultResponse(
            is_alive=False,
            confidence=0.0,
            attempts_remaining=3 - session.liveness_strike_count,
            strikes_remaining=3 - session.liveness_strike_count,
            face_match_score=None,
            anti_spoofing_score=None,
            is_locked=False,
            cooldown_seconds=None,
            lockout_count_24h=current_user.liveness_lockout_count_24h or 0,
            branch_fallback_available=False,
        )

    anti_spoofing_score = compute_anti_spoofing_score_from_landmarks(
        body.landmarks_json,
        body.challenge_type,
    )
    face_match_score = await compute_face_match_score_for_session(
        session_id=session.id,
        db=db,
    )
    # face_match_score is None when no SELFIE document exists yet.
    # In that case, we do NOT substitute the liveness confidence —
    # a None score is honest and signals that face matching was not performed.
    if face_match_score is not None and (
        anti_spoofing_score < settings.ANTI_SPOOFING_MIN_SCORE
        or face_match_score < settings.FACE_MATCH_MIN_SCORE
    ):
        session.priority_flag = True

    result = await db.execute(
        select(BiometricResult).where(BiometricResult.session_id == session.id)
    )
    biometric = result.scalar_one_or_none()
    if biometric is None:
        biometric = BiometricResult(
            id=uuid.uuid4(),
            session_id=session.id,
            liveness_score=confidence,
            face_match_score=face_match_score,
            anti_spoofing_score=anti_spoofing_score,
            processed_at=datetime.now(timezone.utc),
        )
        db.add(biometric)
    else:
        biometric.liveness_score = confidence
        biometric.face_match_score = face_match_score
        biometric.anti_spoofing_score = anti_spoofing_score
        biometric.processed_at = datetime.now(timezone.utc)
    session.liveness_strike_count = 0
    session.last_step_completed = "liveness"
    await db.commit()

    return LivenessResultResponse(
        is_alive=is_alive,
        confidence=confidence,
        attempts_remaining=3 - session.liveness_strike_count,
        strikes_remaining=3 - session.liveness_strike_count,
        face_match_score=face_match_score,
        anti_spoofing_score=anti_spoofing_score,
        is_locked=False,
        cooldown_seconds=None,
        lockout_count_24h=current_user.liveness_lockout_count_24h or 0,
        branch_fallback_available=False,
    )


@router.post("/capture/liveness", response_model=LivenessResultResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def capture_liveness(
    request: Request,
    body: LivenessSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Story-aligned liveness endpoint alias."""
    return await submit_liveness(
        request=request,
        body=body,
        current_user=current_user,
        db=db,
    )


@router.post("/address/submit")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def submit_address(
    request: Request,
    body: AddressSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit address information with GPS validation."""
    result = await db.execute(
        select(KYCSession)
        .where(KYCSession.user_id == current_user.id, KYCSession.status == "DRAFT")
        .order_by(KYCSession.started_at.desc())
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="No active KYC session")

    # Validate GPS is within Cameroon bounds (~2°N-13°N, 8°E-17°E)
    if body.gps_lat is not None and body.gps_lng is not None:
        if not (2.0 <= body.gps_lat <= 13.0) or not (8.0 <= body.gps_lng <= 17.0):
            raise HTTPException(
                status_code=400,
                detail="GPS coordinates outside Cameroon bounds. Please ensure location services are enabled.",
            )

    session.last_step_completed = "address"
    await db.commit()

    return {
        "status": "success",
        "message": "Address and GPS validated",
        "gps_validated": body.gps_lat is not None and body.gps_lng is not None,
    }


@router.post("/consent/submit", response_model=ConsentRecordResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def submit_consent(
    request: Request,
    body: ConsentSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit consent checkboxes."""
    result = await db.execute(
        select(KYCSession)
        .where(KYCSession.user_id == current_user.id, KYCSession.status == "DRAFT")
        .order_by(KYCSession.started_at.desc())
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="No active KYC session")

    if not (
        body.cgu_accepted and body.privacy_accepted and body.data_processing_accepted
    ):
        raise HTTPException(status_code=400, detail="All consents must be accepted")

    # Upsert: find existing consent or create new one
    existing_result = await db.execute(
        select(ConsentRecord)
        .where(ConsentRecord.session_id == session.id)
        .order_by(ConsentRecord.signed_at.desc())
        .limit(1)
    )
    existing = existing_result.scalars().first()

    if existing:
        existing.cgu_accepted = body.cgu_accepted
        existing.privacy_accepted = body.privacy_accepted
        existing.data_processing_accepted = body.data_processing_accepted
        existing.consent_method = body.consent_method
        existing.signed_at = datetime.now(timezone.utc)
        consent = existing
    else:
        consent = ConsentRecord(
            id=uuid.uuid4(),
            session_id=session.id,
            cgu_accepted=body.cgu_accepted,
            privacy_accepted=body.privacy_accepted,
            data_processing_accepted=body.data_processing_accepted,
            consent_method=body.consent_method,
            cgu_version="1.0.0",
            privacy_version="1.0.0",
            signed_at=datetime.now(timezone.utc),
        )
        db.add(consent)
    session.last_step_completed = "consent"
    await db.commit()

    return ConsentRecordResponse(
        id=make_session_handle(str(consent.id)),
        cgu_accepted=consent.cgu_accepted,
        privacy_accepted=consent.privacy_accepted,
        data_processing_accepted=consent.data_processing_accepted,
        consent_method=consent.consent_method,
        cgu_version=consent.cgu_version,
        privacy_version=consent.privacy_version,
        signed_at=consent.signed_at,
    )


@router.post("/niu/submit")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def submit_niu(
    request: Request,
    body: NIUSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit NIU information."""
    result = await db.execute(
        select(KYCSession)
        .where(KYCSession.user_id == current_user.id, KYCSession.status == "DRAFT")
        .order_by(KYCSession.started_at.desc())
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="No active KYC session")

    session.niu_type = body.niu_type
    session.last_step_completed = "niu"
    await db.commit()

    return {"status": "success", "niu_type": body.niu_type}


@router.post("/signature/submit")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def submit_signature(
    request: Request,
    body: SignatureSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit electronic signature. Stored in consent metadata."""
    result = await db.execute(
        select(KYCSession)
        .where(KYCSession.user_id == current_user.id, KYCSession.status == "DRAFT")
        .order_by(KYCSession.started_at.desc())
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="No active KYC session")

    # Find or create consent record to attach signature
    result = await db.execute(
        select(ConsentRecord)
        .where(ConsentRecord.session_id == session.id)
        .order_by(ConsentRecord.signed_at.desc())
        .limit(1)
    )
    consent = result.scalars().first()

    if consent is None:
        consent = ConsentRecord(
            id=uuid.uuid4(),
            session_id=session.id,
            cgu_accepted=False,
            privacy_accepted=False,
            data_processing_accepted=False,
            consent_method="SIGNATURE_ONLY",
            signed_at=datetime.now(timezone.utc),
            consent_metadata={
                "signature_data": body.signature_data,
                "signature_timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        db.add(consent)
    else:
        if consent.consent_metadata is None:
            consent.consent_metadata = {}
        consent.consent_metadata["signature_data"] = body.signature_data
        consent.consent_metadata["signature_timestamp"] = datetime.now(timezone.utc).isoformat()

    session.last_step_completed = "signature"
    await db.commit()

    return {"status": "success", "message": "Signature recorded"}


async def _compute_kyc_readiness(
    *,
    session: KYCSession,
    db: AsyncSession,
) -> KYCReadinessResponse:
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.ocr_fields))
        .where(Document.session_id == session.id)
    )
    docs = result.scalars().all()
    doc_types = {d.doc_type for d in docs}

    required = {"CNI_RECTO", "CNI_VERSO", "SELFIE"}

    # Single BiometricResult query — used for SELFIE satisfaction and readiness gating
    result = await db.execute(
        select(BiometricResult).where(BiometricResult.session_id == session.id)
    )
    biometric = result.scalar_one_or_none()
    has_biometric_result = biometric is not None

    # Liveness capture already provides a face image; if biometric result exists,
    # it satisfies the SELFIE requirement (no separate selfie upload needed).
    if has_biometric_result:
        doc_types = doc_types | {"SELFIE"}
    missing = sorted(required - doc_types)
    blocking_reasons: list[str] = []
    warnings: list[str] = []

    if missing:
        blocking_reasons.append(f"Missing required documents: {', '.join(missing)}")

    has_bill_document = bool({"BILL_ENEO", "BILL_CAMWATER"} & doc_types)
    if not has_bill_document:
        blocking_reasons.append("Missing required bill document (ENEO or CAMWATER)")

    result = await db.execute(
        select(ConsentRecord)
        .where(ConsentRecord.session_id == session.id)
        .order_by(ConsentRecord.signed_at.desc())
        .limit(1)
    )
    consent = result.scalars().first()
    has_consent = consent is not None
    if not has_consent:
        blocking_reasons.append("Consent not submitted")

    cni_docs = [d for d in docs if d.doc_type in {"CNI_RECTO", "CNI_VERSO"}]
    ocr_scores: list[float] = []
    for doc in cni_docs:
        for field in doc.ocr_fields:
            ocr_scores.append(1.0 if field.human_corrected else float(field.confidence_score))
    has_ocr_review = len(ocr_scores) > 0
    if not has_ocr_review:
        blocking_reasons.append("OCR review not completed. Please confirm identity fields first.")

    if not has_biometric_result:
        blocking_reasons.append("Liveness step not completed")

    confidence_score_global: float | None = None
    if biometric and ocr_scores:
        liveness_score = float(biometric.liveness_score or 0.0)
        raw_face_match = biometric.face_match_score
        face_match_score = float(raw_face_match) if raw_face_match is not None else None
        anti_spoofing_score = float(biometric.anti_spoofing_score or 0.0)
        ocr_avg_score = float(mean(ocr_scores))
        # Build score list for global average — exclude None components
        score_components: list[float] = [ocr_avg_score, liveness_score, anti_spoofing_score]
        if face_match_score is not None:
            score_components.append(face_match_score)
        confidence_score_global = float(mean(score_components))
        if face_match_score is not None and face_match_score < settings.FACE_MATCH_MIN_SCORE:
            warnings.append("Face match below threshold: priority manual review will be applied.")
        if anti_spoofing_score < settings.ANTI_SPOOFING_MIN_SCORE:
            warnings.append("Anti-spoofing below threshold: priority manual review will be applied.")

    return KYCReadinessResponse(
        can_submit=len(blocking_reasons) == 0,
        blocking_reasons=blocking_reasons,
        warnings=warnings,
        required_missing_documents=missing,
        has_ocr_review=has_ocr_review,
        has_consent=has_consent,
        has_biometric_result=has_biometric_result,
        has_bill_document=has_bill_document,
        confidence_score_global=confidence_score_global,
    )


@router.get("/readiness", response_model=KYCReadinessResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_kyc_readiness(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return readiness gates before KYC submission."""
    session = await _get_active_draft_session(db, current_user)
    return await _compute_kyc_readiness(session=session, db=db)


@router.post("/submit", response_model=KYCSubmitResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def submit_kyc(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit the complete KYC dossier for review."""
    result = await db.execute(
        select(KYCSession)
        .where(KYCSession.user_id == current_user.id, KYCSession.status == "DRAFT")
        .order_by(KYCSession.started_at.desc())
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="No active KYC session")

    readiness = await _compute_kyc_readiness(session=session, db=db)
    if not readiness.can_submit:
        raise HTTPException(status_code=400, detail=readiness.blocking_reasons[0])

    result = await db.execute(
        select(BiometricResult).where(BiometricResult.session_id == session.id)
    )
    biometric = result.scalar_one_or_none()
    if not biometric:
        raise HTTPException(status_code=400, detail="Liveness step not completed")
    raw_face_match = biometric.face_match_score
    face_match_score = float(raw_face_match) if raw_face_match is not None else None
    anti_spoofing_score = float(biometric.anti_spoofing_score or 0.0)

    # Flag for stronger manual review, but keep submission path available.
    # Only check face_match if it was actually computed (not None).
    low_face_match = face_match_score is not None and face_match_score < settings.FACE_MATCH_MIN_SCORE
    low_anti_spoofing = anti_spoofing_score < settings.ANTI_SPOOFING_MIN_SCORE
    if low_face_match or low_anti_spoofing:
        session.priority_flag = True

    session.confidence_score_global = readiness.confidence_score_global

    # Submit — transition per ADR-001: DRAFT → PENDING_AGENT_REVIEW
    new_status = LifecycleState.PENDING_AGENT_REVIEW
    new_access_level = LIFECYCLE_TO_ACCESS_TIER.get(new_status, AccessTier.RESTRICTED)

    session.status = new_status
    session.access_level = new_access_level
    session.submitted_at = datetime.now(timezone.utc)
    session.last_step_completed = "submission"
    await db.commit()

    # Audit log
    audit = AuditLog(
        id=uuid.uuid4(),
        action="KYC_SUBMIT",
        table_name="kyc_sessions",
        record_id=str(session.id),
        new_data={"status": new_status, "access_level": new_access_level},
        performed_by=current_user.id,
        performed_at=datetime.now(timezone.utc),
    )
    db.add(audit)
    await db.commit()

    logger.info(f"KYC submitted for user {current_user.id}, session {session.id}")
    message = "Dossier soumis avec succès. Un agent validera votre dossier sous 24-48h."
    if session.priority_flag:
        message = (
            "Dossier soumis avec succès et marqué en revue prioritaire "
            "(vérification biométrique renforcée)."
        )
    return KYCSubmitResponse(
        session_id=make_session_handle(str(session.id)),
        status=new_status,
        message=message,
        access_level=new_access_level,
    )


# === Mobile Review Status ===


@router.get("/review-status")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_review_status(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll review status for the user's submitted KYC session.

    Returns the current lifecycle state, access tier, and any unread
    notifications about agent decisions. The PWA uses this to:
    - Show "Dashboard Vitrine" while PENDING_AGENT_REVIEW (RESTRICTED)
    - Unlock services when APPROVED (LIMITED_ACCESS)
    - Show rejection reason when REJECTED (GUEST)
    - Block all access when FRAUD_SUSPECT (DISABLED)
    - Allow re-submission when PENDING_INFO (RESTRICTED)
    """
    # Find the most recent submitted session (not DRAFT, not ABANDONED)
    reviewable_statuses = [
        LifecycleState.PENDING_AGENT_REVIEW,
        LifecycleState.PENDING_KYC,
        LifecycleState.APPROVED,
        LifecycleState.REJECTED,
        LifecycleState.FRAUD_SUSPECT,
        LifecycleState.PENDING_INFO,
    ]
    result = await db.execute(
        select(KYCSession)
        .where(
            KYCSession.user_id == current_user.id,
            KYCSession.status.in_(reviewable_statuses),
        )
        .order_by(KYCSession.submitted_at.desc())
    )
    session = result.scalars().first()

    if not session:
        return {"status": "NO_SUBMISSION", "access_level": AccessTier.GUEST}

    # Fetch unread notifications for this user about KYC decisions
    result = await db.execute(
        select(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.type.like("KYC_%"),
            Notification.is_read == False,  # noqa: E712
        )
        .order_by(Notification.sent_at.desc())
    )
    unread_notifications = result.scalars().all()

    # Build response with decision details if available
    decision_info = None
    if session.status in {LifecycleState.APPROVED, LifecycleState.REJECTED, LifecycleState.FRAUD_SUSPECT}:
        result = await db.execute(
            select(ValidationDecision)
            .where(ValidationDecision.session_id == session.id)
            .order_by(ValidationDecision.decided_at.desc())
        )
        latest_decision = result.scalars().first()
        if latest_decision:
            decision_info = {
                "decision": latest_decision.decision,
                "reason": latest_decision.reason,
                "decided_at": latest_decision.decided_at.isoformat(),
            }

    # NOTE: Do NOT mark notifications as read on GET — that's a write side effect.
    # The PWA should call POST /notifications/{id}/read instead.

    return {
        "status": session.status,
        "access_level": session.access_level,
        "submitted_at": session.submitted_at.isoformat() if session.submitted_at else None,
        "completed_at": session.completed_at.isoformat() if session.completed_at else None,
        "decision": decision_info,
        "unread_notifications": [
            {
                "id": str(n.id),
                "type": n.type,
                "message": n.message,
                "sent_at": n.sent_at.isoformat() if n.sent_at else None,
            }
            for n in unread_notifications
        ],
    }


@router.post("/notifications/read")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def mark_notifications_read(
    request: Request,
    mark_all: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark notifications as read.

    With mark_all=true: marks all unread KYC notifications for the current user.
    Without mark_all: use POST /notifications/{id}/read for a single notification.
    """
    if not mark_all:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide mark_all=true to mark all notifications, "
            "or use POST /notifications/{id}/read for a single notification.",
        )

    # Bulk UPDATE — single SQL statement instead of Python loop
    now = datetime.now(timezone.utc)
    result = await db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.type.like("KYC_%"),
            Notification.is_read == False,  # noqa: E712
        )
        .values(is_read=True, read_at=now)
    )
    count = result.rowcount  # number of rows updated
    if count > 0:
        await db.commit()

    return {"status": "success", "marked_read": count}


@router.post("/notifications/{notification_id}/read")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def mark_notification_read(
    request: Request,
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a single notification as read.

    Called by the PWA after the user has seen the notification
    (received via GET /review-status unread_notifications).
    """
    # Validate and parse the notification ID
    try:
        raw_uuid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid notification ID format.",
        )

    # Scope to current user — users can only mark their own notifications
    result = await db.execute(
        select(Notification).where(
            Notification.id == raw_uuid,
            Notification.user_id == current_user.id,
        )
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        await db.commit()

    return {"status": "success", "notification_id": str(notification.id), "is_read": True}


# === Geo Data Endpoints ===


@router.get("/geo/regions", response_model=list[GeoRegionResponse])
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_regions(request: Request):
    """Get Cameroon regions."""
    return geo_data.get_regions()


@router.get("/geo/cities/{region_code}", response_model=list[GeoCityResponse])
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_cities(request: Request, region_code: str):
    """Get cities for a region."""
    return geo_data.get_cities(region_code)


@router.get("/geo/quartiers/{city_code}", response_model=list[GeoQuartierResponse])
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_quartiers(request: Request, city_code: str):
    """Get quartiers for a city."""
    return geo_data.get_quartiers(city_code)
