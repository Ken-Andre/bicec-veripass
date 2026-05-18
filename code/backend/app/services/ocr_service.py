"""OCR Service for document text extraction.

Uses PaddleOCR as primary engine with GLM-OCR fallback for low confidence.
Improved field extraction using spatial anchoring (label → value) based on
CNI Camerounaise layout.

This module ports the proven extraction logic from paddleocr_test/notebooks/ocr_utils.py
into the production backend, adding image alignment, MRZ parsing, and timing metrics.
"""

from __future__ import annotations

import io
import re
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
# Warmup image generation
# ---------------------------------------------------------------------------
def generate_warmup_image() -> np.ndarray:
    """Generate a synthetic text image for PaddleOCR predict() warmup.

    Creates a white image with black text lines mimicking a document layout.
    This ensures both the detection AND recognition sub-models are exercised
    during startup — a pure noise or black image short-circuits detection,
    leaving recognition unwarmed and causing garbage results on the first
    real OCR request.

    Returns:
        BGR numpy array suitable for ocr.predict().
    """
    from PIL import ImageDraw, ImageFont

    img = Image.new("RGB", (600, 380), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Try a monospace font; fall back to default if unavailable
    try:
        font = ImageFont.truetype("DejaVuSansMono.ttf", 18)
    except (IOError, OSError):
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 18)
        except (IOError, OSError):
            font = ImageFont.load_default()

    # Draw text lines similar to a CNI card layout
    lines = [
        "REPUBLIQUE DU CAMEROUN",
        "REPUBLIC OF CAMEROON",
        "NOM / SURNAME: DUPONT",
        "PRENOMS / GIVEN NAMES: MARIE",
        "DATE DE NAISSANCE: 15/03/1990",
        "LIEU DE NAISSANCE: YAOUNDE",
        "SEXE: F   TAILLE: 1.65",
        "PROFESSION: ENSEIGNANTE",
    ]
    y = 20
    for line in lines:
        draw.text((30, y), line, fill=(0, 0, 0), font=font)
        y += 36

    # Convert PIL RGB → OpenCV BGR
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

# ---------------------------------------------------------------------------
# Card alignment (perspective correction)
# ---------------------------------------------------------------------------
# Image width for OCR pipeline — configurable via OCR_IMAGE_WIDTH env var (default 600).
# Profiling showed: 800w → ~94s predict(), 600w → ~44s predict() (2.1x faster,
# same 12 blocks detected). See config.py for the setting definition.


