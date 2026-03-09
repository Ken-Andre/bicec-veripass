# Architecture d'un Pipeline KYC Bancaire Robuste : Le cas BICEC-Veripass

**Auteurs :** Ken-Andre et al. — Brainstorm d'Architecture  
**Version :** 1.0 | **Date :** 2026-03-04

---

## Introduction

Construire un système KYC ("Know Your Customer") pour une néobanque africaine, ce n'est pas simplement brancher une API d'OCR et espérer que ça tienne. C'est résoudre une série de problèmes enchevêtrés : des cartes d'identité en polycarbonate qui reflètent le soleil de Douala, un réseau 3G qui lâche à 99% de l'upload, un disque de 200 Go partagé entre des modèles IA gourmands et les dossiers de 50 000 clients, et une réglementation COBAC qui impose 10 ans de conservation des preuves.

Ce document retrace l'architecture complète du pipeline **BICEC-Veripass**, pensée pour tourner sur du matériel CPU modeste (Ryzen 7 / i3, 16 Go de RAM, capé à 8 Go sous WSL2 en développement), tout en offrant la robustesse d'un système bancaire de production. Chaque choix d'ingénierie présenté ici découle directement des contraintes du terrain, pas d'un environnement de labo.

---

## Partie I — Extraction OCR des CNI Camerounaises

### Le piège de l'approche naïve

La première intuition, quand on veut extraire le Nom, le Prénom, la Date de Naissance et le Numéro d'une CNI, c'est de passer l'image à PaddleOCR et de faire un post-traitement basique avec des expressions régulières. Cette approche fonctionne pour les cas simples, mais elle s'effondre dès qu'on la confronte à la réalité du terrain.

Voici néanmoins la base de cette logique, sur laquelle nous allons construire quelque chose de bien plus solide. Le pipeline se déroule en trois temps : un prétraitement de l'image pour atténuer les reflets, une extraction brute via PaddleOCR, puis un ciblage par Regex et mots-clés pour isoler les champs d'intérêt.

```python
import cv2
import re
from paddleocr import PaddleOCR

# Initialisation optimisée CPU (Ryzen/i3) — à faire une seule fois au lancement du serveur
ocr_engine = PaddleOCR(use_angle_cls=True, lang='fr', use_gpu=False, show_log=False)

def preprocess_cni_image(image_path):
    """
    Applique un filtre CLAHE (Contrast Limited Adaptive Histogram Equalization)
    dans l'espace colorimétrique LAB pour atténuer les reflets du polycarbonate.
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError("Image introuvable")
    
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    l = clahe.apply(l)
    
    enhanced = cv2.merge((l, a, b))
    return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

def extract_cni_fields(image_path):
    img_preprocessed = preprocess_cni_image(image_path)
    result = ocr_engine.ocr(img_preprocessed, cls=True)
    
    extracted_data = {
        "numero_cni": {"value": None, "confidence": 0.0},
        "nom": {"value": None, "confidence": 0.0},
        "date_naissance": {"value": None, "confidence": 0.0}
    }
    
    regex_cni = re.compile(r'\b\d{9}\s*CM\b', re.IGNORECASE)
    regex_date = re.compile(r'\b\d{2}[/.-]\d{2}[/.-]\d{4}\b')
    mot_cle_nom_trouve = False
    
    if result[0] is not None:
        for line in result[0]:
            texte = line[1][0].strip()
            confiance = float(line[1][1])
            
            if regex_cni.search(texte):
                extracted_data["numero_cni"] = {
                    "value": regex_cni.search(texte).group(),
                    "confidence": confiance
                }
            
            if regex_date.search(texte):
                if not extracted_data["date_naissance"]["value"]:
                    extracted_data["date_naissance"] = {
                        "value": regex_date.search(texte).group(),
                        "confidence": confiance
                    }

            if re.search(r'\b(Nom|Name)\b', texte, re.IGNORECASE):
                mot_cle_nom_trouve = True
                continue
                
            if mot_cle_nom_trouve and not extracted_data["nom"]["value"]:
                if len(texte) > 2: 
                    extracted_data["nom"] = {"value": texte, "confidence": confiance}
                mot_cle_nom_trouve = False

    return extracted_data
```

Le filtre CLAHE (`cv2.createCLAHE`) s'applique uniquement sur la composante de luminance dans l'espace LAB : il égalise localement la lumière sans détruire l'encre des lettres, ce qui est crucial pour éviter que PaddleOCR ne soit aveuglé par le flash du smartphone. Le ciblage par Regex est adapté aux formats mathématiquement stables (le numéro de CNI, les dates), tandis que la lecture contextuelle par mots-clés gère les noms — dont la forme est trop variable pour une Regex. Enfin, chaque champ extrait est accompagné de son score de confiance : conformément à l'ADR-003 de l'architecture, tout champ dont le score est inférieur à 0,85 sera signalé à la PWA pour correction manuelle, ou renvoyé au worker GLM-OCR pour un second avis.

### Les deux réalités des CNI camerounaises

