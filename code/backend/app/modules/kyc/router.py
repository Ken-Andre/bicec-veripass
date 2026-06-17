"""KYC Module Routes."""

import uuid
from uuid import UUID
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
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.security import make_session_handle, verify_session_handle, require_agent_role
from app.core.logging import logger
from app.db.session import get_db
from app.modules.auth.models import User, Agent, AgentRole
from app.modules.devices.dependencies import require_registered_device
from app.modules.kyc.models import (
    KYCSession,
    Document,
    OCRField,
    BiometricResult,
    ConsentRecord,
    ValidationDecision,
    Notification,
)
from app.modules.kyc.service import (
    compute_liveness_motion_score,
    biometric_manual_review_reasons,
    is_liveness_challenge_passed,
    FACE_MATCH_STATUS_NOT_PERFORMED,
    LIVENESS_MODEL_VERSION,
)
from app.modules.audit.models import AuditLog
from app.modules.analytics.service import (
    track_event_best_effort,
)
from app.modules.legal.service import resolve_accepted_documents
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
    MergeOCRResponse,
    OCRFieldResponse,
    NIUSubmitRequest,
    SignatureSubmitRequest,
    GeoRegionResponse,
    GeoCityResponse,
    GeoQuartierResponse,
    LifecycleState,
    AccessTier,
    LIFECYCLE_TO_ACCESS_TIER,
    ATMCreate,
    ATMUpdate,
    ATMResponse,
)
from app.modules.kyc import geo_data

router = APIRouter()
SHA256_HEX_RE = re.compile(r"^[a-fA-F0-9]{64}$")
VALID_CAPTURE_SIDES = {"RECTO", "VERSO"}
SUPPORTED_DOCUMENT_UPLOAD_TYPES = {
    "CNI_RECTO",
    "CNI_VERSO",
    "SELFIE",
    "BILL_ENEO",
    "BILL_CAMWATER",
    "NIU",
    "SIGNATURE_SHEET",
}
LIVENESS_LOCKOUT_COOLDOWN_SECONDS = 60
LIVENESS_LOCKOUT_WINDOW_HOURS = 24
MAX_LIVENESS_LOCKOUTS_PER_WINDOW = 3


def _normalize_sha256(value: str) -> str:
    return value.strip().lower()


def _is_valid_sha256(value: str) -> bool:
    return bool(SHA256_HEX_RE.fullmatch(value.strip()))


def _request_uuid(request: Request) -> uuid.UUID | None:
    raw = getattr(request.state, "correlation_id", None)
    try:
        return uuid.UUID(str(raw)) if raw else None
    except ValueError:
        return None


def _float_or_none(value) -> float | None:
    return float(value) if value is not None else None


def _biometric_response(biometric: BiometricResult) -> BiometricResultResponse:
    return BiometricResultResponse(
        id=make_session_handle(str(biometric.id)),
        face_match_score=_float_or_none(biometric.face_match_score),
        face_match_status=biometric.face_match_status,
        face_match_reason=biometric.face_match_reason,
        face_match_distance=_float_or_none(biometric.face_match_distance),
        face_match_threshold=_float_or_none(biometric.face_match_threshold),
        face_match_detector=biometric.face_match_detector,
        liveness_score=_float_or_none(biometric.liveness_score),
        anti_spoofing_score=_float_or_none(biometric.anti_spoofing_score),
        model_version_face=biometric.model_version_face,
        model_version_liveness=biometric.model_version_liveness,
        processed_at=biometric.processed_at,
    )


def _normalize_capture_side(side: str) -> str:
    normalized = side.strip().upper()
    if normalized not in VALID_CAPTURE_SIDES:
        raise HTTPException(
            status_code=400,
            detail="Invalid side. Expected RECTO or VERSO.",
        )
    return normalized


def _normalize_supported_doc_type(doc_type: str) -> str:
    normalized = doc_type.strip().upper()
    if normalized not in SUPPORTED_DOCUMENT_UPLOAD_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Document type is not supported.",
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
        face_match_status=FACE_MATCH_STATUS_NOT_PERFORMED,
        face_match_reason="liveness_locked",
        anti_spoofing_score=None,
        is_locked=True,
        cooldown_seconds=LIVENESS_LOCKOUT_COOLDOWN_SECONDS,
        lockout_count_24h=lockout_count_24h,
        branch_fallback_available=True,
    )


async def _get_active_editable_session(
    db: AsyncSession, current_user: User
) -> KYCSession:
    """Return a session that the client can still complete.

    PENDING_INFO is intentionally editable so the client can upload requested
    complements and resubmit the same dossier instead of creating a duplicate.
    """
    result = await db.execute(
        select(KYCSession)
        .where(
            KYCSession.user_id == current_user.id,
            KYCSession.status.in_([LifecycleState.DRAFT, LifecycleState.PENDING_INFO]),
        )
        .order_by(KYCSession.started_at.desc())
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="No active editable KYC session")
    return session


