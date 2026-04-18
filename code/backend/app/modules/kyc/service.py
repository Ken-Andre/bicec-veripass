"""KYC OCR service layer."""

from __future__ import annotations

import json
import math
import re
import subprocess
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from statistics import mean, pstdev
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.logging import logger
from app.modules.kyc.models import Document, OCRField
from app.modules.kyc.storage import document_storage

DATE_REGEX = re.compile(r"\b([0-3]?\d[./-][01]?\d[./-](?:19|20)\d{2})\b")
CNI_NUMBER_REGEX = re.compile(r"\b\d{8,12}\b")
SEX_REGEX = re.compile(r"\b([MF])\b")

DEFAULT_REQUIRED_FIELDS: dict[str, list[str]] = {
    "CNI_RECTO": ["nom", "prenoms", "date_naissance", "numero_cni"],
    "CNI_VERSO": ["date_expiration"],
}
OCR_ENABLED_DOC_TYPES = {"CNI_RECTO", "CNI_VERSO", "BILL_ENEO", "BILL_CAMWATER", "NIU"}


@dataclass
class OCRExtractionResult:
    engine: str
    raw_payload: dict[str, Any]
    fields: dict[str, str]
    confidences: dict[str, float]

    def min_confidence(self) -> float:
        if not self.confidences:
            return 0.0
        return float(min(self.confidences.values()))


def _threshold_ratio() -> float:
    threshold = float(settings.OCR_CONFIDENCE_THRESHOLD)
    if threshold > 1:
        threshold = threshold / 100.0
    return max(0.0, min(1.0, threshold))


def _resolve_document_path(document: Document) -> Path:
    return (document_storage.base_path / document.file_path).resolve()


def _extract_fields_from_lines(lines: list[tuple[str, float]]) -> tuple[dict[str, str], dict[str, float]]:
    fields: dict[str, str] = {}
    confidences: dict[str, float] = {}

    full_text = " ".join(text for text, _ in lines).strip()
    if full_text:
        fields["raw_text"] = full_text
        confidences["raw_text"] = float(mean(score for _, score in lines))

    for text, score in lines:
        if "numero" in text.lower() or "id" in text.lower():
            match = CNI_NUMBER_REGEX.search(text)
            if match:
                fields.setdefault("numero_cni", match.group(0))
                confidences.setdefault("numero_cni", score)

        if "nom" in text.lower() and "prenom" not in text.lower():
            value = text.split(":")[-1].strip()
            if value and len(value) > 1:
                fields.setdefault("nom", value)
                confidences.setdefault("nom", score)

        if "prenom" in text.lower():
            value = text.split(":")[-1].strip()
            if value and len(value) > 1:
                fields.setdefault("prenoms", value)
                confidences.setdefault("prenoms", score)

        date_match = DATE_REGEX.search(text)
        if date_match:
            candidate = date_match.group(1)
            if "naiss" in text.lower():
                fields.setdefault("date_naissance", candidate)
                confidences.setdefault("date_naissance", score)
            elif "expir" in text.lower():
                fields.setdefault("date_expiration", candidate)
                confidences.setdefault("date_expiration", score)

        sex_match = SEX_REGEX.search(text.upper())
        if sex_match and "sexe" in text.lower():
            fields.setdefault("sexe", sex_match.group(1))
            confidences.setdefault("sexe", score)

    return fields, confidences


def _run_paddle_ocr(image_path: Path) -> OCRExtractionResult:
    try:
        from paddleocr import PaddleOCR  # type: ignore
    except Exception as exc:
        logger.warning("PaddleOCR unavailable: %s", exc)
        return OCRExtractionResult(
            engine="PADDLE_UNAVAILABLE",
            raw_payload={"error": "paddleocr_not_installed"},
            fields={},
            confidences={},
        )

    try:
        ocr = PaddleOCR(use_angle_cls=True, lang="fr")
        raw = ocr.ocr(str(image_path), cls=True) or []
    except Exception as exc:
        logger.error("PaddleOCR failed on %s: %s", image_path, exc, exc_info=True)
        return OCRExtractionResult(
            engine="PADDLE_ERROR",
            raw_payload={"error": str(exc)},
            fields={},
            confidences={},
        )

    lines: list[tuple[str, float]] = []
    for page in raw:
        if not page:
            continue
        for item in page:
            try:
                text = str(item[1][0]).strip()
                score = float(item[1][1])
            except Exception:
                continue
            if text:
                lines.append((text, score))

    fields, confidences = _extract_fields_from_lines(lines)
    return OCRExtractionResult(
        engine="PADDLE",
        raw_payload={"lines": [{"text": t, "confidence": c} for t, c in lines]},
        fields=fields,
        confidences=confidences,
    )