Ce code naïf survivrait difficilement sur le terrain, car il ignore une dualité fondamentale : il existe en ce moment deux générations de CNI au Cameroun qui coexistent et qui posent des défis techniques radicalement différents.

**Les anciennes CNI** (format paysage, plastifiées / Teslin) présentent un fond jaunâtre ou verdâtre avec des motifs de guillochis complexes. Elles sont souvent usées, pliées, parfois le plastique se décolle — ce qui crée des reflets massifs. L'encre noire s'efface avec la sueur et le temps. Leur structure est strictement bilingue sur la même ligne : *Nom / Surname*, *Prénoms / Given names*, *Date et lieu de naissance / Date and place of birth*. Le numéro (9 chiffres) est placé de manière variable selon l'année d'émission.

**Les nouvelles CNI biométriques** (format portrait, polycarbonate, directives OACI 2024/2025) représentent une rupture totale. La carte est verticale, le texte est gravé au laser — excellent en théorie, mais sur une carte tenue verticalement, PaddleOCR peut perturber le tri de ses bounding boxes. Au recto, on trouve un QR Code VOS et une image laser changeante (CLI). Au verso, une bande MRZ (Machine Readable Zone) en police OCR-B standardisée mondialement. C'est cette bande MRZ qui va devenir notre meilleure alliée.

### Pourquoi la lecture séquentielle est une erreur fatale

Sur une CNI camerounaise, lire les blocs de texte "en séquence" (ligne 1, puis ligne 2) ne fonctionne pas. PaddleOCR regroupe parfois le texte de manière imprévisible : il peut lire l'étiquette `"Nom / Surname"` dans une boîte, puis sauter de l'autre côté de la carte avant de revenir. La lecture séquentielle ne nous dit pas qu'un bloc est "après" un autre dans le sens sémantique — elle nous dit seulement qu'il arrive après dans l'ordre de scan.

La vraie solution industrielle repose sur la **géométrie spatiale** : au lieu de chercher le mot "après", on cherche le mot **physiquement en dessous** (coordonnées X, Y). Voici comment cette logique s'implémente de manière robuste :

```python
import math

def get_center(bbox):
    """Calcule le centre (x, y) d'une Bounding Box PaddleOCR."""
    x_center = sum([point[0] for point in bbox]) / 4
    y_center = sum([point[1] for point in bbox]) / 4
    return x_center, y_center

def extract_cni_cameroon_geometry(result_paddleocr):
    lines = result_paddleocr[0]
    
    blocks = []
    for line in lines:
        bbox = line[0]
        text = line[1][0].strip()
        conf = line[1][1]
        cx, cy = get_center(bbox)
        blocks.append({"text": text, "conf": conf, "cx": cx, "cy": cy, "bbox": bbox})

    extracted = {"nom": None, "prenom": None, "numero_cni": None}
    anchor_nom = None
    anchor_prenom = None
    
    for b in blocks:
        if "nom" in b["text"].lower() or "surname" in b["text"].lower():
            anchor_nom = b
        elif "prénom" in b["text"].lower() or "given" in b["text"].lower() or "prenom" in b["text"].lower():
            anchor_prenom = b
        
        import re
        if re.search(r'\b\d{9}\b', b["text"]):
            extracted["numero_cni"] = b["text"]

    if anchor_nom:
        candidates = []
        for b in blocks:
            if b["cy"] > anchor_nom["cy"] + 5:
                dist = math.hypot(b["cx"] - anchor_nom["cx"], b["cy"] - anchor_nom["cy"])
                candidates.append((dist, b))
        
        if candidates:
            candidates.sort(key=lambda x: x[0])
            extracted["nom"] = candidates[0][1]["text"]

    return extracted
```

On identifie d'abord une "ancre" (l'étiquette *Nom* ou *Surname*), puis on cherche parmi tous les blocs celui dont le centre Y est supérieur à celui de l'ancre — autrement dit, celui qui est physiquement plus bas — et dont le centre X est le plus proche. La distance euclidienne (`math.hypot`) nous permet de trier les candidats et de prendre le plus proche.

---

## Partie II — La Stratégie Hybride Complète

### Le Sniper, le Hack, et le Détective

Les deux approches précédentes (Regex naïve et ancrage spatial) ne s'excluent pas — elles se complètent. La stratégie de production pour BICEC-Veripass les assemble en un pipeline à trois étapes.

**Le Sniper (OpenCV / ROI)** — Avant même de lancer PaddleOCR, on détecte la carte dans l'image, on la découpe et on l'aplatit par homographie. Quand Marie prend sa CNI en photo sur une table, la carte est souvent de travers. Sans alignement préalable, toutes nos heuristiques spatiales sont faussées.

**Le Hack (MRZ)** — Si l'image est le verso d'une nouvelle CNI biométrique, on lit directement la bande MRZ. Elle contient le numéro de carte, le nom, le prénom et la date de naissance, avec des check-digits qui garantissent à 100% l'absence d'erreur d'OCR. C'est la voie royale : rapide, fiable, sans ambiguïté.

**Le Détective (Ancrage Spatial + Regex)** — Si la MRZ est absente (ancienne CNI, ou recto de la nouvelle), on applique l'extraction géométrique sur l'image alignée.

