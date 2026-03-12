import cv2
import numpy as np
import re
import math
import os
import sys
from paddleocr import PaddleOCR

# Forcer l'encodage UTF-8 pour Windows
sys.stdout.reconfigure(encoding='utf-8')

print("🔥 Chargement du modèle PaddleOCR (CPU)...")
ocr_engine = PaddleOCR(use_angle_cls=True, lang='fr', use_gpu=False, show_log=False)

# =====================================================================
# ÉTAPE 1 : LE SNIPER (Alignement géométrique avec OpenCV)
# =====================================================================
def align_card_image(image_path):
    """
    Détecte la carte d'identité dans l'image, la découpe et l'aplatit 
    (Transformation de perspective / Homographie).
    """
    img = cv2.imread(image_path)
    if img is None:
        print(f"⚠️ Erreur: Impossible de lire l'image {image_path}")
        return None
        
    ratio = img.shape[0] / 500.0
    orig = img.copy()
    img_resized = cv2.resize(img, (int(img.shape[1]/ratio), 500))

    gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 75, 200)

    # Fermeture morphologique pour lier les bords cassés par les reflets
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed = cv2.morphologyEx(edged, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(closed.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
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
        if area < 0.1 * img_area:  # Ignore tiny contours (false positives)
            screen_cnt = None

    if screen_cnt is None:
        print("  ⚠️ Bords parfaits introuvables. Fallback sur l'image brute.")
        # Ensure fallback image is also strictly normalized to 800px wide
        fallback_ratio = 800.0 / float(orig.shape[1])
        fallback_height = int(orig.shape[0] * fallback_ratio)
        return cv2.resize(orig, (800, fallback_height))

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

    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]], dtype="float32")

    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(orig, M, (maxWidth, maxHeight))
    
    # FIX 1: Normalisation de la résolution : on fige la sortie à 800px de large.
    STANDARD_WIDTH = 800
    ratio_warp = STANDARD_WIDTH / float(maxWidth)
    standard_height = int(maxHeight * ratio_warp)
    warped_standard = cv2.resize(warped, (STANDARD_WIDTH, standard_height))
    return warped_standard

# =====================================================================
# ÉTAPE 2 : LE HACK (Lecture de la MRZ au Verso)
# =====================================================================
def extract_mrz(blocks):
    mrz_lines =[]
    # Exactement 30 caractères : Lettres majuscules, chiffres, et chevrons
    mrz_pattern = re.compile(r'^[A-Z0-9<]{30}$') 
    
    for b in blocks:
        text = b['text'].replace(' ', '')
        if mrz_pattern.match(text) and '<' in text:
            mrz_lines.append(text)
            
    if len(mrz_lines) == 3: # Le standard TD1 exige 3 lignes
        print("  🎯 MRZ Détectée !")
        return {
            "mrz_trouvee": True,
            "lignes_mrz": mrz_lines,
            "methode": "MRZ_ICAO_TD1"
        }
    return None

