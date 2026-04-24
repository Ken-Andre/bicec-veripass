"""OCR Service for document text extraction.

Uses PaddleOCR as primary engine with GLM-OCR fallback for low confidence.
Improved field extraction using spatial anchoring (label → value) based on
CNI Camerounaise layout.

This module ports the proven extraction logic from paddleocr_test/notebooks/ocr_utils.py
into the production backend, adding image alignment, MRZ parsing, and timing metrics.
"""

from __future__ import annotations

import io
import os
import re
import tempfile
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image

from app.core.config import settings
from app.core.logging import logger
from app.modules.kyc.service import get_shared_paddle_ocr

# ---------------------------------------------------------------------------
# Card alignment (perspective correction)
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
# MRZ extraction
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
    _exp_yy, _exp_mm, _exp_dd = line2[8:10], line2[10:12], line2[12:14]
    try:
        _ey, _em, _ed = int(_exp_yy), int(_exp_mm), int(_exp_dd)
        if 1 <= _em <= 12 and 1 <= _ed <= 31:
            _exp_year = "20" + _exp_yy
            exp_str = f"{_ed:02d}.{_em:02d}.{_exp_year}"
            result["date_expiration"] = {"value": exp_str, "conf": 0.97, "source": "mrz"}
    except (ValueError, TypeError):
        pass

    return result


# ---------------------------------------------------------------------------
# Spatial field extraction (ported from notebook ocr_utils.py)
# ---------------------------------------------------------------------------
# NOTE: STOP_WORDS must only contain LABELS/HEADERS, never legitimate field values.
# Values like "MENAGERE", "INGENIEUR" are professions, not labels.
STOP_WORDS = {
    "REPUBLIQUE", "REPUBLIC", "CAMEROON", "CAMEROUN", "NATIONAL", "IDENTITY",
    "CARD", "CARTE", "NATIONALE", "IDENTITE", "SIGNATURE", "SEXE", "NAME", "NOM",
    "SURNAME", "GIVEN", "NAMES", "PROFESSION", "OCCUPATION", "TRAVAIL",
    "REPUBLIQUEDUCAMEROUN", "REPUBLICOFCAMEROON", "CARTENATIONALEDIDENTITE",
    "PERE/FATHER", "MERE/MOTHER", "S.P/S.M", "AUTORITE/AUTHORITY", "DATEDE", "DELIVRANCE",
    "POSTEDIDENTIFICATION", "DATEOFISSUE", "IDENTIFSCATIONPOSS", "DATEDEXPIRATION/",
    "DENTIFLANTUNIQUE", "DATEOEEXPIRY", "UNIOUEIDENDFIE", "DENTIFIANURIQUE",
    "OHOUEIDENTIFIER", "PRÉNOMS", "PRENOMS", "PRÉNOM", "PRENOM",
    "HEIGHT", "TAILLE", "ADRESSE", "ADDRESS", "DATE", "BIRTH", "NAISSANCE",
    "LIEU", "PLACE", "PLACEOFBIRTH", "LIEUDENAISSANCE", "NUMERO", "NUMBER",
    "IDENTIFIANT", "UNIQUE", "IDENTIFIER", "POSTE", "D'IDENTIFICATION",
    "NATIONALIDENTITY", "CARTENATIONALED'IDENTITE", "CNI",
    "CARTENATIONALED", "IDENTITE", "DIDENTITE", "NATIONALED",
}

CNI_FIELDS = [
    "nom", "prenom", "numero_cni", "date_naissance", "lieu_naissance",
    "sexe", "taille", "profession", "date_delivrance", "date_expiration",
    "adresse", "poste_identification",
]

CAMEROON_CITIES = [
    "YAOUNDE", "DOUALA", "DSCHANG", "BONOUA", "BAFOUSSAM",
    "GAROUA", "MAROUA", "BERTOUA", "BUEA", "LIMBE",
    "EBOLOWA", "SANGMELIMA", "NKOUMOU", "BAFANG", "TOLE",
    "KANA", "MFOU", "NGOUON", "MONATELE", "NKOLAFAMBA",
    "NGAMBE", "TIBATI", "NGAOUNDERE", "MEIGANGA",
]