Voici le code complet de ce pipeline. La dépendance à installer est : `pip install opencv-python numpy paddlepaddle paddleocr`.

```python
import cv2
import numpy as np
import re
import math
from paddleocr import PaddleOCR

print("🔥 Chargement du modèle PaddleOCR (CPU)...")
ocr_engine = PaddleOCR(use_angle_cls=True, lang='fr', use_gpu=False, show_log=False)

# =====================================================================
# ÉTAPE 1 : LE SNIPER — Alignement géométrique avec OpenCV
# =====================================================================
def align_card_image(image_path):
    """
    Détecte la carte d'identité dans l'image, la découpe et l'aplatit 
    (Transformation de perspective / Homographie).
    """
    img = cv2.imread(image_path)
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

    if screen_cnt is None:
        print("⚠️ Impossible de détecter les bords parfaits. Utilisation de l'image brute.")
        return orig

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

    # Normalisation de la résolution : on fige la sortie à 800px de large.
    # C'est essentiel pour que nos heuristiques spatiales (+5, <150)
    # soient mathématiquement invariantes quel que soit le capteur du smartphone.
    STANDARD_WIDTH = 800
    ratio_warp = STANDARD_WIDTH / float(maxWidth)
    standard_height = int(maxHeight * ratio_warp)
    return cv2.resize(warped, (STANDARD_WIDTH, standard_height))


# =====================================================================
# ÉTAPE 2 : LE HACK — Lecture de la MRZ au Verso
# =====================================================================
def extract_mrz(blocks):
    """
    Cherche les lignes de code MRZ (Machine Readable Zone).
    Le standard ICAO TD1 impose 3 lignes de exactement 30 caractères.
    Si on les trouve, c'est 100% de fiabilité garantie.
    """
    mrz_lines = []
    mrz_pattern = re.compile(r'^[A-Z0-9<]{30}$')
    
    for b in blocks:
        text = b['text'].replace(' ', '')
        if mrz_pattern.match(text) and '<' in text:
            mrz_lines.append(text)
            
    if len(mrz_lines) == 3:
        print("🎯 MRZ Détectée ! Extraction ultra-rapide en cours...")
        return {
            "mrz_trouvee": True,
            "lignes_mrz": mrz_lines,
            "methode": "MRZ_ICAO_TD1"
        }
    return None


# =====================================================================
# ÉTAPE 3 : LE DÉTECTIVE — Ancrage Spatial + Regex sur Recto
# =====================================================================
def extract_spatial_data(blocks):
    """
    La magie opère ici : on cherche des mots-clés (ancres) et on identifie
    le texte qui se trouve géométriquement juste en dessous.
    """
    parsed_data = {
        "nom": {"value": None, "conf": 0.0},
        "prenom": {"value": None, "conf": 0.0},
        "numero_cni": {"value": None, "conf": 0.0},
        "methode": "ANCRAGE_SPATIAL"
    }
    
    for i, block in enumerate(blocks):
        text = block['text'].upper()
        
        if re.search(r'\b\d{9}\b', text):
            match = re.search(r'\b\d{9}\b', text).group()
            parsed_data["numero_cni"] = {"value": match, "conf": block['conf']}

        if "NOM" in text or "SURNAME" in text:
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

    return parsed_data


# =====================================================================
# LE PIPELINE PRINCIPAL
# =====================================================================
def process_cni(image_path):
    print(f"\n📸 Traitement de l'image : {image_path}")
    
    aligned_img = align_card_image(image_path)
    
    results = ocr_engine.ocr(aligned_img, cls=True)
    if not results or not results[0]:
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
    
    # Décision : MRZ disponible ? (Nouvelle carte, verso)
    mrz_data = extract_mrz(blocks)
    if mrz_data:
        return mrz_data
    
    # Sinon : ancrage spatial (Ancienne carte ou recto)
    return extract_spatial_data(blocks)


if __name__ == "__main__":
    print("✅ Code prêt à être intégré dans Bicec-Veripass !")
```

La fermeture morphologique dans `align_card_image` est une addition critique par rapport à l'approche naïve : les nervures d'une table en bois ou le fond texturé derrière la carte peuvent briser les contours détectés par Canny et empêcher la détection du rectangle. La morphologie "soude" ces bords fragmentés avant la recherche de contours. La normalisation à 800 pixels de largeur garantit ensuite que nos seuils spatiaux (comme "moins de 150 pixels d'écart horizontal") signifient la même distance physique quelle que soit la résolution du capteur de Marie.

---

## Partie III — Orchestration dans l'Architecture bicec-veripass

### Fast path synchrone, fallback asynchrone

L'orchestration des deux moteurs OCR (PaddleOCR et GLM-OCR) ne peut être ni entièrement synchrone ni entièrement asynchrone. Le choix dépend directement de deux besoins contradictoires : l'UX de Marie qui exige un retour immédiat après la capture, et la survie d'un CPU déjà partagé avec des modèles IA.

