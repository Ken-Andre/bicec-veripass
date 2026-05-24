"""KYC OCR service layer."""

from __future__ import annotations

import asyncio
import json
import math
import os
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
from app.services.glm_utils import (
    DEFAULT_GLM_RECTO_PROMPT,
    DEFAULT_GLM_VERSO_PROMPT,
    normalize_glm_key,
    calculate_glm_confidence,
    parse_plaintext_fields,
    sanitize_glm_output,
    _sanitize_date,
)

DATE_REGEX = re.compile(r"\b([0-3]?\d[./-][01]?\d[./-](?:19|20)\d{2})\b")
CNI_NUMBER_REGEX = re.compile(r"\b\d{8,12}\b")
SEX_REGEX = re.compile(r"\b([MF])\b")

DEFAULT_REQUIRED_FIELDS: dict[str, list[str]] = {
    # FIX-1 (Cause 1): clé canonique 'prenom' (sans s) alignée avec GLM/frontend
    "CNI_RECTO": ["nom", "prenom", "date_naissance", "numero_cni"],
    # FIX-3 (Cause 3): verso exige désormais les champs critiques pour déclencher GLM si absent
    "CNI_VERSO": ["date_expiration", "adresse", "poste_identification"],
    "BILL_ENEO": ["contrat_number", "date_facturation", "total_ttc"],
    "BILL_CAMWATER": ["contrat_number", "date_facturation", "total_ttc"],
}
OCR_ENABLED_DOC_TYPES = {"CNI_RECTO", "CNI_VERSO", "BILL_ENEO", "BILL_CAMWATER", "NIU"}
_shared_paddle_ocr: Any | None = None


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


def _paddle_lang() -> str:
    lang = settings.PADDLE_LANG.strip().lower()
    if lang in {"fr", "french", "france"}:
        return "fr"
    return settings.PADDLE_LANG


def _configured_model_dir(value: str, label: str) -> str | None:
    cleaned = value.strip()
    if not cleaned:
        return None
    model_path = Path(cleaned)
    if model_path.is_dir():
        return str(model_path)
    logger.warning(f"Configured {label} does not exist or is not a directory: {cleaned}")
    return None


def _resolve_offline_model_dir(default_subdir: str, override_value: str, label: str) -> str | None:
    override_dir = _configured_model_dir(override_value, label)
    if override_dir:
        return override_dir
    candidate = Path(settings.OCR_MODELS_ROOT) / "paddlex" / "official_models" / default_subdir
    if candidate.is_dir():
        return str(candidate)
    logger.error(f"Missing offline Paddle model directory for {label}: {candidate}")
    return None


def get_shared_paddle_ocr() -> Any | None:
    """Initialize and return a shared PaddleOCR v3 instance in offline-first mode.

    This initializer avoids runtime downloads by requiring local model directories
    when PADDLE_OFFLINE is enabled.
    """
    global _shared_paddle_ocr
    if _shared_paddle_ocr is not None:
        return _shared_paddle_ocr

    os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
    os.environ.setdefault("PADDLE_PDX_MODEL_SOURCE_CHECK", "0")
    if settings.PADDLE_CACHE_DIR:
        os.environ.setdefault("PADDLE_HOME", settings.PADDLE_CACHE_DIR)
        os.environ.setdefault("XDG_CACHE_HOME", settings.PADDLE_CACHE_DIR)

    try:
        from paddleocr import PaddleOCR  # type: ignore
    except Exception as exc:
        logger.warning(f"PaddleOCR unavailable: {exc}")
        return None

    det_model_dir = _resolve_offline_model_dir(
        default_subdir="PP-OCRv5_server_det",
        override_value=settings.PADDLE_DET_MODEL_DIR,
        label="PADDLE_DET_MODEL_DIR",
    )
    rec_model_dir = _resolve_offline_model_dir(
        default_subdir="latin_PP-OCRv5_mobile_rec",
        override_value=settings.PADDLE_REC_MODEL_DIR,
        label="PADDLE_REC_MODEL_DIR",
    )
    if settings.PADDLE_OFFLINE and (det_model_dir is None or rec_model_dir is None):
        logger.error(
            f"Offline Paddle mode enabled but required models are missing (det={det_model_dir}, rec={rec_model_dir})."
        )
        return None

    kwargs: dict[str, Any] = {
        "lang": _paddle_lang(),
        "use_doc_orientation_classify": False,
        "use_doc_unwarping": False,
        "use_textline_orientation": False,
        "enable_mkldnn": False,
    }
    if det_model_dir:
        kwargs["text_detection_model_dir"] = det_model_dir
        kwargs["text_detection_model_name"] = Path(det_model_dir).name
    if rec_model_dir:
        kwargs["text_recognition_model_dir"] = rec_model_dir
        kwargs["text_recognition_model_name"] = Path(rec_model_dir).name

    try:
        _shared_paddle_ocr = PaddleOCR(**kwargs)
        logger.info(f"PaddleOCR v3 initialized (lang={kwargs.get('lang')}) in offline mode")
    except Exception as exc:
        logger.warning(f"PaddleOCR unavailable: {exc}", exc_info=True)
        return None

    # Warmup: run a tiny dummy predict() call so the first real request
    # doesn't suffer from non-deterministic initialization artifacts.
    # PaddleOCR v3's first inference can produce garbage output (e.g.
    # nom=DSCHANG instead of KANA) because internal tensors are not yet
    # fully materialized. A warmup call forces full model initialization.
    # Controlled by PADDLE_WARMUP_ON_START env var (default: true).
    _should_warmup = os.environ.get("PADDLE_WARMUP_ON_START", "true").lower() in ("true", "1", "yes")
    if _should_warmup:
        try:
            import numpy as np
            _dummy = np.zeros((100, 300, 3), dtype=np.uint8)
            _shared_paddle_ocr.predict(_dummy)
            logger.info("PaddleOCR warmup predict() completed")
        except Exception as exc:
            logger.debug(f"PaddleOCR warmup predict() failed (non-critical): {exc}")
    else:
        logger.info("PaddleOCR warmup skipped (PADDLE_WARMUP_ON_START=false)")

    return _shared_paddle_ocr


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
                # FIX-1 (Cause 1): clé canonique 'prenom' (sans s) pour cohérence pipeline
                fields.setdefault("prenom", value)
                confidences.setdefault("prenom", score)

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


