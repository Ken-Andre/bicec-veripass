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
        match_date = re.search(r"\b(\d{2}[./-]\d{2}[./-]\d{2,4})\b", text)
        if match_date:
            raw_date = match_date.group(1).replace(".", "/").replace("-", "/")
            parts = raw_date.split("/")
            if len(parts) == 3:
                d, m, y = parts
                if m == "00":
                    m = "01"
                if d == "00":
                    d = "01"
                clean_date = f"{d}/{m}/{y}"
                if len(clean_date) == 8:  # 2-digit year -> expand
                    clean_date = clean_date[:6] + ("19" if int(clean_date[6:]) > 30 else "20") + clean_date[6:]
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
        # Sexe (F / M isolated)
        if text_upper in ["F", "M"] and parsed_data["sexe"]["value"] is None:
            parsed_data["sexe"] = {"value": text_upper, "conf": conf}

        # Taille (e.g. 1.54, 1,75)
        match_taille = re.search(r"\b(1[.,]\d{2})\b", text)
        if match_taille and parsed_data["taille"]["value"] is None:
            parsed_data["taille"] = {"value": match_taille.group(1).replace(",", "."), "conf": conf}

        # Profession
        if text_upper in CAMEROON_PROFESSIONS and parsed_data["profession"]["value"] is None:
            parsed_data["profession"] = {"value": text, "conf": conf}

        # Lieu de naissance (Cameroonian city names)
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

    # Remove None values for downstream compatibility
    return {k: v for k, v in parsed_data.items() if not (isinstance(v, dict) and v.get("value") is None)}


class OCRService:
    """OCR service for document text extraction."""

    def __init__(self):
        self.confidence_threshold = settings.OCR_CONFIDENCE_THRESHOLD
        self.user_edit_threshold = settings.OCR_USER_EDIT_THRESHOLD

    def extract_from_bytes(self, image_bytes: bytes) -> dict[str, Any]:
        """Extract text from image bytes using PaddleOCR with alignment."""
        import time
        start_time = time.perf_counter()

        # Convert bytes to numpy array (BGR for OpenCV)
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_arr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

        result = self._extract_from_array(img_arr)
        result["process_time_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
        return result

    def extract_from_path(self, image_path: Path) -> dict[str, Any]:
        """Extract text from image file using PaddleOCR with alignment."""
        import time
        start_time = time.perf_counter()

        img_arr = cv2.imread(str(image_path))
        if img_arr is None:
            logger.error(f"Failed to read image: {image_path}")
            return {
                "fields": {},
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
        """Run full OCR pipeline: align -> OCR -> extract fields."""
        # Step 1: Align the card image
        aligned = align_card_image(img_arr)
        if aligned is None:
            aligned = img_arr
            logger.debug("Card alignment failed, using original image")

        # Step 2: Run PaddleOCR
        ocr = get_shared_paddle_ocr()
        if ocr is None:
            logger.warning("PaddleOCR not available, returning empty results")
            return {
                "fields": {},
                "blocks": [],
                "engine": "paddleocr_unavailable",
                "needs_glm_fallback": True,
                "avg_confidence": 0.0,
            }

        try:
            # Ensure image is valid and has expected dimensions
            if aligned is None or aligned.size == 0:
                logger.error("Empty image passed to OCR")
                return {
                    "fields": {},
                    "blocks": [],
                    "engine": "paddleocr_error",
                    "needs_glm_fallback": True,
                    "avg_confidence": 0.0,
                }
            
            # PaddleOCR v3: use predict() instead of deprecated ocr().
            # The cls parameter was removed in v3 — textline orientation is
            # controlled via use_textline_orientation at init time.
            results = ocr.predict(aligned)

        except Exception as exc:
            logger.error(f"OCR total failure: {exc}", exc_info=True)
            return {
                "fields": {},
                "blocks": [],
                "engine": "paddleocr_error",
                "needs_glm_fallback": True,
                "avg_confidence": 0.0,
            }

        if not results or not results[0].get("rec_texts"):
            logger.warning("No text detected in image")
            return {
                "fields": {},
                "blocks": [],
                "engine": "paddleocr",
                "needs_glm_fallback": True,
                "avg_confidence": 0.0,
            }

        # Step 3: Build blocks from OCR results
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

        # Step 4: Extract structured fields using spatial logic
        spatial_data = _extract_fields_from_blocks(blocks)

        # Extract MRZ data if present (for verso)
        mrz_data = extract_mrz(blocks)
        if mrz_data:
            spatial_data["mrz"] = mrz_data

        # Build the flat fields dict expected by downstream consumers
        fields: dict[str, dict[str, Any]] = {}
        for field_name in CNI_FIELDS:
            if field_name in spatial_data:
                fields[field_name] = spatial_data[field_name]

        # Calculate average confidence
        confidences = [f.get("conf", 0) for f in fields.values()]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        # Determine if fallback is needed
        needs_fallback = avg_confidence < self.confidence_threshold

        logger.info(
            f"OCR extracted {len(fields)} fields, avg_confidence={avg_confidence:.2f}, "
            f"needs_glm_fallback={needs_fallback}, side={spatial_data.get('detected_side', 'unknown')}, "
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