def align_card_image(image_input: str | np.ndarray | Image.Image) -> np.ndarray | None:
    """Detect card in image, crop and flatten via perspective transform.

    Args:
        image_input: File path (str), numpy array (BGR), or PIL Image.

    Returns:
        Aligned BGR numpy array normalized to OCR_IMAGE_WIDTH, or None on failure.
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

    _width = settings.OCR_IMAGE_WIDTH

    if screen_cnt is None:
        # Fallback: just normalize width
        fallback_ratio = _width / float(orig.shape[1])
        fallback_height = int(orig.shape[0] * fallback_ratio)
        return cv2.resize(orig, (_width, fallback_height))

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

    # Sanity check: CNI cards (ISO 7810 ID-1) are landscape (~1.586:1).
    # If the warp produces a portrait or extreme aspect ratio, the contour
    # was likely wrong (e.g. a vertical strip or text block on the card).
    # In that case, fall back to simple resize to avoid destroying the image.
    _warp_ratio = maxWidth / max(maxHeight, 1)
    _CNI_MIN_RATIO = 1.1  # card must be noticeably landscape (1.586:1 is standard)
    _CNI_MAX_RATIO = 2.5  # extremely wide warp is also wrong (e.g. horizontal strip)
    if _warp_ratio < _CNI_MIN_RATIO or _warp_ratio > _CNI_MAX_RATIO:
        logger.info(
            f"Aligned aspect ratio {_warp_ratio:.2f} outside expected range "
            f"[{_CNI_MIN_RATIO}, {_CNI_MAX_RATIO}] (CNI ~1.6) — "
            f"falling back to simple resize"
        )
        fallback_ratio = _width / float(orig.shape[1])
        fallback_height = int(orig.shape[0] * fallback_ratio)
        return cv2.resize(orig, (_width, fallback_height))

    ratio_warp = _width / float(maxWidth)
    standard_height = int(maxHeight * ratio_warp)
    return cv2.resize(warped, (_width, standard_height))


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
    "SURNAME", "GIVEN", "NAMES", "PROFESSION", "OCCUPATION", "MENAGERE", "TRAVAIL",
    "INGENIEUR", "REPUBLIQUEDUCAMEROUN", "REPUBLICOFCAMEROON", "CARTENATIONALEDIDENTITE",
    # Parent labels — stored BOTH as compound strings AND individual tokens because
    # _is_stop_word() extracts individual words via regex \b[A-ZÀ-Ÿ]{3,}\b.  Without
    # the individual tokens "PERE"/"MERE" etc., a block containing just "PERE" would
    # NOT match STOP_WORDS and would leak into nom/prenom candidates.
    "PERE/FATHER", "MERE/MOTHER", "PERE", "MERE", "FATHER", "MOTHER",
    "S.P/S.M", "AUTORITE", "AUTHORITY", "AUTORITE/AUTHORITY", "DATEDE", "DELIVRANCE",
    "POSTEDIDENTIFICATION", "DATEOFISSUE", "IDENTIFSCATIONPOSS", "DATEDEXPIRATION/",
    "DENTIFLANTUNIQUE", "DATEOEEXPIRY", "UNIOUEIDENDFIE", "DENTIFIANURIQUE",
    "OHOUEIDENTIFIER", "FENO", "PRÉNOMS", "PRENOMS", "PRÉNOM", "PRENOM",
    "HEIGHT", "TAILLE", "ADRESSE", "ADDRESS", "DATE", "BIRTH", "NAISSANCE",
    "LIEU", "PLACE", "PLACEOFBIRTH", "LIEUDENAISSANCE", "NUMERO", "NUMBER",
    "IDENTIFIANT", "UNIQUE", "IDENTIFIER", "POSTE", "IDENTIFICATION",
    "NATIONALIDENTITY", "CARTENATIONALED'IDENTITE", "CNI",
    "CARTENATIONALED", "IDENTITE", "DIDENTITE", "NATIONALED",
}

CNI_FIELDS = [
    "nom", "prenom", "numero_cni", "date_naissance", "lieu_naissance",
    "sexe", "taille", "profession", "date_delivrance", "date_expiration",
    "sp", "adresse", "autorite_nom", "poste_identification", "pere", "mere",
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
    # Normalize separators (including colon — PaddleOCR v3 at 600w reads
    # "07.02:1989" where the colon replaces the final dot).
    d = val.replace("/", ".").replace("-", ".").replace(",", ".").replace(":", ".").strip()
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


# ---------------------------------------------------------------------------
# Positional template zones for CNI field extraction
# ---------------------------------------------------------------------------
# Instead of matching specific values (city names, profession names),
# we use spatial zones on the aligned card image. Each zone defines where
# a particular field's VALUE appears on the card. Content validators check
# that the block text matches the expected FORMAT (date, name, etc.) without
# relying on predefined value lists.
#
# Zone format: (field_name, cy_min_frac, cy_max_frac, cx_min_frac, cx_max_frac, validator_key)
# Positions are fractions of the aligned image dimensions.
# Calibrated on standard CNI Camerounaise (ISO 7810 ID-1, ~86×54mm).

CNI_RECTO_ZONES = [
    # Zone            cy_min  cy_max  cx_min  cx_max  validator
    ("nom",            0.18,   0.32,   0.05,   0.65, "is_name"),
    ("prenom",         0.30,   0.45,   0.05,   0.65, "is_name"),
    ("date_naissance", 0.42,   0.58,   0.10,   0.65, "is_date"),
    ("lieu_naissance", 0.53,   0.66,   0.05,   0.65, "is_place"),
    ("sexe",           0.60,   0.75,   0.05,   0.45, "is_sex"),
    ("taille",         0.60,   0.75,   0.35,   0.65, "is_height"),
    ("profession",     0.68,   0.85,   0.05,   0.65, "is_profession"),
]

CNI_VERSO_ZONES = [
    # Zone             cy_min  cy_max  cx_min  cx_max  validator
    # NOTE: nom/prenom intentionally EXCLUDED from verso zones.
    # On the Cameroonian CNI verso, the top section contains PARENT names
    # (NOM DU PERE / NOM DE LA MERE), not the cardholder's own name.
    # The cardholder's nom/prenom must come from the recto side only.
    ("sp",               0.33,   0.42,   0.02,   0.25, "is_sp"),
    ("lieu_naissance",  0.38,   0.55,   0.02,   0.25, "is_place"),
    ("autorite_nom",     0.42,   0.56,   0.20,   0.55, "is_name"),
    ("date_delivrance", 0.33,   0.48,   0.40,   0.75, "is_date"),
    ("date_expiration", 0.46,   0.58,   0.40,   0.75, "is_date"),
    ("numero_cni",      0.48,   0.60,   0.60,   0.95, "is_nin"),
    # adresse is below the authority signature area, near bottom-left.
    # Authority name (e.g. "Martin MBARGA NGUELE") sits at cy≈0.56 — skip it.
    # NOTE: Low detection rate at 600w — PaddleOCR often misses address text.
    # Falls back to legacy label-based extraction when ADRESSE label is detected.
    ("adresse",          0.68,   0.82,   0.02,   0.40, "is_address"),
    # poste_identification: short code (e.g. "CE012") on the right side.
    # NOTE: Low detection rate at 600w — falls back to legacy label-based extraction.
    ("poste_identification", 0.60, 0.75, 0.55, 0.85, "is_poste"),
]


# ---------------------------------------------------------------------------
# Positional template zones for BILL field extraction (ENEO / CAMWATER)
# ---------------------------------------------------------------------------
# Bills are A4 landscape documents — NOT card-shaped.
# Positions calibrated on ENEO Facture d'Electricite (standard layout).
# Zone format: (field_name, cy_min, cy_max, cx_min, cx_max, validator_key)

BILL_ENEO_ZONES = [
    # Zone                    cy_min  cy_max  cx_min  cx_max  validator
    ("contrat_number",         0.18,   0.32,   0.02,   0.35, "is_contract_number"),
    ("compteur_number",        0.18,   0.32,   0.35,   0.65, "is_meter_number"),
    ("date_releve",            0.22,   0.30,   0.35,   0.65, "is_bill_date"),
    ("date_facturation",       0.26,   0.34,   0.35,   0.65, "is_bill_date"),
    ("date_limite_paiement",   0.15,   0.35,   0.70,   0.98, "is_bill_date"),
    ("agence",                 0.32,   0.42,   0.02,   0.35, "is_bill_agence"),
    ("ville",                  0.38,   0.48,   0.02,   0.35, "is_bill_place"),
    ("total_ttc",              0.85,   0.98,   0.30,   0.70, "is_bill_amount"),
    ("kwh_consommes",          0.42,   0.55,   0.40,   0.60, "is_bill_amount"),
    ("categorie",              0.08,   0.18,   0.70,   0.98, "is_bill_category"),
]

BILL_CAMWATER_ZONES = [
    # Zone                    cy_min  cy_max  cx_min  cx_max  validator
    ("contrat_number",         0.18,   0.32,   0.02,   0.35, "is_contract_number"),
    ("compteur_number",        0.18,   0.32,   0.35,   0.65, "is_meter_number"),
    ("date_facturation",       0.26,   0.34,   0.35,   0.65, "is_bill_date"),
    ("date_limite_paiement",   0.15,   0.35,   0.70,   0.98, "is_bill_date"),
    ("total_ttc",              0.85,   0.98,   0.30,   0.70, "is_bill_amount"),
    ("consommation_m3",        0.42,   0.55,   0.40,   0.60, "is_bill_amount"),
]

BILL_FIELDS = {
    "BILL_ENEO": [
        "contrat_number", "compteur_number", "date_releve", "date_facturation",
        "date_limite_paiement", "agence", "ville", "total_ttc", "kwh_consommes", "categorie",
    ],
    "BILL_CAMWATER": [
        "contrat_number", "compteur_number", "date_facturation",
        "date_limite_paiement", "total_ttc", "consommation_m3",
    ],
}


# ---------------------------------------------------------------------------
# Content validators — check FORMAT, not specific values
# ---------------------------------------------------------------------------
def _is_date_text(text: str) -> bool:
    """Check if text contains a date pattern."""
    return bool(re.search(r"\b\d{2}[./,\-:]\d{2}[./,\-:]\d{2,4}\b", text))


def _is_alphabetic_text(text: str, min_len: int = 2, reject_numbers: bool = False) -> bool:
    """Check if text is mostly alphabetic (name, place, profession)."""
    t = text.strip()
    if len(t) < min_len:
        return False
    if _is_stop_word(t):
        return False
    if _is_date_text(t):
        return False
    if reject_numbers and re.search(r"\b\d{5,}\b", t):
        return False
    if "<" in t:
        return False  # MRZ line
    alpha_count = sum(1 for c in t if c.isalpha() or c in " -'àâäéèêëîïôöùûüÿç")
    return alpha_count / max(len(t), 1) >= 0.7


def _is_name_text(text: str) -> bool:
    """Check if text looks like a person's name."""
    return _is_alphabetic_text(text, min_len=2)


def _is_sex_text(text: str) -> bool:
    """Check if text indicates sex (F or M)."""
    t = text.upper().strip()
    if t in ("F", "M"):
        return True
    if len(text) <= 8:
        return bool(re.search(r"([FM])\s*$", t))
    return False