def _run_paddle_ocr(image_path: Path, doc_type: str = "CNI_RECTO") -> OCRExtractionResult:
    """Run PaddleOCR and extract fields using the improved spatial extraction.
    
    Delegates to app.services.ocr_service to reuse the improved field extraction
    logic (spatial anchoring, label-following, etc.) while keeping the same
    OCRExtractionResult return format for compatibility.
    """
    # Lazy import to avoid circular dependency at module load time.
    # ocr_service.py imports get_shared_paddle_ocr from this module,
    # so we import ocr_service lazily inside the function.
    from app.services.ocr_service import ocr_service

    try:
        result = ocr_service.extract_from_path(image_path, doc_type=doc_type)
    except Exception as exc:
        logger.error("PaddleOCR extraction failed on %s: %s", image_path, exc, exc_info=True)
        return OCRExtractionResult(
            engine="PADDLE_ERROR",
            raw_payload={"error": str(exc)},
            fields={},
            confidences={},
        )

    # Convert ocr_service result format to OCRExtractionResult
    fields: dict[str, str] = {}
    confidences: dict[str, float] = {}
    
    for field_name, field_data in result.get("fields", {}).items():
        if isinstance(field_data, dict):
            fields[field_name] = field_data.get("value", "")
            confidences[field_name] = field_data.get("conf", 0.0)
        else:
            fields[field_name] = str(field_data)
            confidences[field_name] = 0.8

    engine = result.get("engine", "paddleocr")
    if engine == "paddleocr_unavailable":
        engine = "PADDLE_UNAVAILABLE"

    return OCRExtractionResult(
        engine=engine,
        raw_payload=result,
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


def _run_glm_cli(image_path: Path, doc_type: str, detected_side: str = "recto") -> OCRExtractionResult:
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

    # Side-specific prompt selection
    if detected_side == "verso":
        prompt = DEFAULT_GLM_VERSO_PROMPT
    else:
        prompt = DEFAULT_GLM_RECTO_PROMPT

    cmd = [
        settings.GLM_OCR_CLI_PATH,
        "-m", settings.GLM_OCR_MODEL_PATH,
        "--mmproj", settings.GLM_OCR_MMPROJ_PATH,
        "--image", str(image_path),
        "-p", prompt,
        "-n", "2048",
        "--temp", "0.1",
        "-c", "4096",
        "-ngl", "0",
        "-fit", "off",
        "--chat-template", "chatglm4",
    ]

    # Set cwd to CLI's directory so Windows can find companion DLLs
    cli_dir = settings.GLM_OCR_CLI_PATH.parent if hasattr(settings.GLM_OCR_CLI_PATH, 'parent') else None

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=settings.GLM_OCR_TIMEOUT_SECONDS,
            check=False,
            cwd=str(cli_dir) if cli_dir else None,
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

    # Canonical field list
    _cni_keys = [
        "nom", "prenom", "date_naissance", "lieu_naissance",
        "sexe", "taille", "profession",
        "numero_cni", "date_delivrance", "date_expiration",
        "pere", "mere", "sp", "adresse", "autorite_nom", "poste_identification",
    ]
    _date_fields = {"date_naissance", "date_delivrance", "date_expiration"}

    # Strip markdown code fences if present
    _clean = re.sub(r"```(?:json)?", "", combined_output, flags=re.IGNORECASE).replace("```", "").strip()
    _json_match = re.search(r"\{[\s\S]*?\}", _clean)

    fields: dict[str, str] = {}
    confidences: dict[str, float] = {}

    if _json_match:
        try:
            import json
            _data = json.loads(_json_match.group())
            for raw_key, val in _data.items():
                canonical = normalize_glm_key(raw_key)
                if canonical not in _cni_keys:
                    continue
                if val in ("", "null", "NULL", "N/A", "n/a", None):
                    val = None
                if canonical in _date_fields and val is not None:
                    val = _sanitize_date(str(val))
                if val is not None:
                    fields[canonical] = str(val)
                confidences[canonical] = calculate_glm_confidence(canonical, val)
        except (json.JSONDecodeError, ValueError):
            # Plaintext fallback
            parse_plaintext_fields(combined_output, _cni_keys, _date_fields, fields, confidences)
    else:
        # Plaintext fallback
        parse_plaintext_fields(combined_output, _cni_keys, _date_fields, fields, confidences)

    # Fill missing confidences with default
    for key in _cni_keys:
        confidences.setdefault(key, 0.0)

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
    if result.engine == "UNSUPPORTED_FILE_TYPE":
        return False
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
    paddle_result = await asyncio.to_thread(_run_paddle_ocr, image_path, document.doc_type)

    await _upsert_ocr_fields(db, document, paddle_result.fields, paddle_result.confidences)
    document.ocr_engine = paddle_result.engine
    document.ocr_raw_json = paddle_result.raw_payload
    document.confidence_per_field = paddle_result.confidences

    # Update ocr_status based on extraction results
    if paddle_result.engine in ("PADDLE_ERROR", "paddleocr_unavailable", "paddleocr_error"):
        document.ocr_status = "FAILED"
        document.ocr_error = f"Engine: {paddle_result.engine}"
    elif paddle_result.fields and any(
        v for v in paddle_result.fields.values() if isinstance(v, dict) and v.get("value")
    ):
        document.ocr_status = "SUCCESS"
        document.ocr_error = None
    else:
        document.ocr_status = "PARTIAL"
        document.ocr_error = None

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

    # Detect side from doc_type
    detected_side = "verso" if "VERSO" in (document.doc_type or "").upper() else "recto"

    glm_result = _run_glm_cli(image_path, document.doc_type, detected_side=detected_side)

    # Sanitize GLM output — nullify wrong-side fields, validate NIN length
    glm_fields_clean = sanitize_glm_output(
        {k: v for k, v in glm_result.fields.items()},
        side=detected_side,
    )
    glm_conf_clean = {k: v for k, v in glm_result.confidences.items() if glm_fields_clean.get(k) is not None}

    # Confidence-based merge: only overwrite PaddleOCR fields if GLM has higher confidence
    existing_by_name = {field.field_name: field for field in document.ocr_fields}
    for field_name, extracted_value in glm_fields_clean.items():
        if extracted_value is None:
            continue
        glm_conf = float(glm_conf_clean.get(field_name, 0.0))
        existing = existing_by_name.get(field_name)
        if existing:
            # Keep existing if it has higher confidence
            if existing.confidence_score is not None and existing.confidence_score >= glm_conf:
                continue
            existing.extracted_value = extracted_value
            existing.confidence_score = glm_conf
        else:
            db.add(
                OCRField(
                    document_id=document.id,
                    field_name=field_name,
                    extracted_value=extracted_value,
                    confidence_score=glm_conf,
                )
            )

    previous_engine = document.ocr_engine or ""
    if previous_engine.startswith("PADDLE"):
        document.ocr_engine = "PADDLE_THEN_GLM"
    else:
        document.ocr_engine = glm_result.engine

    # Merge confidences — keep existing higher values
    merged_conf = dict(document.confidence_per_field or {})
    for k, v in glm_conf_clean.items():
        if k not in merged_conf or v > merged_conf[k]:
            merged_conf[k] = v
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
    except Exception as exc:
        logger.warning("DeepFace import failed: %s", exc)
        return None

    detector = settings.DEEPFACE_DETECTOR_BACKEND
    fallback_detector = "opencv"  # Lightweight fallback if primary detector fails

    # Try primary detector backend, then fallback
    for backend in [detector, fallback_detector]:
        if backend == detector and backend == fallback_detector:
            # Avoid trying the same backend twice
            continue
        try:
            result = DeepFace.verify(
                img1_path=str(cni_path),
                img2_path=str(selfie_path),
                model_name="Facenet512",
                detector_backend=backend,
                enforce_detection=False,
            )
            distance = float(result.get("distance", 1.0))
            score = _clamp_01(1.0 - distance)
            logger.info(
                "DeepFace verify OK (detector=%s, distance=%.4f, score=%.4f)",
                backend, distance, score,
            )
            return score
        except Exception as exc:
            logger.warning(
                "DeepFace verification failed with detector=%s: %s",
                backend, exc,
            )
            if backend == detector:
                logger.info("Retrying with fallback detector: %s", fallback_detector)
                continue
            return None

    return None


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