def _extract_json_blob(value: str) -> dict[str, Any]:
    start = value.find("{")
    end = value.rfind("}")
    if start < 0 or end <= start:
        return {}
    try:
        return json.loads(value[start : end + 1])
    except Exception:
        return {}


def _run_glm_cli(image_path: Path, doc_type: str) -> OCRExtractionResult:
    if not settings.GLM_OCR_ENABLED:
        return OCRExtractionResult(
            engine="GLM_DISABLED",
            raw_payload={"error": "glm_disabled"},
            fields={},
            confidences={},
        )

    if not settings.GLM_OCR_CLI_PATH:
        return OCRExtractionResult(
            engine="GLM_UNAVAILABLE",
            raw_payload={"error": "glm_cli_missing"},
            fields={},
            confidences={},
        )

    prompt = (
        "Extract identity fields from this document image as strict JSON. "
        "Use keys: nom, prenoms, date_naissance, date_expiration, numero_cni, sexe. "
        "Also provide confidences object with 0..1 float per field. "
        f"Document type: {doc_type}."
    )

    cmd = [
        settings.GLM_OCR_CLI_PATH,
        "--model",
        settings.GLM_OCR_MODEL_PATH,
        "--mmproj",
        settings.GLM_OCR_MMPROJ_PATH,
        "--image",
        str(image_path),
        "--prompt",
        prompt,
    ]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=settings.GLM_OCR_TIMEOUT_SECONDS,
            check=False,
        )
    except Exception as exc:
        logger.error("GLM CLI invocation failed: %s", exc, exc_info=True)
        return OCRExtractionResult(
            engine="GLM_ERROR",
            raw_payload={"error": str(exc)},
            fields={},
            confidences={},
        )

    combined_output = f"{proc.stdout}\n{proc.stderr}".strip()
    parsed = _extract_json_blob(combined_output)

    fields = parsed.get("fields", parsed if isinstance(parsed, dict) else {})
    if not isinstance(fields, dict):
        fields = {}
    fields = {str(k): str(v) for k, v in fields.items() if v not in (None, "")}

    confidences_obj = parsed.get("confidences", {})
    confidences: dict[str, float] = {}
    if isinstance(confidences_obj, dict):
        for key, value in confidences_obj.items():
            try:
                confidences[str(key)] = max(0.0, min(1.0, float(value)))
            except Exception:
                continue

    for key in fields:
        confidences.setdefault(key, 0.75)

    return OCRExtractionResult(
        engine="GLM",
        raw_payload={"raw_output": combined_output, "exit_code": proc.returncode},
        fields=fields,
        confidences=confidences,
    )


async def _upsert_ocr_fields(
    db: AsyncSession,
    document: Document,
    fields: dict[str, str],
    confidences: dict[str, float],
) -> None:
    existing_by_name = {field.field_name: field for field in document.ocr_fields}
    for field_name, extracted_value in fields.items():
        confidence = float(confidences.get(field_name, 0.0))
        row = existing_by_name.get(field_name)
        if row:
            row.extracted_value = extracted_value
            row.confidence_score = confidence
        else:
            db.add(
                OCRField(
                    document_id=document.id,
                    field_name=field_name,
                    extracted_value=extracted_value,
                    confidence_score=confidence,
                )
            )


def _needs_glm_fallback(result: OCRExtractionResult, doc_type: str) -> bool:
    required = DEFAULT_REQUIRED_FIELDS.get(doc_type, [])
    present_required = sum(1 for field in required if result.fields.get(field))
    if present_required < min(len(required), settings.OCR_GLM_FALLBACK_MIN_FIELDS):
        return True
    if result.min_confidence() < _threshold_ratio():
        return True
    return False


async def process_document_ocr_pipeline(
    *,
    document_id: UUID,
    db: AsyncSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.ocr_fields))
        .where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise ValueError(f"Document {document_id} not found")

    if document.doc_type not in OCR_ENABLED_DOC_TYPES:
        logger.info(
            "Skipping OCR pipeline for non-textual document %s (%s)",
            document.id,
            document.doc_type,
        )
        return {
            "document_id": str(document.id),
            "engine": document.ocr_engine,
            "fallback_queued": False,
            "confidence_per_field": document.confidence_per_field or {},
        }

    image_path = _resolve_document_path(document)
    paddle_result = _run_paddle_ocr(image_path)

    await _upsert_ocr_fields(db, document, paddle_result.fields, paddle_result.confidences)
    document.ocr_engine = paddle_result.engine
    document.ocr_raw_json = paddle_result.raw_payload
    document.confidence_per_field = paddle_result.confidences

    should_enqueue_glm = _needs_glm_fallback(paddle_result, document.doc_type)
    if should_enqueue_glm:
        from app.tasks.ocr import run_glm_ocr_fallback_task

        run_glm_ocr_fallback_task.apply_async(
            kwargs={"document_id": str(document.id)},
            queue=settings.GLM_OCR_QUEUE,
        )
        if document.ocr_engine.startswith("PADDLE"):
            document.ocr_engine = "PADDLE_PENDING_GLM"

    await db.commit()
    return {
        "document_id": str(document.id),
        "engine": document.ocr_engine,
        "fallback_queued": should_enqueue_glm,
        "confidence_per_field": document.confidence_per_field or {},
    }