# =====================================================================
# ÉTAPE 3 : LE DÉTECTIVE (Ancrage Spatial + Regex sur Recto)
# =====================================================================
def extract_spatial_data(blocks):
    parsed_data = {
        "nom": {"value": None, "conf": 0.0},
        "prenom": {"value": None, "conf": 0.0},
        "numero_cni": {"value": None, "conf": 0.0},
        "methode": "ANCRAGE_SPATIAL"
    }
    
    for i, block in enumerate(blocks):
        text = block['text'].upper()
        
        # Numéro de CNI via Regex (ex: 9 chiffres)
        match = re.search(r'\b\d{9}\b', text)
        if match and parsed_data["numero_cni"]["value"] is None:
            parsed_data["numero_cni"] = {"value": match.group(), "conf": block['conf']}
            
        # Chercher également le nouveau format CNI: 17 chiffres (NIN)
        match_nin = re.search(r'\b\d{17}\b', text)
        if match_nin and parsed_data["numero_cni"]["value"] is None:
             parsed_data["numero_cni"] = {"value": match_nin.group(), "conf": block['conf']}

        # Ancrage Spatial : Trouver le "Nom"
        if "NOM" in text or "SURNAME" in text:
            # On cherche tous les blocs qui sont PLUS BAS (Y supérieur)
            # et alignés verticalement (X très proche, ex: < 250px d'écart, ce qui est standard car image normalisée à 800px)
            candidates = [
                b for b in blocks 
                if b['cy'] > block['cy'] + 5 
                and abs(b['cx'] - block['cx']) < 150 
            ]
            
            if candidates:
                candidates.sort(key=lambda b: b['cy'] - block['cy'])
                meilleur_candidat = candidates[0]
                
                if "PRENOM" not in meilleur_candidat['text'].upper():
                     parsed_data["nom"] = {
                        "value": meilleur_candidat['text'], 
                        "conf": meilleur_candidat['conf']
                    }
                    
        # Ancrage Spatial : Trouver le "Prénom"
        if "PRENOM" in text or "GIVEN" in text or "PRÉNOM" in text:
            candidates = [
                b for b in blocks 
                if b['cy'] > block['cy'] + 5 
                and abs(b['cx'] - block['cx']) < 150 
            ]
            if candidates:
                candidates.sort(key=lambda b: b['cy'] - block['cy'])
                meilleur_candidat = candidates[0]
                parsed_data["prenom"] = {
                    "value": meilleur_candidat['text'], 
                    "conf": meilleur_candidat['conf']
                }

    # === DETECTION RECTO / VERSO ===
    is_verso = False
    for b in blocks:
        if any(kw in b['text'].upper() for kw in ['PERE', 'FATHER', 'MERE', 'MOTHER', 'AUTORITE', 'AUTHORITY', 'DELIVRANCE']):
            is_verso = True
            break
            
    if is_verso:
        parsed_data["methode"] += " (VERSO DETEC. -> IGNORE HEURISTIQUE NOM)"
        return parsed_data

    # === FALLBACK HEURISTIQUE (UNIQUEMENT RECTO) ===
    # Si le nom ou prénom n'a pas été trouvé (parce que le mot 'NOM' était illisible),
    # on cherche de gros blocs en majuscules qui ne sont pas des stopwords.
    if parsed_data["nom"]["value"] is None or parsed_data["prenom"]["value"] is None:
        stop_words = {
            'REPUBLIQUE', 'REPUBLIC', 'CAMEROON', 'CAMEROUN', 'NATIONAL', 'IDENTITY', 
            'CARD', 'CARTE', 'NATIONALE', 'IDENTITE', 'SIGNATURE', 'SEXE', 'NAME', 'NOM',
            'SURNAME', 'GIVEN', 'NAMES', 'PROFESSION', 'OCCUPATION', 'MENAGERE', 'TRAVAIL',
            'INGENIEUR', 'REPUBLIQUEDUCAMEROUN', 'REPUBLICOFCAMEROON', 'CARTENATIONALED\'IDENTITE',
            'PERE/FATHER', 'MERE/MOTHER', 'S.P/S.M', 'AUTORITE/AUTHORITY', 'DATEDE', 'DELIVRANCE',
            'POSTEDIDENTIFICATION', 'DATEOFISSUE', 'IDENTIFSCATIONPOSS', 'DATEDEXPIRATION/', 
            'DENTIFLANTUNIQUE', 'DATEOEEXPIRY', 'UNIOUEIDENDFIE', 'DENTIFIANURIQUE', 'OHOUEIDENTIFIER',
            'FENO', 'PRÉNOMS', 'PRENOMS', 'PRÉNOM', 'PRENOM'
        }
        
        caps_blocks = []
        for b in blocks:
            # On cherche des mots de 3 lettres minimum en Maj
            words = re.findall(r'\b[A-Z]{3,}\b', b['text'])
            if not words:
                continue
            
            # On vérifie que ce ne sont pas des stopwords
            has_stop_word = any(w.upper() in stop_words for w in words)
            if not has_stop_word:
                 # C'est probablement un nom propre
                 caps_blocks.append(b)
                 
        # Trier par position Y (de haut en bas)
        caps_blocks.sort(key=lambda b: b['cy'])
        
        if parsed_data["nom"]["value"] is None and len(caps_blocks) > 0:
            parsed_data["nom"] = {"value": caps_blocks[0]['text'], "conf": caps_blocks[0]['conf']}
            if "HEURISTIQUE" not in parsed_data["methode"]:
                parsed_data["methode"] += " + HEURISTIQUE"
            
        if parsed_data["prenom"]["value"] is None and len(caps_blocks) > 1:
            parsed_data["prenom"] = {"value": caps_blocks[1]['text'], "conf": caps_blocks[1]['conf']}
            if "HEURISTIQUE" not in parsed_data["methode"]:
                parsed_data["methode"] += " + HEURISTIQUE"

    return parsed_data

# =====================================================================
# LE PIPELINE PRINCIPAL 
# =====================================================================
def process_cni(image_path):
    print(f"\n📸 Traitement de l'image : {os.path.basename(image_path)}")
    
    aligned_img = align_card_image(image_path)
    if aligned_img is None:
        return
        
    results = ocr_engine.ocr(aligned_img, cls=True)
    if not results or not results[0]:
        print("  ❌ Aucun texte détecté")
        return {"error": "Aucun texte détecté"}
        
    blocks = []
    for el in results[0]:
        coords, (text, conf) = el[0], el[1]
        center_x = sum([p[0] for p in coords]) / 4
        center_y = sum([p[1] for p in coords]) / 4
        blocks.append({
            'text': text.strip(), 
            'cx': center_x, 
            'cy': center_y, 
            'conf': float(conf)
        })
        
    print(f"  --- Debug Blocks ({len(blocks)}) ---")
    for block in blocks:
        print(f"    Text: {block['text']} | cx: {block['cx']:.1f}, cy: {block['cy']:.1f}")
        
    # Validation MRZ
    mrz_data = extract_mrz(blocks)
    if mrz_data:
        print(f"  [RESULTAT] Mode: {mrz_data['methode']}")
        for mrz_line in mrz_data["lignes_mrz"]:
             print(f"    - {mrz_line}")
        return mrz_data
        
    # Extraction géométrique
    spatial_data = extract_spatial_data(blocks)
    print(f"  [RESULTAT] Mode: {spatial_data['methode']}")
    
    def format_output(label, field_data):
        val = field_data['value']
        conf = field_data['conf']
        status = "✅ OK" if conf >= 0.85 else "⚠️ LOW CONFIDENCE (Review needed)"
        return f"    - {label.ljust(6)}: {str(val).ljust(20)} | Score: {conf:.2f} {status}"

    print(format_output("Nom", spatial_data['nom']))
    print(format_output("Prenom", spatial_data['prenom']))
    print(format_output("CNI #", spatial_data['numero_cni']))
    return spatial_data

if __name__ == "__main__":
    image_dir = "./images"
    if os.path.exists(image_dir):
        # We process webp, png, jpg, jpeg
        cni_files = [f for f in os.listdir(image_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
        for filename in cni_files:
            process_cni(os.path.join(image_dir, filename))
    else:
        print(f"Dossier {image_dir} introuvable.")
