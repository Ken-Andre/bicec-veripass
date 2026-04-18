"""OCR Service for document text extraction.

Uses PaddleOCR as primary engine with GLM-OCR fallback for low confidence.
"""

from __future__ import annotations

import asyncio
import io
from pathlib import Path
from typing import Any

import numpy as np

from app.core.config import settings
from app.core.logging import logger


# Singleton PaddleOCR instance
_paddle_ocr = None


def get_paddle_ocr():
    """Return a shared PaddleOCR instance (CPU, French)."""
    global _paddle_ocr
    if _paddle_ocr is None:
        from paddleocr import PaddleOCR

        _paddle_ocr = PaddleOCR(
            use_angle_cls=True,
            lang=settings.PADDLE_LANG,
            use_gpu=settings.PADDLE_USE_GPU,
        )
        logger.info(
            "PaddleOCR initialized (lang=%s, gpu=%s)",
            settings.PADDLE_LANG,
            settings.PADDLE_USE_GPU,
        )
    return _paddle_ocr


def _load_image_from_bytes(image_bytes: bytes) -> np.ndarray:
    """Load image from bytes as numpy array (BGR format for OpenCV)."""
    import cv2

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image")
    return img


def _load_image_from_path(image_path: Path) -> np.ndarray:
    """Load image from file path as numpy array (BGR format for OpenCV)."""
    import cv2

    img = cv2.imread(str(image_path))
    if img is None:
        raise ValueError(f"Failed to read image: {image_path}")
    return img


