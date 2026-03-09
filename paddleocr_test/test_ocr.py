from paddleocr import PaddleOCR
import cv2
import os
import sys

# Forcer l'encodage UTF-8 pour Windows
sys.stdout.reconfigure(encoding='utf-8')

# Initialisation avec le modèle PaddleOCR (français + anglais)
ocr = PaddleOCR(
    use_angle_cls=True,   # détecte les textes inclinés
    lang='fr',            # langue française
    use_gpu=False         # CPU mode
)

def extract_text(image_path):
    print(f"\n📄 Traitement: {image_path}")
    result = ocr.ocr(image_path, cls=True)
    
    if result is None or len(result) == 0:
        print("  Aucun texte détecté.")
        return None
        
    for line in result[0]:
        coords, (text, confidence) = line
        print(f"  [{confidence:.2f}] {text}")
    
    return result

# Traiter tous les fichiers du dossier images/
image_dir = "./images"
if not os.path.exists(image_dir):
    os.makedirs(image_dir)

print(f"Extraction OCR lancée sur le dossier : {os.path.abspath(image_dir)}")
found_images = False
for filename in os.listdir(image_dir):
    if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.pdf')):
        found_images = True
        extract_text(os.path.join(image_dir, filename))

if not found_images:
    print("⚠️  Aucune image trouvée dans ./images/. Veuillez ajouter vos factures ou CNI.")