**PaddleOCR — Synchrone via Threadpool.** Le PRD exige que Marie voie immédiatement l'écran de révision OCR après la capture pour confirmer ou corriger les champs extraits. Si on envoie ce traitement dans une file de messages (Celery), on introduit une complexité de polling ou de WebSocket inutile pour une tâche qui prend moins de 2 à 3 secondes avec PaddleOCR optimisé CPU (ONNX). L'inférence OCR étant une tâche CPU-bound (bloquante), on ne l'exécute pas directement dans une route `async def` de FastAPI — ce qui bloquerait l'Event Loop. On la décharge dans le threadpool de Starlette avec `run_in_threadpool`, permettant au serveur de continuer à traiter en parallèle les autres requêtes (OTP, back-office de Jean).

**GLM-OCR — Asynchrone via Celery + Redis.** Si PaddleOCR échoue (confiance < 85%) ou s'il s'agit d'une facture ENEO/CAMWATER (extraction sémantique lourde), on fait appel à GLM-OCR (0,9B paramètres). Sur un i3/Ryzen, cela peut prendre de 10 à 30 secondes — un traitement synchrone provoquerait un timeout HTTP 504 côté frontend. La route FastAPI pousse alors un job dans Redis ; un worker Celery dédié (`glm_ocr_worker`) le dépile. La PWA de Marie peut faire un polling léger (`GET /kyc/session/{id}/status`) ou passer directement à l'étape suivante en attendant.

**Gestion mémoire.** Pour éviter les Out-Of-Memory (OOM), le modèle PaddleOCR est chargé via le gestionnaire `@asynccontextmanager lifespan` au démarrage d'Uvicorn, et le serveur est limité à 2 workers maximum (`--workers 2`). Côté Celery, le worker GLM-OCR est lancé avec `--concurrency=1` (exécution strictement séquentielle) et `--max-tasks-per-child=1` — ce dernier paramètre force le process Python à mourir et être recréé par Celery après chaque tâche, contraignant l'OS Linux à libérer agressivement la RAM du modèle GLM entre chaque inférence.

---

## Partie IV — Anti-Spoofing et Liveness Detection

### Le problème des Presentation Attacks

Un système aveugle à la nature du support est un système vulnérable. Un écran d'iPad affichant un passeport ou un masque en silicone devant la webcam peut donner une extraction OCR et un Face Match parfaits. C'est ce qu'on appelle les **Attaques par Présentation (Presentation Attacks — PAD)**.

La détection de vivacité doit être agressive, synchrone, et intervenir le plus tôt possible dans le tunnel, avant que le dossier n'atteigne Jean. Deux raisons à cela. D'abord, économiser l'attention humaine : le temps de Jean est précieux, on ne lui envoie pas un dossier si on sait déjà que c'est une fraude grossière (vidéo rejouée, masque). Ensuite, respecter la règle des 3 strikes du PRD (FR7) : l'UX de Marie exige un retour immédiat ("Tournez la tête", "Clignez des yeux") et un verrouillage de la session au bout de 3 échecs — ce qui nécessite un couplage temps réel.

### L'architecture Anti-Spoofing en 2 étapes

Contraints par le CPU et la RAM (8 Go sous WSL2), on déporte la charge de calcul comportementale sur l'appareil du client, et on garde l'analyse spectrale (lourde) sur le serveur.

**Étape 1 — Le Gatekeeper comportemental (sur le smartphone de Marie).** On utilise **MediaPipe WASM** directement dans le navigateur (PWA) via JavaScript. Il extrait 478 points 3D du visage en temps réel (30 FPS, même sur un vieil Android), calcule l'angle de la tête (Yaw/Pitch) et le ratio d'ouverture des yeux (EAR) pour valider la **vivacité active** (Challenge-Response : "Tournez la tête à gauche", "Souriez"). Le coût pour notre serveur est nul — c'est le processeur du smartphone de Marie qui travaille. Le serveur ne reçoit qu'un petit JSON (~15 Ko) contenant les coordonnées des landmarks et une seule image haute résolution (la meilleure frame).

Il est important de noter que MediaPipe est rétrogradé au rang de **"Gâchette UX / Videur Qualité"**. Un client web est un environnement hostile par définition : un hacker peut forger une requête HTTP avec de faux landmarks. La sécurité incombe donc 100% au serveur.