def _is_height_text(text: str) -> bool:
    """Check if text contains a height measurement (1.XX)."""
    return bool(re.search(r"\b1[.,]\d{2}\b", text))


def _is_nin_text(text: str) -> bool:
    """Check if text contains a national ID number (9+ digits)."""
    return len(re.sub(r"\D", "", text)) >= 9


def _is_place_text(text: str) -> bool:
    """Check if text looks like a place name."""
    return _is_alphabetic_text(text, min_len=2)


def _is_profession_text(text: str) -> bool:
    """Check if text looks like a profession."""
    return _is_alphabetic_text(text, min_len=3, reject_numbers=True)


def _is_address_text(text: str) -> bool:
    """Check if text looks like an address (requires digit or address keyword).

    Addresses on Cameroonian CNI typically contain numbers or keywords
    like QUARTIER, RUE, CARREFOUR, B.P. Pure alphabetic text (person names)
    should NOT match — they are authority names, not addresses.
    """
    t = text.strip()
    if len(t) < 3:
        return False
    if _is_stop_word(t):
        return False
    if _is_date_text(t):
        return False
    if "<" in t:
        return False  # MRZ line
    # Must contain at least one digit OR an address-related keyword
    has_digit = any(c.isdigit() for c in t)
    _addr_keywords = ["QUARTIER", "QRT", "RUE", "CARREFOUR", "B.P", "BP", "LOT", "ARROND"]
    has_addr_kw = any(kw in t.upper() for kw in _addr_keywords)
    if not (has_digit or has_addr_kw):
        return False
    alpha_count = sum(1 for c in t if c.isalpha() or c in " -'àâäéèêëîïôöùûüÿç")
    return alpha_count / max(len(t), 1) >= 0.3


def _is_poste_text(text: str) -> bool:
    """Check if text looks like a poste d'identification code (e.g. CE012, CM24)."""
    t = text.strip().upper()
    # Typical format: 2-3 uppercase letters + 2-3 digits, or short alphanumeric
    return bool(re.match(r'^[A-Z]{1,4}[0-9]{2,4}$', t)) or (len(t) <= 6 and len(re.sub(r'\D', '', t)) >= 2 and len(re.sub(r'[^A-Z]', '', t)) >= 1)


def _is_sp_text(text: str) -> bool:
    """Check if text looks like an SP (situation professionnelle) number — 6 digits."""
    cleaned = re.sub(r"\D", "", text)
    return len(cleaned) == 6


# ---------------------------------------------------------------------------
# Bill-specific validators (ENEO / CAMWATER)
# ---------------------------------------------------------------------------
def _is_contract_number_text(text: str) -> bool:
    """Validate a utility contract number (8-12 digits)."""
    cleaned = re.sub(r"\D", "", text)
    return 8 <= len(cleaned) <= 12


def _is_meter_number_text(text: str) -> bool:
    """Validate a meter/compteur number (10-11 digits)."""
    cleaned = re.sub(r"\D", "", text)
    return 10 <= len(cleaned) <= 11


def _is_bill_amount_text(text: str) -> bool:
    """Validate a bill amount (number with optional separators)."""
    # Extract just the numeric part from text like "TOTAL TTC / WITH TAX: 35.987"
    nums = re.findall(r"\d[\d\s.,]*\d|\d", text)
    if not nums:
        return False
    # Try each number found
    for num_str in nums:
        cleaned = num_str.replace(" ", "").replace(",", ".")
        try:
            amount = float(cleaned)
            if 0 < amount < 10_000_000:
                return True
        except (ValueError, TypeError):
            continue
    return False


def _is_bill_date_text(text: str) -> bool:
    """Validate a bill date (DD/MM/YYYY or DD-MM-YYYY)."""
    patterns = [
        r"\b\d{2}/\d{2}/\d{4}\b",
        r"\b\d{2}-\d{2}-\d{4}\b",
        r"\b\d{2}\.\d{2}\.\d{4}\b",
    ]
    return any(re.search(p, text) for p in patterns)


def _is_bill_agence_text(text: str) -> bool:
    """Validate an agency name (alphabetic, 3+ chars)."""
    return _is_alphabetic_text(text, min_len=3)


def _is_bill_place_text(text: str) -> bool:
    """Validate a city/ville name (alphabetic)."""
    return _is_alphabetic_text(text, min_len=2)


def _is_bill_category_text(text: str) -> bool:
    """Validate a bill category (e.g. LV - DOMESTIC)."""
    t = text.strip().upper()
    return len(t) >= 3 and any(kw in t for kw in ["DOMESTIC", "COMMERCIAL", "INDUSTRIEL", "LV", "MV", "HV"])


_VALIDATORS = {
    "is_name": _is_name_text,
    "is_date": _is_date_text,
    "is_place": _is_place_text,
    "is_sex": _is_sex_text,
    "is_height": _is_height_text,
    "is_nin": _is_nin_text,
    "is_profession": _is_profession_text,
    "is_address": _is_address_text,
    "is_poste": _is_poste_text,
    "is_sp": _is_sp_text,
    "is_contract_number": _is_contract_number_text,
    "is_meter_number": _is_meter_number_text,
    "is_bill_amount": _is_bill_amount_text,
    "is_bill_date": _is_bill_date_text,
    "is_bill_agence": _is_bill_agence_text,
    "is_bill_place": _is_bill_place_text,
    "is_bill_category": _is_bill_category_text,
}


# ---------------------------------------------------------------------------
# Field format validators — last-chance gate before returning PaddleOCR data.
# Each validator returns True if the value matches the expected format.
# Banking requirement: reject (None) anything that doesn't pass — fail safe.
# ---------------------------------------------------------------------------
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
    "sp": lambda v: len(re.sub(r"\D", "", v)) == 6,
    "adresse": lambda v: any(c.isdigit() for c in v) or any(kw in v.upper() for kw in ["QUARTIER", "RUE", "B.P", "BP", "LOT", "ARROND", "MELEN", "BASTOS", "AKWA"]),
    "autorite_nom": lambda v: _is_alphabetic_text(v, min_len=3),
    "poste_identification": lambda v: bool(re.match(r"^[A-Z]{1,4}\d{2,4}$", v.strip().upper())),
    "pere": lambda v: _is_alphabetic_text(v, min_len=2),
    "mere": lambda v: _is_alphabetic_text(v, min_len=2),
}


def _validate_field_value(field_name: str, value: str) -> str | None:
    """Validate a single field value against its format rules.

    Returns the value unchanged if it passes validation, or None if it doesn't.
    """
    validator = FIELD_VALIDATORS_PADDLE.get(field_name)
    if validator is None:
        return value
    return value if validator(value) else None


