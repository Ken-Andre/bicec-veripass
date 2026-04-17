"""Shared OCR utilities for Marimo notebooks.

Extracted and refactored from paddleocr_test/test_kyc.py with:
- PaddleOCR engine (existing pipeline)
- GLM-OCR engine via llama-cpp-python (multimodal GGUF)
- Reusable alignment, MRZ, and spatial extraction functions
- Data generation helpers for synthetic CNI / ENEO datasets
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image

# ---------------------------------------------------------------------------
# PaddleOCR singleton (lazy-loaded)
# ---------------------------------------------------------------------------
_paddle_ocr = None


def get_paddle_ocr():
    """Return a shared PaddleOCR instance (CPU, French)."""
    global _paddle_ocr
    if _paddle_ocr is None:
        from paddleocr import PaddleOCR

        _paddle_ocr = PaddleOCR(
            use_angle_cls=True, lang="fr", use_gpu=False, show_log=False
        )
    return _paddle_ocr


# ---------------------------------------------------------------------------
# GLM-OCR via llama-mtmd-cli subprocess
# ---------------------------------------------------------------------------
# NOTE: llama-cpp-python >= 0.3.x removed the `clip_model_path` parameter from
# Llama.__init__ (silently swallowed by **kwargs). The old llava/clip Python API
# no longer works. Multimodal inference now requires `llama-mtmd-cli` (from
# llama.cpp releases) invoked as a subprocess, which is the same approach used
# by the backend's _run_glm_cli().
# ---------------------------------------------------------------------------
_glm_ocr_path: str | None = None
_glm_mtmd_cli_path: str | None = None

DEFAULT_GLM_KYC_PROMPT = (
    "Extract the following fields from this Cameroonian national identity card "
    "and return ONLY a valid JSON object (no markdown, no explanation) with these exact keys: "
    "nom, prenom, numero_cni, date_naissance, lieu_naissance, sexe, taille, "
    "profession, date_delivrance, date_expiration. "
    "Use null for any field that is not visible or legible. "
    "Important rules:\n"
    "- Dates must be returned in DD/MM/YYYY format whenever possible.\n"
    "- Sexe is usually 'F' or 'M'.\n"
    "- Taille is usually a number like '1.54'.\n"
)


def set_glm_ocr_model_path(path: str) -> None:
    """Set the path to the GLM-OCR main GGUF model file."""
    global _glm_ocr_path
    _glm_ocr_path = path


def _find_mmproj_path() -> str | None:
    """Auto-detect the mmproj GGUF file near the main model."""
    if not _glm_ocr_path:
        return None
    _search_dirs = [os.path.dirname(_glm_ocr_path)]
    _models_sibling = os.path.join(os.path.dirname(_glm_ocr_path), "models")
    if os.path.isdir(_models_sibling):
        _search_dirs.append(_models_sibling)
    _ocr_test_models_dir = str(Path(__file__).resolve().parent.parent / "models")
    if os.path.isdir(_ocr_test_models_dir) and _ocr_test_models_dir not in _search_dirs:
        _search_dirs.append(_ocr_test_models_dir)
    for _mdir in _search_dirs:
        for f in os.listdir(_mdir):
            if "mmproj" in f.lower() and f.endswith(".gguf"):
                return os.path.join(_mdir, f)
    return None


def _find_mtmd_cli() -> str | None:
    """Find the llama-mtmd-cli executable.

    Search order:
      1. Explicit path set via set_glm_ocr_mtmd_cli_path()
      2. paddleocr_test/llama-cpp-bin/llama-mtmd-cli.exe (downloaded release)
      3. System PATH
    """
    global _glm_mtmd_cli_path

    if _glm_mtmd_cli_path and os.path.isfile(_glm_mtmd_cli_path):
        return _glm_mtmd_cli_path

    # Check for downloaded binary next to paddleocr_test/
    _local_bin = str(Path(__file__).resolve().parent.parent / "llama-cpp-bin" / "llama-mtmd-cli.exe")
    if os.path.isfile(_local_bin):
        _glm_mtmd_cli_path = _local_bin
        return _local_bin

    # Check system PATH
    import shutil
    found = shutil.which("llama-mtmd-cli")
    if found:
        _glm_mtmd_cli_path = found
        return found

    return None


def set_glm_ocr_mtmd_cli_path(path: str) -> None:
    """Explicitly set the path to the llama-mtmd-cli executable."""
    global _glm_mtmd_cli_path
    _glm_mtmd_cli_path = path


def _glm_ocr_extract_via_cli(
    image_path: str,
    model_path: str,
    mmproj_path: str,
    cli_path: str,
    prompt: str,
    timeout: int = 120,
) -> dict:
    """Run GLM-OCR via llama-mtmd-cli subprocess.

    This is the only working method for multimodal inference with
    llama-cpp-python >= 0.3.x, since the old clip_model_path API
    was removed and the mtmd_cpp low-level API has no Python wrapper.

    Args:
        image_path: Path to the image file on disk.
        model_path: Path to the main GGUF model.
        mmproj_path: Path to the mmproj GGUF.
        cli_path: Path to llama-mtmd-cli executable.
        prompt: Text prompt for the model.
        timeout: Max seconds to wait for the subprocess.

    Returns:
        dict with raw_text, parsed_fields, parsing_mode, model, success.
    """
    import subprocess

    cmd = [
        cli_path,
        "-m", model_path,
        "--mmproj", mmproj_path,
        "--image", image_path,
        "-p", prompt,
        "-n", "2048",
        "--temp", "0.1",
        "--no-warmup",  # skip warmup on repeat calls
    ]

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
    except FileNotFoundError:
        return {
            "raw_text": "",
            "parsed_fields": {},
            "parsing_mode": "error",
            "model": "glm-ocr",
            "success": False,
            "error": f"llama-mtmd-cli not found at {cli_path}",
        }
    except subprocess.TimeoutExpired:
        return {
            "raw_text": "",
            "parsed_fields": {},
            "parsing_mode": "error",
            "model": "glm-ocr",
            "success": False,
            "error": f"llama-mtmd-cli timed out after {timeout}s",
        }

    combined = f"{proc.stdout}\n{proc.stderr}"

    # The CLI outputs the model response after the loading/diagnostic lines.
    # The actual generated text appears after the last "---" separator or after
    # the image decode message. We look for the JSON block in the combined output.
    _cni_keys = [
        "nom", "prenom", "numero_cni", "date_naissance", "lieu_naissance",
        "profession", "date_delivrance", "date_expiration", "sexe", "taille",
    ]
    parsed_fields: dict[str, Any] = {k: None for k in _cni_keys}
    parsing_mode = "plaintext"

    # Extract the generated text (after model loading logs)
    # llama-mtmd-cli outputs the response as plain text, possibly wrapped in ```json```
    # We search for JSON blocks in the combined output
    raw_text = proc.stdout.strip()

    # Strip markdown fences
    _clean = re.sub(r"```(?:json)?", "", raw_text, flags=re.IGNORECASE).replace("```", "").strip()
    _json_match = re.search(r"\{[\s\S]*\}", _clean)
    if _json_match:
        try:
            _data = json.loads(_json_match.group())
            for k in _cni_keys:
                _val = _data.get(k)
                if _val in ("", "null", "NULL", "N/A", "n/a"):
                    _val = None
                parsed_fields[k] = _val
            parsing_mode = "json"
        except (json.JSONDecodeError, ValueError):
            parsing_mode = "json_fallback_plaintext"
            _fallback = _json_match.group()
            for k in _cni_keys:
                _m = re.search(
                    rf'"{k}"\s*:\s*"([^"]*)"', _fallback, re.IGNORECASE
                )
                if _m and _m.group(1) not in ("", "null", "NULL"):
                    parsed_fields[k] = _m.group(1)
    else:
        parsing_mode = "json_fallback_plaintext"

    return {
        "raw_text": raw_text,
        "parsed_fields": parsed_fields,
        "parsing_mode": parsing_mode,
        "model": "glm-ocr",
        "success": bool(parsed_fields and any(v is not None for v in parsed_fields.values())),
    }


def glm_ocr_extract(
    image_bytes: bytes,
    prompt: str = DEFAULT_GLM_KYC_PROMPT,
    model_path: str | None = None,
    mmproj_path: str | None = None,
) -> dict:
    """Run GLM-OCR on image bytes and return extracted text + parsed fields.

    Uses llama-mtmd-cli subprocess for multimodal inference since
    llama-cpp-python >= 0.3.x removed the clip_model_path parameter.

    Args:
        image_bytes: Raw image bytes (JPEG/PNG).
        prompt: Instruction prompt for the model. Defaults to DEFAULT_GLM_KYC_PROMPT.
        model_path: Override GGUF model path.
        mmproj_path: Override mmproj path.

    Returns:
        dict with keys:
          - raw_text      : raw model output string
          - parsed_fields : dict of CNI fields (nom, prenom, numero_cni, ...)
          - parsing_mode  : "json" | "json_fallback_plaintext" | "plaintext"
          - model         : model identifier string
          - success       : bool
    """
    import tempfile

    if model_path:
        set_glm_ocr_model_path(model_path)

    if not _glm_ocr_path or not os.path.isfile(_glm_ocr_path):
        return {
            "raw_text": "",
            "parsed_fields": {},
            "parsing_mode": "error",
            "model": "glm-ocr",
            "success": False,
            "error": f"GLM-OCR model not found at '{_glm_ocr_path}'. Use set_glm_ocr_model_path().",
        }

    cli_path = _find_mtmd_cli()
    if not cli_path:
        return {
            "raw_text": "",
            "parsed_fields": {},
            "parsing_mode": "error",
            "model": "glm-ocr",
            "success": False,
            "error": (
                "llama-mtmd-cli not found. Download from "
                "https://github.com/ggml-org/llama.cpp/releases and place in "
                "paddleocr_test/llama-cpp-bin/ or set via set_glm_ocr_mtmd_cli_path()."
            ),
        }

    if mmproj_path is None:
        mmproj_path = _find_mmproj_path()
    if not mmproj_path or not os.path.isfile(mmproj_path):
        return {
            "raw_text": "",
            "parsed_fields": {},
            "parsing_mode": "error",
            "model": "glm-ocr",
            "success": False,
            "error": f"mmproj GGUF not found (searched near {_glm_ocr_path}).",
        }

    # Write image to a temporary file for the CLI (it needs a file path, not bytes)
    _suffix = ".png" if image_bytes[:8] == b"\x89PNG\r\n\x1a\n" else ".jpg"
    with tempfile.NamedTemporaryFile(suffix=_suffix, delete=False) as tmp:
        tmp.write(image_bytes)
        tmp_image_path = tmp.name

    try:
        return _glm_ocr_extract_via_cli(
            image_path=tmp_image_path,
            model_path=_glm_ocr_path,
            mmproj_path=mmproj_path,
            cli_path=cli_path,
            prompt=prompt,
        )
    finally:
        try:
            os.unlink(tmp_image_path)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# Card alignment (from test_kyc.py)
# ---------------------------------------------------------------------------
STANDARD_WIDTH = 800


def align_card_image(image_input: str | np.ndarray | Image.Image) -> np.ndarray | None:
    """Detect card in image, crop and flatten via perspective transform.

    Args:
        image_input: File path (str), numpy array (BGR), or PIL Image.

    Returns:
        Aligned BGR numpy array normalized to STANDARD_WIDTH, or None on failure.
    """
    if isinstance(image_input, str):
        img = cv2.imread(image_input)
    elif isinstance(image_input, Image.Image):
        img = cv2.cvtColor(np.array(image_input.convert("RGB")), cv2.COLOR_RGB2BGR)
    else:
        img = image_input.copy()

    if img is None:
        return None

    ratio = img.shape[0] / 500.0
    orig = img.copy()
    img_resized = cv2.resize(img, (int(img.shape[1] / ratio), 500))

    gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 75, 200)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed = cv2.morphologyEx(edged, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(
        closed.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE
    )
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

    screen_cnt = None
    for c in contours:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            screen_cnt = approx
            break

    if screen_cnt is not None:
        area = cv2.contourArea(screen_cnt)
        img_area = img_resized.shape[0] * img_resized.shape[1]
        if area < 0.1 * img_area:
            screen_cnt = None

    if screen_cnt is None:
        # Fallback: just normalize width
        fallback_ratio = STANDARD_WIDTH / float(orig.shape[1])
        fallback_height = int(orig.shape[0] * fallback_ratio)
        return cv2.resize(orig, (STANDARD_WIDTH, fallback_height))

    pts = screen_cnt.reshape(4, 2) * ratio
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]

    (tl, tr, br, bl) = rect
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))

    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))

    dst = np.array(
        [[0, 0], [maxWidth - 1, 0], [maxWidth - 1, maxHeight - 1], [0, maxHeight - 1]],
        dtype="float32",
    )

    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(orig, M, (maxWidth, maxHeight))

    ratio_warp = STANDARD_WIDTH / float(maxWidth)
    standard_height = int(maxHeight * ratio_warp)
    return cv2.resize(warped, (STANDARD_WIDTH, standard_height))


# ---------------------------------------------------------------------------
# MRZ extraction (from test_kyc.py)
# ---------------------------------------------------------------------------
MRZ_PATTERN = re.compile(r"^[A-Z0-9<]{30}$")


def extract_mrz(blocks: list[dict]) -> dict | None:
    """Extract Machine Readable Zone (TD1 format, 3x30 chars).

    Args:
        blocks: List of dicts with 'text', 'cx', 'cy', 'conf' keys.

    Returns:
        MRZ dict or None.
    """
    mrz_lines = []
    for b in blocks:
        text = b["text"].replace(" ", "")
        if MRZ_PATTERN.match(text) and "<" in text:
            mrz_lines.append(text)

    if len(mrz_lines) == 3:
        return {
            "mrz_trouvee": True,
            "lignes_mrz": mrz_lines,
            "methode": "MRZ_ICAO_TD1",
        }
    return None


# ---------------------------------------------------------------------------
# Spatial field extraction (from test_kyc.py)
# ---------------------------------------------------------------------------
# FIX #3 — corruption UTF-8 dans STOP_WORDS : "PRÃ‰NOMS" / "PRÃ‰NOM"
# remplacés par les vraies chaînes accentuées "PRÉNOMS" / "PRÉNOM".
# Sans cette correction, les mots imprimés sur une CNI réelle ne sont pas
# reconnus comme stop-words et peuvent être pris pour des noms propres.
STOP_WORDS = {
    "REPUBLIQUE", "REPUBLIC", "CAMEROON", "CAMEROUN", "NATIONAL", "IDENTITY",
    "CARD", "CARTE", "NATIONALE", "IDENTITE", "SIGNATURE", "SEXE", "NAME", "NOM",
    "SURNAME", "GIVEN", "NAMES", "PROFESSION", "OCCUPATION", "MENAGERE", "TRAVAIL",
    "INGENIEUR", "REPUBLIQUEDUCAMEROUN", "REPUBLICOFCAMEROON", "CARTENATIONALEDIDENTITE",
    "PERE/FATHER", "MERE/MOTHER", "S.P/S.M", "AUTORITE/AUTHORITY", "DATEDE", "DELIVRANCE",
    "POSTEDIDENTIFICATION", "DATEOFISSUE", "IDENTIFSCATIONPOSS", "DATEDEXPIRATION/",
    "DENTIFLANTUNIQUE", "DATEOEEXPIRY", "UNIOUEIDENDFIE", "DENTIFIANURIQUE",
    "OHOUEIDENTIFIER", "FENO", "PRÉNOMS", "PRENOMS", "PRÉNOM", "PRENOM",
}

CNI_FIELDS = ["nom", "prenom", "numero_cni", "date_naissance", "lieu_naissance",
               "sexe", "taille", "profession", "date_delivrance", "date_expiration"]


def extract_spatial_data(blocks: list[dict]) -> dict:
    """Extract structured CNI fields using spatial anchoring + regex.

    Args:
        blocks: List of dicts with 'text', 'cx', 'cy', 'conf' keys.

    Returns:
        Parsed field dict with per-field value and confidence.
    """
    parsed_data = {
        "nom": {"value": None, "conf": 0.0},
        "prenom": {"value": None, "conf": 0.0},
        "numero_cni": {"value": None, "conf": 0.0},
        "methode": "ANCRAGE_SPATIAL",
    }

    for i, block in enumerate(blocks):
        text = block["text"].upper()

        # CNI number (9 digits) or NIN (17 digits)
        match = re.search(r"\b\d{9}\b", text)
        if match and parsed_data["numero_cni"]["value"] is None:
            parsed_data["numero_cni"] = {"value": match.group(), "conf": block["conf"]}

        match_nin = re.search(r"\b\d{17}\b", text)
        if match_nin and parsed_data["numero_cni"]["value"] is None:
            parsed_data["numero_cni"] = {"value": match_nin.group(), "conf": block["conf"]}

        # Spatial anchor: NOM / SURNAME
        if "NOM" in text or "SURNAME" in text:
            candidates = [
                b for b in blocks
                if b["cy"] > block["cy"] + 5 and abs(b["cx"] - block["cx"]) < 150
            ]
            if candidates:
                candidates.sort(key=lambda b: b["cy"] - block["cy"])
                meilleur_candidat = candidates[0]
                if "PRENOM" not in meilleur_candidat["text"].upper():
                    parsed_data["nom"] = {
                        "value": meilleur_candidat["text"],
                        "conf": meilleur_candidat["conf"],
                    }

        # FIX #3 (suite) — "PRÃ‰NOM" corrigé en "PRÉNOM" dans la condition d'ancrage.
        # Avant cette correction, les CNI avec "PRÉNOM" imprimé en accentué
        # ne déclenchaient jamais l'ancrage spatial du prénom.
        if "PRENOM" in text or "GIVEN" in text or "PRÉNOM" in text:
            candidates = [
                b for b in blocks
                if b["cy"] > block["cy"] + 5 and abs(b["cx"] - block["cx"]) < 150
            ]
            if candidates:
                candidates.sort(key=lambda b: b["cy"] - block["cy"])
                meilleur_candidat = candidates[0]
                parsed_data["prenom"] = {
                    "value": meilleur_candidat["text"],
                    "conf": meilleur_candidat["conf"],
                }

    # Detect verso — skip heuristic name extraction
    is_verso = any(
        kw in b["text"].upper()
        for b in blocks
        for kw in ["PERE", "FATHER", "MERE", "MOTHER", "AUTORITE", "AUTHORITY", "DELIVRANCE"]
    )
    if is_verso:
        parsed_data["methode"] += " (VERSO DETEC. -> IGNORE HEURISTIQUE NOM)"
        return parsed_data

    # Fallback heuristic for RECTO when anchors are missing
    if parsed_data["nom"]["value"] is None or parsed_data["prenom"]["value"] is None:
        caps_blocks = []
        for b in blocks:
            words = re.findall(r"\b[A-Z]{3,}\b", b["text"])
            if not words:
                continue
            has_stop = any(w.upper() in STOP_WORDS for w in words)
            if not has_stop:
                caps_blocks.append(b)

        caps_blocks.sort(key=lambda b: b["cy"])

        if parsed_data["nom"]["value"] is None and len(caps_blocks) > 0:
            parsed_data["nom"] = {"value": caps_blocks[0]["text"], "conf": caps_blocks[0]["conf"]}
            if "HEURISTIQUE" not in parsed_data["methode"]:
                parsed_data["methode"] += " + HEURISTIQUE"

        if parsed_data["prenom"]["value"] is None and len(caps_blocks) > 1:
            parsed_data["prenom"] = {"value": caps_blocks[1]["text"], "conf": caps_blocks[1]["conf"]}
            if "HEURISTIQUE" not in parsed_data["methode"]:
                parsed_data["methode"] += " + HEURISTIQUE"

    return parsed_data


# ---------------------------------------------------------------------------
# PaddleOCR full pipeline
# ---------------------------------------------------------------------------
def paddle_ocr_pipeline(image_input: str | np.ndarray | Image.Image) -> dict:
    """Run full PaddleOCR pipeline: align -> OCR -> extract.

    Args:
        image_input: File path, numpy array (BGR), or PIL Image.

    Returns:
        Dict with 'aligned_image', 'blocks', 'extraction', 'engine' keys.
    """
    ocr = get_paddle_ocr()
    aligned = align_card_image(image_input)
    if aligned is None:
        return {"error": "Failed to align image", "engine": "paddleocr"}

    results = ocr.ocr(aligned, cls=True)
    if not results or not results[0]:
        return {"error": "No text detected", "engine": "paddleocr", "aligned_image": aligned}

    blocks = []
    for el in results[0]:
        coords, (text, conf) = el[0], el[1]
        center_x = sum(p[0] for p in coords) / 4
        center_y = sum(p[1] for p in coords) / 4
        blocks.append({"text": text.strip(), "cx": center_x, "cy": center_y, "conf": float(conf)})

    mrz_data = extract_mrz(blocks)
    if mrz_data:
        return {
            "aligned_image": aligned,
            "blocks": blocks,
            "extraction": mrz_data,
            "engine": "paddleocr",
        }

    spatial_data = extract_spatial_data(blocks)
    return {
        "aligned_image": aligned,
        "blocks": blocks,
        "extraction": spatial_data,
        "engine": "paddleocr",
    }


# ---------------------------------------------------------------------------
# Visualization helpers
# ---------------------------------------------------------------------------
def draw_ocr_boxes(image: np.ndarray, blocks: list[dict]) -> np.ndarray:
    """Draw OCR bounding boxes and text on image.

    Args:
        image: BGR numpy array.
        blocks: Blocks with 'text', 'cx', 'cy', 'conf' keys.

    Returns:
        Annotated BGR image.
    """
    annotated = image.copy()
    for b in blocks:
        cx, cy = int(b["cx"]), int(b["cy"])
        conf = b["conf"]
        color = (0, 255, 0) if conf >= 0.85 else (0, 165, 255) if conf >= 0.6 else (0, 0, 255)
        cv2.circle(annotated, (cx, cy), 4, color, -1)
        cv2.putText(
            annotated,
            f"{b['text'][:20]} ({conf:.2f})",
            (cx + 6, cy - 6),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.4,
            color,
            1,
        )
    return annotated


def numpy_to_pil(img: np.ndarray) -> Image.Image:
    """Convert BGR numpy array to PIL RGB Image."""
    return Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))


def pil_to_numpy(img: Image.Image) -> np.ndarray:
    """Convert PIL RGB Image to BGR numpy array."""
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def image_to_bytes(img: Image.Image, fmt: str = "PNG") -> bytes:
    """Convert PIL Image to bytes."""
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def compute_sha256(data: bytes) -> str:
    """Compute SHA-256 hash of bytes."""
    return hashlib.sha256(data).hexdigest()


# ---------------------------------------------------------------------------
# GGUF model search helper
# ---------------------------------------------------------------------------
def find_gguf_models(search_dirs: list[str] | None = None) -> list[dict]:
    """Search for GGUF model files in common directories.

    Args:
        search_dirs: Optional list of directories to search.

    Returns:
        List of dicts with 'path', 'name', 'size_mb', 'role' keys.
        'role' is 'main' for LLM models or 'mmproj' for multimodal projectors.
    """
    if search_dirs is None:
        home = os.path.expanduser("~")
        # Resolve the paddleocr_test/ directory relative to this file
        _this_dir = Path(__file__).resolve().parent
        _project_ocr_dir = str(_this_dir.parent)  # paddleocr_test/
        search_dirs = [
            _project_ocr_dir,
            os.path.join(_project_ocr_dir, "models"),
            os.path.join(home, "Downloads"),
            os.path.join(home, "Models"),
            os.path.join(home, ".cache", "huggingface"),
        ]

    models = []
    seen_paths: set[str] = set()
    for search_dir in search_dirs:
        if not os.path.isdir(search_dir):
            continue
        for root, _dirs, files in os.walk(search_dir):
            # Prune hidden dirs, venvs, node_modules, caches
            _dirs[:] = [
                d for d in _dirs
                if not d.startswith('.')
                and d != '__pycache__'
                and d != 'node_modules'
                and d != '.venv_ocr'
                and d != 'site-packages'
            ]
            # Limit depth to avoid scanning entire drives
            depth = root.replace(search_dir, "").count(os.sep)
            if depth > 2:
                _dirs[:] = []
                continue
            for f in files:
                if f.endswith(".gguf"):
                    full_path = os.path.join(root, f)
                    # Deduplicate by canonical path
                    canon = os.path.realpath(full_path)
                    if canon in seen_paths:
                        continue
                    seen_paths.add(canon)
                    size_mb = os.path.getsize(full_path) / (1024 * 1024)
                    role = "mmproj" if "mmproj" in f.lower() else "main"
                    models.append({
                        "path": full_path,
                        "name": f,
                        "size_mb": round(size_mb, 1),
                        "role": role,
                    })

    return sorted(models, key=lambda m: (m["role"], m["name"]))


# ---------------------------------------------------------------------------
# Cameroon-specific Faker providers
# ---------------------------------------------------------------------------
CAMEROON_SURNAMES = [
    "TANDENT YANG", "KANA", "BONDI NGA", "SOBGUI", "TRAVAIL", "AHANDA",
    "NKOA", "MBOCK", "EKAMBI", "BIYONG", "FOKOU", "TCHINDA", "NGANOU",
    "KAMGA", "TCHUENTE", "DJOUKOUO", "NGUIE", "MINKOU", "EWANE", "EYEBE",
]

CAMEROON_FIRSTNAMES = [
    "DANIEL CHARLES", "LAMBO EDITH", "BRUNO", "JEAN", "AUGUSTINE",
    "PATRICE", "SERGE", "ARLETTE", "CHRISTELLE", "FABRICE",
    "GERVAIS", "MARTHE", "HERVE", "CELESTIN", "SIMPLICE",
    "BENOIT", "NADGE", "ANGELE", "CLEOPHAS", "MIREILLE",
]

CAMEROON_CITIES = [
    "YAOUNDE", "DOUALA", "DSCHANG", "BONOUA", "BAFOUSSAM",
    "GAROUA", "MAROUA", "BERTOUA", "BUEA", "LIMBE",
    "EBOLOWA", "SANGMELIMA", "NKOUMOU", "BAFANG", "TOLE",
]

CAMEROON_PROFESSIONS = [
    "INGENIEUR", "MENAGERE", "COMMERCANT", "ENSEIGNANT", "ETUDIANT",
    "FONCTIONNAIRE", "CHAUFFEUR", "AGRICULTEUR", "MEDECIN", "AVOCAT",
    "COMPTABLE", "TECHNICIEN", "INFIRMIER", "MILITAIRE", "RETRAITE",
]

# FIX #3 (suite) — "ExtrÃªme-Nord" corrigé en "Extrême-Nord".
CAMEROON_REGIONS = [
    "Centre", "Littoral", "Ouest", "Nord-Ouest", "Sud-Ouest",
    "Est", "Sud", "Extrême-Nord", "Nord", "Adamaoua",
]