async def _get_latest_active_session(
    db: AsyncSession,
    user_id: UUID,
) -> KYCSession | None:
    result = await db.execute(
        select(KYCSession)
        .where(
            KYCSession.user_id == user_id,
            KYCSession.status.in_(
                [
                    LifecycleState.DRAFT,
                    LifecycleState.PENDING_KYC,
                    LifecycleState.PENDING_INFO,
                ]
            ),
        )
        .order_by(KYCSession.started_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def _session_start_response(session: KYCSession, *, existing: bool) -> dict[str, str]:
    return {
        "session_id": make_session_handle(str(session.id)),
        "status": session.status,
        "message": "Existing session found" if existing else "Session started",
    }


async def _store_document_and_create_record(
    *,
    session: KYCSession,
    file: UploadFile,
    doc_type: str,
    db: AsyncSession,
    client_sha256: str | None = None,
) -> DocumentResponse:
    from app.modules.kyc.storage import document_storage

    doc_type = _normalize_supported_doc_type(doc_type)

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
    doc.ocr_status = "PENDING"
    await db.commit()
    await db.refresh(doc, attribute_names=["ocr_fields"])

    try:
        from app.tasks.ocr import process_document_ocr_task
        process_document_ocr_task.apply_async(
            kwargs={"document_id": str(doc.id)},
            queue=settings.GLM_OCR_QUEUE,
        )
    except Exception as exc:
        logger.error(
            "Failed to enqueue primary OCR task for document %s: %s",
            doc.id,
            exc,
            exc_info=True,
        )
        doc.ocr_status = "FAILED"
        doc.ocr_error = f"Celery queue error: {str(exc)[:400]}"
        await db.commit()

    await db.refresh(doc, attribute_names=["ocr_fields"])

    await track_event_best_effort(
        db,
        event_type="DOCUMENT_UPLOADED",
        session_id=session.id,
        user_id=session.user_id,
        agency_id=session.agency_id,
        occurred_at=doc.captured_at,
        step=f"upload_{doc_type.lower()}",
        status=doc.ocr_status,
        metadata={"doc_type": doc.doc_type, "file_size_bytes": doc.file_size_bytes},
    )
    await db.commit()

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


@router.get("/session/status")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_session_status(
    request: Request,
    current_user: User = Depends(require_registered_device),
    db: AsyncSession = Depends(get_db),
):
    """Lightweight status checking endpoint for polling OCR and biometrics status."""
    session = await _get_active_editable_session(db, current_user)
    
    doc_results = await db.execute(
        select(Document.doc_type, Document.ocr_status)
        .where(Document.session_id == session.id)
    )
    docs = {row[0]: row[1] for row in doc_results.all()}
    
    bio_result = await db.execute(
        select(BiometricResult.face_match_status)
        .where(BiometricResult.session_id == session.id)
    )
    bio_row = bio_result.first()
    bio_status = bio_row[0] if bio_row else None
    
    return {
        "session_id": make_session_handle(str(session.id)),
        "status": session.status,
        "documents": docs,
        "biometrics": bio_status,
    }


from pydantic import BaseModel, Field  # noqa: E402

class KYCFeedbackRequest(BaseModel):
    document_id: str
    corrected_fields: dict[str, str] = Field(..., description="Field name to corrected value mapping")


@router.post("/feedback")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def submit_kyc_feedback(
    request: Request,
    body: KYCFeedbackRequest,
    current_user: User = Depends(require_registered_device),
    db: AsyncSession = Depends(get_db),
):
    """Save corrected OCR fields to ocr_training_queue for machine learning feedback loop."""
    doc = await _resolve_document_by_handle(body.document_id, current_user, db)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    from app.modules.kyc.models import OcrTrainingQueue
    
    # Save each corrected field to the queue
    for field_name, corrected_val in body.corrected_fields.items():
        field_match = next((f for f in doc.ocr_fields if f.field_name == field_name), None)
        extracted_val = field_match.extracted_value if field_match else None
        
        db.add(OcrTrainingQueue(
            id=uuid.uuid4(),
            document_id=doc.id,
            field_name=field_name,
            extracted_value=extracted_val,
            corrected_value=corrected_val,
            created_at=datetime.now(timezone.utc),
        ))
        
    await db.commit()
    return {"status": "success", "message": "Feedback recorded for model training"}


@router.get("/session/current", response_model=KYCSessionResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_current_session(
    request: Request,
    current_user: User = Depends(require_registered_device),
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
        niu_number=kyc_session.niu_number,
        niu_declarative=bool(kyc_session.niu_declarative),
        address_city=kyc_session.address_city,
        address_commune=kyc_session.address_commune,
        address_quartier=kyc_session.address_quartier,
        address_lieu_dit=kyc_session.address_lieu_dit,
        address_details=kyc_session.address_details,
        gps_latitude=_float_or_none(kyc_session.gps_latitude),
        gps_longitude=_float_or_none(kyc_session.gps_longitude),
        utility_provider=kyc_session.utility_provider,
        utility_bill_date=kyc_session.utility_bill_date,
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
                ocr_status=doc.ocr_status,
                ocr_error=doc.ocr_error,
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
        biometric_result=_biometric_response(kyc_session.biometric_results)
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
    current_user: User = Depends(require_registered_device),
    db: AsyncSession = Depends(get_db),
):
    """Start a new KYC session for the user."""
    # Check for existing active session
    existing = await _get_latest_active_session(db, current_user.id)
    if existing:
        return _session_start_response(existing, existing=True)

    # Create new session — ADR-001: DRAFT → RESTRICTED access
    # Note: ADR-001 specifies GUEST for DRAFT, but existing sessions use RESTRICTED.
    # Keeping RESTRICTED for backward compat until migration is ready.
    from app.modules.admin.models import Agency
    agency_result = await db.execute(select(Agency).limit(1))
    default_agency = agency_result.scalar_one_or_none()
    agency_id = default_agency.id if default_agency else None

    session = KYCSession(
        id=uuid.uuid4(),
        user_id=current_user.id,
        agency_id=agency_id,
        status=LifecycleState.DRAFT,
        access_level=AccessTier.RESTRICTED,
        started_at=datetime.now(timezone.utc),
    )
    db.add(session)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing = await _get_latest_active_session(db, current_user.id)
        if existing:
            return _session_start_response(existing, existing=True)
        raise

    logger.info(f"KYC session started for user {current_user.id}")
    await track_event_best_effort(
        db,
        event_type="KYC_SESSION_STARTED",
        session_id=session.id,
        user_id=current_user.id,
        occurred_at=session.started_at,
        step="start",
        status=session.status,
        request_id=_request_uuid(request),
    )
    await db.commit()
    return _session_start_response(session, existing=False)


@router.post("/document/upload", response_model=DocumentResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    doc_type: str = Form("CNI_RECTO"),
    client_sha256: str | None = Form(None),
    current_user: User = Depends(require_registered_device),
    db: AsyncSession = Depends(get_db),
):
    """Upload a KYC document (CNI recto/verso, selfie, bill, NIU)."""
    session = await _get_active_editable_session(db, current_user)
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
    current_user: User = Depends(require_registered_device),
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
    session = await _get_active_editable_session(db, current_user)
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
    current_user: User = Depends(require_registered_device),
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
    session = await _get_active_editable_session(db, current_user)
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
    current_user: User = Depends(require_registered_device),
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
    current_user: User = Depends(require_registered_device),
    db: AsyncSession = Depends(get_db),
):
    """Submit OCR field corrections."""
    session = await _get_active_editable_session(db, current_user)

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
    session.ocr_review_confirmed = True
    await track_event_best_effort(
        db,
        event_type="OCR_CORRECTED",
        session_id=session.id,
        user_id=session.user_id,
        agency_id=session.agency_id,
        step="ocr_review",
        status=session.status,
        metadata={"corrected_fields": sorted(body.fields.keys())},
        request_id=_request_uuid(request),
    )
    await track_event_best_effort(
        db,
        event_type="OCR_REVIEW_CONFIRMED",
        session_id=session.id,
        user_id=session.user_id,
        agency_id=session.agency_id,
        step="ocr_review",
        status=session.status,
        request_id=_request_uuid(request),
    )
    await db.commit()

    return {"status": "success", "message": "OCR review submitted"}


@router.post("/ocr/confirm")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def confirm_ocr_review(
    request: Request,
    body: OCRConfirmSubmitRequest,
    current_user: User = Depends(require_registered_device),
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


@router.post("/ocr/merge", response_model=MergeOCRResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def merge_ocr_fields(
    request: Request,
    session_id: UUID,
    current_user: User = Depends(require_registered_device),
    db: AsyncSession = Depends(get_db),
):
    """Merge recto + verso OCR extractions into a unified identity record.

    Finds both CNI documents for the session, runs confidence-based merge,
    and uperts the combined fields into both documents.
    """
    from app.services.ocr_service import combine_extractions

    result = await db.execute(
        select(KYCSession).where(
            KYCSession.id == session_id,
            KYCSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="KYC session not found")

    # Find recto and verso CNI documents
    docs_result = await db.execute(
        select(Document)
        .options(selectinload(Document.ocr_fields))
        .where(Document.session_id == session_id)
        .where(Document.doc_type.in_(["CNI_RECTO", "CNI_VERSO"]))
    )
    documents = docs_result.scalars().all()

    recto_doc = next((d for d in documents if d.doc_type == "CNI_RECTO"), None)
    verso_doc = next((d for d in documents if d.doc_type == "CNI_VERSO"), None)

    if not recto_doc and not verso_doc:
        raise HTTPException(status_code=404, detail="No CNI documents found for this session")

    # Build field dicts from existing OCR fields
    def _fields_dict(doc):
        if not doc:
            return {}
        return {
            f.field_name: {"value": f.extracted_value, "conf": f.confidence_score or 0.0}
            for f in doc.ocr_fields
        }

    recto_fields = _fields_dict(recto_doc)
    verso_fields = _fields_dict(verso_doc)

    merged = combine_extractions(recto_fields, verso_fields)

    # FIX-2 (Cause 2): Route chaque champ vers le document d'ORIGINE correct.
    # Avant ce fix, tout était écrit dans recto_doc, effaçant les données verso.
    # On distingue les champs natifs verso des champs natifs recto.
    VERSO_CANONICAL_FIELDS = {
        "pere", "mere", "sp", "adresse", "autorite_nom", "poste_identification",
    }

    sources = set()
    for field_name, data in merged.items():
        if data["value"] is None:
            continue
        source = data.get("source")
        if source:
            sources.add(source)

        # Déterminer le document cible selon la source confirmée ou l'appartenance naturelle
        if source == "verso" or (source is None and field_name in VERSO_CANONICAL_FIELDS):
            target_doc = verso_doc or recto_doc
        else:
            target_doc = recto_doc or verso_doc

        if target_doc:
            existing_by_name = {f.field_name: f for f in target_doc.ocr_fields}
            existing = existing_by_name.get(field_name)
            if existing:
                existing.extracted_value = data["value"]
                existing.confidence_score = data["conf"]
            else:
                db.add(OCRField(
                    document_id=target_doc.id,
                    field_name=field_name,
                    extracted_value=data["value"],
                    confidence_score=data["conf"],
                ))

    await db.commit()

    return MergeOCRResponse(
        fields={k: v for k, v in merged.items() if v["value"] is not None},
        sources=sorted(sources),
    )


@router.post("/liveness/submit", response_model=LivenessResultResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def submit_liveness(
    request: Request,
    body: LivenessSubmitRequest,
    current_user: User = Depends(require_registered_device),
    db: AsyncSession = Depends(get_db),
):
    """Submit liveness challenge result."""
    _reset_user_lockout_window_if_needed(current_user)

    result = await db.execute(
        select(KYCSession)
        .where(
            KYCSession.user_id == current_user.id,
            KYCSession.status.in_(
                [LifecycleState.DRAFT, LifecycleState.PENDING_INFO, LifecycleState.LOCKED_LIVENESS]
            ),
        )
        .order_by(KYCSession.started_at.desc())
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="No active KYC session")

    if session.status == LifecycleState.LOCKED_LIVENESS:
        await db.commit()
        return _locked_liveness_response(current_user.liveness_lockout_count_24h or 0)

    if (current_user.liveness_lockout_count_24h or 0) >= MAX_LIVENESS_LOCKOUTS_PER_WINDOW:
        session.status = LifecycleState.LOCKED_LIVENESS
        await db.commit()
        return _locked_liveness_response(current_user.liveness_lockout_count_24h or 0)

    liveness_score = compute_liveness_motion_score(body.landmarks_json, body.challenge_type)
    challenge_passed = is_liveness_challenge_passed(
        body.landmarks_json,
        body.challenge_type,
    )

    if not challenge_passed:
        session.liveness_strike_count += 1
        if session.liveness_strike_count >= 3:
            session.status = LifecycleState.LOCKED_LIVENESS
            current_user.liveness_lockout_count_24h = (
                (current_user.liveness_lockout_count_24h or 0) + 1
            )
            await track_event_best_effort(
                db,
                event_type="LIVENESS_FAILED",
                session_id=session.id,
                user_id=session.user_id,
                agency_id=session.agency_id,
                step="liveness",
                status=session.status,
                metadata={
                    "locked": True,
                    "liveness_score": liveness_score,
                    "challenge_passed": False,
                },
                request_id=_request_uuid(request),
            )
            await db.commit()
            return _locked_liveness_response(current_user.liveness_lockout_count_24h)

        await track_event_best_effort(
            db,
            event_type="LIVENESS_FAILED",
            session_id=session.id,
            user_id=session.user_id,
            agency_id=session.agency_id,
            step="liveness",
            status=session.status,
            metadata={
                "locked": False,
                "liveness_score": liveness_score,
                "challenge_passed": False,
            },
            request_id=_request_uuid(request),
        )
        await db.commit()
        return LivenessResultResponse(
            is_alive=False,
            confidence=liveness_score,
            attempts_remaining=3 - session.liveness_strike_count,
            strikes_remaining=3 - session.liveness_strike_count,
            face_match_score=None,
            face_match_status=FACE_MATCH_STATUS_NOT_PERFORMED,
            face_match_reason="liveness_failed",
            anti_spoofing_score=None,
            is_locked=False,
            cooldown_seconds=None,
            lockout_count_24h=current_user.liveness_lockout_count_24h or 0,
            branch_fallback_available=False,
        )

    # Motion challenge passed! Verify evidence exists before enqueuing heavy ML tasks
    selfie_doc_result = await db.execute(
        select(Document).where(
            Document.session_id == session.id,
            Document.doc_type == "SELFIE",
        )
    )
    selfie_doc = selfie_doc_result.scalars().first()
    if not selfie_doc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "FACE_MATCH_EVIDENCE_MISSING",
                "message": "Selfie evidence is required before liveness can be completed.",
                "reason": "selfie_missing",
            },
        )

    cni_recto_result = await db.execute(
        select(Document).where(
            Document.session_id == session.id,
            Document.doc_type == "CNI_RECTO",
        )
    )
    cni_recto = cni_recto_result.scalars().first()
    if not cni_recto:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "FACE_MATCH_EVIDENCE_MISSING",
                "message": "CNI recto and selfie evidence are required before liveness can be completed.",
                "reason": "cni_recto_missing",
            },
        )

    # Initialize/update BiometricResult as PENDING
    result = await db.execute(
        select(BiometricResult).where(BiometricResult.session_id == session.id)
    )
    biometric = result.scalar_one_or_none()
    if biometric is None:
        biometric = BiometricResult(
            id=uuid.uuid4(),
            session_id=session.id,
            liveness_score=liveness_score,
            face_match_status="PENDING",
            model_version_liveness=LIVENESS_MODEL_VERSION,
            processed_at=datetime.now(timezone.utc),
        )
        db.add(biometric)
    else:
        biometric.liveness_score = liveness_score
        biometric.face_match_status = "PENDING"
        biometric.model_version_liveness = LIVENESS_MODEL_VERSION
        biometric.processed_at = datetime.now(timezone.utc)
    await db.commit()

    try:
        from app.tasks.kyc import process_biometric_verification_task
        process_biometric_verification_task.apply_async(
            args=[str(session.id), body.challenge_type, body.landmarks_json],
            queue=settings.GLM_OCR_QUEUE,
        )
    except Exception as exc:
        logger.error(
            "Failed to enqueue biometric task for session %s: %s",
            session.id,
            exc,
            exc_info=True,
        )
        biometric.face_match_status = "ERROR"
        biometric.face_match_reason = f"Celery queue error: {str(exc)[:400]}"
        await db.commit()

    return LivenessResultResponse(
        is_alive=True,
        confidence=liveness_score,
        attempts_remaining=3 - session.liveness_strike_count,
        strikes_remaining=3 - session.liveness_strike_count,
        face_match_score=None,
        face_match_status="PENDING",
        face_match_reason="biometrics_running",
        anti_spoofing_score=None,
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
    current_user: User = Depends(require_registered_device),
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
    current_user: User = Depends(require_registered_device),
    db: AsyncSession = Depends(get_db),
):
    """Submit address information with GPS validation."""
    session = await _get_active_editable_session(db, current_user)

    # Validate GPS is within Cameroon bounds (~2°N-13°N, 8°E-17°E)
    if body.gps_lat is not None and body.gps_lng is not None:
        if not (2.0 <= body.gps_lat <= 13.0) or not (8.0 <= body.gps_lng <= 17.0):
            raise HTTPException(
                status_code=400,
                detail="GPS coordinates outside Cameroon bounds. Please ensure location services are enabled.",
            )

    session.address_city = body.city
    session.address_commune = body.commune
    session.address_quartier = body.quartier
    session.address_lieu_dit = body.lieu_dit
    session.address_details = body.region
    session.gps_latitude = body.gps_lat
    session.gps_longitude = body.gps_lng
    session.last_step_completed = "address"
    await db.commit()

    return {
        "status": "success",
        "message": "Address and GPS validated",
        "address_city": session.address_city,
        "address_commune": session.address_commune,
        "address_quartier": session.address_quartier,
        "address_lieu_dit": session.address_lieu_dit,
        "gps_validated": body.gps_lat is not None and body.gps_lng is not None,
    }


@router.post("/consent/submit", response_model=ConsentRecordResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def submit_consent(
    request: Request,
    body: ConsentSubmitRequest,
    current_user: User = Depends(require_registered_device),
    db: AsyncSession = Depends(get_db),
):
    """Submit consent checkboxes."""
    session = await _get_active_editable_session(db, current_user)

    if not (
        body.cgu_accepted and body.privacy_accepted and body.data_processing_accepted
    ):
        raise HTTPException(status_code=400, detail="All consents must be accepted")

    accepted_documents = await resolve_accepted_documents(
        db,
        body.accepted_documents,
        fallback_locale=getattr(current_user, "language", None) or "fr",
    )
    cgu_document = next(
        (document for document in accepted_documents if document.get("document_key") == "cgu"),
        None,
    )
    privacy_document = next(
        (document for document in accepted_documents if document.get("document_key") == "privacy"),
        None,
    )

    # Upsert: find existing consent or create new one
    existing_result = await db.execute(
        select(ConsentRecord)
        .where(ConsentRecord.session_id == session.id)
        .order_by(ConsentRecord.signed_at.desc())
        .limit(1)
    )
    existing = existing_result.scalars().first()

    if existing:
        consent_metadata = dict(existing.consent_metadata or {})
        consent_metadata["accepted_documents"] = accepted_documents
        existing.cgu_accepted = body.cgu_accepted
        existing.privacy_accepted = body.privacy_accepted
        existing.data_processing_accepted = body.data_processing_accepted
        existing.consent_method = body.consent_method
        existing.cgu_version = (
            str(cgu_document.get("version"))
            if cgu_document and cgu_document.get("version")
            else existing.cgu_version
        )
        existing.privacy_version = (
            str(privacy_document.get("version"))
            if privacy_document and privacy_document.get("version")
            else existing.privacy_version
        )
        existing.consent_metadata = consent_metadata
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
            cgu_version=(
                str(cgu_document.get("version"))
                if cgu_document and cgu_document.get("version")
                else "1.0.0"
            ),
            privacy_version=(
                str(privacy_document.get("version"))
                if privacy_document and privacy_document.get("version")
                else "1.0.0"
            ),
            consent_metadata={"accepted_documents": accepted_documents},
            signed_at=datetime.now(timezone.utc),
        )
        db.add(consent)
    session.last_step_completed = "consent"
    await track_event_best_effort(
        db,
        event_type="CONSENT_SUBMITTED",
        session_id=session.id,
        user_id=session.user_id,
        agency_id=session.agency_id,
        occurred_at=consent.signed_at,
        step="consent",
        status=session.status,
        request_id=_request_uuid(request),
    )
    await db.commit()

    return ConsentRecordResponse(
        id=make_session_handle(str(consent.id)),
        cgu_accepted=consent.cgu_accepted,
        privacy_accepted=consent.privacy_accepted,
        data_processing_accepted=consent.data_processing_accepted,
        consent_method=consent.consent_method,
        cgu_version=consent.cgu_version,
        privacy_version=consent.privacy_version,
        accepted_documents=(consent.consent_metadata or {}).get("accepted_documents"),
        signed_at=consent.signed_at,
    )


@router.post("/niu/submit")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def submit_niu(
    request: Request,
    body: NIUSubmitRequest,
    current_user: User = Depends(require_registered_device),
    db: AsyncSession = Depends(get_db),
):
    """Submit NIU information."""
    session = await _get_active_editable_session(db, current_user)

    niu_type = body.niu_type.strip().upper()
    if niu_type not in {"MISSING", "DECLARATIVE", "UPLOADED"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid niu_type. Expected MISSING, DECLARATIVE, or UPLOADED.",
        )

    niu_value = body.niu_value.strip().upper() if body.niu_value else None
    if niu_value:
        niu_value = re.sub(r"[^A-Z0-9]", "", niu_value)

    if niu_type == "DECLARATIVE":
        if not niu_value:
            raise HTTPException(status_code=400, detail="niu_value is required for DECLARATIVE NIU")
        if not re.fullmatch(r"^[A-Z0-9]\d{12}[A-Z0-9]$", niu_value):
            raise HTTPException(status_code=400, detail="Invalid NIU format")
    elif niu_type == "UPLOADED":
        doc_result = await db.execute(
            select(Document)
            .where(Document.session_id == session.id, Document.doc_type == "NIU")
            .limit(1)
        )
        if doc_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=409,
                detail="NIU upload evidence is required before submitting niu_type=UPLOADED",
            )
    else:
        niu_value = None

    session.niu_type = niu_type
    session.niu_number = niu_value
    session.niu_declarative = niu_type == "DECLARATIVE"
    session.last_step_completed = "niu"
    await db.commit()

    return {
        "status": "success",
        "niu_type": niu_type,
        "niu_number": session.niu_number,
        "niu_declarative": session.niu_declarative,
    }


@router.post("/signature/submit")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def submit_signature(
    request: Request,
    body: SignatureSubmitRequest,
    current_user: User = Depends(require_registered_device),
    db: AsyncSession = Depends(get_db),
):
    """Submit electronic signature. Stored in consent metadata.

    Accepts either:
    - document_id: opaque handle of a SIGNATURE_SHEET document (preferred)
    - signature_data: base64 data URL (legacy fallback)
    """
    if not body.document_id and not body.signature_data:
        raise HTTPException(
            status_code=400,
            detail="Either document_id or signature_data is required.",
        )

    session = await _get_active_editable_session(db, current_user)

    # Resolve document handle if provided
    signature_doc = None
    if body.document_id:
        signature_doc = await _resolve_document_by_handle(body.document_id, current_user, db)
        if not signature_doc:
            raise HTTPException(status_code=404, detail="Signature document not found.")
        if signature_doc.doc_type != "SIGNATURE_SHEET":
            raise HTTPException(
                status_code=400,
                detail=f"Expected SIGNATURE_SHEET document, got {signature_doc.doc_type}.",
            )

    # Find or create consent record to attach signature
    result = await db.execute(
        select(ConsentRecord)
        .where(ConsentRecord.session_id == session.id)
        .order_by(ConsentRecord.signed_at.desc())
        .limit(1)
    )
    consent = result.scalars().first()

    consent_method = "PAPER_SIGNATURE_PHOTO" if signature_doc else "SIGNATURE_ONLY"
    metadata_update = {
        "signature_timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if signature_doc:
        metadata_update["signature_document_id"] = str(signature_doc.id)
    else:
        metadata_update["signature_data"] = body.signature_data

    if consent is None:
        consent = ConsentRecord(
            id=uuid.uuid4(),
            session_id=session.id,
            cgu_accepted=False,
            privacy_accepted=False,
            data_processing_accepted=False,
            consent_method=consent_method,
            signed_at=datetime.now(timezone.utc),
            consent_metadata=metadata_update,
        )
        db.add(consent)
    else:
        if consent.consent_metadata is None:
            consent.consent_metadata = {}
        consent.consent_metadata.update(metadata_update)
        consent.consent_method = consent_method

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
    has_biometric_result = (
        biometric is not None
        and biometric.face_match_status not in ("PENDING", "PROCESSING")
    )

    missing = sorted(required - doc_types)
    blocking_reasons: list[str] = []
    warnings: list[str] = []

    if missing:
        blocking_reasons.append(f"Missing required documents: {', '.join(missing)}")

    has_bill_document = bool({"BILL_ENEO", "BILL_CAMWATER"} & doc_types)
    if not has_bill_document:
        blocking_reasons.append("Missing required bill document (ENEO or CAMWATER)")
    else:
        # Validate bill date < 3 months (90 days)
        bill_docs = [d for d in docs if d.doc_type in {"BILL_ENEO", "BILL_CAMWATER"}]
        for bill_doc in bill_docs:
            date_field = next(
                (f for f in bill_doc.ocr_fields if f.field_name == "date_facturation"), None
            )
            if date_field and date_field.extracted_value:
                raw = date_field.extracted_value.strip()
                parsed_date = None
                for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"):
                    try:
                        parsed_date = datetime.strptime(raw, fmt).date()
                        break
                    except ValueError:
                        continue
                if parsed_date:
                    days_old = (datetime.now(timezone.utc).date() - parsed_date).days
                    if days_old > 90:
                        warnings.append(
                            f"Facture périmée ({days_old} jours, max 90). "
                            f"Date: {raw}"
                        )

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
    has_ocr_review_confirmed = bool(session.ocr_review_confirmed)
    if not has_ocr_review:
        blocking_reasons.append("OCR review not completed. Please confirm identity fields first.")

    if not has_biometric_result:
        if biometric and biometric.face_match_status in ("PENDING", "PROCESSING"):
            blocking_reasons.append("Biometric verification in progress. Please wait.")
        else:
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
        biometric_risk_reasons = biometric_manual_review_reasons(biometric)
        if any(reason.startswith("FACE_MATCH") for reason in biometric_risk_reasons):
            warnings.append("Face match requires priority manual review.")
        if "ANTI_SPOOFING_BELOW_THRESHOLD" in biometric_risk_reasons:
            warnings.append("Anti-spoofing requires priority manual review.")

    return KYCReadinessResponse(
        can_submit=len(blocking_reasons) == 0,
        blocking_reasons=blocking_reasons,
        warnings=warnings,
        required_missing_documents=missing,
        has_ocr_review=has_ocr_review,
        has_ocr_review_confirmed=has_ocr_review_confirmed,
        has_consent=has_consent,
        has_biometric_result=has_biometric_result,
        has_bill_document=has_bill_document,
        confidence_score_global=confidence_score_global,
    )


@router.get("/readiness", response_model=KYCReadinessResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_kyc_readiness(
    request: Request,
    current_user: User = Depends(require_registered_device),
    db: AsyncSession = Depends(get_db),
):
    """Return readiness gates before KYC submission."""
    session = await _get_active_editable_session(db, current_user)
    return await _compute_kyc_readiness(session=session, db=db)


@router.post("/submit", response_model=KYCSubmitResponse)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def submit_kyc(
    request: Request,
    current_user: User = Depends(require_registered_device),
    db: AsyncSession = Depends(get_db),
):
    """Submit the complete KYC dossier for review."""
    session = await _get_active_editable_session(db, current_user)

    readiness = await _compute_kyc_readiness(session=session, db=db)
    if not readiness.can_submit:
        raise HTTPException(status_code=400, detail=readiness.blocking_reasons[0])

    result = await db.execute(
        select(BiometricResult).where(BiometricResult.session_id == session.id)
    )
    biometric = result.scalar_one_or_none()
    if not biometric:
        raise HTTPException(status_code=400, detail="Liveness step not completed")
    biometric_risk_reasons = biometric_manual_review_reasons(biometric)
    if biometric_risk_reasons:
        session.priority_flag = True

    session.confidence_score_global = readiness.confidence_score_global
    old_status = session.status
    old_access_level = session.access_level

    # Submit — transition per ADR-001: DRAFT → PENDING_AGENT_REVIEW
    new_status = LifecycleState.PENDING_AGENT_REVIEW
    new_access_level = LIFECYCLE_TO_ACCESS_TIER.get(new_status, AccessTier.RESTRICTED)

    now = datetime.now(timezone.utc)
    session.status = new_status
    session.access_level = new_access_level
    session.submitted_at = now
    session.last_step_completed = "submission"

    # Audit log
    new_data = {"status": new_status, "access_level": new_access_level}
    if biometric_risk_reasons:
        new_data["biometric_manual_review_reasons"] = biometric_risk_reasons

    audit = AuditLog(
        id=uuid.uuid4(),
        action="KYC_RESUBMIT" if old_status == LifecycleState.PENDING_INFO else "KYC_SUBMIT",
        table_name="kyc_sessions",
        record_id=str(session.id),
        old_data={"status": old_status, "access_level": old_access_level},
        new_data=new_data,
        performed_by=current_user.id,
        performed_at=now,
    )
    db.add(audit)
    if biometric_risk_reasons:
        db.add(
            AuditLog(
                id=uuid.uuid4(),
                action="KYC_BIOMETRIC_RISK_FLAGGED",
                table_name="kyc_sessions",
                record_id=str(session.id),
                old_data={},
                new_data={
                    "biometric_manual_review_reasons": biometric_risk_reasons,
                    "priority_flag": True,
                },
                performed_by=current_user.id,
                performed_at=now,
            )
        )
    await track_event_best_effort(
        db,
        event_type="KYC_SUBMITTED",
        session_id=session.id,
        user_id=session.user_id,
        agency_id=session.agency_id,
        occurred_at=now,
        step="submission",
        status=new_status,
        request_id=_request_uuid(request),
        metadata={"biometric_manual_review_reasons": biometric_risk_reasons},
    )
    await db.commit()

    try:
        from app.tasks.kyc import celery_screen_session_against_sanctions

        celery_screen_session_against_sanctions.delay(str(session.id))
    except Exception as exc:
        logger.warning(
            "Unable to enqueue AML screening for session %s: %s",
            session.id,
            exc,
        )

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
    current_user: User = Depends(require_registered_device),
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
    current_user: User = Depends(require_registered_device),
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
    current_user: User = Depends(require_registered_device),
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


# === ATM / GAB Management & Synchronization Endpoints ===

@router.get("/atms", response_model=list[ATMResponse])
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def list_atms(
    request: Request,
    current_user: User = Depends(require_registered_device),
    db: AsyncSession = Depends(get_db)
):
    """List ATMs matching the user's KYC session access level. Seeding dynamically if empty."""
    from app.modules.kyc.models import ATM, KYCSession
    
    # Query current user's session to check access level
    session_result = await db.execute(
        select(KYCSession)
        .where(KYCSession.user_id == current_user.id)
        .order_by(KYCSession.started_at.desc())
        .limit(1)
    )
    session = session_result.scalar_one_or_none()
    access_level = "GUEST"
    if session:
        access_level = session.access_level

    # Seeding safeguard to remain Demo-Ready
    result = await db.execute(select(ATM))
    atms = result.scalars().all()
    if not atms:
        initial_atms = [
            ATM(
                id=uuid.uuid4(),
                name="BICEC Siege Bonanjo",
                city="Douala",
                address="Avenue du General de Gaulle, Bonanjo",
                latitude=4.0419,
                longitude=9.6877,
                services=["Retrait", "Consultation solde", "Mini releve"],
                available_24h=True,
                access_tier="basic"
            ),
            ATM(
                id=uuid.uuid4(),
                name="BICEC Yaounde Centre",
                city="Yaounde",
                address="Boulevard du 20 Mai, Centre-ville",
                latitude=3.8667,
                longitude=11.5167,
                services=["Retrait", "Consultation solde"],
                available_24h=True,
                access_tier="basic"
            ),
            ATM(
                id=uuid.uuid4(),
                name="BICEC Akwa",
                city="Douala",
                address="Boulevard de la Liberte, Akwa",
                latitude=4.0533,
                longitude=9.6996,
                services=["Retrait", "Depot cheque", "Consultation solde"],
                available_24h=True,
                access_tier="full"
            ),
            ATM(
                id=uuid.uuid4(),
                name="BICEC Bastos",
                city="Yaounde",
                address="Quartier Bastos",
                latitude=3.8954,
                longitude=11.5158,
                services=["Retrait", "Depot cheque"],
                available_24h=True,
                access_tier="full"
            ),
        ]
        db.add_all(initial_atms)
        await db.commit()
    stmt = select(ATM)
    if access_level == "GUEST":
        stmt = stmt.where(ATM.access_tier == "basic")
    
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/backoffice/atms", response_model=list[ATMResponse])
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def list_backoffice_atms(
    request: Request,
    current_agent: Agent = Depends(require_agent_role(AgentRole.ADMIN_IT)),
    db: AsyncSession = Depends(get_db)
):
    """List all ATMs in the directory for backoffice administration. Restricted to ADMIN_IT."""
    from app.modules.kyc.models import ATM
    
    # Seeding safeguard to remain Demo-Ready
    result = await db.execute(select(ATM))
    atms = result.scalars().all()
    if not atms:
        initial_atms = [
            ATM(
                id=uuid.uuid4(),
                name="BICEC Siege Bonanjo",
                city="Douala",
                address="Avenue du General de Gaulle, Bonanjo",
                latitude=4.0419,
                longitude=9.6877,
                services=["Retrait", "Consultation solde", "Mini releve"],
                available_24h=True,
                access_tier="basic"
            ),
            ATM(
                id=uuid.uuid4(),
                name="BICEC Yaounde Centre",
                city="Yaounde",
                address="Boulevard du 20 Mai, Centre-ville",
                latitude=3.8667,
                longitude=11.5167,
                services=["Retrait", "Consultation solde"],
                available_24h=True,
                access_tier="basic"
            ),
            ATM(
                id=uuid.uuid4(),
                name="BICEC Akwa",
                city="Douala",
                address="Boulevard de la Liberte, Akwa",
                latitude=4.0533,
                longitude=9.6996,
                services=["Retrait", "Depot cheque", "Consultation solde"],
                available_24h=True,
                access_tier="full"
            ),
            ATM(
                id=uuid.uuid4(),
                name="BICEC Bastos",
                city="Yaounde",
                address="Quartier Bastos",
                latitude=3.8954,
                longitude=11.5158,
                services=["Retrait", "Depot cheque"],
                available_24h=True,
                access_tier="full"
            ),
        ]
        db.add_all(initial_atms)
        await db.commit()
        
    res = await db.execute(select(ATM))
    return res.scalars().all()


@router.post("/backoffice/atms", response_model=ATMResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def create_atm(
    request: Request,
    body: ATMCreate,
    current_agent: Agent = Depends(require_agent_role(AgentRole.ADMIN_IT)),
    db: AsyncSession = Depends(get_db)
):
    """Add a new ATM to the directory. Restricted strictly to ADMIN_IT."""
    from app.modules.kyc.models import ATM
    
    atm = ATM(
        id=uuid.uuid4(),
        name=body.name,
        city=body.city,
        address=body.address,
        latitude=body.latitude,
        longitude=body.longitude,
        services=body.services,
        available_24h=body.available_24h,
        access_tier=body.access_tier
    )
    db.add(atm)
    
    # Audit log
    audit = AuditLog(
        id=uuid.uuid4(),
        action="ATM_CREATE",
        table_name="atms",
        record_id=str(atm.id),
        new_data={
            "name": body.name,
            "city": body.city,
            "address": body.address,
            "access_tier": body.access_tier
        },
        performed_by=current_agent.id,
        performed_at=datetime.now(timezone.utc),
        client_ip=request.client.host if request.client else None
    )
    db.add(audit)
    await db.commit()
    await db.refresh(atm)
    return atm


@router.put("/backoffice/atms/{atm_id}", response_model=ATMResponse)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def update_atm(
    request: Request,
    atm_id: UUID,
    body: ATMUpdate,
    current_agent: Agent = Depends(require_agent_role(AgentRole.ADMIN_IT)),
    db: AsyncSession = Depends(get_db)
):
    """Update ATM attributes. Restricted to ADMIN_IT."""
    from app.modules.kyc.models import ATM
    
    result = await db.execute(select(ATM).where(ATM.id == atm_id))
    atm = result.scalar_one_or_none()
    if not atm:
        raise HTTPException(status_code=404, detail="ATM not found")
        
    old_data = {
        "name": atm.name,
        "city": atm.city,
        "address": atm.address,
        "services": atm.services,
        "available_24h": atm.available_24h,
        "access_tier": atm.access_tier
    }

    if body.name is not None:
        atm.name = body.name
    if body.city is not None:
        atm.city = body.city
    if body.address is not None:
        atm.address = body.address
    if body.latitude is not None:
        atm.latitude = body.latitude
    if body.longitude is not None:
        atm.longitude = body.longitude
    if body.services is not None:
        atm.services = body.services
    if body.available_24h is not None:
        atm.available_24h = body.available_24h
    if body.access_tier is not None:
        atm.access_tier = body.access_tier

    atm.last_verified = datetime.now(timezone.utc).date()

    audit = AuditLog(
        id=uuid.uuid4(),
        action="ATM_UPDATE",
        table_name="atms",
        record_id=str(atm.id),
        old_data=old_data,
        new_data={
            "name": atm.name,
            "city": atm.city,
            "address": atm.address,
            "access_tier": atm.access_tier
        },
        performed_by=current_agent.id,
        performed_at=datetime.now(timezone.utc),
        client_ip=request.client.host if request.client else None
    )
    db.add(audit)
    await db.commit()
    await db.refresh(atm)
    return atm


@router.delete("/backoffice/atms/{atm_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def delete_atm(
    request: Request,
    atm_id: UUID,
    current_agent: Agent = Depends(require_agent_role(AgentRole.ADMIN_IT)),
    db: AsyncSession = Depends(get_db)
):
    """Delete an ATM from the directory. Restricted to ADMIN_IT."""
    from app.modules.kyc.models import ATM
    
    result = await db.execute(select(ATM).where(ATM.id == atm_id))
    atm = result.scalar_one_or_none()
    if not atm:
        raise HTTPException(status_code=404, detail="ATM not found")

    await db.delete(atm)

    audit = AuditLog(
        id=uuid.uuid4(),
        action="ATM_DELETE",
        table_name="atms",
        record_id=str(atm_id),
        old_data={"name": atm.name, "city": atm.city},
        performed_by=current_agent.id,
        performed_at=datetime.now(timezone.utc),
        client_ip=request.client.host if request.client else None
    )
    db.add(audit)
    await db.commit()
    return None
