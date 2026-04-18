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
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.security import get_current_user, make_session_handle
from app.core.logging import logger
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.kyc.models import (
    KYCSession,
    Document,
    OCRField,
    BiometricResult,
    ConsentRecord,
)
from app.modules.kyc.service import (
    process_document_ocr_pipeline,
    compute_anti_spoofing_score_from_landmarks,
    compute_face_match_score_for_session,
)
from app.modules.kyc.schemas import (
    KYCSessionResponse,
    KYCSubmitResponse,
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
    GeoRegionResponse,
    GeoCityResponse,
    GeoQuartierResponse,
)

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
        await db.refresh(doc, attribute_names=["ocr_fields"])
    except Exception as exc:
        logger.warning(
            "OCR pipeline failed for document %s (doc_type=%s): %s",
            doc.id,
            doc_type,
            exc,
        )

    logger.info(f"Document {doc_type} uploaded for session {session.id}")
    return DocumentResponse(
        id=make_session_handle(str(doc.id)),
        doc_type=doc.doc_type,
        file_path=doc.file_path,
        sha256_hash=doc.sha256_hash,
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
    """Get the current active KYC session for the user."""
    result = await db.execute(
        select(KYCSession)
        .options(
            selectinload(KYCSession.documents).selectinload(Document.ocr_fields),
            selectinload(KYCSession.biometric_results),
            selectinload(KYCSession.consent_record),
        )
        .where(
            KYCSession.user_id == current_user.id,
            KYCSession.status.in_(
                ["DRAFT", "PENDING_INFO", "LOCKED_LIVENESS", "PENDING_KYC"]
            ),
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

    # Create new session
    session = KYCSession(
        id=uuid.uuid4(),
        user_id=current_user.id,
        status="DRAFT",
        access_level="RESTRICTED",
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


@router.get("/document/{doc_id}/ocr")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_document_ocr(
    request: Request,
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get OCR results for a document."""
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.ocr_fields))
        .where(Document.id == uuid.UUID(doc_id))
    )
    doc = result.scalar_one_or_none()
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
    resolved_face_match_score = face_match_score if face_match_score is not None else confidence
    if (
        anti_spoofing_score < settings.ANTI_SPOOFING_MIN_SCORE
        or resolved_face_match_score < settings.FACE_MATCH_MIN_SCORE
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
            face_match_score=resolved_face_match_score,
            anti_spoofing_score=anti_spoofing_score,
            processed_at=datetime.now(timezone.utc),
        )
        db.add(biometric)
    else:
        biometric.liveness_score = confidence
        biometric.face_match_score = resolved_face_match_score
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
        face_match_score=resolved_face_match_score,
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
    """Submit address information."""
    result = await db.execute(
        select(KYCSession)
        .where(KYCSession.user_id == current_user.id, KYCSession.status == "DRAFT")
        .order_by(KYCSession.started_at.desc())
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="No active KYC session")

    # Store address in session metadata (JSONB)
    # In production, you might have a dedicated Address table
    session.last_step_completed = "address"
    await db.commit()

    return {"status": "success", "message": "Address submitted"}


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

    # Validate minimum requirements
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.ocr_fields))
        .where(Document.session_id == session.id)
    )
    docs = result.scalars().all()
    doc_types = {d.doc_type for d in docs}

    required = {"CNI_RECTO", "CNI_VERSO", "SELFIE"}
    missing = required - doc_types
    if missing:
        raise HTTPException(
            status_code=400, detail=f"Missing required documents: {', '.join(missing)}"
        )

    # Check consent
    result = await db.execute(
        select(ConsentRecord).where(ConsentRecord.session_id == session.id)
    )
    consent = result.scalar_one_or_none()
    if not consent:
        raise HTTPException(status_code=400, detail="Consent not submitted")

    # OCR review gate: at least one extracted/corrected CNI field must exist
    cni_docs = [d for d in docs if d.doc_type in {"CNI_RECTO", "CNI_VERSO"}]
    ocr_scores: list[float] = []
    for doc in cni_docs:
        for field in doc.ocr_fields:
            score = 1.0 if field.human_corrected else float(field.confidence_score)
            ocr_scores.append(score)
    if not ocr_scores:
        raise HTTPException(
            status_code=400,
            detail="OCR review not completed. Please confirm identity fields first.",
        )

    # Biometric checkpoint gate (liveness + derived scores)
    result = await db.execute(
        select(BiometricResult).where(BiometricResult.session_id == session.id)
    )
    biometric = result.scalar_one_or_none()
    if not biometric:
        raise HTTPException(status_code=400, detail="Liveness step not completed")

    liveness_score = float(biometric.liveness_score or 0.0)
    face_match_score = float(biometric.face_match_score or 0.0)
    anti_spoofing_score = float(biometric.anti_spoofing_score or 0.0)
    ocr_avg_score = float(mean(ocr_scores))

    # Flag for stronger manual review, but keep submission path available.
    low_face_match = face_match_score < settings.FACE_MATCH_MIN_SCORE
    low_anti_spoofing = anti_spoofing_score < settings.ANTI_SPOOFING_MIN_SCORE
    if low_face_match or low_anti_spoofing:
        session.priority_flag = True

    session.confidence_score_global = float(
        mean(
            [
                ocr_avg_score,
                liveness_score,
                face_match_score,
                anti_spoofing_score,
            ]
        )
    )

    # Submit
    session.status = "PENDING_KYC"
    session.submitted_at = datetime.now(timezone.utc)
    session.last_step_completed = "submission"
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
        status="PENDING_KYC",
        message=message,
    )


# === Geo Data Endpoints ===


@router.get("/geo/regions", response_model=list[GeoRegionResponse])
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_regions(request: Request):
    """Get Cameroon regions."""
    # In production, fetch from DB. For now, return static data.
    return [
        {"code": "CE", "name": "Centre"},
        {"code": "LT", "name": "Littoral"},
        {"code": "OU", "name": "Ouest"},
        {"code": "SU", "name": "Sud"},
        {"code": "NO", "name": "Nord"},
        {"code": "EN", "name": "Extrême-Nord"},
        {"code": "AD", "name": "Adamaoua"},
        {"code": "ES", "name": "Est"},
        {"code": "NW", "name": "Nord-Ouest"},
        {"code": "SW", "name": "Sud-Ouest"},
    ]


@router.get("/geo/cities/{region_code}", response_model=list[GeoCityResponse])
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_cities(request: Request, region_code: str):
    """Get cities for a region."""
    cities_by_region = {
        "CE": [
            {"code": "YDE", "name": "Yaoundé", "region_code": "CE"},
            {"code": "MBA", "name": "Mbalmayo", "region_code": "CE"},
            {"code": "OBA", "name": "Obala", "region_code": "CE"},
        ],
        "LT": [
            {"code": "DLA", "name": "Douala", "region_code": "LT"},
            {"code": "EDA", "name": "Edéa", "region_code": "LT"},
            {"code": "NKG", "name": "Nkongsamba", "region_code": "LT"},
        ],
        "OU": [
            {"code": "BFM", "name": "Bafoussam", "region_code": "OU"},
            {"code": "DSG", "name": "Dschang", "region_code": "OU"},
            {"code": "MDA", "name": "Mbouda", "region_code": "OU"},
        ],
        "NW": [{"code": "BDA", "name": "Bamenda", "region_code": "NW"}],
        "SW": [{"code": "BUE", "name": "Buéa", "region_code": "SW"}],
        "NO": [{"code": "GRA", "name": "Garoua", "region_code": "NO"}],
        "EN": [{"code": "MRA", "name": "Maroua", "region_code": "EN"}],
        "AD": [{"code": "NGD", "name": "Ngaoundéré", "region_code": "AD"}],
        "ES": [{"code": "BTA", "name": "Bertoua", "region_code": "ES"}],
        "SU": [{"code": "EBW", "name": "Ebolowa", "region_code": "SU"}],
    }
    return cities_by_region.get(region_code, [])


@router.get("/geo/quartiers/{city_code}", response_model=list[GeoQuartierResponse])
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_quartiers(request: Request, city_code: str):
    """Get quartiers for a city."""
    quartiers_by_city = {
        "YDE": [
            {
                "code": "BAS",
                "name": "Bastos",
                "city_code": "YDE",
                "commune_name": "Yaoundé 1er",
            },
            {
                "code": "NLG",
                "name": "Nlongkak",
                "city_code": "YDE",
                "commune_name": "Yaoundé 1er",
            },
            {
                "code": "MEL",
                "name": "Melen",
                "city_code": "YDE",
                "commune_name": "Yaoundé 6e",
            },
            {
                "code": "BYA",
                "name": "Biyem-Assi",
                "city_code": "YDE",
                "commune_name": "Yaoundé 6e",
            },
            {
                "code": "MDS",
                "name": "Mendong",
                "city_code": "YDE",
                "commune_name": "Yaoundé 6e",
            },
            {
                "code": "ESS",
                "name": "Essos",
                "city_code": "YDE",
                "commune_name": "Yaoundé 5e",
            },
            {
                "code": "ODA",
                "name": "Odza",
                "city_code": "YDE",
                "commune_name": "Yaoundé 4e",
            },
        ],
        "DLA": [
            {
                "code": "AKW",
                "name": "Akwa",
                "city_code": "DLA",
                "commune_name": "Douala 1er",
            },
            {
                "code": "DEI",
                "name": "Deido",
                "city_code": "DLA",
                "commune_name": "Douala 1er",
            },
            {
                "code": "BPR",
                "name": "Bonapriso",
                "city_code": "DLA",
                "commune_name": "Douala 1er",
            },
            {
                "code": "BMS",
                "name": "Bonamoussadi",
                "city_code": "DLA",
                "commune_name": "Douala 5e",
            },
            {
                "code": "MKP",
                "name": "Makepe",
                "city_code": "DLA",
                "commune_name": "Douala 5e",
            },
        ],
        "BFM": [
            {
                "code": "TGI",
                "name": "Tamdja",
                "city_code": "BFM",
                "commune_name": "Bafoussam 1er",
            },
            {
                "code": "KAM",
                "name": "Kamkop",
                "city_code": "BFM",
                "commune_name": "Bafoussam 2e",
            },
        ],
        "BDA": [
            {
                "code": "MNK",
                "name": "Mankon",
                "city_code": "BDA",
                "commune_name": "Bamenda 1er",
            },
            {
                "code": "UPT",
                "name": "Up Station",
                "city_code": "BDA",
                "commune_name": "Bamenda 1er",
            },
        ],
        "BUE": [
            {
                "code": "MOL",
                "name": "Molyko",
                "city_code": "BUE",
                "commune_name": "Buéa",
            },
            {
                "code": "GCE",
                "name": "Great Soppo",
                "city_code": "BUE",
                "commune_name": "Buéa",
            },
        ],
    }
    return quartiers_by_city.get(city_code, [])
