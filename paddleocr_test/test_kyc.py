from paddleocr import PaddleOCR
import re
import os
import sys
import cv2
import numpy as np
import tempfile

# Forcer l'encodage UTF-8 pour Windows
sys.stdout.reconfigure(encoding='utf-8')

# Initialisation OCR (version stable)
ocr = PaddleOCR(use_angle_cls=True, lang='fr', use_gpu=False)

def preprocess_image(image_path):
    """
    Pré-traitement OpenCV pour améliorer l'OCR :
    - Grayscale
    - Denoising (Bilateral Filter pour garder les bords)
    - Seuillage adaptatif (Binarisation)
    - Redimensionnement (Upscaling)
    """
    img = cv2.imread(image_path)
    if img is None:
        return None
    
    # 1. Grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 2. Upscaling (x2) pour les petits caractères
    gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    
    # 3. Denoising
    denoised = cv2.bilateralFilter(gray, 9, 75, 75)
    
    # 4. Adaptive Thresholding (pour les fonds complexes des CNI)
    binary = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                   cv2.THRESH_BINARY, 11, 2)
    
    # Sauvegarde temporaire pour PaddleOCR
    temp_fd, temp_path = tempfile.mkstemp(suffix='.png')
    os.close(temp_fd)
    cv2.imwrite(temp_path, binary)
    return temp_path

def clean_text(text):
    """Nettoyage et correction intelligente des confusions OCR"""
    # Remplacement des confusions classiques
    text = text.replace('|', 'I').replace('0', '0')
    # Normalisation des dates (ex: 23-06.2021 -> 23.06.2021)
    return text

def extract_cni_fields(image_path):
    print(f"\n--- Analyse de : {os.path.basename(image_path)} ---")
    
    # Utiliser le pré-traitement
    processed_path = preprocess_image(image_path)
    if not processed_path:
        print("  Erreur de lecture image.")
        return None
        
    result = ocr.ocr(processed_path, cls=True)
    
    # Nettoyage fichier temporaire
    if os.path.exists(processed_path):
        os.remove(processed_path)

    if not result or not result[0]:
        print("  Aucun texte détecté.")
        return None
        
    lines = [clean_text(line[1][0]) for line in result[0]]
    full_text = " ".join(lines)
    
    print(f"DEBUG RAW: {full_text[:400]}...") # Plus de contexte
    
    # 1. Extraction des Dates avec Correction Intelligente
    # Cherche JJ.MM.AA ou JJ.MM.AAAA (supporte . / -)
    date_pattern = r'\b(\d{2}[./-]\d{2}[./-]\d{2,4})\b'
    raw_dates = re.findall(date_pattern, full_text)
    all_dates = []
    
    for d in raw_dates:
        # Correction : si l'année est sur 2 chiffres, on tente de deviner
        parts = re.split(r'[./-]', d)
        if len(parts) == 3:
            day, month, year = parts
            if len(year) == 2:
                # Heuristique : si l'année est > 30, c'est probablement 19XX, sinon 20XX
                prefix = "19" if int(year) > 30 else "20"
                d = f"{day}.{month}.{prefix}{year}"
            else:
                d = f"{day}.{month}.{year}"
        all_dates.append(d)
    
    # 2. Heuristique pour le NOM et PRENOM (souvent en MAJUSCULES après REPUBLIQUE)
    # On cherche des blocs de texte en MAJUSCULES de plus de 3 lettres
    caps_words = re.findall(r'\b[A-Z]{3,}\b', full_text)
    # On filtre les mots clés administratifs
    stop_words = {'REPUBLIQUE', 'REPUBLIC', 'CAMEROON', 'CAMEROUN', 'NATIONAL', 'IDENTITY', 'CARD', 'CARTE', 'NATIONALE', 'IDENTITE', 'SIGNATURE', 'SEXE', 'NAME', 'NOM'}
    potential_names = [w for w in caps_words if w not in stop_words]

    # 3. Identifiants (NIU, NIN, ID No)
    # Cherche soit 17 chiffres (NIN camerounais), soit 9 chiffres + 1 lettre
    id_pattern = r'\b(\d{17}|\d{9}[A-Z])\b'
    ids = re.findall(id_pattern, full_text)
    
    # 4. Nettoyage spécifique S.P/S.M (souvent lu 5.5.M ou 5P/5M)
    sp_sm_match = re.search(r'\b[5SI].[5PI].[M]\b', full_text)
    sp_sm_value = "S.P/S.M (Détecté)" if sp_sm_match else None

    # Affichage des résultats "intelligents"
    print("\n--- RÉSULTATS EXTRAITS ---")
    if all_dates:
        print(f"  Dates trouvées: {', '.join(all_dates)}")
        # Souvent la 1ère date est la naissance sur le recto
        print(f"  -> Date Naissance Probable: {all_dates[0]}")
    
    if sp_sm_value:
        print(f"  Champ trouvé: {sp_sm_value}")

    if len(potential_names) >= 2:
        print(f"  Identité Probable: {potential_names[0]} {potential_names[1]}")
    elif potential_names:
        print(f"  Identité Probable (partiel): {potential_names[0]}")

    if ids:
        print(f"  ID (NIN/NIU) trouvé: {ids[0]}")
    
    # Fallback sur les anciens regex pour compatibilité
    simple_patterns = {
        "Nom": r'(?:NOM|NAME)\s*[:\-]?\s*([A-Z\s]+)',
        "Prénom": r'(?:PRÉNOM|PRENOM|GIVEN)\s*[:\-]?\s*([A-Z\s]+)',
    }
    for label, pattern in simple_patterns.items():
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            print(f"  {label} (via label): {match.group(1).strip()}")

    return lines

# Execution sur toutes les images de CNI trouvées
image_dir = "./images"
if os.path.exists(image_dir):
    cni_files = [f for f in os.listdir(image_dir) if "cni" in f.lower()]
    if not cni_files:
        # Fallback si pas de fichier avec "cni" dans le nom, on prend tout pour tester
        cni_files = [f for f in os.listdir(image_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        
    for filename in cni_files:
        extract_cni_fields(os.path.join(image_dir, filename))
else:
    print(f"Dossier {image_dir} introuvable.")