# ---------------------------------------------------------------------------
# GLM-OCR utilities (re-exported from glm_utils to avoid circular imports)
# ---------------------------------------------------------------------------
from app.services.glm_utils import (  # noqa: E402, F401
    DEFAULT_GLM_RECTO_PROMPT,
    DEFAULT_GLM_VERSO_PROMPT,
    normalize_glm_key as _normalize_glm_key,
    calculate_glm_confidence as _calculate_glm_confidence,
    parse_plaintext_fields as _parse_plaintext_fields,
    sanitize_glm_output,
)


# ---------------------------------------------------------------------------
# Value extractors — pull the specific value from block text
# ---------------------------------------------------------------------------
def _extract_date_value(text: str) -> str | None:
    """Extract and sanitize a date value from text."""
    match = re.search(r"\b(\d{2}[./,\-:]\d{2}[./,\-:]\d{2,4})\b", text)
    if match:
        raw_date = match.group(1).replace(".", "/").replace("-", "/").replace(",", "/").replace(":", "/")
        parts = raw_date.split("/")
        if len(parts) == 3:
            clean_date = f"{parts[0]}/{parts[1]}/{parts[2]}"
            return _sanitize_date(clean_date)
    return None


def _extract_sex_value(text: str) -> str | None:
    """Extract sex (F/M) from text."""
    t = text.upper().strip()
    if t in ("F", "M"):
        return t
    if len(text) <= 8:
        m = re.search(r"([FM])\s*$", t)
        if m:
            return m.group(1)
    return None


def _extract_height_value(text: str) -> str | None:
    """Extract height (1.XX) from text."""
    # Remove units and common noise
    t = text.lower().replace(" ", "").replace("m", "").replace("s", "").replace("e", "")
    # Keep only digits and decimal if present
    nums = "".join([c for c in t if c.isdigit() or c == "."])
    if not nums:
        return None
    try:
        # Handle formats like "1.75" or "175"
        val = float(nums)
        if 1.4 <= val <= 2.2: # matches 1.75m
            return f"{val:.2f}m"
        if 140 <= val <= 220: # matches 175cm
            return f"{val/100:.2f}m"
    except ValueError:
        pass
    return None


def _extract_nin_value(text: str) -> str | None:
    """Extract NIN (15+ digits preferred, fallback 9 digits) from text."""
    m = re.search(r"\b(\d{15,})\b", text)
    if m:
        return m.group(1)
    m = re.search(r"\b(\d{9})\b", text)
    if m:
        return m.group(1)
    return None


def _extract_poste_value(text: str) -> str | None:
    """Extract poste d'identification code, stripping spaces."""
    t = text.strip().replace(" ", "")
    if len(t) <= 6 and len(re.sub(r'\D', '', t)) >= 2:
        return t
    return None


def _extract_sp_value(text: str) -> str | None:
    """Extract SP (situation professionnelle) — 6-digit number."""
    cleaned = re.sub(r"\D", "", text)
    if len(cleaned) == 6:
        return cleaned
    return None


def _extract_by_template(
    blocks: list[dict[str, Any]],
    img_height: int,
    img_width: int,
    side: str,
) -> dict[str, Any]:
    """Extract CNI fields using positional template zones.

    PRIMARY extraction method: for each field, find the OCR block whose
    centroid falls within the expected spatial zone on the aligned card AND
    passes the content validator. This approach doesn't depend on label
    detection (PaddleOCR often misses small label text) or predefined value
    lists (cities, professions) — it uses POSITION + FORMAT only.

    Args:
        blocks: OCR blocks with 'text', 'cx', 'cy', 'conf' keys.
        img_height: Height of the aligned image in pixels.
        img_width: Width of the aligned image in pixels.
        side: "recto" or "verso".

    Returns:
        Parsed field dict with per-field value and confidence.
        Only fields that were successfully extracted are populated;
        others remain None.
    """
    parsed = {field: {"value": None, "conf": 0.0} for field in CNI_FIELDS}
    parsed["methode"] = "TEMPLATE_POSITIONNEL"
    parsed["detected_side"] = side

    zones = CNI_RECTO_ZONES if side == "recto" else CNI_VERSO_ZONES

    for field_name, cy_min, cy_max, cx_min, cx_max, validator_key in zones:
        validator = _VALIDATORS.get(validator_key)
        if validator is None:
            continue

        # Convert fractional zone to pixel coordinates
        cy_lo = cy_min * img_height
        cy_hi = cy_max * img_height
        cx_lo = cx_min * img_width
        cx_hi = cx_max * img_width

        # Find blocks within this zone that pass the validator
        candidates = []
        for b in blocks:
            b_cy = b.get("cy", 0)
            b_cx = b.get("cx", 0)
            if not (cy_lo <= b_cy <= cy_hi and cx_lo <= b_cx <= cx_hi):
                continue
            b_text = b.get("text", "")
            if not validator(b_text):
                continue
            # Score: prefer blocks closer to zone center
            zone_cx = (cx_lo + cx_hi) / 2
            zone_cy = (cy_lo + cy_hi) / 2
            dist = ((b_cx - zone_cx) ** 2 + (b_cy - zone_cy) ** 2) ** 0.5
            candidates.append((b, dist))

        if not candidates:
            continue

        # Sort by distance to zone center (closest first)
        candidates.sort(key=lambda x: x[1])
        best_block = candidates[0][0]
        best_text = best_block["text"].strip()
        best_conf = float(best_block.get("conf", 0.0))

        # Apply field-specific extraction
        value: str | None = best_text  # default: use the whole text
        if field_name in ("date_naissance", "date_delivrance", "date_expiration"):
            value = _extract_date_value(best_text)
            if value is None:
                continue  # validator said yes but extractor said no — skip
        elif field_name == "sexe":
            value = _extract_sex_value(best_text)
            if value is None:
                continue
        elif field_name == "taille":
            value = _extract_height_value(best_text)
            if value is None:
                continue
        elif field_name == "numero_cni":
            value = _extract_nin_value(best_text)
            if value is None:
                continue
        elif field_name == "poste_identification":
            value = _extract_poste_value(best_text)
            if value is None:
                continue
        elif field_name == "sp":
            value = _extract_sp_value(best_text)
            if value is None:
                continue

        parsed[field_name] = {"value": value, "conf": best_conf}

    return parsed