# ---------------------------------------------------------------------------
# Date sanitization (ported from notebook ocr_utils.py)
# ---------------------------------------------------------------------------
def _sanitize_date(val: str) -> str:
    """Fix common OCR date errors: '07.02,18E9' -> '07/02/1989', etc.

    Handles common OCR garbling patterns in date strings:
    - Letter→digit confusion (E→8, O→0, l→1, etc.) in year part
    - 2-digit year expansion ('89' → '1989')
    - Zero month/day correction
    """
    if not val or not isinstance(val, str):
        return val
    # Normalize separators
    d = val.replace("/", ".").replace("-", ".").replace(",", ".").strip()
    parts = d.split(".")
    if len(parts) != 3:
        return val  # not a recognizable date format
    day, month, year = parts
    # Fix letter→digit OCR errors in the year portion
    # Common confusions on Cameroonian CNI: E↔8, O↔0, l↔1, I↔1, S↔5, Z↔2, B↔8, G↔9
    _digit_map = {
        "E": "8", "O": "0", "l": "1", "I": "1",
        "S": "5", "Z": "2", "B": "8", "G": "9", "A": "4",
    }
    _had_letter_sub = False
    _year_chars = []
    for c in year:
        if c in _digit_map:
            _year_chars.append(_digit_map[c])
            _had_letter_sub = True
        else:
            _year_chars.append(c)
    year = "".join(_year_chars)
    # Heuristic: 4-digit year starting with 1[0-8] is likely a garbled 19XX
    # (the '9' in '19' often gets misread by OCR as another digit, e.g. E→8)
    # Example: '18E9' → after digit_map → '1889' → '1989'
    # IMPORTANT: Only apply this when letter substitutions occurred in the
    # year — without that evidence, changing 1809→1909 would hide an
    # implausible DOB from the plausibility check.
    if (_had_letter_sub
        and len(year) == 4
        and year[0] == "1"
        and year[1].isdigit()
        and int(year[1]) <= 8):
        year = "19" + year[2:]
    # Expand 2-digit year: '89' -> '1989', '23' -> '2023'
    if len(year) == 2 and year.isdigit():
        year = ("19" + year) if int(year) > 30 else ("20" + year)
    # Fix zero month/day
    if month == "00":
        month = "01"
    if day == "00":
        day = "01"
    return f"{day}/{month}/{year}"


CAMEROON_PROFESSIONS = {
    "MENAGERE", "COMMERCANT", "ETUDIANT", "ELEVE", "INGENIEUR",
    "ENSEIGNANT", "FONCTIONNAIRE", "CHAUFFEUR", "AGRICULTEUR",
    "MEDECIN", "AVOCAT", "COMPTABLE", "TECHNICIEN",
    "INFIRMIER", "MILITAIRE", "RETRAITE", "AGENT", "SECRETAIRE",
    "VENDEUR", "CADRE", "OUVRIER", "ETUDIANTE",
}


def _is_stop_word(text: str) -> bool:
    """Check if text is a label/stop word. Uses exact word matching, not substring."""
    text_upper = text.upper().strip()
    words = re.findall(r"\b[A-ZÀ-Ÿ]{3,}\b", text_upper)
    if not words:
        return False
    return any(w in STOP_WORDS for w in words)


