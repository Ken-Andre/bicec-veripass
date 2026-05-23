"""GLM-OCR utility functions: prompts, key normalization, confidence heuristics.

Extracted from ocr_service.py to break circular import between
ocr_service.py and kyc/service.py.
"""

from __future__ import annotations

import re
from typing import Any


# ---------------------------------------------------------------------------
# Date sanitization (shared with ocr_service._sanitize_date)
# ---------------------------------------------------------------------------
def _sanitize_date(val: str | None) -> str | None:
    """Fix common OCR date errors: '07.02.18E9' -> '07.02.1989', etc."""
    if not val or not isinstance(val, str):
        return val
    d = val.replace("/", ".").replace("-", ".").strip()
    parts = d.split(".")
    if len(parts) != 3:
        return d
    day, month, year = parts
    _digit_map = {"E": "8", "O": "0", "l": "1", "I": "1", "S": "5", "Z": "2", "B": "8", "G": "9", "A": "4"}
    year = "".join(_digit_map.get(c, c) for c in year)
    if len(year) == 4 and year[0] == "1" and year[1].isdigit() and int(year[1]) <= 8:
        year = "19" + year[2:]
    if len(year) == 2 and year.isdigit():
        year = ("19" + year) if int(year) > 30 else ("20" + year)
    if month == "00":
        month = "01"
    if day == "00":
        day = "01"
    return f"{day}.{month}.{year}"


# ---------------------------------------------------------------------------
# GLM-OCR Prompts (side-specific)
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# GLM-OCR key normalization
# ---------------------------------------------------------------------------
def normalize_glm_key(raw_key: str) -> str:
    """Normalize a JSON key from GLM output to a canonical CNI field name.

    Handles accented variants, case differences, and common aliases.
    """
    import unicodedata
    nfkd = unicodedata.normalize("NFKD", raw_key)
    ascii_key = "".join(c for c in nfkd if not unicodedata.combining(c))
    k = ascii_key.lower().strip().replace(" ", "_").replace("-", "_")
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
        "prenoms": "prenom",
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


# ---------------------------------------------------------------------------
# GLM-OCR confidence heuristics
# ---------------------------------------------------------------------------
def calculate_glm_confidence(field: str, val: Any) -> float:
    """Heuristic confidence scoring for GLM fields."""
    if val is None or val == "":
        return 0.0
    s = str(val).strip()
    score = 0.8
    forbidden = ["GIVEN NAMES", "PRENOMS", "SURNAME", "NOM", "DATE", "BIRTH", "SEXE", "HEIGHT"]
    if any(f in s.upper() for f in forbidden):
        return 0.1
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


# ---------------------------------------------------------------------------
# GLM-OCR plaintext fallback parser
# ---------------------------------------------------------------------------
def parse_plaintext_fields(text: str, cni_keys: list[str], date_fields: set[str],
                            parsed_fields: dict[str, Any], confidences: dict[str, float]) -> None:
    """Extract CNI fields from non-JSON (plaintext) model output using regex."""
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
        canonical = normalize_glm_key(raw_key)
        if canonical not in cni_keys:
            continue
        if raw_val in ("", "null", "NULL", "N/A", "n/a", "-"):
            continue
        parsed_fields[canonical] = raw_val
        confidences[canonical] = calculate_glm_confidence(canonical, raw_val)


# ---------------------------------------------------------------------------
# GLM-OCR side-aware sanitization
# ---------------------------------------------------------------------------
def sanitize_glm_output(data: dict[str, Any], side: str = "recto") -> dict[str, Any]:
    """Validate and clean GLM-OCR extracted fields based on the card side.

    In "recto"/"verso" mode, fields that don't belong to that side are nulled.
    Validates NIN length (rejects <15 digits), cross-validates verso dates.
    """
    if not data:
        return data
    clean_data = data.copy()
    if side.lower() == "verso":
        for field in ["nom", "prenom", "date_naissance", "lieu_naissance",
                      "sexe", "taille", "profession", "signature_present"]:
            clean_data[field] = None
        nin = clean_data.get("numero_cni")
        if nin is not None:
            digits_only = re.sub(r"\D", "", str(nin))
            if len(digits_only) < 15:
                clean_data["numero_cni"] = None
        _deliv = clean_data.get("date_delivrance")
        _expir = clean_data.get("date_expiration")
        if _deliv and _expir and isinstance(_deliv, str) and isinstance(_expir, str):
            try:
                from datetime import datetime
                _d = datetime.strptime(_deliv, "%d.%m.%Y")
                _e = datetime.strptime(_expir, "%d.%m.%Y")
                if _e <= _d:
                    _corrected = _d.replace(year=_d.year + 10)
                    clean_data["date_expiration"] = _corrected.strftime("%d.%m.%Y")
            except (ValueError, OverflowError):
                pass
    elif side.lower() == "recto":
        for field in ["numero_cni", "date_delivrance", "date_expiration",
                      "adresse", "poste_identification", "pere", "mere",
                      "sp", "autorite_nom"]:
            clean_data[field] = None
    elif side.lower() == "auto":
        nin = clean_data.get("numero_cni")
        if nin is not None:
            digits_only = re.sub(r"\D", "", str(nin))
            if len(digits_only) < 15:
                clean_data["numero_cni"] = None
    return clean_data