def _extract_bill_by_template(
    blocks: list[dict[str, Any]],
    img_height: int,
    img_width: int,
    doc_type: str,
) -> dict[str, Any]:
    """Extract bill fields using positional template zones.

    Works like _extract_by_template but for ENEO/CAMWATER bills.
    Bills are A4 landscape — no card alignment applied.

    Args:
        blocks: OCR blocks with 'text', 'cx', 'cy', 'conf' keys.
        img_height: Height of the image in pixels.
        img_width: Width of the image in pixels.
        doc_type: "BILL_ENEO" or "BILL_CAMWATER".

    Returns:
        Parsed field dict with per-field value and confidence.
    """
    bill_fields = BILL_FIELDS.get(doc_type, [])
    parsed = {field: {"value": None, "conf": 0.0} for field in bill_fields}
    parsed["methode"] = "BILL_TEMPLATE_POSITIONNEL"
    parsed["detected_doc_type"] = doc_type

    zones = BILL_ENEO_ZONES if doc_type == "BILL_ENEO" else BILL_CAMWATER_ZONES

    for field_name, cy_min, cy_max, cx_min, cx_max, validator_key in zones:
        validator = _VALIDATORS.get(validator_key)
        if validator is None:
            continue

        cy_lo = cy_min * img_height
        cy_hi = cy_max * img_height
        cx_lo = cx_min * img_width
        cx_hi = cx_max * img_width

        candidates = []
        for b in blocks:
            b_cy = b.get("cy", 0)
            b_cx = b.get("cx", 0)
            if not (cy_lo <= b_cy <= cy_hi and cx_lo <= b_cx <= cx_hi):
                continue
            b_text = b.get("text", "")
            if not validator(b_text):
                continue
            zone_cx = (cx_lo + cx_hi) / 2
            zone_cy = (cy_lo + cy_hi) / 2
            dist = ((b_cx - zone_cx) ** 2 + (b_cy - zone_cy) ** 2) ** 0.5
            candidates.append((b, dist))

        if not candidates:
            continue

        candidates.sort(key=lambda x: x[1])
        best_block = candidates[0][0]
        best_text = best_block["text"].strip()
        best_conf = float(best_block.get("conf", 0.0))

        value: str | None = best_text
        if field_name in ("date_releve", "date_facturation", "date_limite_paiement"):
            value = _extract_date_value(best_text)
            if value is None:
                continue
        elif field_name in ("total_ttc", "kwh_consommes", "consommation_m3"):
            value = _extract_bill_amount_value(best_text)
            if value is None:
                continue

        parsed[field_name] = {"value": value, "conf": best_conf}

    return parsed


def _extract_bill_amount_value(text: str) -> str | None:
    """Extract a numeric amount from bill text like 'TOTAL TTC / WITH TAX: 35.987'."""
    # Find all numeric patterns (including those with dots as thousands separator)
    nums = re.findall(r"\d[\d\s.,]*\d|\d", text)
    if not nums:
        return None
    # Return the last number (usually the total, not the label number)
    return nums[-1].strip()


