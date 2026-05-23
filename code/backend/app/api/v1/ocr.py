"""OCR API routes for document text extraction."""

from __future__ import annotations

import asyncio
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.logging import logger
from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.kyc.models import Document, KYCSession
from app.modules.kyc.service import process_document_ocr_pipeline
from app.services.ocr_service import ocr_service


router = APIRouter(prefix="/ocr", tags=["ocr"])


@router.post("/extract")
async def extract_ocr_from_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extract OCR text from an already uploaded document.

    This endpoint triggers OCR extraction on a document that was previously
    uploaded. Results are stored in the document's ocr_fields.

    Args:
        document_id: The document UUID to process

    Returns:
        OCR extraction results with field-level confidence scores
    """
    from app.modules.kyc.storage import document_storage

    # Get the document
    result = await db.execute(
        select(Document).where(Document.id == uuid.UUID(document_id))
    )
    document = result.scalars().first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    # Verify ownership
    session_result = await db.execute(
        select(KYCSession).where(KYCSession.id == document.session_id)
    )
    session = session_result.scalars().first()

    if not session or session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this document",
        )

    # Get the file path
    file_path = document_storage.base_path / document.file_path
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file not found on storage",
        )

    # Run the same OCR pipeline used by the capture flow
    try:
        pipeline_result = await process_document_ocr_pipeline(
            document_id=document.id,
            db=db,
        )
    except Exception as exc:
        logger.error("OCR extraction failed for document %s: %s", document_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR extraction failed: {str(exc)}",
        )

    refreshed_result = await db.execute(
        select(Document)
        .options(selectinload(Document.ocr_fields))
        .where(Document.id == document.id)
    )
    document = refreshed_result.scalars().first() or document
    confidence_map = document.confidence_per_field or {}
    confidence_values = [
        float(v)
        for v in confidence_map.values()
        if isinstance(v, (int, float))
    ]
    avg_conf = sum(confidence_values) / len(confidence_values) if confidence_values else 0.0
    fields = {
        row.field_name: {
            "value": row.corrected_value if row.human_corrected and row.corrected_value else row.extracted_value,
            "conf": float(row.confidence_score),
            "human_corrected": row.human_corrected,
        }
        for row in document.ocr_fields
    }

    can_edit = avg_conf < settings.OCR_USER_EDIT_THRESHOLD

    return {
        "document_id": document_id,
        "engine": pipeline_result["engine"],
        "fields": fields,
        "avg_confidence": avg_conf,
        "can_user_edit": can_edit,
        "needs_glm_fallback": pipeline_result.get("fallback_queued", False),
    }


@router.post("/extract/upload")
async def extract_ocr_from_upload(
    file: UploadFile = File(...),
):
    """Extract OCR from an uploaded image directly.

    This is a convenience endpoint for extracting OCR from an image
    without saving it as a document first. Use this for preview/draft
    OCR before正式 capture.

    Args:
        file: Image file (PNG, JPG)

    Returns:
        OCR extraction results
    """
    # Read file bytes
    image_bytes = await file.read()

    # Validate it's an image
    if len(image_bytes) < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too small to be a valid image",
        )

    # Run OCR in thread pool so the event loop stays free
    try:
        ocr_result = await asyncio.to_thread(ocr_service.extract_from_bytes, image_bytes)
    except Exception as exc:
        logger.error("OCR extraction from upload failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR extraction failed: {str(exc)}",
        )

    avg_conf = ocr_result.get("avg_confidence", 0.0)
    can_edit = avg_conf < settings.OCR_USER_EDIT_THRESHOLD

    return {
        "engine": ocr_result["engine"],
        "fields": ocr_result["fields"],
        "avg_confidence": avg_conf,
        "can_user_edit": can_edit,
        "needs_glm_fallback": ocr_result.get("needs_glm_fallback", False),
        "process_time_ms": ocr_result.get("process_time_ms", 0.0),
    }


@router.get("/config/thresholds")
async def get_ocr_thresholds():
    """Get current OCR threshold configuration.

    Returns:
        Threshold values for OCR confidence
    """
    return {
        "confidence_threshold": settings.OCR_CONFIDENCE_THRESHOLD,
        "user_edit_threshold": settings.OCR_USER_EDIT_THRESHOLD,
    }


@router.get("/test/extract")
async def test_ocr_extract():
    """Test endpoint - extract from a test image inside the container.

    This is for testing OCR without uploading a file.
    """
    # Look for test images in the mounted volume first, then fallback
    _test_dirs = [Path("/tmp/test-images"), Path("/tmp")]
    test_image_path = None
    for _dir in _test_dirs:
        _candidate = _dir / "cni_recto.png"
        if _candidate.exists():
            test_image_path = _candidate
            break
    if test_image_path is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test image not found on server. Mount paddleocr_test/images to /tmp/test-images",
        )

    ocr_result = await asyncio.to_thread(ocr_service.extract_from_path, test_image_path)

    avg_conf = ocr_result.get("avg_confidence", 0.0)
    can_edit = avg_conf < settings.OCR_USER_EDIT_THRESHOLD

    return {
        "engine": ocr_result["engine"],
        "fields": ocr_result["fields"],
        "avg_confidence": avg_conf,
        "can_user_edit": can_edit,
        "needs_glm_fallback": ocr_result.get("needs_glm_fallback", False),
        "process_time_ms": ocr_result.get("process_time_ms", 0.0),
    }