async def process_glm_fallback(
    *,
    document_id: UUID,
    db: AsyncSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.ocr_fields))
        .where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise ValueError(f"Document {document_id} not found")

    image_path = _resolve_document_path(document)
    glm_result = _run_glm_cli(image_path, document.doc_type)
    await _upsert_ocr_fields(db, document, glm_result.fields, glm_result.confidences)

    previous_engine = document.ocr_engine or ""
    if previous_engine.startswith("PADDLE"):
        document.ocr_engine = "PADDLE_THEN_GLM"
    else:
        document.ocr_engine = glm_result.engine

    merged_conf = dict(document.confidence_per_field or {})
    merged_conf.update(glm_result.confidences)
    document.confidence_per_field = merged_conf
    document.ocr_raw_json = {
        "previous": document.ocr_raw_json,
        "glm": glm_result.raw_payload,
    }

    await db.commit()
    return {
        "document_id": str(document.id),
        "engine": document.ocr_engine,
        "confidence_per_field": document.confidence_per_field or {},
    }


def _clamp_01(value: float) -> float:
    return max(0.0, min(1.0, value))


def compute_anti_spoofing_score_from_landmarks(
    landmarks_json: list[dict[str, Any]],
    challenge_type: str,
) -> float:
    if not landmarks_json:
        return 0.0

    frame_count = len(landmarks_json)
    points = []
    for frame in landmarks_json:
        try:
            point = frame.get("landmarks", [])[1]  # nose bridge-ish point
            points.append((float(point["x"]), float(point["y"])))
        except Exception:
            continue

    if len(points) < 2:
        movement_score = 0.1
    else:
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        movement_score = _clamp_01((pstdev(xs) + pstdev(ys)) * 8)

    frame_score = _clamp_01(frame_count / 40.0)
    challenge_bonus = 0.08 if challenge_type in {"smile", "blink", "turn_left", "turn_right"} else 0.0
    score = 0.45 + (0.35 * frame_score) + (0.20 * movement_score) + challenge_bonus
    return _clamp_01(score)


def _byte_histogram_similarity(path_a: Path, path_b: Path) -> float:
    def histogram(path: Path) -> Counter:
        raw = path.read_bytes()[:1024 * 512]
        return Counter(raw)

    hist_a = histogram(path_a)
    hist_b = histogram(path_b)
    keys = set(hist_a) | set(hist_b)
    dot = sum(hist_a.get(k, 0) * hist_b.get(k, 0) for k in keys)
    norm_a = math.sqrt(sum(v * v for v in hist_a.values()))
    norm_b = math.sqrt(sum(v * v for v in hist_b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return _clamp_01(dot / (norm_a * norm_b))


def _deepface_verify_if_available(cni_path: Path, selfie_path: Path) -> float | None:
    try:
        from deepface import DeepFace  # type: ignore
    except Exception:
        return None

    try:
        result = DeepFace.verify(
            img1_path=str(cni_path),
            img2_path=str(selfie_path),
            model_name="Facenet512",
            detector_backend="retinaface",
            enforce_detection=False,
        )
    except Exception as exc:
        logger.warning("DeepFace verification failed: %s", exc)
        return None

    distance = float(result.get("distance", 1.0))
    return _clamp_01(1.0 - distance)


async def compute_face_match_score_for_session(
    *,
    session_id: UUID,
    db: AsyncSession,
) -> float | None:
    result = await db.execute(
        select(Document).where(
            Document.session_id == session_id,
            Document.doc_type.in_(["CNI_RECTO", "SELFIE"]),
        )
    )
    docs = result.scalars().all()
    cni = next((d for d in docs if d.doc_type == "CNI_RECTO"), None)
    selfie = next((d for d in docs if d.doc_type == "SELFIE"), None)
    if not cni or not selfie:
        return None

    cni_path = _resolve_document_path(cni)
    selfie_path = _resolve_document_path(selfie)
    if not cni_path.exists() or not selfie_path.exists():
        return None

    deepface_score = _deepface_verify_if_available(cni_path, selfie_path)
    if deepface_score is not None:
        return deepface_score

    try:
        return _byte_histogram_similarity(cni_path, selfie_path)
    except Exception as exc:
        logger.warning("Fallback face matching failed: %s", exc)
        return None
