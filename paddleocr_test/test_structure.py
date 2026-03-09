from paddleocr import PaddleOCR, draw_ocr
from PIL import Image
import matplotlib.pyplot as plt
import os
import sys

# Forcer l'encodage UTF-8 pour Windows
sys.stdout.reconfigure(encoding='utf-8')

ocr = PaddleOCR(use_angle_cls=True, lang='fr', use_gpu=False)

image_dir = "./images"
image_path = os.path.join(image_dir, "facture_1.jpg") # Exemple de défaut

if not os.path.exists(image_path):
    # Chercher n'importe quelle image dans le dossier
    for filename in os.listdir(image_dir):
        if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            image_path = os.path.join(image_dir, filename)
            break

if not os.path.exists(image_path):
    print(f"❌ Image non trouvée: {image_path}. Veuillez ajouter une image dans le dossier images/.")
else:
    print(f"🖼️ Traitement et visualisation de: {image_path}")
    result = ocr.ocr(image_path, cls=True)

    if result and len(result) > 0:
        # Extraction des données
        boxes  = [line[0] for line in result[0]]
        texts  = [line[1][0] for line in result[0]]
        scores = [line[1][1] for line in result[0]]

        # Téléchargement de la police si nécessaire (si non présente lors du test)
        font_path = "./simfang.ttf"
        
        image = Image.open(image_path).convert('RGB')
        annotated = draw_ocr(image, boxes, texts, scores, font_path=font_path)

        plt.figure(figsize=(14, 10))
        plt.imshow(annotated)
        plt.axis('off')
        plt.title(f"Résultat PaddleOCR - {os.path.basename(image_path)}")
        
        output_name = f"./result_{os.path.basename(image_path)}_annotated.png"
        plt.savefig(output_name, dpi=150, bbox_inches='tight')
        print(f"\n✅ Résultat sauvegardé: {output_name}")
        # plt.show() # Peut ne pas s'afficher s'il n'y a pas d'interface graphique
    else:
        print("❌ Aucun texte détecté pour la visualisation.")
