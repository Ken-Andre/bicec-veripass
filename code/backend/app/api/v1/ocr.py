"""OCR API routes for document text extraction."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.logging import logger
from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.kyc.models import Document, KYCSession
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

    # Run OCR
    try:
        ocr_result = ocr_service.extract_from_path(file_path)
    except Exception as exc:
        logger.error("OCR extraction failed for document %s: %s", document_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR extraction failed: {str(exc)}",
        )

    # Update document with OCR results
    if ocr_result["fields"]:
        # Store raw OCR data as JSON
        import json

        document.ocr_raw_json = json.dumps(ocr_result["fields"])
        document.ocr_engine = ocr_result["engine"]

        # Calculate average confidence for the whole document
        conf_values = [f.get("conf", 0) for f in ocr_result["fields"].values()]
        avg_conf = sum(conf_values) / len(conf_values) if conf_values else 0.0
        document.confidence_per_field = {"avg_confidence": avg_conf}

        await db.commit()

    # Determine if user can edit (confidence below threshold)
    avg_conf = ocr_result.get("avg_confidence", 0.0)
    can_edit = avg_conf < settings.OCR_USER_EDIT_THRESHOLD

    return {
        "document_id": document_id,
        "engine": ocr_result["engine"],
        "fields": ocr_result["fields"],
        "avg_confidence": avg_conf,
        "can_user_edit": can_edit,
        "needs_glm_fallback": ocr_result.get("needs_glm_fallback", False),
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

    # Run OCR
    try:
        ocr_result = ocr_service.extract_from_bytes(image_bytes)
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
    import os

    test_image_path = Path("/tmp/test_cni_valid.png")
    if not test_image_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test image not found on server",
        )

    ocr_result = ocr_service.extract_from_path(test_image_path)

    avg_conf = ocr_result.get("avg_confidence", 0.0)
    can_edit = avg_conf < settings.OCR_USER_EDIT_THRESHOLD

    return {
        "engine": ocr_result["engine"],
        "fields": ocr_result["fields"],
        "avg_confidence": avg_conf,
        "can_user_edit": can_edit,
        "needs_glm_fallback": ocr_result.get("needs_glm_fallback", False),
    }
