from paddleocr import PaddleOCR
import re
import os

ocr = PaddleOCR(use_textline_orientation=True, lang='fr', use_gpu=False)

def extract_cni_fields(image_path):
    print(f"📄 Analyse CNI : {image_path}")
    result = ocr.ocr(image_path, cls=True)
    if result is None or len(result) == 0:
        print("  Aucun texte détecté.")
        return None
        
    all_texts = [line[1][0] for line in result[0]]
    full_text = " ".join(all_texts)
    
    print("=== TEXTE BRUT ===")
    print(full_text)
    print("\n=== CHAMPS DÉTECTÉS ===")
    
    # Patterns pour CNI camerounaise (selon les exemples donnés par l'utilisateur)
    patterns = {
        "NIU / NIN":    r'\b[0-9]{9}[A-Z]\b',
        "Date naissance": r'\b\d{2}[/-]\d{2}[/-]\d{4}\b',
        "Nom":          r'(?:NOM|NAME)\s*[:\-]?\s*([A-Z\s]+)',
        "Prénom":       r'(?:PRÉNOM|PRENOM|GIVEN)\s*[:\-]?\s*([A-Z\s]+)',
    }
    
    fields = {}
    for label, pattern in patterns.items():
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            # Nettoyage si possible (prendre seulement le groupe capturé si présent)
            fields[label] = match.group(1).strip() if match.groups() else match.group(0).strip()
            print(f"  {label}: {fields[label]}")
        else:
            print(f"  {label}: non trouvé")
    
    return fields

# Traiter une CNI par défaut si présente
image_dir = "./images"
image_path = os.path.join(image_dir, "cni_recto.jpg")

if not os.path.exists(image_path):
    # Chercher n'importe quelle image avec cni dans le nom
    for filename in os.listdir(image_dir):
        if "cni" in filename.lower() and filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            image_path = os.path.join(image_dir, filename)
            break

if os.path.exists(image_path):
    fields = extract_cni_fields(image_path)
else:
    print(f"❌ CNI non trouvée: {image_path}. Veuillez ajouter une image contenant 'cni' dans './images/'.")
