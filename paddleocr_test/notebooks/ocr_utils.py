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

        _paddle_ocr = PaddleOCR(use_angle_cls=True, lang="fr")
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

# ---------------------------------------------------------------------------
# GLM-OCR Prompts
# ---------------------------------------------------------------------------
# Recto-specific prompt — identity fields only, strict negative rules
DEFAULT_GLM_RECTO_PROMPT = (
    "You are analyzing the FRONT (recto) of a Cameroonian CNI identity card. "
    "Extract ONLY these identity fields from the FRONT side. "
    'Return ONLY valid JSON with exactly these keys: '
    '"nom", "prenom", "date_naissance", "lieu_naissance", '
    '"sexe", "taille", "profession".\n'
    "Rules:\n"
    "- 'nom' is the surname, located below 'NOM / SURNAME'. "
    "Do NOT use 'PERE / FATHER' or 'MERE / MOTHER' text.\n"
    "- 'prenom' is the given name(s), below 'PRENOMS / GIVEN NAMES'.\n"
    "- 'date_naissance' format: DD.MM.YYYY or DD/MM/YYYY.\n"
    "- 'lieu_naissance' is the place of birth, below 'LIEU DE NAISSANCE'.\n"
    "- 'sexe' is 'M' or 'F'.\n"
    "- 'taille' is height like '1,75' or '1.75'.\n"
    "- 'profession' is the job title (e.g. INGENIEUR, MENAGERE, ETUDIANT). "
    "Do NOT use authority names like 'MARTIN MBARGA'.\n"
    "- DO NOT extract: numero_cni, date_delivrance, date_expiration, "
    "adresse, poste_identification, pere, mere.\n"
    "- Use null for any field not visible.\n"
    "- Output ONLY JSON, no explanation."
)

# Verso-specific prompt — validity/parent fields only, strict negative rules
DEFAULT_GLM_VERSO_PROMPT = (
    "You are analyzing the BACK (verso) of a Cameroonian CNI identity card. "
    "Extract ONLY the verso fields listed below. "
    'Return ONLY valid JSON with exactly these keys: '
    '"numero_cni", "date_delivrance", "date_expiration", '
    '"adresse", "poste_identification", "pere", "mere", "sp", "autorite_nom".\n'
    "Rules:\n"
    "- 'pere' (father's name): the text directly below the 'PERE / FATHER' label "
    "at the top of the card. NOT the label itself.\n"
    "- 'mere' (mother's name): the text directly below the 'MERE / MOTHER' label. "
    "NOT the label itself.\n"
    "- 'sp': the 6-digit number next to the 'SP / S.N.' label "
    "(e.g. '279093'). NOT the 17-digit unique identifier.\n"
    "- 'autorite_nom': the issuing authority full name next to "
    "'AUTORITE / AUTHORITY' (e.g. 'MARTIN MBARGA AGUELE').\n"
    "- 'numero_cni': the 15-to-17-digit unique identifier labeled "
    "'IDENTIFIANT UNIQUE / UNIQUE IDENTIFIER'. "
    "A 6-digit SP number is NOT the NIN. A 9-digit serial is NOT the NIN.\n"
    "- 'date_delivrance': issue date, format DD.MM.YYYY.\n"
    "- 'date_expiration': expiry date, format DD.MM.YYYY, "
    "typically 10 years after issue.\n"
    "- 'poste_identification': short code like 'EN68' or 'CE01'.\n"
    "- 'adresse': address below 'ADRESSE / ADDRESS'. "
    "Do NOT include the authority name in the address.\n"
    "- DO NOT extract: nom, prenom, date_naissance, lieu_naissance, "
    "sexe, taille, profession. These are on the FRONT side only.\n"
    "- Use null for any field not visible.\n"
    "- Output ONLY JSON, no explanation."
)

# Unified reference prompt (for display/info — not used for inference routing)
DEFAULT_GLM_CNI_PROMPT = DEFAULT_GLM_RECTO_PROMPT + (
    "\n\n[If the image shows the BACK (verso) of the card, use the verso prompt instead.]"
)

# Backward-compatible alias
DEFAULT_GLM_KYC_PROMPT = DEFAULT_GLM_RECTO_PROMPT
DEFAULT_GLM_AUTO_PROMPT = DEFAULT_GLM_CNI_PROMPT

CNI_FIELDS = ["nom", "prenom", "numero_cni", "date_naissance", "lieu_naissance",
              "sexe", "taille", "profession", "date_delivrance", "date_expiration",
              "sp", "adresse", "autorite_nom", "poste_identification", "pere", "mere"]

# ---------------------------------------------------------------------------
# Field format validators — last-chance gate before returning PaddleOCR data.
# Each validator returns True if the value matches the expected format for that field.
# Banking requirement: reject (None) anything that doesn't pass — fail safe.
# ---------------------------------------------------------------------------
def _is_alphabetic_text(v: str, min_len: int = 1, reject_numbers: bool = False) -> bool:
    s = v.strip()
    if len(s) < min_len:
        return False
    if reject_numbers and any(c.isdigit() for c in s):
        return False
    return bool(re.match(r"^[A-Za-zÀ-ÖØ-ÿ\d][A-Za-zÀ-ÖØ-ÿ\s\-'\.\d]{0,}$", s))

FIELD_VALIDATORS_PADDLE: dict[str, callable] = {
    "nom": lambda v: bool(re.match(r"^[A-ZÀ-Ÿ][A-ZÀ-Ÿ\s\-'\.]{1,39}$", v.strip().upper())),
    "prenom": lambda v: bool(re.match(r"^[A-ZÀ-Ÿ][A-ZÀ-Ÿ\s\-'\.]{1,49}$", v.strip().upper())),
    "numero_cni": lambda v: len(re.sub(r"\D", "", v)) >= 15,
    "date_naissance": lambda v: bool(re.search(r"\b\d{2}[./,\-:]\d{2}[./,\-:]\d{2,4}\b", v)),
    "lieu_naissance": lambda v: _is_alphabetic_text(v, min_len=2),
    "sexe": lambda v: v.upper().strip() in ("M", "F"),
    "taille": lambda v: bool(re.search(r"1[.,]\d{2}", v)),
    "profession": lambda v: _is_alphabetic_text(v, min_len=3, reject_numbers=True),
    "date_delivrance": lambda v: bool(re.search(r"\b\d{2}[./,\-:]\d{2}[./,\-:]\d{2,4}\b", v)),
    "date_expiration": lambda v: bool(re.search(r"\b\d{2}[./,\-:]\d{2}[./,\-:]\d{2,4}\b", v)),
    "adresse": lambda v: any(c.isdigit() for c in v) or any(kw in v.upper() for kw in ["QUARTIER", "RUE", "B.P", "BP", "LOT", "ARROND", "MELEN", "BASTOS", "AKWA"]),
    "poste_identification": lambda v: bool(re.match(r"^[A-Z]{1,4}\d{2,4}$", v.strip().upper())),
    "pere": lambda v: _is_alphabetic_text(v, min_len=2),
    "mere": lambda v: _is_alphabetic_text(v, min_len=2),
}