def _extract_fields_from_blocks(blocks: list[dict[str, Any]]) -> dict[str, Any]:
    """Extract structured CNI fields using spatial anchoring + regex + MRZ.

    Supports BOTH old and new Cameroonian CNI formats.
    This is a direct port of the proven notebook logic from ocr_utils.py.

    Args:
        blocks: List of dicts with 'text', 'cx', 'cy', 'conf' keys.

    Returns:
        Parsed field dict with per-field value and confidence.
    """
    parsed_data = {
        field: {"value": None, "conf": 0.0}
        for field in CNI_FIELDS
    }
    parsed_data["methode"] = "ANCRAGE_SPATIAL"

    # Detect side — but do NOT suppress fields based on side (new CNI has
    # identity fields on verso too).
    is_verso = any(
        kw in b["text"].upper()
        for b in blocks
        for kw in ["PERE", "FATHER", "MERE", "MOTHER", "AUTORITE", "AUTHORITY",
                   "DELIVRANCE", "UNIQUE", "IDENTIFIER", "ADRESSE", "POSTE"]
    )
    parsed_data["detected_side"] = "verso" if is_verso else "recto"
    if is_verso:
        parsed_data["methode"] = "ANCRAGE_SPATIAL (VERSO)"

    all_dates: list[tuple[str, float]] = []
    _parent_name_labels = {"PERE", "FATHER", "MERE", "MOTHER"}

    for i, block in enumerate(blocks):
        text = block["text"].strip()
        text_upper = text.upper()
        conf = float(block.get("conf", 0.0))

        # --- NIN / CNI number (15+ digits preferred over 9-digit serial) ---
        match_nin = re.search(r"\b(\d{15,})\b", text)
        if match_nin and parsed_data["numero_cni"]["value"] is None:
            parsed_data["numero_cni"] = {"value": match_nin.group(1), "conf": conf}
        elif match_nin and parsed_data["numero_cni"]["value"] is not None:
            existing = str(parsed_data["numero_cni"]["value"])
            if len(match_nin.group(1)) > len(existing):
                parsed_data["numero_cni"] = {"value": match_nin.group(1), "conf": conf}

        # Fallback to 9-digit serial if no NIN yet
        if parsed_data["numero_cni"]["value"] is None:
            match_9 = re.search(r"\b(\d{9})\b", text)
            if match_9:
                parsed_data["numero_cni"] = {"value": match_9.group(1), "conf": conf}

        # --- Dates (collect ALL regardless of side) ---
        # Accept comma as separator too (PaddleOCR v3 sometimes reads
        # "07.02.2018" as "07.02,2018" or "07/02,2018").
        match_date = re.search(r"\b(\d{2}[./,\-]\d{2}[./,\-]\d{2,4})\b", text)
        if match_date:
            raw_date = match_date.group(1).replace(".", "/").replace("-", "/").replace(",", "/")
            parts = raw_date.split("/")
            if len(parts) == 3:
                clean_date = f"{parts[0]}/{parts[1]}/{parts[2]}"
                # Apply date sanitization (fix OCR garbling like 18E9→1989,
                # zero month/day, 2-digit year expansion, etc.)
                clean_date = _sanitize_date(clean_date)
                all_dates.append((clean_date, conf))

        # --- Verso-specific fields (adresse, poste) ---
        if is_verso:
            # Adresse
            if re.search(r"(AD[D]?RES|DRESS|ORESS|DDRES|ADR\.)", text_upper) and parsed_data["adresse"]["value"] is None:
                candidates = []
                for b in blocks:
                    if b["cy"] > block["cy"] + 2 and abs(b.get("cx", 0) - block.get("cx", 0)) < 400:
                        b_text = b.get("text", "").upper()
                        if not _is_stop_word(b.get("text", "")) and not re.search(r"(AD[D]?RES|DRESS|ORESS|DDRES|ADR\.)", b_text):
                            if len(b.get("text", "")) > 2:
                                candidates.append(b)
                if candidates:
                    candidates.sort(
                        key=lambda b: (b["cy"] - block["cy"]) // 10 * 1000 + abs(b.get("cx", 0) - block.get("cx", 0))
                    )
                    meilleur = candidates[0]
                    parsed_data["adresse"] = {"value": meilleur["text"], "conf": meilleur.get("conf", conf)}

            # Poste d'identification
            match_poste = re.search(r"\b([A-Z]{2}\s?[0-9]{2})\b", text)
            if match_poste and parsed_data["poste_identification"]["value"] is None:
                parsed_data["poste_identification"] = {"value": match_poste.group(1).replace(" ", ""), "conf": conf}
            if ("POST" in text_upper or "IDENTIFICATIO" in text_upper) and parsed_data["poste_identification"]["value"] is None:
                candidates = [
                    b for b in blocks
                    if b["cy"] > block["cy"] + 5 and abs(b.get("cx", 0) - block.get("cx", 0)) < 250
                ]
                if candidates:
                    candidates.sort(key=lambda b: b["cy"] - block["cy"])
                    meilleur = candidates[0]
                    if len(meilleur.get("text", "")) <= 6 and not any(kw in meilleur.get("text", "").upper() for kw in ["POST", "IDENT"]):
                        parsed_data["poste_identification"] = {"value": meilleur["text"].replace(" ", ""), "conf": meilleur.get("conf", conf)}

        # --- Identity fields (extract on BOTH sides) ---
        # Sexe (F / M isolated or embedded in noisy OCR text)
        # PaddleOCR v3 sometimes merges small characters with adjacent text,
        # e.g. "KEEESF" instead of isolated "F".
        if text_upper in ["F", "M"] and parsed_data["sexe"]["value"] is None:
            parsed_data["sexe"] = {"value": text_upper, "conf": conf}
        elif parsed_data["sexe"]["value"] is None and len(text) <= 8 and conf > 0.5:
            # Look for F/M at end of short noisy blocks (e.g. "KEEESF")
            # Use \s*$ instead of \b$ because \b fails when preceded by
            # another word character (S before F).
            _sex_match = re.search(r"([FM])\s*$", text_upper)
            if _sex_match:
                parsed_data["sexe"] = {"value": _sex_match.group(1), "conf": conf * 0.85}

        # Taille (e.g. 1.54, 1,75)
        match_taille = re.search(r"\b(1[.,]\d{2})\b", text)
        if match_taille and parsed_data["taille"]["value"] is None:
            parsed_data["taille"] = {"value": match_taille.group(1).replace(",", "."), "conf": conf}

        # Profession
        if text_upper in CAMEROON_PROFESSIONS and parsed_data["profession"]["value"] is None:
            parsed_data["profession"] = {"value": text, "conf": conf}

        # Lieu de naissance (Cameroonian city names)
        # NOTE: Déduplication with nom is done in POST-PROCESSING below,
        # because the NOM spatial anchor may not have been assigned yet
        # when we encounter a city-name block earlier in the loop.
        _city_matches = [c for c in CAMEROON_CITIES if c in text_upper]
        if _city_matches and parsed_data["lieu_naissance"]["value"] is None:
            # Verify it's not inside an MRZ line
            if "<" not in text:
                parsed_data["lieu_naissance"] = {"value": _city_matches[0].title(), "conf": conf}

        # --- Spatial anchor: NOM / SURNAME ---
        is_parent_nom = any(kw in text_upper for kw in _parent_name_labels)
        is_nom_label = (
            ("NOM" in text_upper or "SURNAME" in text_upper)
            and "PRENOM" not in text_upper
            and "PRÉNOM" not in text_upper
            and not is_parent_nom
        )
        if is_nom_label and parsed_data["nom"]["value"] is None:
            candidates = [
                b for b in blocks
                if b["cy"] > block["cy"] + 5 and abs(b.get("cx", 0) - block.get("cx", 0)) < 350
            ]
            if candidates:
                candidates.sort(key=lambda b: b["cy"] - block["cy"])
                meilleur_candidat = candidates[0]
                _cand_upper = meilleur_candidat.get("text", "").upper()
                _is_parent_val = any(kw in _cand_upper for kw in _parent_name_labels)
                if ("PRENOM" not in _cand_upper
                    and "NOM" not in _cand_upper
                    and not _is_parent_val
                    and not _is_stop_word(meilleur_candidat.get("text", ""))):
                    parsed_data["nom"] = {
                        "value": meilleur_candidat["text"],
                        "conf": meilleur_candidat.get("conf", conf),
                    }

        # --- Spatial anchor: PRENOMS / GIVEN NAMES ---
        if ("PRENOM" in text_upper or "GIVEN" in text_upper or "PRÉNOM" in text_upper) and parsed_data["prenom"]["value"] is None:
            candidates = [
                b for b in blocks
                if b["cy"] > block["cy"] + 5 and abs(b.get("cx", 0) - block.get("cx", 0)) < 350
            ]
            if candidates:
                candidates.sort(key=lambda b: b["cy"] - block["cy"])
                meilleur_candidat = candidates[0]
                _cand_upper = meilleur_candidat.get("text", "").upper()
                if "GIVEN" not in _cand_upper and "PRENOM" not in _cand_upper and not _is_stop_word(meilleur_candidat.get("text", "")):
                    parsed_data["prenom"] = {
                        "value": meilleur_candidat["text"],
                        "conf": meilleur_candidat.get("conf", conf),
                    }
                # Anti-duplication: if nom == prenom, try second candidate
                if (parsed_data["nom"]["value"] is not None
                    and parsed_data["prenom"]["value"] is not None
                    and parsed_data["nom"]["value"] == parsed_data["prenom"]["value"]
                    and len(candidates) > 1):
                    meilleur_candidat = candidates[1]
                    _cand_upper2 = meilleur_candidat.get("text", "").upper()
                    if "GIVEN" not in _cand_upper2 and "PRENOM" not in _cand_upper2:
                        parsed_data["prenom"] = {
                            "value": meilleur_candidat["text"],
                            "conf": meilleur_candidat.get("conf", conf),
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
                    # Verso: DOB (earliest or new CNI), delivrance, expiration
                    if parsed_data["date_naissance"]["value"] is None and len(parsed_dates) >= 3:
                        parsed_data["date_naissance"] = {"value": parsed_dates[0][1], "conf": parsed_dates[0][2]}
                    if parsed_data["date_delivrance"]["value"] is None:
                        if len(parsed_dates) >= 3:
                            parsed_data["date_delivrance"] = {"value": parsed_dates[1][1], "conf": parsed_dates[1][2]}
                        elif len(parsed_dates) == 2:
                            parsed_data["date_delivrance"] = {"value": parsed_dates[0][1], "conf": parsed_dates[0][2]}
                    if parsed_data["date_expiration"]["value"] is None:
                        parsed_data["date_expiration"] = {"value": parsed_dates[-1][1], "conf": parsed_dates[-1][2]}
                else:
                    # Recto: earliest = DOB, latest = Expiry
                    if parsed_data["date_naissance"]["value"] is None:
                        parsed_data["date_naissance"] = {"value": parsed_dates[0][1], "conf": parsed_dates[0][2]}
                    if len(parsed_dates) >= 2 and parsed_data["date_expiration"]["value"] is None:
                        parsed_data["date_expiration"] = {"value": parsed_dates[-1][1], "conf": parsed_dates[-1][2]}
                    if len(parsed_dates) >= 3 and parsed_data["date_delivrance"]["value"] is None:
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
    if parsed_data["nom"]["value"] is None or parsed_data["prenom"]["value"] is None:
        caps_blocks = []
        for b in blocks:
            words = re.findall(r"\b[A-ZÀ-Ÿ]{3,}\b", b.get("text", ""))
            if not words:
                continue
            has_stop = any(w in STOP_WORDS for w in words)
            if not has_stop:
                caps_blocks.append(b)

        caps_blocks.sort(key=lambda b: b.get("cy", 0))

        if parsed_data["nom"]["value"] is None and len(caps_blocks) > 0:
            parsed_data["nom"] = {"value": caps_blocks[0]["text"], "conf": caps_blocks[0].get("conf", 0.7)}
            if "HEURISTIQUE" not in parsed_data["methode"]:
                parsed_data["methode"] += " + HEURISTIQUE"

        if parsed_data["prenom"]["value"] is None and len(caps_blocks) > 1:
            second_block = caps_blocks[1]
            if second_block["text"] != parsed_data["nom"]["value"]:
                parsed_data["prenom"] = {"value": second_block["text"], "conf": second_block.get("conf", 0.7)}
                if "HEURISTIQUE" not in parsed_data["methode"]:
                    parsed_data["methode"] += " + HEURISTIQUE"

    # --- Post-processing: deduplicate lieu_naissance vs nom AND prenom ---
    # This MUST run AFTER all fields are assigned (including spatial anchors)
    # because the inline check can't know the final nom/prenom values yet.
    # A city name that exactly matches the holder's surname OR given name
    # is almost certainly a false positive from the same text block.
    if parsed_data["lieu_naissance"]["value"] is not None:
        _lieu_upper = parsed_data["lieu_naissance"]["value"].upper()
        # Exact match only — substring is too aggressive ("BONOU" in "BONOUA")
        for _field in ["nom", "prenom"]:
            if parsed_data[_field]["value"] is not None:
                if _lieu_upper == parsed_data[_field]["value"].upper():
                    logger.debug(
                        f"lieu_naissance '{_lieu_upper}' matches {_field} "
                        f"'{parsed_data[_field]['value']}' — clearing false positive"
                    )
                    parsed_data["lieu_naissance"] = {"value": None, "conf": 0.0}
                    break

    # --- Re-scan for lieu_naissance after dedup ---
    # If dedup cleared a false positive (e.g. "Kana" matched both nom and city),
    # we need to try other city blocks that were skipped because lieu_naissance
    # was already filled. Example: "DSCHANG" exists as block 7 but was never
    # assigned because "KANA" (block 3) was found first.
    if parsed_data["lieu_naissance"]["value"] is None:
        _nom_upper = (parsed_data["nom"]["value"].upper()
                      if parsed_data["nom"]["value"] else "")
        _prenom_upper = (parsed_data["prenom"]["value"].upper()
                         if parsed_data["prenom"]["value"] else "")
        # Collect city-name candidates from all blocks, then pick the one
        # closest to the date_naissance block (on a CNI recto, lieu_naissance
        # is always just below date_naissance). Fallback: sort by cy.
        _city_candidates = []
        _dob_cy = None
        if parsed_data["date_naissance"]["value"] is not None:
            # Find the block whose text contains the detected DOB.
            # The sanitized date uses '/' but the raw OCR block may use
            # '.', ',', or '-' as separators.
            _dob_val = (parsed_data["date_naissance"]["value"]
                        .replace("/", ".").replace(",", "."))
            _dob_year = parsed_data["date_naissance"]["value"][-4:]
            for b in blocks:
                # Normalize block text the same way as _dob_val so commas,
                # dashes etc. don't break the match.
                b_text_norm = (b.get("text", "")
                               .replace(",", ".").replace("-", "."))
                if _dob_val in b_text_norm or _dob_year in b_text_norm:
                    _dob_cy = b.get("cy", 0)
                    break
        for b in blocks:
            b_text_upper = b["text"].strip().upper()
            if "<" in b_text_upper:
                continue  # skip MRZ lines
            _city_matches = [c for c in CAMEROON_CITIES if c in b_text_upper]
            if _city_matches:
                _city_name = _city_matches[0]
                # Skip if it matches nom or prenom (same false-positive risk)
                if _city_name == _nom_upper or _city_name == _prenom_upper:
                    continue
                _city_candidates.append({"name": _city_name, "conf": float(b.get("conf", 0.0)), "cy": b.get("cy", 0)})
        if _city_candidates:
            # Sort by proximity to date_naissance block, or by cy if no DOB found
            if _dob_cy is not None:
                _city_candidates.sort(key=lambda c: abs(c["cy"] - _dob_cy))
            else:
                _city_candidates.sort(key=lambda c: c["cy"])
            best = _city_candidates[0]
            parsed_data["lieu_naissance"] = {
                "value": best["name"].title(),
                "conf": best["conf"],
            }
            if "RESCAN_VILLE" not in parsed_data["methode"]:
                parsed_data["methode"] += " + RESCAN_VILLE"

    # --- DOB plausibility check ---
    # CNI dates of birth before 1920 are almost certainly OCR digit→digit
    # errors (e.g. "2018" read as "1909"). A person born before 1920 would
    # be 106+ years old — extremely rare on a current CNI.
    # We can't auto-fix digit→digit errors, but we flag them for GLM fallback.
    if parsed_data["date_naissance"]["value"] is not None:
        try:
            _dob_parts = parsed_data["date_naissance"]["value"].split("/")
            if len(_dob_parts) == 3:
                _dob_year = int(_dob_parts[2])
                if _dob_year < 1920:
                    logger.warning(
                        f"Implausible DOB year {_dob_year} in "
                        f"'{parsed_data['date_naissance']['value']}' — "
                        f"likely OCR digit error, flagging for GLM fallback"
                    )
                    # Don't delete — keep it but mark for review
                    if "DOB_SUSPECT" not in parsed_data["methode"]:
                        parsed_data["methode"] += " + DOB_SUSPECT"
        except (ValueError, IndexError):
            pass

    # Return ALL 12 CNI fields, even those with value=None.
    # Downstream consumers (API, frontend) need the full schema to know
    # which fields are expected, even when not extracted.
    return parsed_data


# ---------------------------------------------------------------------------
# Image preprocessing for better OCR detection
# ---------------------------------------------------------------------------
def _enhance_for_ocr(img: np.ndarray) -> np.ndarray:
    """Apply selective contrast enhancement for very dark images only.

    CLAHE (even conservative clipLimit=1.0) was found to DEGRADE OCR
    results on normal CNI photos by distorting thin text strokes
    (e.g. "KANA" → "NATA", "EDITH" → "KANA"). It is only applied when
    the image is genuinely underexposed (mean brightness < 100).

    Args:
        img: BGR numpy array (aligned card image).

    Returns:
        Enhanced BGR numpy array, or original if already well-exposed.
    """
    # Measure average brightness — only enhance very dark images
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mean_brightness = float(np.mean(gray))

    # Well-exposed document (mean > 100 out of 255): skip enhancement
    if mean_brightness > 100:
        return img

    # Dark image: apply very conservative CLAHE
    logger.info(f"Low-contrast image detected (brightness={mean_brightness:.0f}), applying CLAHE")
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=1.0, tileGridSize=(8, 8))
    l_enhanced = clahe.apply(l_channel)
    lab_enhanced = cv2.merge([l_enhanced, a_channel, b_channel])
    return cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)