def _extract_fields_from_blocks(blocks: list[dict[str, Any]]) -> dict[str, Any]:
    """Legacy spatial anchoring extraction (used as FALLBACK).

    This is the original extraction logic using label-based spatial anchoring,
    regex, and value-list matching (CAMEROON_CITIES, CAMEROON_PROFESSIONS).
    It serves as a fallback for fields that the template-based extraction
    misses (e.g. adresse, poste_identification which lack template zones).

    NOTE: Post-processing (dedup, re-scan, DOB_SUSPECT) is NOT done here —
    it runs centrally in _extract_from_array() after the template/legacy merge.

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
        # Accept comma/colon as separator too (PaddleOCR v3 sometimes reads
        # "07.02.2018" as "07.02,2018", "07/02,2018", or "07.02:1989").
        match_date = re.search(r"\b(\d{2}[./,\-:]\d{2}[./,\-:]\d{2,4})\b", text)
        if match_date:
            raw_date = match_date.group(1).replace(".", "/").replace("-", "/").replace(",", "/").replace(":", "/")
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
                    _addr_keywords = {"QUARTIER", "RUE", "CARREFOUR", "B.P", "BP", "LOT", "ARROND", "MELEN", "BASTOS", "AKWA", "BONABERI", "MAKEPE", "NDOKOTI", "MVOG", "BIYEM", "ESSOS"}
                    _label_penalty = {"DATE", "BIRTH", "BIRTA", "NAISSANCE", "DELIVRANCE", "EXPIRATION", "IDENTIFIER", "IDENTIFICATION", "UNIQUE"}
                    def _addr_sort_key(b):
                        cy_diff = b["cy"] - block["cy"]
                        cx_diff = abs(b.get("cx", 0) - block.get("cx", 0))
                        b_upper = b.get("text", "").upper()
                        quality_bonus = 0
                        if any(kw in b_upper for kw in _addr_keywords) or any(c.isdigit() for c in b_upper):
                            quality_bonus = -10000
                        penalty = 0
                        if any(kw in b_upper for kw in _label_penalty):
                            penalty = 10000
                        return (cy_diff // 10) * 1000 + cx_diff + quality_bonus + penalty
                    candidates.sort(key=_addr_sort_key)
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

            # SP / S.N. — 6-digit number (situation professionnelle)
            # The label is often garbled: "5P/5.M.", "SP/SM", etc.
            if re.search(r"[5S][Pp][/\\.]", text) and parsed_data["sp"]["value"] is None:
                sp_candidates = [
                    b for b in blocks
                    if b["cy"] > block["cy"] + 2 and b["cy"] < block["cy"] + 60
                    and abs(b.get("cx", 0) - block.get("cx", 0)) < 150
                ]
                if sp_candidates:
                    sp_candidates.sort(key=lambda b: b["cy"] - block["cy"])
                    for _sp_b in sp_candidates:
                        _sp_match = re.search(r"\b(\d{5,7})\b", _sp_b["text"])
                        if _sp_match:
                            parsed_data["sp"] = {"value": _sp_match.group(1), "conf": _sp_b.get("conf", conf)}
                            break
            # Fallback: isolated 6-digit number on the left side of the card
            if parsed_data["sp"]["value"] is None:
                _sp_direct = re.search(r"^\s*(\d{6})\s*$", text.strip())
                if _sp_direct and block.get("cx", 999) < 200 and block.get("cy", 999) < 500:
                    parsed_data["sp"] = {"value": _sp_direct.group(1), "conf": conf}

            # Autorite_nom — name alongside or below AUTORITE/AUTHORITY label
            if re.search(r"(AUTORIT[EÉ]|AUTHORITY)", text) and parsed_data["autorite_nom"]["value"] is None:
                _auth_candidates = [
                    b for b in blocks
                    if (abs(b.get("cy", 0) - block.get("cy", 0)) < 20 and b.get("cx", 0) > block.get("cx", 0) + 10)
                    or (b.get("cy", 0) > block.get("cy", 0) + 2 and b.get("cy", 0) < block.get("cy", 0) + 120
                        and abs(b.get("cx", 0) - block.get("cx", 0)) < 350)
                ]
                _auth_valid = [
                    b for b in _auth_candidates
                    if not _is_stop_word(b.get("text", ""))
                    and not re.search(r"(AUTORIT[EÉ]|AUTHORITY|DATE|BIRTH|POST|ADRESS|IDENTIF|UNIQUE)", b.get("text", "").upper())
                    and len(b.get("text", "")) >= 4
                    and not re.search(r"^\d+$", b.get("text", "").strip())
                    and not re.search(r"\d{2}[./-]\d{2}[./-]\d{4}", b.get("text", ""))
                    and not re.match(r"^[A-Z]{1,4}\d{2,4}$", b.get("text", "").strip())
                ]
                if _auth_valid:
                    _auth_valid.sort(key=lambda b: (abs(b.get("cy", 0) - block.get("cy", 0)), abs(b.get("cx", 0) - block.get("cx", 0))))
                    parsed_data["autorite_nom"] = {"value": _auth_valid[0]["text"], "conf": _auth_valid[0].get("conf", conf)}

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
        # NOTE: Déduplication with nom is done centrally in
        # _extract_from_array() after the template/legacy merge, not here.
        # GUARD: verso has no holder place-of-birth; cities there (e.g. LIMBE in
        # "LIMBE-MELEN") belong to the address — block assignment on verso.
        _city_matches = [c for c in CAMEROON_CITIES if c in text_upper]
        if _city_matches and parsed_data["lieu_naissance"]["value"] is None and not is_verso:
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
                    and not is_parent_nom
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

        # --- Parent names (Pere / Mere) — verso only ---
        if is_verso:
            # Pere
            if re.search(r"(PERE|FATHER)", text_upper) and parsed_data["pere"]["value"] is None:
                candidates = [
                    b for b in blocks
                    if b["cy"] > block["cy"] + 2 and abs(b.get("cx", 0) - block.get("cx", 0)) < 350
                ]
                if candidates:
                    candidates.sort(key=lambda b: b["cy"] - block["cy"])
                    meilleur = candidates[0]
                    if not any(sw in meilleur.get("text", "").upper() for sw in STOP_WORDS):
                        parsed_data["pere"] = {"value": meilleur["text"], "conf": meilleur.get("conf", conf)}

            # Mere
            if re.search(r"(MERE|MOTHER)", text_upper) and parsed_data["mere"]["value"] is None:
                candidates = [
                    b for b in blocks
                    if b["cy"] > block["cy"] + 2 and abs(b.get("cx", 0) - block.get("cx", 0)) < 350
                ]
                if candidates:
                    candidates.sort(key=lambda b: b["cy"] - block["cy"])
                    meilleur = candidates[0]
                    if not any(sw in meilleur.get("text", "").upper() for sw in STOP_WORDS):
                        parsed_data["mere"] = {"value": meilleur["text"], "conf": meilleur.get("conf", conf)}

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
                    # On verso, dates are typically:
                    #   - date_naissance (if present on new CNI)
                    #   - date_delivrance
                    #   - date_expiration
                    # Use MRZ to identify date_naissance and date_expiration if available
                    mrz_dob = mrz_fields.get("date_naissance", {}).get("value")
                    mrz_exp = mrz_fields.get("date_expiration", {}).get("value")

                    # Match MRZ dates to detected dates to classify them
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
                            # Only one non-DOB date: assume delivrance if no expiry match
                            if not _exp_match:
                                parsed_data["date_delivrance"] = {"value": _remaining[0][1], "conf": _remaining[0][2]}

                    # Assign date_expiration: latest date or MRZ-matched
                    if parsed_data["date_expiration"]["value"] is None:
                        if _exp_match:
                            parsed_data["date_expiration"] = {"value": _exp_match[0], "conf": _exp_match[1]}
                        else:
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
    # On verso without an explicit NOM/SURNAME label, skip the heuristic entirely.
    # The verso contains parent names (PERE/MERE), not the cardholder's identity.
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

        # Tolerance: blocks within this many pixels below a parent label are
        # treated as parent VALUES (not the subject's name).
        _PARENT_PROXIMITY_PX = 60

        def _is_parent_value(block_cy: float) -> bool:
            """Return True if block_cy is within parent-label proximity zone."""
            return any(
                label_cy < block_cy <= label_cy + _PARENT_PROXIMITY_PX
                for label_cy in _parent_label_cys
            )

        caps_blocks = []
        for b in blocks:
            words = re.findall(r"\b[A-ZÀ-Ÿ]{3,}\b", b.get("text", ""))
            if not words:
                continue
            has_stop = any(w in STOP_WORDS for w in words)
            if has_stop:
                continue
            # Exclude blocks that are in a parent-value zone
            if _parent_label_cys and _is_parent_value(float(b.get("cy", 0))):
                continue
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

    # NOTE: Post-processing (dedup lieu_naissance, re-scan, DOB plausibility)
    # is done centrally in _extract_from_array() after the template/legacy merge,
    # so it is NOT repeated here to avoid wasted work and inconsistent results.

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


# ---------------------------------------------------------------------------
# Recto + Verso merge
# ---------------------------------------------------------------------------
def combine_extractions(
    recto_fields: dict[str, dict[str, Any]],
    verso_fields: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Merge recto and verso extraction results into a single complete record.

    Strategy: prefer higher-confidence values. For each field:
    - If only one side provides a value, use it.
    - If both sides provide a value, prefer the one with higher confidence.
    - Special handling for numero_cni: prefer the longer (NIN) value.
    """
    combined = {
        field: {"value": None, "conf": 0.0, "source": None}
        for field in CNI_FIELDS
    }

    for field in CNI_FIELDS:
        r_val = recto_fields.get(field, {})
        v_val = verso_fields.get(field, {})
        r_v = r_val.get("value") if isinstance(r_val, dict) else r_val
        r_c = r_val.get("conf", 0.0) if isinstance(r_val, dict) else 0.0
        v_v = v_val.get("value") if isinstance(v_val, dict) else v_val
        v_c = v_val.get("conf", 0.0) if isinstance(v_val, dict) else 0.0

        if r_v is None and v_v is None:
            continue
        if r_v is None and v_v is not None:
            combined[field] = {"value": v_v, "conf": v_c, "source": "verso"}
            continue
        if r_v is not None and v_v is None:
            combined[field] = {"value": r_v, "conf": r_c, "source": "recto"}
            continue

        # Both have values — pick best
        if field == "numero_cni" and isinstance(r_v, str) and isinstance(v_v, str):
            r_digits = len(re.sub(r"\D", "", r_v))
            v_digits = len(re.sub(r"\D", "", v_v))
            if v_digits > r_digits:
                combined[field] = {"value": v_v, "conf": v_c, "source": "verso"}
                continue
            elif r_digits > v_digits:
                combined[field] = {"value": r_v, "conf": r_c, "source": "recto"}
                continue

        # Prefer longer/more-complete value
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