def _validate_field_value(field_name: str, value: str) -> str | None:
    """Validate a single field value against its format rules.
    
    Args:
        field_name: CNI field name.
        value: Extracted value string.
    
    Returns:
        The value unchanged if it passes validation, or None if it doesn't.
    """
    validator = FIELD_VALIDATORS_PADDLE.get(field_name)
    if validator is None:
        return value
    return value if validator(value) else None


def sanitize_glm_output(data: dict[str, Any], side: str = "recto") -> dict[str, Any]:
    """Validate and clean GLM-OCR extracted fields based on the card side.

    In "auto" mode, no fields are suppressed — the model may extract identity
    fields from either side (new CNI has identity on verso too).

    In "recto"/"verso" mode, fields that don't belong to that side are nulled
    to prevent hallucination.

    Also applies structural validation rules:
    - Verso: numero_cni must have at least 15 digits (real NIN), otherwise nullify it
      to avoid confusing it with the 9-digit card serial number.
    - Cross-validate verso dates: if expiration <= delivrance, apply 10-year correction.
    """
    if not data:
        return data

    clean_data = data.copy()
    if side.lower() == "verso":
        # Verso should NOT contain identity fields (OLD CNI; new CNI may have them)
        for field in ["nom", "prenom", "date_naissance", "lieu_naissance",
                      "sexe", "taille", "profession", "signature_present"]:
            clean_data[field] = None
        # Validate NIN: real NIN has 17 digits on Cameroonian CNI; serial number has 9.
        nin = clean_data.get("numero_cni")
        if nin is not None:
            digits_only = re.sub(r"\D", "", str(nin))
            if len(digits_only) < 15:
                clean_data["numero_cni"] = None  # was card serial, not NIN
        # Cross-validate verso dates
        _deliv = clean_data.get("date_delivrance")
        _expir = clean_data.get("date_expiration")
        if _deliv and _expir and isinstance(_deliv, str) and isinstance(_expir, str):
            try:
                from datetime import datetime, timedelta
                _d = datetime.strptime(_deliv, "%d.%m.%Y")
                _e = datetime.strptime(_expir, "%d.%m.%Y")
                if _e <= _d:
                    _corrected = _d.replace(year=_d.year + 10)
                    clean_data["date_expiration"] = _corrected.strftime("%d.%m.%Y")
            except (ValueError, OverflowError):
                pass
    elif side.lower() == "recto":
        # Recto should NOT contain validity/verso fields
        for field in ["numero_cni", "date_delivrance", "date_expiration",
                      "adresse", "poste_identification", "pere", "mere",
                      "sp", "autorite_nom"]:
            clean_data[field] = None
    elif side.lower() == "auto":
        # Auto mode: don't suppress any field, but still validate NIN length
        nin = clean_data.get("numero_cni")
        if nin is not None:
            digits_only = re.sub(r"\D", "", str(nin))
            if len(digits_only) < 15:
                clean_data["numero_cni"] = None

    return clean_data


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


def _normalize_glm_key(raw_key: str) -> str:
    """Normalize a JSON key from GLM output to a canonical CNI field name.

    Handles accented variants (num\u00e9ro_cni), case differences, and common aliases.
    """
    import unicodedata
    # Strip accents: 'num\u00e9ro' -> 'numero'
    nfkd = unicodedata.normalize("NFKD", raw_key)
    ascii_key = "".join(c for c in nfkd if not unicodedata.combining(c))
    k = ascii_key.lower().strip().replace(" ", "_").replace("-", "_")
    # Alias map for common GLM deviations
    _aliases: dict[str, str] = {
        "numero_cni": "numero_cni",
        "numero_carte": "numero_cni",
        "identifiant_unique": "numero_cni",
        "unique_identifier": "numero_cni",
        "nin": "numero_cni",
        "date_de_naissance": "date_naissance",
        "date_of_birth": "date_naissance",
        "lieu_de_naissance": "lieu_naissance",
        "place_of_birth": "lieu_naissance",
        "date_de_delivrance": "date_delivrance",
        "date_of_issue": "date_delivrance",
        "date_d_expiration": "date_expiration",
        "date_of_expiry": "date_expiration",
        "date_d_expirationdate_of_expiry": "date_expiration",
        "height": "taille",
        "sex": "sexe",
        "given_names": "prenom",
        "given_name": "prenom",
        "surname": "nom",
        "last_name": "nom",
        "occupation": "profession",
        "pere": "pere",
        "father": "pere",
        "mere": "mere",
        "mother": "mere",
        "autorite": "autorite_nom",
        "autorite_nom": "autorite_nom",
        "authority": "autorite_nom",
        "autorite_authority": "autorite_nom",
        "nom_de_l_autorite": "autorite_nom",
        "sp": "sp",
        "situation_professionnelle": "sp",
        "sp_s_n": "sp",
    }
    return _aliases.get(k, k)


def _sanitize_date(val: str | None) -> str | None:
    """Fix common OCR date errors: '07.02.18E9' -> '07.02.1989', etc.

    Handles common OCR garbling patterns in date strings:
    - Letter→digit confusion (E→8, O→0, l→1, etc.) in year part
    - 2-digit year expansion ('89' → '1989')
    - Zero month/day correction
    """
    if not val or not isinstance(val, str):
        return val
    # Normalize separators
    d = val.replace("/", ".").replace("-", ".").strip()
    parts = d.split(".")
    if len(parts) != 3:
        return d  # not a recognizable date format
    day, month, year = parts
    # Fix letter→digit OCR errors in the year portion
    # Common confusions on Cameroonian CNI: E↔8, O↔0, l↔1, I↔1, S↔5, Z↔2, B↔8, G↔9
    _digit_map = {
        "E": "8", "O": "0", "l": "1", "I": "1",
        "S": "5", "Z": "2", "B": "8", "G": "9", "A": "4",
    }
    year = "".join(_digit_map.get(c, c) for c in year)
    # Heuristic: 4-digit year starting with 1[0-8] is likely a garbled 19XX
    # (the '9' in '19' often gets misread by OCR as another digit, e.g. E→8)
    # Example: '18E9' → after digit_map → '1889' → '1989'
    if len(year) == 4 and year[0] == "1" and year[1].isdigit() and int(year[1]) <= 8:
        year = "19" + year[2:]  # e.g. '1889' → '1989'
    # Expand 2-digit year: '89' -> '1989', '23' -> '2023'
    if len(year) == 2 and year.isdigit():
        year = ("19" + year) if int(year) > 30 else ("20" + year)
    # Fix zero month/day
    if month == "00":
        month = "01"
    if day == "00":
        day = "01"
    return f"{day}.{month}.{year}"