class OCRService:
    """OCR service for document text extraction."""

    def __init__(self):
        self.confidence_threshold = settings.OCR_CONFIDENCE_THRESHOLD
        self.user_edit_threshold = settings.OCR_USER_EDIT_THRESHOLD

    def extract_from_bytes(self, image_bytes: bytes) -> dict[str, Any]:
        """Extract text from image bytes using PaddleOCR with alignment."""
        start_time = time.perf_counter()

        # Convert bytes to numpy array (BGR for OpenCV)
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_arr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

        result = self._extract_from_array(img_arr)
        result["process_time_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
        return result

    def extract_from_path(self, image_path: Path) -> dict[str, Any]:
        """Extract text from image file using PaddleOCR with alignment."""
        start_time = time.perf_counter()

        img_arr = cv2.imread(str(image_path))
        if img_arr is None:
            logger.error(f"Failed to read image: {image_path}")
            return {
                "fields": {f: {"value": None, "conf": 0.0} for f in CNI_FIELDS},
                "blocks": [],
                "engine": "paddleocr_error",
                "needs_glm_fallback": True,
                "avg_confidence": 0.0,
                "process_time_ms": 0.0,
            }

        result = self._extract_from_array(img_arr)
        result["process_time_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
        return result

    def _extract_from_array(self, img_arr: np.ndarray) -> dict[str, Any]:
        """Run full OCR pipeline: align -> enhance -> OCR -> extract fields."""
        _t0 = time.perf_counter()

        # Step 1: Align the card image
        aligned = align_card_image(img_arr)
        if aligned is None:
            aligned = img_arr
            logger.debug("Card alignment failed, using original image")
        _t_align = time.perf_counter()

        # Step 2: Enhance contrast for better text detection
        enhanced = _enhance_for_ocr(aligned)
        _t_enhance = time.perf_counter()

        # Step 3: Run PaddleOCR
        ocr = get_shared_paddle_ocr()
        if ocr is None:
            logger.warning("PaddleOCR not available, returning empty results")
            return {
                "fields": {f: {"value": None, "conf": 0.0} for f in CNI_FIELDS},
                "blocks": [],
                "engine": "paddleocr_unavailable",
                "needs_glm_fallback": True,
                "avg_confidence": 0.0,
            }

        try:
            # Ensure image is valid and has expected dimensions
            if enhanced is None or enhanced.size == 0:
                logger.error("Empty image passed to OCR")
                return {
                    "fields": {f: {"value": None, "conf": 0.0} for f in CNI_FIELDS},
                    "blocks": [],
                    "engine": "paddleocr_error",
                    "needs_glm_fallback": True,
                    "avg_confidence": 0.0,
                }

            # PaddleOCR v3: use predict() instead of deprecated ocr().
            # The cls parameter was removed in v3 — textline orientation is
            # controlled via use_textline_orientation at init time.
            results = ocr.predict(enhanced)
            _t_ocr = time.perf_counter()
            logger.info(
                f"OCR pipeline timing: align={(_t_align-_t0)*1000:.0f}ms, "
                f"enhance={(_t_enhance-_t_align)*1000:.0f}ms, "
                f"predict={(_t_ocr-_t_enhance)*1000:.0f}ms"
            )

        except Exception as exc:
            logger.error(f"OCR total failure: {exc}", exc_info=True)
            return {
                "fields": {f: {"value": None, "conf": 0.0} for f in CNI_FIELDS},
                "blocks": [],
                "engine": "paddleocr_error",
                "needs_glm_fallback": True,
                "avg_confidence": 0.0,
            }

        if not results or not results[0].get("rec_texts"):
            logger.warning("No text detected in image")
            return {
                "fields": {f: {"value": None, "conf": 0.0} for f in CNI_FIELDS},
                "blocks": [],
                "engine": "paddleocr",
                "needs_glm_fallback": True,
                "avg_confidence": 0.0,
            }

        # Step 4: Build blocks from OCR results
        blocks = []
        first_page = results[0]

        if hasattr(first_page, "get"):
            # PaddleOCR v3 format
            texts = first_page.get("rec_texts") or []
            scores = first_page.get("rec_scores") or []
            polys = first_page.get("rec_polys") or []

            for idx, text in enumerate(texts):
                cleaned = str(text).strip()
                if not cleaned:
                    continue
                try:
                    conf = float(scores[idx]) if idx < len(scores) else 0.0
                except Exception:
                    conf = 0.0

                center_x = 0.0
                center_y = 0.0
                if idx < len(polys):
                    try:
                        poly = polys[idx]
                        center_x = float(sum(p[0] for p in poly) / len(poly))
                        center_y = float(sum(p[1] for p in poly) / len(poly))
                    except Exception:
                        pass

                blocks.append({"text": cleaned, "cx": center_x, "cy": center_y, "conf": conf})
        else:
            # Legacy format
            for el in first_page:
                coords, (text, conf) = el[0], el[1]
                center_x = sum(p[0] for p in coords) / 4
                center_y = sum(p[1] for p in coords) / 4
                blocks.append({"text": text.strip(), "cx": center_x, "cy": center_y, "conf": float(conf)})

        # Step 5: Extract structured fields using spatial logic
        _t_extract_start = time.perf_counter()
        spatial_data = _extract_fields_from_blocks(blocks)
        _t_extract = time.perf_counter()
        logger.debug(f"Field extraction timing: {(_t_extract-_t_extract_start)*1000:.0f}ms")

        # Extract MRZ data if present (for verso)
        mrz_data = extract_mrz(blocks)
        if mrz_data:
            spatial_data["mrz"] = mrz_data

        # Build the flat fields dict — always include ALL 12 CNI fields,
        # even those with value=None, so the frontend knows the full schema.
        fields: dict[str, dict[str, Any]] = {}
        for field_name in CNI_FIELDS:
            if field_name in spatial_data and isinstance(spatial_data[field_name], dict):
                fields[field_name] = spatial_data[field_name]
            else:
                fields[field_name] = {"value": None, "conf": 0.0}

        # Calculate average confidence — only over fields that have a value
        # (None fields should NOT drag down the average)
        filled_confidences = [
            f.get("conf", 0.0) for f in fields.values()
            if f.get("value") is not None
        ]
        avg_confidence = (
            sum(filled_confidences) / len(filled_confidences)
            if filled_confidences
            else 0.0
        )

        filled_count = len(filled_confidences)  # same as sum(1 for f in fields.values() if f.get("value") is not None)

        # Determine if fallback is needed — consider confidence, fill rate,
        # AND data quality flags (e.g. implausible DOB year from OCR errors).
        fill_rate = filled_count / len(CNI_FIELDS)
        _has_dob_suspect = "DOB_SUSPECT" in spatial_data.get("methode", "")
        needs_fallback = (
            avg_confidence < self.confidence_threshold
            or fill_rate < 0.5  # fewer than 6 of 12 fields filled → fallback
            or _has_dob_suspect  # implausible DOB year → needs review
        )
        logger.info(
            f"OCR extracted {filled_count}/{len(CNI_FIELDS)} fields, "
            f"avg_confidence={avg_confidence:.2f}, needs_glm_fallback={needs_fallback}, "
            f"side={spatial_data.get('detected_side', 'unknown')}, "
            f"method={spatial_data.get('methode', 'unknown')}"
        )

        return {
            "fields": fields,
            "blocks": blocks,
            "engine": "paddleocr",
            "needs_glm_fallback": needs_fallback,
            "avg_confidence": avg_confidence,
            "detected_side": spatial_data.get("detected_side", "unknown"),
            "extraction_method": spatial_data.get("methode", ""),
        }


# Module-level singleton instance
ocr_service = OCRService()