class OCRService:
    """OCR service for document text extraction."""

    def __init__(self):
        self.confidence_threshold = settings.OCR_CONFIDENCE_THRESHOLD
        self.user_edit_threshold = settings.OCR_USER_EDIT_THRESHOLD

    def extract_from_bytes(self, image_bytes: bytes, doc_type: str = "CNI_RECTO") -> dict[str, Any]:
        """Extract text from image bytes using PaddleOCR with alignment."""
        start_time = time.perf_counter()

        # Convert bytes to numpy array (BGR for OpenCV)
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_arr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

        result = self._extract_from_array(img_arr, doc_type=doc_type)
        result["process_time_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
        return result

    def extract_from_path(self, image_path: Path, doc_type: str = "CNI_RECTO") -> dict[str, Any]:
        """Extract text from image file using PaddleOCR with alignment.

        Args:
            image_path: Path to the image file.
            doc_type: Document type — determines extraction strategy.
                      CNI_RECTO/CNI_VERSO → card alignment + CNI templates.
                      BILL_ENEO/BILL_CAMWATER → no alignment + bill templates.
        """
        start_time = time.perf_counter()

        img_arr = cv2.imread(str(image_path))
        if img_arr is None:
            logger.error(f"Failed to read image: {image_path}")
            empty_fields = BILL_FIELDS.get(doc_type, CNI_FIELDS) if doc_type.startswith("BILL_") else CNI_FIELDS
            return {
                "fields": {f: {"value": None, "conf": 0.0} for f in empty_fields},
                "blocks": [],
                "engine": "paddleocr_error",
                "needs_glm_fallback": True,
                "avg_confidence": 0.0,
                "process_time_ms": 0.0,
            }

        result = self._extract_from_array(img_arr, doc_type=doc_type)
        result["process_time_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
        return result

    def _extract_from_array(self, img_arr: np.ndarray, doc_type: str = "CNI_RECTO") -> dict[str, Any]:
        """Run full OCR pipeline: enhance -> OCR -> extract fields.

        For CNI documents: align card, use CNI templates.
        For bills: skip alignment, use bill templates.
        """
        _t0 = time.perf_counter()
        is_bill = doc_type.startswith("BILL_")
        _target_fields = BILL_FIELDS.get(doc_type, CNI_FIELDS) if is_bill else CNI_FIELDS

        # Step 1: Align card image (only for CNI, not bills)
        if is_bill:
            enhanced = _enhance_for_ocr(img_arr)
            _t_align = _t0  # no alignment for bills
        else:
            aligned = align_card_image(img_arr)
            if aligned is None:
                aligned = img_arr
                logger.debug("Card alignment failed, using original image")
            enhanced = _enhance_for_ocr(aligned)
            _t_align = time.perf_counter()
        _t_enhance = time.perf_counter()

        # Step 3: Run PaddleOCR
        ocr = get_shared_paddle_ocr()
        if ocr is None:
            logger.warning("PaddleOCR not available, returning empty results")
            return {
                "fields": {f: {"value": None, "conf": 0.0} for f in _target_fields},
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
                    "fields": {f: {"value": None, "conf": 0.0} for f in _target_fields},
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
                f"{'[bill]' if is_bill else ''}"
            )

        except Exception as exc:
            logger.error(f"OCR total failure: {exc}", exc_info=True)
            return {
                "fields": {f: {"value": None, "conf": 0.0} for f in _target_fields},
                "blocks": [],
                "engine": "paddleocr_error",
                "needs_glm_fallback": True,
                "avg_confidence": 0.0,
            }

        if not results or not results[0].get("rec_texts"):
            logger.warning("No text detected in image")
            return {
                "fields": {f: {"value": None, "conf": 0.0} for f in _target_fields},
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

        # Step 5: Extract structured fields — TEMPLATE FIRST, then fallback
        _t_extract_start = time.perf_counter()

        _img_h, _img_w = enhanced.shape[:2]

        if is_bill:
            # BILL extraction: use bill-specific templates (no side detection needed)
            spatial_data = _extract_bill_by_template(blocks, _img_h, _img_w, doc_type)
            bill_field_names = BILL_FIELDS.get(doc_type, [])
        else:
            # CNI extraction: detect side, use CNI templates + legacy fallback
            recto_keywords = {"REPUBLIQUE", "IDENTITY", "CARD", "CARTE", "NATIONALE", "RECTO"}
            verso_keywords = {"AUTORITE", "AUTHORITY", "MRZ", "VERSO", "EMPREINTE", "FINGERPRINT",
                              "PERE", "FATHER", "MERE", "MOTHER", "ADRESSE", "POSTE"}
            
            has_mrz = any("<<" in b.get("text", "") for b in blocks)
            
            recto_score = 0
            verso_score = 10 if has_mrz else 0
            
            texts = [b.get("text", "").upper() for b in blocks]
            for text in texts:
                for skip in recto_keywords:
                    if skip in text:
                        recto_score += 1
                for skip in verso_keywords:
                    if skip in text:
                        verso_score += 1
                        
            detected_side = "recto" if recto_score >= verso_score else "verso"
            logger.info(f"Side detection: recto={recto_score}, verso={verso_score} -> {detected_side}")

            # PRIMARY: Template-based extraction (position + format validators)
            template_data = _extract_by_template(blocks, _img_h, _img_w, detected_side)

            # FALLBACK: Legacy spatial extraction for fields the template missed
            legacy_data = _extract_fields_from_blocks(blocks)

            # Merge: template values take priority, legacy fills gaps
            spatial_data = template_data
            for field in CNI_FIELDS:
                if spatial_data[field]["value"] is None and legacy_data[field]["value"] is not None:
                    spatial_data[field] = legacy_data[field]
                    if "FALLBACK" not in spatial_data.get("methode", ""):
                        spatial_data["methode"] += " + FALLBACK_ANCRAGE"

        # Merge methode metadata (CNI only)
        if not is_bill:
            if "MRZ" in legacy_data.get("methode", "") and "MRZ" not in spatial_data.get("methode", ""):
                spatial_data["methode"] += " + MRZ"
            if "DOB_SUSPECT" in legacy_data.get("methode", "") and "DOB_SUSPECT" not in spatial_data.get("methode", ""):
                spatial_data["methode"] += " + DOB_SUSPECT"

        # --- Post-processing on merged result ---

        if not is_bill:
            # CNI-specific post-processing: lieu_naissance dedup, DOB plausibility
            # (skipped for bills — they have different field semantics)

            # 0. Guard: nom/prenom must not be parent values.
            #    Collect all text values that appear immediately below a PERE/MERE
            #    label block (within 60px cy). If nom or prenom matches one of these
            #    parent values, clear it so GLM fallback can correct it.
            _PARENT_LABEL_KW = {"PERE", "FATHER", "MERE", "MOTHER"}
            _PARENT_PROX_PX = 60
            _parent_value_texts: set[str] = set()
            for _pb in blocks:
                _pb_words = re.findall(r"\b[A-ZÀ-Ÿ]{3,}\b", _pb.get("text", "").upper())
                if any(w in _PARENT_LABEL_KW for w in _pb_words):
                    _label_cy = float(_pb.get("cy", 0))
                    for _vb in blocks:
                        _vb_cy = float(_vb.get("cy", 0))
                        if _label_cy < _vb_cy <= _label_cy + _PARENT_PROX_PX:
                            _parent_value_texts.add(_vb.get("text", "").upper().strip())
            if _parent_value_texts:
                for _field in ["nom", "prenom"]:
                    _field_val = spatial_data.get(_field, {}).get("value")
                    if _field_val and _field_val.upper().strip() in _parent_value_texts:
                        logger.warning(
                            f"Post-processing: '{_field_val}' matched parent value set — "
                            f"clearing {_field} to avoid parent/subject confusion"
                        )
                        spatial_data[_field] = {"value": None, "conf": 0.0}
                        if "PARENT_DEDUP" not in spatial_data.get("methode", ""):
                            spatial_data["methode"] += " + PARENT_DEDUP"

            # 1. Deduplicate lieu_naissance vs nom/prenom
            if spatial_data.get("lieu_naissance", {}).get("value") is not None:
                _lieu_upper = spatial_data["lieu_naissance"]["value"].upper()
                for _field in ["nom", "prenom"]:
                    if spatial_data.get(_field, {}).get("value") is not None:
                        if _lieu_upper == spatial_data[_field]["value"].upper():
                            logger.debug(f"lieu_naissance '{_lieu_upper}' matches {_field} — clearing")
                            spatial_data["lieu_naissance"] = {"value": None, "conf": 0.0}
                            break

            # 2. Re-scan for lieu_naissance if dedup cleared it
            #    Use spatial proximity: pick the block closest to date_naissance
            #    that looks like a place name and doesn't match nom/prenom.
            if spatial_data.get("lieu_naissance", {}).get("value") is None and "lieu_naissance" in spatial_data:
                _nom_upper = (spatial_data["nom"]["value"].upper()
                              if spatial_data.get("nom", {}).get("value") else "")
                _prenom_upper = (spatial_data["prenom"]["value"].upper()
                                 if spatial_data.get("prenom", {}).get("value") else "")
                _dob_cy = None
                if spatial_data.get("date_naissance", {}).get("value") is not None:
                    _dob_val = (spatial_data["date_naissance"]["value"]
                                .replace("/", ".").replace(",", ".").replace(":", "."))
                    _dob_year = spatial_data["date_naissance"]["value"][-4:]
                    for b in blocks:
                        b_text_norm = (b.get("text", "")
                                       .replace(",", ".").replace("-", ".").replace(":", "."))
                        if _dob_val in b_text_norm or _dob_year in b_text_norm:
                            _dob_cy = b.get("cy", 0)
                            break
                _zone_key = "lieu_naissance"
                _zones = CNI_RECTO_ZONES if detected_side == "recto" else CNI_VERSO_ZONES
                _lieu_zone = [(cy1, cy2, cx1, cx2) for f, cy1, cy2, cx1, cx2, _ in _zones if f == _zone_key]
                _place_candidates = []
                if _lieu_zone:
                    _cy1, _cy2, _cx1, _cx2 = _lieu_zone[0]
                    _cy_lo = _cy1 * _img_h
                    _cy_hi = _cy2 * _img_h
                    _cx_lo = _cx1 * _img_w
                    _cx_hi = _cx2 * _img_w
                    for b in blocks:
                        b_text = b.get("text", "").strip()
                        if not _is_place_text(b_text):
                            continue
                        b_cy = b.get("cy", 0)
                        b_cx = b.get("cx", 0)
                        if not (_cy_lo <= b_cy <= _cy_hi and _cx_lo <= b_cx <= _cx_hi):
                            continue
                        b_upper = b_text.upper()
                        if b_upper == _nom_upper or b_upper == _prenom_upper:
                            continue
                        _place_candidates.append(b)
                if _place_candidates:
                    if _dob_cy is not None:
                        _place_candidates.sort(key=lambda b: abs(b.get("cy", 0) - _dob_cy))
                    else:
                        _place_candidates.sort(key=lambda b: b.get("cy", 0))
                    best = _place_candidates[0]
                    spatial_data["lieu_naissance"] = {
                        "value": best["text"].strip(),
                        "conf": float(best.get("conf", 0.0)),
                    }
                    if "RESCAN_LIEU" not in spatial_data.get("methode", ""):
                        spatial_data["methode"] += " + RESCAN_LIEU"

        # 3. DOB plausibility check (CNI only)
        if not is_bill and spatial_data.get("date_naissance", {}).get("value") is not None:
            try:
                _dob_parts = spatial_data["date_naissance"]["value"].split("/")
                if len(_dob_parts) == 3:
                    _dob_year = int(_dob_parts[2])
                    if _dob_year < 1920:
                        logger.warning(
                            f"Implausible DOB year {_dob_year} in "
                            f"'{spatial_data['date_naissance']['value']}' — "
                            f"likely OCR digit error, flagging for GLM fallback"
                        )
                        if "DOB_SUSPECT" not in spatial_data.get("methode", ""):
                            spatial_data["methode"] += " + DOB_SUSPECT"
            except (ValueError, IndexError):
                pass

        _t_extract = time.perf_counter()
        logger.debug(f"Field extraction timing: {(_t_extract-_t_extract_start)*1000:.0f}ms")

        # Extract MRZ data if present (CNI verso only)
        if not is_bill:
            mrz_data = extract_mrz(blocks)
            if mrz_data:
                spatial_data["mrz"] = mrz_data

        # Build the flat fields dict
        target_fields = bill_field_names if is_bill else CNI_FIELDS
        fields: dict[str, dict[str, Any]] = {}
        for field_name in target_fields:
            if field_name in spatial_data and isinstance(spatial_data[field_name], dict):
                fields[field_name] = spatial_data[field_name]
            else:
                fields[field_name] = {"value": None, "conf": 0.0}

        # Last-chance format validation gate (CNI only)
        # Banking requirement: fail safe — never return a value that doesn't pass
        # its format validator. Downstream (GLM fallback or human review) handles gaps.
        if not is_bill:
            for _field in CNI_FIELDS:
                _val = fields.get(_field, {}).get("value")
                if _val is not None:
                    _valid = _validate_field_value(_field, str(_val))
                    if _valid is None:
                        logger.debug(f"Field {_field} rejected by format validator: '{_val}'")
                        fields[_field] = {"value": None, "conf": 0.0}

        # Calculate average confidence — only over fields that have a value
        filled_confidences = [
            f.get("conf", 0.0) for f in fields.values()
            if f.get("value") is not None
        ]
        avg_confidence = (
            sum(filled_confidences) / len(filled_confidences)
            if filled_confidences
            else 0.0
        )

        filled_count = len(filled_confidences)

        # Determine if fallback is needed
        fill_rate = filled_count / max(len(target_fields), 1)
        _has_dob_suspect = "DOB_SUSPECT" in spatial_data.get("methode", "")
        needs_fallback = (
            avg_confidence < self.confidence_threshold
            or fill_rate < 0.5
            or (not is_bill and _has_dob_suspect)
        )
        logger.info(
            f"OCR extracted {filled_count}/{len(target_fields)} fields, "
            f"avg_confidence={avg_confidence:.2f}, needs_glm_fallback={needs_fallback}, "
            f"doc_type={doc_type}, "
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