def _extract_fields_from_blocks(
    blocks: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Extract CNI fields from OCR blocks using spatial layout.

    For CNI Camerounaise:
    - Recto: nom, prenom, date_naissance, lieu_naissance, sexe, taille, profession
    - Verso: numero_cni, date_delivrance, date_expiration, adresse, poste_identification

    Args:
        blocks: List of OCR blocks with 'text', 'cx', 'cy', 'conf'

    Returns:
        Dict mapping field names to {'value': str, 'conf': float}
    """
    fields: dict[str, dict[str, Any]] = {}

    if not blocks:
        return fields

    # Sort blocks by vertical position (y coordinate)
    sorted_blocks = sorted(blocks, key=lambda b: b.get("cy", 0))

    # Simple spatial extraction based on card layout
    # These are approximate Y positions for CNI cards (normalized 0-1)
    # Adjust based on actual CNI templates

    # Find text blocks and categorize by position
    for block in sorted_blocks:
        text = block.get("text", "").strip()
        if not text:
            continue

        conf = float(block.get("conf", 0.0))

        # Skip very short or low-confidence detections
        if len(text) < 2 or conf < 0.3:
            continue

        text_upper = text.upper()

        # Detection heuristics based on CNI labels
        if "NOM" in text_upper or "SURNAME" in text_upper:
            continue  # This is a label, next block is the value

        if "PRENOM" in text_upper or "GIVEN NAME" in text_upper:
            continue

        if "SEXE" in text_upper or "SEX" in text_upper:
            continue

        # Date patterns (DD.MM.YYYY or similar)
        import re

        date_match = re.match(r"(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})", text)
        is_date_field = date_match is not None

        # Detect field type based on content patterns
        if is_date_field:
            # Could be date_naissance, date_delivrance, or date_expiration
            # Store with low confidence initially, refine later based on Y position
            if "date_naissance" not in fields:
                fields["date_naissance"] = {"value": text, "conf": conf}
            elif "date_delivrance" not in fields:
                fields["date_delivrance"] = {"value": text, "conf": conf}
            elif "date_expiration" not in fields:
                fields["date_expiration"] = {"value": text, "conf": conf}
        elif text.upper() in ["M", "F", "MASCULIN", "FEMININ"]:
            fields["sexe"] = {"value": text[0].upper(), "conf": conf}
        elif text.replace(".", "").replace(",", "").isdigit() and len(text) > 10:
            # Likely a number (CNI, telephone)
            if "numero_cni" not in fields:
                fields["numero_cni"] = {"value": text, "conf": conf}
        else:
            # Text fields - assign based on order in the card
            existing_text_fields = [
                k
                for k in fields.keys()
                if k
                not in [
                    "date_naissance",
                    "date_delivrance",
                    "date_expiration",
                    "numero_cni",
                    "sexe",
                    "poste_identification",
                ]
            ]

            if "nom" not in fields:
                fields["nom"] = {"value": text, "conf": conf}
            elif "prenom" not in fields:
                fields["prenom"] = {"value": text, "conf": conf}
            elif "lieu_naissance" not in fields:
                fields["lieu_naissance"] = {"value": text, "conf": conf}
            elif "profession" not in fields:
                fields["profession"] = {"value": text, "conf": conf}
            elif "adresse" not in fields:
                fields["adresse"] = {"value": text, "conf": conf}

    # Extract post identification (usually 4 chars like CE01, LT04)
    for block in sorted_blocks:
        text = block.get("text", "").strip().upper()
        import re

        if re.match(r"^[A-Z]{2}\d{2}$", text):
            fields["poste_identification"] = {
                "value": text,
                "conf": float(block.get("conf", 0.8)),
            }
            break

    # Extract taille (height like 1.75, 1M80)
    for block in sorted_blocks:
        text = block.get("text", "").strip()
        import re

        taille_match = re.match(r"^(\d,?\d{0,2})\s*[cmCM]?$", text.replace("M", ","))
        if taille_match:
            fields["taille"] = {"value": text, "conf": float(block.get("conf", 0.7))}
            break

    return fields


class OCRService:
    """OCR service for document text extraction."""

    def __init__(self):
        self.confidence_threshold = settings.OCR_CONFIDENCE_THRESHOLD
        self.user_edit_threshold = settings.OCR_USER_EDIT_THRESHOLD

    def extract_from_bytes(self, image_bytes: bytes) -> dict[str, Any]:
        """Extract text from image bytes using PaddleOCR.

        Args:
            image_bytes: Raw image file bytes

        Returns:
            Dict with:
            - fields: extracted field values with confidence
            - blocks: raw OCR blocks for debugging
            - engine: 'paddleocr'
            - needs_glm_fallback: bool (if confidence below threshold)
            - avg_confidence: average confidence score
        """
        img = _load_image_from_bytes(image_bytes)
        return self._extract_from_array(img)

    def extract_from_path(self, image_path: Path) -> dict[str, Any]:
        """Extract text from image file using PaddleOCR.

        Args:
            image_path: Path to image file

        Returns:
            Dict with fields, blocks, engine, needs_glm_fallback, avg_confidence
        """
        img = _load_image_from_path(image_path)
        return self._extract_from_array(img)

    def _extract_from_array(self, img: np.ndarray) -> dict[str, Any]:
        """Extract text from numpy array (BGR format)."""
        ocr = get_paddle_ocr()
        results = ocr.ocr(img, cls=True)

        if not results or not results[0]:
            logger.warning("No text detected in image")
            return {
                "fields": {},
                "blocks": [],
                "engine": "paddleocr",
                "needs_glm_fallback": True,
                "avg_confidence": 0.0,
            }

        # Build blocks from OCR results
        blocks = []
        for el in results[0]:
            coords, (text, conf) = el[0], el[1]
            center_x = sum(p[0] for p in coords) / 4
            center_y = sum(p[1] for p in coords) / 4
            blocks.append(
                {
                    "text": text.strip(),
                    "cx": center_x,
                    "cy": center_y,
                    "conf": float(conf),
                }
            )

        # Extract structured fields
        fields = _extract_fields_from_blocks(blocks)

        # Calculate average confidence
        confidences = [f.get("conf", 0) for f in fields.values()]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        # Determine if fallback is needed
        needs_fallback = avg_confidence < self.confidence_threshold

        logger.info(
            "OCR extracted %d fields, avg_confidence=%.2f, needs_glm_fallback=%s",
            len(fields),
            avg_confidence,
            needs_fallback,
        )

        return {
            "fields": fields,
            "blocks": blocks,
            "engine": "paddleocr",
            "needs_glm_fallback": needs_fallback,
            "avg_confidence": avg_confidence,
        }


# Module-level singleton instance
ocr_service = OCRService()