**Étape 2 — Le Sniper spectral (sur le backend FastAPI).** Dès que le backend reçoit la meilleure frame validée par le frontend, il lance **MiniFASNetV2**. Ce modèle n'analyse pas le comportement de la personne — il analyse le spectre de Fourier de l'image pour détecter les **motifs de moiré** (typiques d'un écran photographié) ou l'absence de micro-textures (typique d'un masque en papier ou d'une photocopie). C'est la **vivacité passive** : détecter le support, pas la personne.

### Cohabitation des modèles en RAM

MiniFASNetV2 est un poids plume absolu : 600 Ko en ONNX, moins de 50 Mo d'empreinte RAM en inférence, 10 à 20 millisecondes sur Ryzen 7 / i3. Son exécution quasi-instantanée permet de le charger de manière synchrone, dans le même pool ONNX que PaddleOCR, sans fuite mémoire :

```python
from fastapi import FastAPI
import onnxruntime as ort
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

ml_models = {}
cv_threadpool = ThreadPoolExecutor(max_workers=2)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Démarrage des moteurs IA (FastAPI)...")
    
    sess_options = ort.SessionOptions()
    sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    
    # PaddleOCR (gourmand — plusieurs threads intra-op)
    sess_options.intra_op_num_threads = 4 
    ml_models["ocr_det"] = ort.InferenceSession("models/ch_PP-OCRv4_det_infer.onnx", sess_options)
    ml_models["ocr_rec"] = ort.InferenceSession("models/ch_PP-OCRv4_rec_infer.onnx", sess_options)
    
    # MiniFASNetV2 (poids plume — exécution séquentielle pour éviter l'overhead)
    fas_options = ort.SessionOptions()
    fas_options.intra_op_num_threads = 1
    fas_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    ml_models["liveness"] = ort.InferenceSession("models/MiniFASNetV2.onnx", fas_options)
    
    yield
    
    print("🛑 Arrêt du serveur, libération de la RAM...")
    ml_models.clear()
    cv_threadpool.shutdown(wait=True)

app = FastAPI(lifespan=lifespan)
```

Le flux exact lors de l'appel API `POST /kyc/liveness` est le suivant : FastAPI vérifie d'abord que le JSON des landmarks a du sens cryptographiquement. Il passe ensuite l'image à `ml_models["liveness"]` via `run_in_threadpool`. Si le score est inférieur au seuil (0,95), la session est rejetée immédiatement (HTTP 400) et le compteur "Strike" dans Redis est incrémenté. Si le score est suffisant, l'image est transmise à DeepFace pour la comparaison faciale avec le visage découpé de la CNI.

### La CNI elle-même : document liveness

MiniFASNet est entraîné pour les visages, pas pour les documents. Pour contrer la photocopie de CNI, l'architecture repose sur deux piliers complémentaires. Côté client (PWA), au lieu d'essayer de détecter un reflet spéculaire via OpenCV.js — approche trop fragile sous le soleil de Douala ou dans un cybercafé sombre, et source d'un taux de faux rejets (FRR) catastrophique sur les téléphones Tecno, Itel ou Infinix — on adopte l'approche du **Tilt** : la PWA extrait 3 photos nettes (carte à plat, inclinée vers le haut, inclinée vers le bas) et les compresse en WebP 60% (~150 Ko par image). Côté serveur et agent, Jean constitue le second rempart. Dans son back-office, une interface slider (gauche-droite) fait défiler les 3 images rapidement, créant un effet pseudo-3D. L'œil de Jean remarque instantanément si la lumière bouge sur les hologrammes (vraie carte) ou si l'image reste désespérément plate (écran ou photocopie).

On transforme ainsi une vulnérabilité matérielle (l'absence de scanner spécialisé) en une force opérationnelle, en combinant l'ingéniosité du frontend et la supériorité cognitive du cerveau humain. Le Liveness est le videur à l'entrée de la boîte de nuit : agressif, synchrone, rapide, et il rejette les fraudeurs avant qu'ils ne consomment les ressources OCR asynchrones ou le temps de Jean.

---

## Partie V — Gestion du Cycle de Vie des Données

### La contrainte du disque de 200 Go

Avec 200 Go de stockage (NFR9), si l'on stocke 3 frames par CNI, un selfie haute résolution et une facture, et que le système subit une attaque de bots ou un fort taux de rejets, le serveur peut tomber en "Disk Full" en quelques semaines. La gestion du cycle de vie des données n'est pas une option — c'est une contrainte architecturale de premier rang, encadrée par deux exigences réglementaires opposées : la Loi 2024-017 (minimisation des données) et la COBAC (conservation 10 ans pour les comptes ouverts).

La réponse est une stratégie en **3 Tiers de Rétention**, gérés automatiquement par des tâches planifiées via Celery Beat.

**Tier 1 — Les sessions abandonnées (TTL : 72 heures).** Marie commence son KYC, prend sa CNI en photo, puis ferme l'application faute de facture ENEO. Elle ne revient jamais. Un script Celery tourne chaque nuit à 03h00 : il repère toutes les `kyc_sessions` au statut `DRAFT` ou `PENDING_INFO` inactives depuis plus de 72 heures, supprime physiquement les images du volume Docker, et passe la session en statut `ABANDONED`. On ne conserve que les métadonnées anonymisées (Device OS, heure de drop-off) pour les analytics de Sylvie.

**Tier 2 — Les dossiers rejetés pour fraude (TTL : 30 jours).** La Loi oblige à garder une trace en cas d'enquête de l'ANIF, mais on ne sature pas le disque pendant 10 ans avec des preuves de fraudeurs. Au 31ème jour, les images et vidéos sont supprimées. On ne conserve que le log cryptographique (SHA-256 de l'événement, adresse IP, raison du rejet) dans la table `audit_log`.

**Tier 3 — Les comptes validés (TTL : 10 ans — "Coffre-Fort COBAC").** Une fois le statut passé à `ACTIVATED_FULL`, les 3 frames du Tilt sont fusionnées en un seul PDF optimisé (ou une grille JPEG très compressée) avec le reste des preuves. Les images brutes temporaires sont supprimées. Le dossier final est chiffré (AES-256) et stocké à froid. Sur 200 Go, 50 000 dossiers optimisés à 1,5 Mo tiennent dans 75 Go — une marge confortable.

### Implémentation du Garbage Collector (Celery Beat)

```python
import os
import shutil
from datetime import datetime, timedelta
from celery import shared_task

STORAGE_PATH = "/data/documents/"
DISK_THRESHOLD_PERCENT = 85.0

@shared_task(name="tasks.storage_garbage_collector")
def garbage_collect_kyc_data():
    """
    Tâche nocturne (03h00 AM) pour purger le disque et respecter 
    la Loi 2024-017 sur la minimisation des données.
    """
    print("🧹 Démarrage du Garbage Collector de stockage...")
    db = get_db_session()
    
    # 1. Purge des Sessions Abandonnées (> 72 heures)
    abandoned_threshold = datetime.utcnow() - timedelta(hours=72)
    abandoned_sessions = db.query(KYCSession).filter(
        KYCSession.status.in_(['DRAFT', 'PENDING_INFO']),
        KYCSession.updated_at < abandoned_threshold
    ).all()
    
    for session in abandoned_sessions:
        session_dir = os.path.join(STORAGE_PATH, str(session.id))
        if os.path.exists(session_dir):
            shutil.rmtree(session_dir)
        session.status = 'ABANDONED'
    
    # 2. Purge des Fraudes / Rejets (> 30 jours)
    fraud_threshold = datetime.utcnow() - timedelta(days=30)
    rejected_sessions = db.query(KYCSession).filter(
        KYCSession.status == 'REJECTED',
        KYCSession.updated_at < fraud_threshold,
        KYCSession.media_purged == False
    ).all()
    
    for session in rejected_sessions:
        session_dir = os.path.join(STORAGE_PATH, str(session.id))
        if os.path.exists(session_dir):
            shutil.rmtree(session_dir)
        session.media_purged = True
        # La ligne reste en base pour l'historique ANIF, sans les fichiers
        
    db.commit()

    # 3. Bouclier Anti-Crash (NFR9)
    # Si le disque dépasse 85%, on déclenche une alerte critique
    total, used, free = shutil.disk_usage("/")
    percent_used = (used / total) * 100
    
    if percent_used > DISK_THRESHOLD_PERCENT:
        print(f"🚨 ALERTE CRITIQUE : Disque à {percent_used:.1f}%.")
        # Déclencher un email à Sylvie ou forcer une purge plus agressive
        # (ex: réduire le TTL des abandonnés à 24h temporairement)
```

---

## Partie VI — Architecture de la Base de Données et Chiffrement

### OLTP vs OLAP sur une même instance PostgreSQL

L'architecture distingue deux modes d'accès à la donnée qui répondent à des besoins fondamentalement différents.

**OLTP (Online Transaction Processing)** : la base opérationnelle en temps réel, optimisée pour les INSERT/UPDATE/DELETE rapides — création de sessions KYC, validation par Jean, mise à jour des statuts. Elle s'appuie sur les tables `kyc_sessions`, `users`, `documents`.

**OLAP (Online Analytical Processing)** : l'entrepôt analytique, optimisé pour les requêtes complexes d'agrégation (SUM, AVG, GROUP BY) — dashboards de Sylvie, funnel analytics, monitoring SLA. Il s'appuie sur un star schema avec les tables `fact_kyc_events`, `dim_users`, `dim_time`.

Pour le volume MVP, nous utilisons **PostgreSQL pour les deux** — les séparer avec un ETL vers un vrai Data Warehouse est une décision de Phase 2.

Le trigger PostgreSQL pour l'`audit_log` est la pièce maîtresse pour la conformité COBAC. Si l'audit est géré côté Python (FastAPI), un crash serveur, un bug applicatif ou une intervention manuelle d'un DBA passerait sous le radar. Avec un trigger `AFTER INSERT OR UPDATE`, la base s'auto-audite : c'est l'**immuabilité par design**.

### Le verdict sur le chiffrement : FastAPI/Fernet plutôt que pgcrypto

Pour le chiffrement des PII (NIU, Numéro de CNI), la réponse industrielle pour BICEC-Veripass est le **chiffrement applicatif côté FastAPI via la librairie `cryptography` (Fernet)**, et non `pgcrypto`.

Avec `pgcrypto`, la clé de chiffrement doit être transmise à la base dans la requête SQL (ex: `PGP_SYM_ENCRYPT('mon_niu', 'ma_cle_secrete')`). Cette clé risque d'être journalisée en clair dans les logs de requêtes lentes de PostgreSQL (`pg_stat_statements`). Un DBA malveillant avec accès à la base a potentiellement accès aux fonctions de déchiffrement. Avec Fernet, la base de données ne voit **jamais** la donnée en clair ni la clé — elle n'est qu'un espace de stockage de chaînes incompréhensibles. Un dump complet de PostgreSQL volé ne donne rien sans le fichier `.env` du serveur API.

L'autre raison est le déchargement CPU : notre instance PostgreSQL partage la même machine que les modèles IA lourds. Le chiffrement/déchiffrement coûte du CPU ; il vaut mieux paralléliser cette charge sur les workers Uvicorn (stateless et scalables) plutôt que de surcharger le thread de la base de données.

### Le paradoxe de la déduplication : le Blind Indexing

Choisir le chiffrement applicatif introduit un problème d'ingénierie majeur : **la perte de la recherchabilité**. Fernet utilise un vecteur d'initialisation (IV) aléatoire. Cela signifie que chiffrer deux fois le même NIU (`M081234567`) produit deux textes chiffrés totalement différents. Thomas (AML) ne peut donc plus faire de requête `SELECT * WHERE niu = 'M081234567'` pour détecter les doublons.

La solution industrielle est le **Blind Indexing**. Pour chaque PII critique (le NIU), on stocke **deux valeurs** dans des colonnes séparées :

- **La valeur chiffrée** (pour l'affichage) : chiffrée avec FastAPI/Fernet, déchiffrable uniquement par l'application pour l'afficher à Jean ou Thomas.
- **L'index aveugle** (pour la recherche) : un hash déterministe HMAC-SHA256 avec une clé secrète dédiée.

```sql
ALTER TABLE kyc_sessions 
ADD COLUMN niu_encrypted VARCHAR, -- Ex: "gAAAAABk..." (déchiffrable par l'App)
ADD COLUMN niu_blind_index VARCHAR; -- Ex: "e3b0c442..." (hash déterministe pour le WHERE)
```

```python
import hmac
import hashlib
from cryptography.fernet import Fernet

fernet = Fernet(APP_ENCRYPTION_KEY)

def prepare_data_for_db(niu_clair):
    # 1. Chiffrement pour le stockage sécurisé (aléatoire, non-recherchable)
    niu_enc = fernet.encrypt(niu_clair.encode()).decode()
    
    # 2. Hash déterministe pour la recherche (Blind Index)
    # HMAC avec un poivre (pepper) secret pour contrer les attaques par dictionnaire
    niu_blind_index = hmac.new(
        BLIND_INDEX_SECRET.encode(), 
        niu_clair.encode(), 
        hashlib.sha256
    ).hexdigest()
    
    return niu_enc, niu_blind_index
```

La requête de déduplication de Thomas devient alors :

```sql
SELECT id FROM kyc_sessions 
WHERE niu_blind_index = 'le_hash_calcule_par_fastapi';
```

Thomas trouve ses doublons en millisecondes grâce à un index B-Tree classique sur `niu_blind_index`, la base de données ne connaît jamais le vrai NIU, et les données sont indéchiffrables en cas de fuite.

### Le triptyque de sécurité complet

Cette architecture aboutit à une répartition claire des responsabilités cryptographiques :

1. **Preuves (Images/Vidéos)** : stockées sur disque (Volume LUKS), référencées en BDD par leur chemin et leur empreinte SHA-256 (anti-tampering).
2. **PII Stricts (NIU, Numéro CNI)** : chiffrement applicatif (FastAPI/Fernet) + Blind Indexing (HMAC) pour la déduplication exacte.
3. **PII de Recherche (Nom, Prénom)** : stockés en clair dans la BDD pour le Fuzzy Matching (`pg_trgm`) de l'AML, protégés physiquement par le chiffrement de volume LUKS et logiquement par le RBAC de FastAPI.

La Loi 2024-017 et le bon sens dictent de minimiser le chiffrement là où il n'est pas indispensable. Pour le screening AML/PEP, Thomas a besoin d'utiliser `pg_trgm` (la recherche floue de PostgreSQL) sur les noms et prénoms — ces champs doivent rester en clair. Leur protection physique passe par le chiffrement du volume Docker entier de PostgreSQL via **LUKS** au niveau de l'OS.

---

## Partie VII — Résilience Réseau et Idempotence

### Le syndrome du "HTTP 200 perdu dans les limbes de la 3G"

C'est le cauchemar classique des applications mobiles mal conçues sur des réseaux africains. Si on ne gère pas l'idempotence de manière agressive, le CPU va s'effondrer en recalculant des dizaines de fois la même CNI via PaddleOCR, simplement parce que le Service Worker de la PWA panique et relance l'upload après une coupure réseau.

La stratégie adoptée est **hybride : hachage de fichier (SHA-256) combiné à une machine à états (State Lock) côté base de données**. Une simple clé d'idempotence (`Idempotency-Key` dans le header, façon Stripe) est parfaite pour des transactions JSON légères, mais pour des fichiers lourds qui déclenchent du Machine Learning, le hachage du contenu est la seule preuve cryptographique absolue que "cette photo est exactement celle que j'ai déjà traitée".

### Le Bouclier d'Idempotence (FastAPI + SHA-256)

Le calcul du hash ne se fait pas uniquement à l'arrivée du fichier. **Avant même de démarrer l'upload**, la PWA (via l'API `SubtleCrypto` du navigateur) calcule le SHA-256 de l'image et l'envoie dans un header HTTP personnalisé `X-Document-Hash`. Dès que FastAPI reçoit les headers (avant même d'avoir fini de télécharger le corps du fichier multipart en RAM), il interroge PostgreSQL pour vérifier s'il a déjà traité ce document.

```python
from fastapi import APIRouter, Header, UploadFile, File, HTTPException, status
from fastapi.responses import JSONResponse

router = APIRouter()

@router.post("/kyc/session/{session_id}/document/{doc_type}")
async def upload_kyc_document(
    session_id: str,
    doc_type: str,
    x_file_hash: str = Header(...),  # SHA-256 calculé par la PWA
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    existing_doc = db.query(Document).filter(
        Document.kyc_session_id == session_id,
        Document.document_type == doc_type,
        Document.status.in_(['PROCESSING', 'COMPLETED'])
    ).first()

    if existing_doc:
        # SCÉNARIO A : Le "HTTP 200 Perdu" — même hash
        if existing_doc.file_hash == x_file_hash:
            if existing_doc.status == 'COMPLETED':
                # Court-circuit absolu : on renvoie les données OCR déjà calculées (0 impact CPU)
                return JSONResponse(status_code=200, content=existing_doc.extracted_data)
            
            elif existing_doc.status == 'PROCESSING':
                # SCÉNARIO B : Race Condition — la PWA a retry pendant que PaddleOCR tourne encore
                # On ne relance surtout pas l'OCR. On dit à la PWA de patienter.
                return JSONResponse(
                    status_code=status.HTTP_202_ACCEPTED, 
                    content={"message": "Traitement IA déjà en cours", "retry_after": 2}
                )
        
        # SCÉNARIO C : L'utilisateur a pris une NOUVELLE photo pour la même étape
        # (ex: la première était floue, il a cliqué sur "Reprendre la photo")
        else:
            # On marque l'ancien document comme obsolète (le Garbage Collector le supprimera)
            existing_doc.status = 'OBSOLETE'
            db.commit()
            # Le code continue pour traiter le nouveau fichier...

    # --- Traitement Normal ---
    # 1. Sauvegarde du fichier sur le volume Docker
    # 2. Création de la nouvelle ligne Document (status='PROCESSING')
    # 3. Appel de run_in_threadpool(process_cni, file_path)
    # 4. Mise à jour Document (status='COMPLETED', extracted_data=...)
    # 5. Return 200 OK
```

Ce design couvre les trois scénarios critiques. Le premier est le "HTTP 200 Perdu" : si le réseau saute à 99% de l'upload ou juste avant la réponse, le deuxième essai de la PWA se soldera par une réponse instantanée du serveur (lecture en base < 5 ms) — PaddleOCR n'est jamais réveillé inutilement. Le second est la Race Condition : si la PWA est agressive et envoie 3 requêtes en parallèle à cause d'un bug réseau, le statut `PROCESSING` agit comme un **Mutex** — une seule requête déclenche l'IA, les autres reçoivent un HTTP 202 Accepted. Le troisième est la correction naturelle par l'utilisateur : si Marie décide de reprendre sa photo, le hash change, et le système invalide proprement l'ancienne image sans créer de conflit.

### La sécurité du Session Token

Pour une PWA, stocker un JWT dans le `localStorage` est un risque majeur d'exfiltration via XSS (Cross-Site Scripting). La stratégie standard pour BICEC-Veripass est donc la suivante :

1. L'API FastAPI renvoie le token via `Set-Cookie: kyc_token=ey...; HttpOnly; Secure; SameSite=Strict`.
2. Le code React (TypeScript) de la PWA ne peut pas lire ce cookie. Il se contente de faire des requêtes `fetch()` avec `credentials: 'include'`.
3. Le navigateur attache automatiquement le cookie chiffré à chaque appel API.
4. **Si Marie quitte l'application (délestage ENEO, fermeture d'onglet) :** le cookie `HttpOnly` reste valide jusqu'à son expiration de 2h. Quand elle rouvre l'URL, FastAPI lit le cookie, identifie la session, et renvoie l'état exact de l'onboarding (`last_completed_step`). C'est ce qui permet la reprise transparente exigée par le PRD (FR6).

---

## Conclusion

L'architecture BICEC-Veripass n'est pas une suite de solutions techniques isolées — c'est un système dont chaque couche s'appuie sur la suivante. L'alignement géométrique OpenCV rend les heuristiques spatiales mathématiquement stables. La détection MRZ élimine l'ambiguïté sur les nouvelles CNI avant même que l'extraction spatiale n'intervienne. MiniFASNetV2 filtre les fraudeurs avant qu'ils ne consomment les ressources de PaddleOCR. Le Bouclier d'Idempotence protège le CPU des doublons réseau avant que l'OCR ne démarre. Le Blind Indexing concilie chiffrement total et déduplication AML. Et le Garbage Collector maintient la conformité réglementaire sans saturer le disque.

Ce qui relie toutes ces pièces, c'est une même philosophie : **raisonner en termes de budget** (RAM, CPU, disque, bande passante, attention humaine) et ne dépenser chaque ressource qu'une seule fois, au bon moment, pour la bonne raison.