def _calculate_glm_confidence(field: str, val: Any) -> float:
    """Heuristic confidence scoring for GLM fields."""
    if val is None or val == "":
        return 0.0
    
    s = str(val).strip()
    score = 0.8  # base score if present
    
    # 1. Reject labels (most common hallucination)
    forbidden = ["GIVEN NAMES", "PRENOMS", "SURNAME", "NOM", "DATE", "BIRTH", "SEXE", "HEIGHT"]
    if any(f in s.upper() for f in forbidden):
        return 0.1
    
    # 2. Field-specific format checks
    if field in ["date_naissance", "date_delivrance", "date_expiration"]:
        if re.match(r"^\d{2}\.\d{2}\.\d{4}$", s):
            score = 0.95
        else:
            score = 0.3
    elif field == "sexe":
        if s.upper() in ["M", "F"]:
            score = 0.99
    elif field == "taille":
        if re.match(r"^\d[.,]\d{2}$", s):
            score = 0.95
    elif field == "numero_cni":
        if len(re.sub(r"\D", "", s)) >= 15:
            score = 0.98
            
    return score


def _glm_ocr_extract_via_cli(
    image_path: str,
    model_path: str,
    mmproj_path: str,
    cli_path: str,
    prompt: str,
    timeout: int = 120,
    max_tokens: int = 2048,
    temperature: float = 0.1,
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
        max_tokens: Maximum number of tokens to generate.
        temperature: Sampling temperature (0 = greedy).

    Returns:
        dict with keys:
          - raw_text       : raw model output string
          - parsed_fields  : dict of CNI field name → extracted value (or None)
          - confidences    : dict of CNI field name → heuristic confidence (0.0–1.0)
          - parsing_mode   : "json" | "json_fallback_plaintext" | "plaintext" | "error"
          - model          : model identifier string
          - success        : bool — at least one non-null field extracted
          - error          : str (only present on failure)
    """
    import subprocess

    cmd = [
        cli_path,
        "-m", model_path,
        "--mmproj", mmproj_path,
        "--image", image_path,
        "-p", prompt,
        "-n", str(max_tokens),
        "--temp", str(temperature),
        "-c", "4096",
        "-ngl", "0",
        "-fit", "off",
        "--chat-template", "chatglm4",
    ]

    # Set cwd to the CLI's directory so Windows can find companion DLLs
    cli_dir = os.path.dirname(os.path.abspath(cli_path))

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            cwd=cli_dir,
        )
    except subprocess.TimeoutExpired:
        return {
            "raw_text": "",
            "parsed_fields": {},
            "confidences": {},
            "parsing_mode": "error",
            "model": "glm-ocr",
            "success": False,
            "error": f"llama-mtmd-cli timed out after {timeout}s",
        }
    except OSError as e:
        return {
            "raw_text": "",
            "parsed_fields": {},
            "confidences": {},
            "parsing_mode": "error",
            "model": "glm-ocr",
            "success": False,
            "error": f"Failed to run llama-mtmd-cli: {e}",
        }

    # Canonical field list — ALL CNI fields (recto + verso)
    # BUG FIX: old list only had recto fields; verso ones (pere, mere, adresse,
    # poste_identification, sp, autorite_nom) were silently dropped by the
    # `if canonical not in _cni_keys: continue` guard below.
    _cni_keys = [
        # Recto
        "nom", "prenom", "date_naissance", "lieu_naissance",
        "sexe", "taille", "profession",
        # Verso
        "numero_cni", "date_delivrance", "date_expiration",
        "pere", "mere", "sp", "adresse", "autorite_nom", "poste_identification",
    ]
    _date_fields = {"date_naissance", "date_delivrance", "date_expiration"}
    parsed_fields: dict[str, Any] = {k: None for k in _cni_keys}
    confidences: dict[str, float] = {k: 0.0 for k in _cni_keys}
    parsing_mode = "plaintext"

    raw_text = proc.stdout.strip()

    # Check for CLI-level errors (non-zero exit)
    if proc.returncode != 0 and not raw_text:
        return {
            "raw_text": "",
            "parsed_fields": {},
            "confidences": {},
            "parsing_mode": "error",
            "model": "glm-ocr",
            "success": False,
            "error": f"llama-mtmd-cli exited with code {proc.returncode}: {proc.stderr[:2000]}",
        }

    # Strip markdown code fences if present
    _clean = re.sub(r"```(?:json)?", "", raw_text, flags=re.IGNORECASE).replace("```", "").strip()
    _json_match = re.search(r"\{[\s\S]*?\}", _clean)
    
    if _json_match:
        try:
            _data = json.loads(_json_match.group())
            for raw_key, val in _data.items():
                canonical = _normalize_glm_key(raw_key)
                if canonical not in _cni_keys:
                    continue
                if val in ("", "null", "NULL", "N/A", "n/a", None):
                    val = None
                if canonical in _date_fields and val is not None:
                    val = _sanitize_date(str(val))
                
                parsed_fields[canonical] = val
                confidences[canonical] = _calculate_glm_confidence(canonical, val)
            parsing_mode = "json"
        except (json.JSONDecodeError, ValueError):
            parsing_mode = "json_fallback_plaintext"
            _parse_plaintext_fields(raw_text, _cni_keys, _date_fields, parsed_fields, confidences)
    else:
        parsing_mode = "json_fallback_plaintext"
        _parse_plaintext_fields(raw_text, _cni_keys, _date_fields, parsed_fields, confidences)

    return {
        "raw_text": raw_text,
        "parsed_fields": parsed_fields,
        "confidences": confidences,
        "parsing_mode": parsing_mode,
        "model": "glm-ocr",
        "success": bool(parsed_fields and any(v is not None for v in parsed_fields.values())),
    }


def _parse_plaintext_fields(
    text: str,
    cni_keys: list[str],
    date_fields: set[str],
    parsed_fields: dict[str, Any],
    confidences: dict[str, float],
) -> None:
    """Extract CNI fields from non-JSON (plaintext) model output using regex.

    Looks for patterns like "nom: KANA", "NOM = KANA", "prenom: EDITH", etc.
    Also scans for recognizable CNI values (dates, long digit sequences for NIN).
    """
    # Key-value patterns: "nom: KANA", "NOM = KANA", "prenom : EDITH"
    _kv_pattern = re.compile(
        r"\b(nom|prenom|numero_cni|date_naissance|lieu_naissance|"
        r"profession|date_delivrance|date_expiration|sexe|taille|"
        r"given_names?|surname|last_name|nin|identifiant_unique)"
        r"\s*[:=]\s*(.+?)(?:\n|$)",
        re.IGNORECASE,
    )
    for match in _kv_pattern.finditer(text):
        raw_key = match.group(1)
        raw_val = match.group(2).strip().rstrip(",")
        canonical = _normalize_glm_key(raw_key)
        if canonical not in cni_keys:
            continue
        if raw_val in ("", "null", "NULL", "N/A", "n/a", "-"):
            continue
        if canonical in date_fields:
            raw_val = _sanitize_date(raw_val)
        parsed_fields[canonical] = raw_val
        confidences[canonical] = _calculate_glm_confidence(canonical, raw_val)


def glm_ocr_extract(
    image_bytes: bytes,
    prompt: str = DEFAULT_GLM_KYC_PROMPT,
    model_path: str | None = None,
    mmproj_path: str | None = None,
    max_tokens: int = 2048,
    temperature: float = 0.1,
) -> dict:
    """Run GLM-OCR on image bytes and return extracted text + parsed fields.

    Uses llama-mtmd-cli subprocess for multimodal inference since
    llama-cpp-python >= 0.3.x removed the clip_model_path parameter.

    Args:
        image_bytes: Raw image bytes (JPEG/PNG).
        prompt: Instruction prompt for the model. Defaults to DEFAULT_GLM_KYC_PROMPT.
        model_path: Override GGUF model path.
        mmproj_path: Override mmproj path.
        max_tokens: Maximum tokens to generate (passed to CLI).
        temperature: Sampling temperature, 0 = greedy (passed to CLI).

    Returns:
        dict with keys:
          - raw_text       : raw model output string
          - parsed_fields  : dict of CNI field name → extracted value (or None)
          - confidences    : dict of CNI field name → heuristic confidence (0.0–1.0)
          - parsing_mode   : "json" | "json_fallback_plaintext" | "plaintext" | "error"
          - model          : model identifier string
          - success        : bool — at least one non-null field extracted
          - error          : str (only present on failure)
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
            max_tokens=max_tokens,
            temperature=temperature,
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
# MRZ line 2 parser (TD1 format)
# ---------------------------------------------------------------------------
# Cameroonian CNI uses TD1 (3 lines × 30 chars).
# Line 2 format:  YYMMDDGYYMMDDCCOUNTRY<<<<<<DD
#   positions 0-5  : date of birth   YYMMDD
#   position  6    : sex              F/M
#   positions 8-13 : expiry date      YYMMDD
#   positions 14-18: nationality     CMR etc.

def _parse_mrz_line2(line2: str) -> dict:
    """Parse MRZ line 2 (TD1) to extract date_naissance, sexe, date_expiration.

    Args:
        line2: 30-char MRZ line 2 string (e.g. "7512102M3201129CMR<<<<<<<2").

    Returns:
        Dict with optional keys: date_naissance, sexe, date_expiration.
        Each value is {"value": str, "conf": float, "source": "mrz"} or None.
    """
    result: dict[str, Any] = {}
    if not line2 or len(line2) < 14:
        return result

    def _mrz_date_to_str(yy: str, mm: str, dd: str) -> str | None:
        """Convert 2-digit YYMMDD MRZ date to DD.MM.YYYY."""
        try:
            y, m, d = int(yy), int(mm), int(dd)
            if m < 1 or m > 12 or d < 1 or d > 31:
                return None
            year = ("19" + yy) if y > 30 else ("20" + yy)
            return f"{d:02d}.{m:02d}.{year}"
        except (ValueError, TypeError):
            return None

    # Date of birth: positions 0-5 as YYMMDD
    dob_str = _mrz_date_to_str(line2[0:2], line2[2:4], line2[4:6])
    if dob_str:
        result["date_naissance"] = {"value": dob_str, "conf": 0.98, "source": "mrz"}

    # Sex: position 6
    sex_char = line2[6].upper() if len(line2) > 6 else ""
    if sex_char in ("M", "F"):
        result["sexe"] = {"value": sex_char, "conf": 0.99, "source": "mrz"}

    # Expiry date: positions 8-13 as YYMMDD
    # Expiry dates on current IDs are always 20xx (never 19xx).
    # Use special parsing that prefers 20xx for expiry.
    _exp_yy, _exp_mm, _exp_dd = line2[8:10], line2[10:12], line2[12:14]
    try:
        _ey, _em, _ed = int(_exp_yy), int(_exp_mm), int(_exp_dd)
        if 1 <= _em <= 12 and 1 <= _ed <= 31:
            # Expiry is always 20xx for current IDs (1999 would be long expired)
            _exp_year = "20" + _exp_yy
            exp_str = f"{_ed:02d}.{_em:02d}.{_exp_year}"
            result["date_expiration"] = {"value": exp_str, "conf": 0.97, "source": "mrz"}
    except (ValueError, TypeError):
        pass

    return result


# ---------------------------------------------------------------------------
# Spatial field extraction (from test_kyc.py)
# ---------------------------------------------------------------------------
# FIX #3 — corruption UTF-8 dans STOP_WORDS : "PRÃ‰NOMS" / "PRÃ‰NOM"
# remplacés par les vraies chaînes accentuées "PRÉNOMS" / "PRÉNOM".
# Sans cette correction, les mots imprimés sur une CNI réelle ne sont pas
# reconnus comme stop-words et peuvent être pris pour des noms propres.
STOP_WORDS = {
    # ----- Identity & document headers -----
    "REPUBLIQUE", "REPUBLIC", "CAMEROON", "CAMEROUN", "NATIONAL", "IDENTITY",
    "CARD", "CARTE", "NATIONALE", "IDENTITE", "SIGNATURE",
    # ----- Field labels (never legitimate values) -----
    "SEXE", "NAME", "NOM", "SURNAME", "GIVEN", "NAMES",
    "PRÉNOMS", "PRENOMS", "PRÉNOM", "PRENOM",
    "PROFESSION", "OCCUPATION", "MENAGERE", "TRAVAIL",
    "INGENIEUR",
    "HEIGHT", "TAILLE",
    "ADRESSE", "ADDRESS",
    "DATE", "BIRTH", "NAISSANCE",
    "LIEU", "PLACE", "PLACEOFBIRTH", "LIEUDENAISSANCE",
    "NUMERO", "NUMBER",
    "IDENTIFIANT", "UNIQUE", "IDENTIFIER",
    "POSTE", "IDENTIFICATION",
    "DELIVRANCE", "EXPIRATION",
    # ----- Garbled OCR variants of common labels -----
    "REPUBLIQUEDUCAMEROUN", "REPUBLICOFCAMEROON", "CARTENATIONALEDIDENTITE",
    "NATIONALIDENTITY", "CARTENATIONALED'IDENTITE", "CNI",
    "CARTENATIONALED", "DIDENTITE", "NATIONALED",
    "POSTEDIDENTIFICATION", "IDENTIFSCATIONPOSS",
    "DATEOFISSUE", "DATEDEXPIRATION/", "DATEDE",
    "DENTIFLANTUNIQUE", "DATEOEEXPIRY",
    "UNIOUEIDENDFIE", "DENTIFIANURIQUE", "OHOUEIDENTIFIER",
    "FENO",
    # ----- Authority / issuing labels -----
    "AUTORITE", "AUTHORITY", "AUTORITE/AUTHORITY", "AUTORITÉ",
    "S.P/S.M",
    # ----- Parent labels (compound + individual) -----
    "PERE/FATHER", "MERE/MOTHER", "PERE", "FATHER", "MERE", "MOTHER",
}


def extract_spatial_data(blocks: list[dict]) -> dict:
    """Extract structured CNI fields using spatial anchoring + regex.

    Supports BOTH old and new Cameroonian CNI formats:
    - Old CNI: identity on recto, validity/NIN on verso
    - New CNI: identity fields (NOM, PRENOMS, TAILLE, PROFESSION) also on verso

    The function extracts ALL available fields regardless of detected side.
    MRZ data (when present) supplements missing fields.

    Args:
        blocks: List of dicts with 'text', 'cx', 'cy', 'conf' keys.

    Returns:
        Parsed field dict with per-field value and confidence.
        Includes 'detected_side' key ("recto" or "verso").
    """
    parsed_data = {
        field: {"value": None, "conf": 0.0}
        for field in CNI_FIELDS
    }
    parsed_data["methode"] = "ANCRAGE_SPATIAL"

    # Detect side — but do NOT suppress fields based on side
    is_verso = any(
        kw in b["text"].upper()
        for b in blocks
        for kw in ["PERE", "FATHER", "MERE", "MOTHER", "AUTORITE", "AUTHORITY",
                   "DELIVRANCE", "UNIQUE", "IDENTIFIER", "ADRESSE", "POSTE"]
    )
    parsed_data["detected_side"] = "verso" if is_verso else "recto"
    if is_verso:
        parsed_data["methode"] = "ANCRAGE_SPATIAL (VERSO)"

    all_dates: list[tuple[str, float]] = []  # (DD/MM/YYYY, confidence)
    mrz_data: dict | None = None

    # Labels that indicate a parent-name NOM block (NOT the holder's NOM)
    _parent_name_labels = {"PERE", "FATHER", "MERE", "MOTHER"}

    for i, block in enumerate(blocks):
        text = block["text"].upper()

        # --- NIN / CNI number (works on both sides) ---
        # Prefer the long NIN (17+ digits) over the short serial (9 digits)
        match_nin = re.search(r"\b(\d{15,})\b", text)
        if match_nin and parsed_data["numero_cni"]["value"] is None:
            parsed_data["numero_cni"] = {"value": match_nin.group(1), "conf": block["conf"]}
        elif match_nin and parsed_data["numero_cni"]["value"] is not None:
            # Upgrade: if we had a 9-digit number, prefer the longer NIN
            existing = str(parsed_data["numero_cni"]["value"])
            if len(match_nin.group(1)) > len(existing):
                parsed_data["numero_cni"] = {"value": match_nin.group(1), "conf": block["conf"]}

        # Fallback to 9-digit serial if no NIN yet
        if parsed_data["numero_cni"]["value"] is None:
            match_9 = re.search(r"\b(\d{9})\b", text)
            if match_9:
                parsed_data["numero_cni"] = {"value": match_9.group(1), "conf": block["conf"]}

        # --- Dates (collect ALL regardless of side) ---
        match_date = re.search(r"\b(\d{2}[./-]\d{2}[./-]\d{2,4})\b", text)
        if match_date:
            raw_date = match_date.group(1).replace(".", "/").replace("-", "/")
            parts = raw_date.split("/")
            if len(parts) == 3:
                d, m, y = parts
                if m == "00": m = "01"
                if d == "00": d = "01"
                clean_date = f"{d}/{m}/{y}"
                if len(clean_date) == 8:  # 2-digit year -> expand
                    clean_date = clean_date[:6] + ("19" if int(clean_date[6:]) > 30 else "20") + clean_date[6:]
                all_dates.append((clean_date, block["conf"]))

        # --- Verso-specific fields (adresse, poste) ---
        if is_verso:
            # Adresse
            if re.search(r"(AD[D]?RES|DRESS|ORESS|DDRES|ADR\.)", text) and parsed_data["adresse"]["value"] is None:
                candidates = []
                for b in blocks:
                    if b["cy"] > block["cy"] + 2 and abs(b["cx"] - block["cx"]) < 400:
                        b_text = b["text"].upper()
                        if not any(sw in b_text for sw in STOP_WORDS) and not re.search(r"(AD[D]?RES|DRESS|ORESS|DDRES|ADR\.)", b_text):
                            if len(b_text) > 2:
                                candidates.append(b)
                if candidates:
                    _addr_keywords = {"QUARTIER", "RUE", "CARREFOUR", "B.P", "BP", "LOT", "ARROND", "MELEN", "BASTOS", "AKWA", "BONABERI", "MAKEPE", "NDOKOTI", "MVOG", "BIYEM", "ESSOS"}
                    _label_penalty = {"DATE", "BIRTH", "BIRTA", "NAISSANCE", "DELIVRANCE", "EXPIRATION", "IDENTIFIER", "IDENTIFICATION", "UNIQUE"}
                    def _addr_sort_key(b):
                        cy_diff = b["cy"] - block["cy"]
                        cx_diff = abs(b["cx"] - block["cx"])
                        b_upper = b["text"].upper()
                        quality_bonus = 0
                        if any(kw in b_upper for kw in _addr_keywords) or any(c.isdigit() for c in b_upper):
                            quality_bonus = -10000
                        penalty = 0
                        if any(kw in b_upper for kw in _label_penalty):
                            penalty = 10000
                        return (cy_diff // 10) * 1000 + cx_diff + quality_bonus + penalty
                    candidates.sort(key=_addr_sort_key)
                    meilleur = candidates[0]
                    parsed_data["adresse"] = {"value": meilleur["text"], "conf": meilleur["conf"]}

            # Poste d'identification
            match_poste = re.search(r"\b([A-Z]{2}\s?[0-9]{2})\b", text)
            if match_poste and parsed_data["poste_identification"]["value"] is None:
                parsed_data["poste_identification"] = {"value": match_poste.group(1).replace(" ", ""), "conf": block["conf"]}
            if ("POST" in text or "IDENTIFICATIO" in text) and parsed_data["poste_identification"]["value"] is None:
                candidates = [
                    b for b in blocks
                    if b["cy"] > block["cy"] + 5 and abs(b["cx"] - block["cx"]) < 250
                ]
                if candidates:
                    candidates.sort(key=lambda b: b["cy"] - block["cy"])
                    meilleur = candidates[0]
                    if len(meilleur["text"]) <= 6 and not any(kw in meilleur["text"].upper() for kw in ["POST", "IDENT"]):
                        parsed_data["poste_identification"] = {"value": meilleur["text"].replace(" ", ""), "conf": meilleur["conf"]}

            # SP / S.N. — 6-digit number (situation professionnelle)
            # The label is often garbled: "5P/5.M.", "SP/SM", etc.
            if re.search(r"[5S][Pp][/\\.]", text) and parsed_data["sp"]["value"] is None:
                sp_candidates = [
                    b for b in blocks
                    if b["cy"] > block["cy"] + 2 and b["cy"] < block["cy"] + 60
                    and abs(b["cx"] - block["cx"]) < 150
                ]
                if sp_candidates:
                    sp_candidates.sort(key=lambda b: b["cy"] - block["cy"])
                    for _sp_b in sp_candidates:
                        _sp_match = re.search(r"\b(\d{5,7})\b", _sp_b["text"])
                        if _sp_match:
                            parsed_data["sp"] = {"value": _sp_match.group(1), "conf": _sp_b["conf"]}
                            break
            # Fallback: isolated 6-digit number on the left side of the card
            if parsed_data["sp"]["value"] is None:
                _sp_direct = re.search(r"^\s*(\d{6})\s*$", block["text"].strip())
                if _sp_direct and block["cx"] < 200 and block["cy"] < 500:
                    parsed_data["sp"] = {"value": _sp_direct.group(1), "conf": block["conf"]}

            # Autorite_nom — name alongside or below AUTORITE/AUTHORITY label
            if re.search(r"(AUTORIT[EÉ]|AUTHORITY)", text) and parsed_data["autorite_nom"]["value"] is None:
                # The authority name can be on the same row (new CNI) or
                # much further below (old CNI, up to ~80-100px away).
                # Column: authority is always in the middle band (cx ~150-550).
                # Exclude: date/post/identifier labels, stop-words, short tokens.
                _auth_candidates = [
                    b for b in blocks
                    if (abs(b["cy"] - block["cy"]) < 20 and b["cx"] > block["cx"] + 10)  # same row, right
                    or (b["cy"] > block["cy"] + 2 and b["cy"] < block["cy"] + 120        # below, same column band
                        and abs(b["cx"] - block["cx"]) < 350)
                ]
                _auth_valid = [
                    b for b in _auth_candidates
                    if not any(sw in b["text"].upper() for sw in STOP_WORDS)
                    and not re.search(r"(AUTORIT[EÉ]|AUTHORITY|DATE|BIRTH|POST|ADRESS|IDENTIF|UNIQUE)", b["text"].upper())
                    and len(b["text"]) >= 4
                    and not re.search(r"^\d+$", b["text"].strip())           # skip pure-digit blocks
                    and not re.search(r"\d{2}[./-]\d{2}[./-]\d{4}", b["text"])  # skip date strings
                    and not re.match(r"^[A-Z]{1,4}\d{2,4}$", b["text"].strip())  # skip post codes (EN68)
                ]
                if _auth_valid:
                    # Prefer same-row first, then nearest below
                    _auth_valid.sort(key=lambda b: (abs(b["cy"] - block["cy"]), abs(b["cx"] - block["cx"])))
                    parsed_data["autorite_nom"] = {"value": _auth_valid[0]["text"], "conf": _auth_valid[0]["conf"]}

            # Pere
            if re.search(r"(PERE|FATHER)", text) and parsed_data["pere"]["value"] is None:
                candidates = [
                    b for b in blocks
                    if b["cy"] > block["cy"] + 2 and abs(b["cx"] - block["cx"]) < 350
                ]
                if candidates:
                    candidates.sort(key=lambda b: b["cy"] - block["cy"])
                    meilleur = candidates[0]
                    if not any(sw in meilleur["text"].upper() for sw in STOP_WORDS):
                        parsed_data["pere"] = {"value": meilleur["text"], "conf": meilleur["conf"]}

            # Mere
            if re.search(r"(MERE|MOTHER)", text) and parsed_data["mere"]["value"] is None:
                candidates = [
                    b for b in blocks
                    if b["cy"] > block["cy"] + 2 and abs(b["cx"] - block["cx"]) < 350
                ]
                if candidates:
                    candidates.sort(key=lambda b: b["cy"] - block["cy"])
                    meilleur = candidates[0]
                    if not any(sw in meilleur["text"].upper() for sw in STOP_WORDS):
                        parsed_data["mere"] = {"value": meilleur["text"], "conf": meilleur["conf"]}

        # --- Identity fields (extract on BOTH sides) ---
        # Sexe (F / M isolated)
        if text in ["F", "M"] and parsed_data["sexe"]["value"] is None:
            parsed_data["sexe"] = {"value": text, "conf": block["conf"]}

        # Taille (e.g. 1.54, 1,75)
        match_taille = re.search(r"\b(1[.,]\d{2})\b", text)
        if match_taille and parsed_data["taille"]["value"] is None:
            parsed_data["taille"] = {"value": match_taille.group(1).replace(",", "."), "conf": block["conf"]}

        # Profession
        _professions = {"MENAGERE", "COMMERCANT", "ETUDIANT", "ELEVE", "INGENIEUR",
                        "ENSEIGNANT", "FONCTIONNAIRE", "CHAUFFEUR", "AGRICULTEUR",
                        "MEDECIN", "AVOCAT", "COMPTABLE", "TECHNICIEN",
                        "INFIRMIER", "MILITAIRE", "RETRAITE"}
        if text in _professions and parsed_data["profession"]["value"] is None:
            parsed_data["profession"] = {"value": text, "conf": block["conf"]}

        # Lieu de naissance (Cameroonian city names)
        # GUARD: verso has no holder place-of-birth; cities there (e.g. LIMBE in
        # "LIMBE-MELEN") belong to the address — block assignment on verso.
        _city_matches = [c for c in CAMEROON_CITIES if c in text]
        if _city_matches and parsed_data["lieu_naissance"]["value"] is None and not is_verso:
            if "<" not in text:
                parsed_data["lieu_naissance"] = {"value": _city_matches[0].title(), "conf": block["conf"]}

        # --- Spatial anchor: NOM / SURNAME ---
        # IMPORTANT: Distinguish "NOM/SURNAME" (identity) from
        # "NOMDU PERE" / "NOMDELA MERE" (parent names) on verso.
        # On the new CNI verso, NOM/SURNAME refers to the holder.
        is_parent_nom = any(kw in text for kw in _parent_name_labels)
        is_nom_label = (
            ("NOM" in text or "SURNAME" in text)
            and "PRENOM" not in text
            and "PRÉNOM" not in text
            and not is_parent_nom
        )
        if is_nom_label and parsed_data["nom"]["value"] is None:
            candidates = [
                b for b in blocks
                if b["cy"] > block["cy"] + 5 and abs(b["cx"] - block["cx"]) < 350
            ]
            if candidates:
                candidates.sort(key=lambda b: b["cy"] - block["cy"])
                meilleur_candidat = candidates[0]
                # Don't pick a label or parent name as the holder's name
                _cand_upper = meilleur_candidat["text"].upper()
                _is_parent_val = any(kw in _cand_upper for kw in _parent_name_labels)
                if ("PRENOM" not in _cand_upper
                    and "NOM" not in _cand_upper
                    and not _is_parent_val
                    and _cand_upper not in STOP_WORDS):
                    parsed_data["nom"] = {
                        "value": meilleur_candidat["text"],
                        "conf": meilleur_candidat["conf"],
                    }

        # --- Spatial anchor: PRENOMS / GIVEN NAMES ---
        if ("PRENOM" in text or "GIVEN" in text or "PRÉNOM" in text) and parsed_data["prenom"]["value"] is None:
            candidates = [
                b for b in blocks
                if b["cy"] > block["cy"] + 5 and abs(b["cx"] - block["cx"]) < 350
            ]
            if candidates:
                candidates.sort(key=lambda b: b["cy"] - block["cy"])
                meilleur_candidat = candidates[0]
                _cand_upper = meilleur_candidat["text"].upper()
                if "GIVEN" not in _cand_upper and "PRENOM" not in _cand_upper and _cand_upper not in STOP_WORDS:
                    parsed_data["prenom"] = {
                        "value": meilleur_candidat["text"],
                        "conf": meilleur_candidat["conf"],
                    }
                # Anti-duplication: if nom == prenom, try second candidate
                if (parsed_data["nom"]["value"] is not None
                    and parsed_data["prenom"]["value"] is not None
                    and parsed_data["nom"]["value"] == parsed_data["prenom"]["value"]
                    and len(candidates) > 1):
                    meilleur_candidat = candidates[1]
                    _cand_upper2 = meilleur_candidat["text"].upper()
                    if "GIVEN" not in _cand_upper2 and "PRENOM" not in _cand_upper2:
                        parsed_data["prenom"] = {
                            "value": meilleur_candidat["text"],
                            "conf": meilleur_candidat["conf"],
                        }

    # --- MRZ supplement (verso) ---
    mrz_fields: dict[str, Any] = {}
    if is_verso:
        mrz_result = extract_mrz(blocks)
        if mrz_result and mrz_result.get("lignes_mrz"):
            _mrz_lines = mrz_result["lignes_mrz"]
            if len(_mrz_lines) >= 2:
                mrz_fields = _parse_mrz_line2(_mrz_lines[1])

    # --- Date classification ---
    # All detected dates are classified by role using heuristics + MRZ.
    # MRZ gives us ground-truth for date_naissance and date_expiration.
    if all_dates:
        try:
            parsed_dates = []
            for d, c in all_dates:
                parts = d.split('/')
                if len(parts) == 3:
                    dt_sortable = parts[2] + parts[1] + parts[0]
                    parsed_dates.append((dt_sortable, d, c))
            if parsed_dates:
                parsed_dates.sort(key=lambda x: x[0])

                if is_verso:
                    # On verso, dates are typically:
                    #   - date_naissance (if present on new CNI)
                    #   - date_delivrance
                    #   - date_expiration
                    # Use MRZ to identify date_naissance if available
                    mrz_dob = mrz_fields.get("date_naissance", {}).get("value")
                    mrz_exp = mrz_fields.get("date_expiration", {}).get("value")

                    # Match MRZ dob to detected dates to classify them
                    _dob_match = None
                    _exp_match = None
                    if mrz_dob:
                        mrz_dob_sortable = mrz_dob[6:10] + mrz_dob[3:5] + mrz_dob[0:2]
                        for _s, _d, _c in parsed_dates:
                            if _s == mrz_dob_sortable:
                                _dob_match = (_d, _c)
                                break
                    if mrz_exp:
                        mrz_exp_sortable = mrz_exp[6:10] + mrz_exp[3:5] + mrz_exp[0:2]
                        for _s, _d, _c in parsed_dates:
                            if _s == mrz_exp_sortable:
                                _exp_match = (_d, _c)
                                break

                    # Assign date_naissance from MRZ-matched date or earliest date
                    if parsed_data["date_naissance"]["value"] is None:
                        if _dob_match:
                            parsed_data["date_naissance"] = {"value": _dob_match[0], "conf": _dob_match[1]}
                        elif len(parsed_dates) >= 3:
                            # 3+ dates on verso: earliest is likely DOB (new CNI)
                            parsed_data["date_naissance"] = {"value": parsed_dates[0][1], "conf": parsed_dates[0][2]}

                    # Assign date_delivrance: middle date (after excluding DOB match)
                    if parsed_data["date_delivrance"]["value"] is None:
                        # Use index-based filtering to avoid value-comparison bugs
                        _dob_idx = None
                        if _dob_match:
                            _dob_sortable = _dob_match[0][6:10] + _dob_match[0][3:5] + _dob_match[0][0:2] if len(_dob_match[0]) == 10 else ""
                            for _idx, (_s, _d, _c) in enumerate(parsed_dates):
                                if _d == _dob_match[0] and _s == _dob_sortable:
                                    _dob_idx = _idx
                                    break
                        _remaining = [
                            (_s, _d, _c)
                            for _idx, (_s, _d, _c) in enumerate(parsed_dates)
                            if _idx != _dob_idx
                        ]
                        if len(_remaining) >= 2:
                            parsed_data["date_delivrance"] = {"value": _remaining[0][1], "conf": _remaining[0][2]}
                        elif len(_remaining) == 1:
                            # Only one non-DOB date: ambiguous — if no expiry matched, assume delivrance
                            if not _exp_match:
                                parsed_data["date_delivrance"] = {"value": _remaining[0][1], "conf": _remaining[0][2]}

                    # Assign date_expiration: latest date or MRZ-matched
                    if parsed_data["date_expiration"]["value"] is None:
                        if _exp_match:
                            parsed_data["date_expiration"] = {"value": _exp_match[0], "conf": _exp_match[1]}
                        else:
                            parsed_data["date_expiration"] = {"value": parsed_dates[-1][1], "conf": parsed_dates[-1][2]}
                else:
                    # Recto: earliest = DOB, latest = Expiry (new CNI has both)
                    if parsed_data["date_naissance"]["value"] is None:
                        parsed_data["date_naissance"] = {"value": parsed_dates[0][1], "conf": parsed_dates[0][2]}
                    if len(parsed_dates) >= 2 and parsed_data["date_expiration"]["value"] is None:
                        parsed_data["date_expiration"] = {"value": parsed_dates[-1][1], "conf": parsed_dates[-1][2]}
                    if len(parsed_dates) >= 3:
                        # 3 dates on recto: DOB, Delivrance, Expiry
                        parsed_data["date_delivrance"] = {"value": parsed_dates[1][1], "conf": parsed_dates[1][2]}
        except Exception:
            pass

    # --- MRZ supplement for missing fields ---
    for _field in ["date_naissance", "sexe", "date_expiration"]:
        if parsed_data[_field]["value"] is None and _field in mrz_fields:
            parsed_data[_field] = mrz_fields[_field]
            if "MRZ" not in parsed_data["methode"]:
                parsed_data["methode"] += " + MRZ"

    # --- Fallback heuristic for missing nom/prenom ---
    # On verso without an explicit NOM/SURNAME label, skip the heuristic entirely.
    # The verso contains parent names (PERE/MERE), not the cardholder's identity.
    # Guessing from arbitrary uppercase blocks picks up garbled labels or parent values.
    _run_heuristic = not (is_verso and parsed_data["nom"]["value"] is None and parsed_data["prenom"]["value"] is None)
    if _run_heuristic and (parsed_data["nom"]["value"] is None or parsed_data["prenom"]["value"] is None):
        # Build a set of cy coordinates for parent-label blocks so we can
        # exclude blocks that immediately follow a PERE/MERE label (those are
        # parent name values, not the subject's identity fields).
        _PARENT_LABEL_KEYWORDS = {"PERE", "FATHER", "MERE", "MOTHER"}
        _parent_label_cys: list[float] = []
        for _b in blocks:
            _b_words = re.findall(r"\b[A-ZÀ-Ÿ]{3,}\b", _b.get("text", "").upper())
            if any(w in _PARENT_LABEL_KEYWORDS for w in _b_words):
                _parent_label_cys.append(float(_b.get("cy", 0)))

        _PARENT_PROXIMITY_PX = 60

        def _is_parent_value(block_cy: float) -> bool:
            return any(
                label_cy < block_cy <= label_cy + _PARENT_PROXIMITY_PX
                for label_cy in _parent_label_cys
            )

        caps_blocks = []
        for b in blocks:
            words = re.findall(r"\b[A-Z]{3,}\b", b["text"])
            if not words:
                continue
            has_stop = any(w.upper() in STOP_WORDS for w in words)
            if has_stop:
                continue
            if _parent_label_cys and _is_parent_value(float(b.get("cy", 0))):
                continue
            caps_blocks.append(b)

        caps_blocks.sort(key=lambda b: b["cy"])

        if parsed_data["nom"]["value"] is None and len(caps_blocks) > 0:
            parsed_data["nom"] = {"value": caps_blocks[0]["text"], "conf": caps_blocks[0]["conf"]}
            if "HEURISTIQUE" not in parsed_data["methode"]:
                parsed_data["methode"] += " + HEURISTIQUE"

        if parsed_data["prenom"]["value"] is None and len(caps_blocks) > 1:
            second_block = caps_blocks[1]
            if second_block["text"] != parsed_data["nom"]["value"]:
                parsed_data["prenom"] = {"value": second_block["text"], "conf": second_block["conf"]}
                if "HEURISTIQUE" not in parsed_data["methode"]:
                    parsed_data["methode"] += " + HEURISTIQUE"

    # Last-chance format validation: reject fields that don't match expected format.
    # Banking requirement: fail safe — never return a value that doesn't pass its
    # format validator. Downstream (GLM fallback or human review) handles gaps.
    for _field in CNI_FIELDS:
        _val = parsed_data[_field]["value"]
        if _val is not None:
            _valid = _validate_field_value(_field, str(_val))
            if _valid is None:
                parsed_data[_field] = {"value": None, "conf": 0.0}

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

    # Always run spatial extraction — it handles both recto and verso,
    # and uses MRZ data internally to supplement missing fields on verso.
    spatial_data = extract_spatial_data(blocks)

    # If full MRZ was found, store it alongside the spatial extraction
    # (spatial extraction already uses _parse_mrz_line2 internally)
    mrz_data = extract_mrz(blocks)
    if mrz_data:
        spatial_data["mrz"] = mrz_data

    return {
        "aligned_image": aligned,
        "blocks": blocks,
        "extraction": spatial_data,
        "engine": "paddleocr",
    }


# ---------------------------------------------------------------------------
# Combine extractions (recto + verso merge)
# ---------------------------------------------------------------------------
def combine_extractions(
    recto_result: dict | None,
    verso_result: dict | None,
) -> dict:
    """Merge recto and verso extraction results into a single complete record.

    Strategy: prefer higher-confidence values. For each field:
    - If only one side provides a value, use it.
    - If both sides provide a value, prefer the one with higher confidence.
    - Special handling for numero_cni: prefer the longer (NIN) value.

    Args:
        recto_result: Extraction dict from paddle_ocr_pipeline (recto image).
        verso_result: Extraction dict from paddle_ocr_pipeline (verso image).

    Returns:
        Combined extraction dict with all fields populated from both sides.
        Includes 'methode' = 'COMBINED (RECTO+VERSO)' and 'source_sides' metadata.
    """
    def _get_extraction(result: dict | None) -> dict:
        if result is None or "error" in result:
            return {}
        return result.get("extraction", {})

    r_ext = _get_extraction(recto_result)
    v_ext = _get_extraction(verso_result)

    combined = {
        field: {"value": None, "conf": 0.0, "source": None}
        for field in CNI_FIELDS
    }
    combined["methode"] = "COMBINED (RECTO+VERSO)"
    combined["source_sides"] = []
    if recto_result:
        combined["source_sides"].append("recto")
    if verso_result:
        combined["source_sides"].append("verso")

    for field in CNI_FIELDS:
        r_val = r_ext.get(field, {})
        v_val = v_ext.get(field, {})
        r_v = r_val.get("value") if isinstance(r_val, dict) else r_val
        r_c = r_val.get("conf", 0.0) if isinstance(r_val, dict) else 0.0
        v_v = v_val.get("value") if isinstance(v_val, dict) else v_val
        v_c = v_val.get("conf", 0.0) if isinstance(v_val, dict) else 0.0

        # Both None → stay None
        if r_v is None and v_v is None:
            continue

        # Only one side has a value
        if r_v is None and v_v is not None:
            combined[field] = {"value": v_v, "conf": v_c, "source": "verso"}
            continue
        if r_v is not None and v_v is None:
            combined[field] = {"value": r_v, "conf": r_c, "source": "recto"}
            continue

        # Both have values — pick best
        # Special: numero_cni — prefer the longer number (NIN vs serial)
        if field == "numero_cni" and isinstance(r_v, str) and isinstance(v_v, str):
            if len(re.sub(r"\D", "", v_v)) > len(re.sub(r"\D", "", r_v)):
                combined[field] = {"value": v_v, "conf": v_c, "source": "verso"}
                continue
            elif len(re.sub(r"\D", "", r_v)) > len(re.sub(r"\D", "", v_v)):
                combined[field] = {"value": r_v, "conf": r_c, "source": "recto"}
                continue

        # Prefer longer/more-complete value when one is a substring of the other
        # e.g. "DANIEL CHARLES AUGUSTINE" > "DANIEL CHARLES"
        if isinstance(r_v, str) and isinstance(v_v, str):
            r_strip = r_v.strip()
            v_strip = v_v.strip()
            if v_strip.startswith(r_strip) and len(v_strip) > len(r_strip):
                combined[field] = {"value": v_strip, "conf": max(v_c, r_c), "source": "verso"}
                continue
            elif r_strip.startswith(v_strip) and len(r_strip) > len(v_strip):
                combined[field] = {"value": r_strip, "conf": max(r_c, v_c), "source": "recto"}
                continue

        # General: prefer higher confidence
        if v_c > r_c:
            combined[field] = {"value": v_v, "conf": v_c, "source": "verso"}
        else:
            combined[field] = {"value": r_v, "conf": r_c, "source": "recto"}

    return combined


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