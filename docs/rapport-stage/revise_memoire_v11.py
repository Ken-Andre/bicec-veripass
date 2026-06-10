from __future__ import annotations

import re
import shutil
from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.shared import Inches
from docx.text.paragraph import Paragraph
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "docs" / "rapport-stage" / "memoire-stage-andre-yoann-kenmogne-v9.docx"
OUT = ROOT / "docs" / "rapport-stage" / "memoire-stage-andre-yoann-kenmogne-v11.docx"
FIG_DIR = ROOT / "docs" / "rapport-stage" / "figures"
FIG_TECH = FIG_DIR / "v11_budget_memoire_ocr.png"
FIG_COST = FIG_DIR / "v11_cout_transport.png"


def set_text(paragraph: Paragraph, text: str) -> None:
    style = paragraph.style
    for run in paragraph.runs:
        run.text = ""
    paragraph.add_run(text)
    paragraph.style = style


def insert_after(paragraph: Paragraph, text: str = "", style: str | None = None) -> Paragraph:
    new_p = OxmlElement("w:p")
    paragraph._p.addnext(new_p)
    p = Paragraph(new_p, paragraph._parent)
    if style:
        p.style = style
    if text:
        p.add_run(text)
    return p


def find_contains(doc: Document, needle: str) -> Paragraph:
    for p in doc.paragraphs:
        if needle in p.text:
            return p
    raise ValueError(f"Paragraph containing {needle!r} not found")


def find_exact(doc: Document, text: str) -> Paragraph:
    for p in doc.paragraphs:
        if p.text.strip() == text:
            return p
    raise ValueError(f"Paragraph {text!r} not found")


def replace_exact(doc: Document, old: str, new: str) -> None:
    set_text(find_exact(doc, old), new)


def add_paragraphs_after(paragraph: Paragraph, texts: list[str], style: str = "Memoire Body") -> Paragraph:
    cur = paragraph
    for text in texts:
        cur = insert_after(cur, text, style)
    return cur


def insert_figure_after(
    paragraph: Paragraph,
    image_path: Path,
    caption: str,
    source: str,
    width_inches: float,
) -> Paragraph:
    image_p = insert_after(paragraph, "", "Memoire Body")
    image_p.alignment = 1
    image_p.add_run().add_picture(str(image_path), width=Inches(width_inches))
    caption_p = insert_after(image_p, caption, "Caption Memoire")
    source_p = insert_after(caption_p, source, "Source Memoire")
    return source_p


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/calibrib.ttf" if bold else "C:/Windows/Fonts/calibri.ttf"),
    ]
    for item in candidates:
        if item.exists():
            return ImageFont.truetype(str(item), size=size)
    return ImageFont.load_default()


def draw_text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, size: int, fill: str, bold: bool = False) -> None:
    draw.text(xy, text, font=font(size, bold), fill=fill)


def make_figures() -> None:
    FIG_DIR.mkdir(parents=True, exist_ok=True)

    img = Image.new("RGB", (1500, 700), "white")
    d = ImageDraw.Draw(img)
    blue = "#1f4e79"
    green = "#2f7d4f"
    orange = "#c46a00"
    gray = "#505050"
    light_blue = "#eaf2f8"
    light_green = "#edf7ef"
    light_orange = "#fff1df"

    d.rectangle((0, 0, 1500, 70), fill=blue)
    draw_text(d, (36, 20), "Budget memoire, seuils OCR et decision de fallback", 28, "white", True)

    d.rectangle((45, 105, 475, 520), outline=blue, width=3, fill=light_blue)
    draw_text(d, (75, 130), "Contrainte locale", 24, blue, True)
    draw_text(d, (75, 180), "Machine de developpement : 16 Go RAM", 22, gray)
    draw_text(d, (75, 225), "M_total = M_base + M_Paddle + M_GLM", 21, gray)
    draw_text(d, (75, 270), "M_total = 2,5 Go + 2,5 Go + 3,5 Go", 21, gray)
    draw_text(d, (75, 315), "M_total = 8,5 Go", 26, blue, True)
    draw_text(d, (75, 370), "Regle : concurrence faible pour", 20, gray)
    draw_text(d, (75, 410), "les traitements IA couteux", 20, gray)

    d.rectangle((535, 105, 980, 520), outline=green, width=3, fill=light_green)
    draw_text(d, (565, 130), "Score et seuils", 24, green, True)
    draw_text(d, (565, 180), "S_ocr(d) = somme(w_f c_f) / somme(w_f)", 21, gray)
    draw_text(d, (565, 230), "Seuil extraction : 0,90", 22, gray)
    draw_text(d, (565, 275), "Seuil edition client : 0,95", 22, gray)
    draw_text(d, (565, 320), "GLM(d) = 1 si min(c_f) < 0,90", 21, gray)
    draw_text(d, (565, 360), "ou n_champs(d) < 2", 21, gray)
    draw_text(d, (565, 410), "Sinon, revue OCR classique", 20, gray)

    d.rectangle((1040, 105, 1455, 520), outline=orange, width=3, fill=light_orange)
    draw_text(d, (1070, 130), "Preuve locale OCR", 24, orange, True)
    axes_x, axes_y = 1100, 420
    d.line((axes_x, 185, axes_x, axes_y), fill=gray, width=2)
    d.line((axes_x, axes_y, 1315, axes_y), fill=gray, width=2)
    values = [(53, "Passe initiale"), (60, "Agregat final"), (8, "Tests regles")]
    max_v = 60
    bar_w = 54
    for idx, (value, label) in enumerate(values):
        x = axes_x + 42 + idx * 95
        h = int((value / max_v) * 190)
        d.rectangle((x, axes_y - h, x + bar_w, axes_y), fill=[orange, green, blue][idx])
        draw_text(d, (x + 8, axes_y - h - 34), str(value), 22, gray, True)
        words = label.split()
        draw_text(d, (x - 18, axes_y + 20), words[0], 16, gray)
        if len(words) > 1:
            draw_text(d, (x - 18, axes_y + 44), " ".join(words[1:]), 16, gray)
    draw_text(d, (65, 575), "Lecture : la figure relie la contrainte RAM, les seuils de confiance et la preuve OCR locale.", 21, gray)
    draw_text(d, (65, 615), "Le 60/60 signifie au moins une revue exploitable apres reprises, pas une precision par champ.", 21, gray)
    img.save(FIG_TECH)

    img2 = Image.new("RGB", (1400, 470), "white")
    d2 = ImageDraw.Draw(img2)
    d2.rectangle((0, 0, 1400, 68), fill=blue)
    draw_text(d2, (36, 19), "Cout de transport du stage jusqu'au 19 juin 2026", 28, "white", True)
    draw_text(d2, (70, 100), "Hypothese : 2 200 FCFA aller retour, 5 jours par semaine, jours feries non deduits", 22, gray)
    draw_text(d2, (70, 140), "Du 19 janvier 2026 au 19 juin 2026 : 110 jours ouvres", 22, gray)
    draw_text(d2, (70, 185), "C_transport = 2 200 x 110 = 242 000 FCFA", 28, blue, True)
    x0, y0, x1, y1 = 90, 385, 1290, 245
    d2.line((x0, y0, x0, y1), fill=gray, width=2)
    d2.line((x0, y0, x1, y0), fill=gray, width=2)
    months = [("Jan", 10), ("Fev", 30), ("Mar", 52), ("Avr", 74), ("Mai", 96), ("Juin", 110)]
    prev = None
    for idx, (label, days) in enumerate(months):
        x = x0 + int((days / 110) * (x1 - x0))
        y = y0 - int((days / 110) * (y0 - y1))
        if prev:
            d2.line((prev[0], prev[1], x, y), fill=green, width=5)
        d2.ellipse((x - 7, y - 7, x + 7, y + 7), fill=orange)
        draw_text(d2, (x - 18, y0 + 22), label, 18, gray)
        prev = (x, y)
    draw_text(d2, (1070, 218), "242 000 FCFA", 24, green, True)
    draw_text(d2, (70, 420), "Ce montant isole seulement le transport. Les autres postes doivent etre chiffres par factures ou journaux.", 18, gray)
    img2.save(FIG_COST)


def update_front_lists(doc: Document) -> None:
    try:
        fig5 = find_exact(doc, "Figure 5. File back office de validation KYC et indicateurs de suivi")
    except ValueError:
        return
    add_paragraphs_after(
        fig5,
        [
            "Figure 6. Budget mémoire, seuils OCR et décision de fallback",
            "Figure 7. Courbe cumulative du coût de transport du stage",
        ],
        "Front Matter",
    )


def add_bibliography_entries(doc: Document) -> None:
    marker = find_exact(
        doc,
        "Du, Y., Li, C., Guo, R., Yin, X., Liu, W., Zhou, J., Bai, Y., Yu, Z., Yang, Y., Dang, Q., & Wang, H. (2020). PP OCR: A practical ultra lightweight OCR system. arXiv. https://arxiv.org/abs/2009.09941",
    )
    add_paragraphs_after(
        marker,
        [
            "Cui, C., Zhang, Y., Sun, T., Wang, X., Liu, H., Lin, M., et al. (2026). PP OCRv5: A specialized 5M parameter model rivaling billion parameter vision language models on OCR tasks. arXiv. https://arxiv.org/abs/2603.24373",
            "Duan, S., Xue, Y., Wang, W., Su, Z., Liu, H., Yang, S., et al. (2026). GLM OCR technical report. arXiv. https://arxiv.org/abs/2603.10910",
            "PaddleOCR. (2026). General OCR pipeline usage guide. https://www.paddleocr.ai/v3.0.0/en/version3.x/pipeline_usage/OCR.html",
            "zai org. (2026). GLM OCR. GitHub. https://github.com/zai-org/GLM-OCR",
        ],
        "Bibliographie",
    )


def replace_content(doc: Document) -> None:
    replace_exact(
        doc,
        "Conception et développement d'un écosystème intelligent d'acquisition client\nIntégration de mécanismes avancés de vérification pour l'automatisation de la conformité KYC",
        "Conception et développement d'un écosystème d'acquisition client pour l'automatisation contrôlée de la conformité KYC à la BICEC\nCas de BICEC VeriPass : vérification documentaire OCR et contrôle biométrique assisté",
    )

    replace_exact(
        doc,
        "La solution proposée vise à réduire les reprises de saisie, les relances liées aux pièces illisibles et la dispersion des preuves. Elle combine une application mobile de capture, une API FastAPI, une base PostgreSQL, des traitements asynchrones Redis/Celery, un pipeline OCR, une vérification de vivacité, une comparaison faciale et un back office de validation. L'automatisation prépare le dossier, mais la décision finale reste portée par un acteur habilité et journalisée dans le système.",
        "La solution proposée vise à préparer une réduction mesurable des reprises de saisie, des relances liées aux pièces illisibles et de la dispersion des preuves, sous réserve d'une validation en phase pilote. Elle combine une application mobile de capture, une API FastAPI, une base PostgreSQL, des traitements asynchrones Redis/Celery, un pipeline OCR, une vérification de vivacité, une comparaison faciale et un back office de validation. L'automatisation prépare le dossier, mais la décision finale reste portée par un acteur habilité et journalisée dans le système.",
    )
    replace_exact(
        doc,
        "The proposed solution reduces manual re-entry, limits follow-up requests caused by unreadable documents, and gives back office agents a structured digital dossier. It combines a mobile capture journey, a FastAPI backend, PostgreSQL persistence, Redis/Celery asynchronous processing, OCR, liveness verification, face matching and a human validation back office. Automation does not replace the compliance decision; it prepares and qualifies the dossier so that the final decision remains explainable, documented and auditable.",
        "The proposed solution prepares a measurable reduction of manual re-entry, follow-up requests caused by unreadable documents and evidence dispersion, subject to validation during a pilot phase. It combines a mobile capture journey, a FastAPI backend, PostgreSQL persistence, Redis/Celery asynchronous processing, OCR, liveness verification, face matching and a human validation back office. Automation does not replace the compliance decision; it prepares and qualifies the dossier so that the final decision remains explainable, documented and auditable.",
    )

    replace_exact(
        doc,
        "La BICEC, acteur majeur du paysage bancaire camerounais, a donc un intérêt stratégique à digitaliser ce parcours sans affaiblir le contrôle réglementaire. Le sujet de stage validé porte sur la conception et le développement d'un écosystème d'acquisition client intégrant des mécanismes de vérification KYC. Dans ce mémoire, cette formulation est traitée comme un problème d'ingénierie : transformer une demande client en dossier numérique exploitable, vérifiable, conservé, auditable et routé vers les acteurs internes compétents.",
        "Pour la BICEC, l'enjeu consiste à moderniser l'entrée en relation tout en conservant les garanties attendues d'un établissement bancaire soumis aux exigences COBAC. Le sujet de stage validé porte sur la conception et le développement d'un écosystème d'acquisition client intégrant des mécanismes de vérification KYC. Dans ce mémoire, cette formulation est traitée comme un problème d'ingénierie : transformer une demande client en dossier numérique exploitable, vérifiable, conservé, auditable et routé vers les acteurs internes compétents.",
    )
    replace_exact(
        doc,
        "La problématique centrale du mémoire peut donc être formulée ainsi : comment concevoir et implémenter une plateforme numérique d'onboarding capable de réduire les reprises et les délais de constitution d'un dossier KYC, tout en maintenant une conformité, une sécurité et une auditabilité compatibles avec les exigences bancaires de la zone CEMAC ?",
        "La problématique porte ainsi sur la capacité à transformer une demande d'ouverture en dossier KYC numérique, vérifiable et traçable, sans déplacer la décision bancaire hors du contrôle des acteurs habilités.",
    )
    replace_exact(
        doc,
        "Cette problématique se décline en plusieurs questions opérationnelles. Comment collecter les pièces KYC de façon guidée depuis un smartphone ? Comment extraire automatiquement les informations utiles sans supprimer la possibilité de correction humaine ? Comment vérifier la présence du client et la cohérence biométrique ? Comment stocker les preuves et les métadonnées en garantissant l'intégrité du dossier ? Comment organiser une file de validation adaptée aux rôles internes de la banque ? Enfin, comment fournir des indicateurs permettant au management de suivre les délais, les erreurs, les rejets et la charge opérationnelle ?",
        "Elle conduit à plusieurs questions d'ingénierie : guider la capture depuis un smartphone, extraire les champs utiles malgré les défauts d'image, maintenir la correction humaine, vérifier la présence du client, conserver les preuves avec intégrité, organiser la revue interne et produire des indicateurs de délai, de reprise, de rejet et de charge.",
    )
    replace_exact(
        doc,
        "L'ouverture de compte est un point de contact décisif dans la relation client. Dans un marché camerounais marqué par l'usage courant du Mobile Money et par la diffusion des services financiers digitaux, les clients comparent de plus en plus l'expérience bancaire aux parcours mobiles simples et disponibles à distance. Face à ces usages, un parcours d'ouverture de compte centré sur l'agence, le papier et les allers retours administratifs perd en attractivité.",
        "L'ouverture de compte est un point de contact décisif dans la relation client. Dans un marché camerounais marqué par l'usage courant du Mobile Money et par la diffusion des services financiers digitaux, les clients comparent de plus en plus l'expérience bancaire aux parcours mobiles simples et disponibles à distance. Face à ces usages, un parcours d'ouverture de compte centré sur l'agence, le papier et les relances administratives devient moins compétitif.",
    )

    replace_exact(
        doc,
        "La consommation de tokens et de services d'assistance doit être suivie comme une charge de conception, au même titre que les coûts de connexion ou de calcul. Elle reste maîtrisée lorsque les tâches répétitives sont transformées en scripts, preuves de tests et documents de cadrage réutilisables. Dans une perspective de reproduction industrielle, le juste chiffrage devra distinguer les coûts déjà supportés par le stage, les coûts internes BICEC, et les coûts nouveaux liés à l'hébergement, à la sécurité, au pilote et à l'exploitation.",
        "Les coûts d'outillage, d'assistance au développement, de calcul et de documentation doivent être intégrés à l'évaluation du prototype. Ils permettent de distinguer l'effort réel de conception, les ressources déjà disponibles en interne et les charges nouvelles liées à l'hébergement, à la sécurité, au pilote et à l'exploitation. Cette lecture évite de sous estimer un projet qui combine développement logiciel, data, IA, sécurité, preuves de test et coordination métier.",
    )

    replace_exact(
        doc,
        "Dans ce contexte, l'approche retenue par VeriPass reste volontairement hybride. PaddleOCR est utilisé comme première passe locale pour détecter et reconnaître le texte, dans l'esprit des systèmes OCR légers conçus pour équilibrer vitesse et précision (Du et al., 2020). Lorsque la qualité de capture ou la structure du document rend cette première passe insuffisante, le pipeline prévoit un traitement différé et une revue humaine, plutôt qu'une acceptation silencieuse d'un champ incertain.",
        "Dans ce contexte, l'approche retenue par VeriPass reste hybride. PaddleOCR est utilisé comme première passe locale pour détecter et reconnaître le texte, dans l'esprit des systèmes OCR légers conçus pour équilibrer vitesse et précision (Du et al., 2020). La documentation PaddleOCR indique que la version PP OCRv5 mobile améliore le comportement du pipeline général par rapport à PP OCRv4 mobile dans plusieurs scénarios et donne des repères de taille et de temps d'inférence utiles au choix d'un moteur embarquable (PaddleOCR, 2026). Cette source ne prouve pas la performance sur CNI camerounaises, mais elle justifie un choix de départ sobre, local et compatible avec une machine de développement limitée.",
    )
    add_paragraphs_after(
        find_contains(doc, "compatible avec une machine de développement limitée."),
        [
            "Pour les CNI camerounaises, la difficulté ne vient pas seulement de la reconnaissance de caractères. Elle vient aussi du support plastifié, des reflets, du flou mobile, de la disposition bilingue et de la variabilité entre recto et verso. VeriPass retient donc une chaîne en trois temps : prétraitement de l'image, extraction PaddleOCR locale, puis post traitement par règles sur les champs critiques comme le numéro CNI, le nom, la date de naissance et la date d'expiration.",
            "GLM OCR intervient comme renfort différé. Son rapport technique le présente comme un modèle multimodal compact de 0,9 milliard de paramètres pour la compréhension documentaire complexe (Duan et al., 2026), tandis que son dépôt officiel décrit un pipeline combinant analyse de mise en page et reconnaissance parallèle de régions (zai org, 2026). Dans VeriPass, cette capacité est utilisée avec prudence : elle soutient les cas difficiles, mais la preuve locale reste la boucle OCR du projet et la validation humaine.",
        ],
        "Memoire Body",
    )
    replace_exact(
        doc,
        "Cette rareté a eu une conséquence directe sur le projet. Il n'était pas acceptable de constituer librement un corpus de CNI réelles, car ces pièces exposent des identités, des signatures, des photos et des numéros sensibles. Le travail expérimental a donc combiné images disponibles dans un cadre contrôlé, génération exploratoire, inspection visuelle, et transformation des erreurs observées en règles générales de post traitement. Les notebooks Marimo ont joué le rôle de laboratoire : ils permettaient de lancer une expérience OCR, d'observer les blocs reconnus, de comparer les sorties, puis de rapatrier seulement les règles validées dans le service backend.",
        "Cette rareté a eu une conséquence directe sur le projet. Il n'était pas acceptable de constituer librement un corpus de CNI réelles, car ces pièces exposent des identités, des signatures, des photos et des numéros sensibles. L'expérimentation OCR a donc été conduite comme un dispositif contrôlé : observation des blocs reconnus, comparaison des sorties, identification des erreurs récurrentes, puis intégration progressive des règles stabilisées dans le backend.",
    )

    tech_anchor = find_contains(doc, "Sur une machine de 16 Go de RAM")
    add_paragraphs_after(
        tech_anchor,
        [
            "La contrainte peut être résumée par l'équation suivante : M_total = M_base + M_Paddle + M_GLM = 2,5 Go + 2,5 Go + 3,5 Go = 8,5 Go. Cette marge explique l'usage de Redis pour les files et les verrous, de Celery pour les traitements longs, et de PostgreSQL pour la vérité métier transactionnelle. Elle explique aussi le chargement différé des modèles, le contrôle des files et le refus de traiter toutes les captures avec le moteur le plus coûteux.",
        ],
        "Memoire Body",
    )
    insert_figure_after(
        find_contains(doc, "le refus de traiter toutes les captures avec le moteur le plus coûteux."),
        FIG_TECH,
        "Figure 6. Budget mémoire, seuils OCR et décision de fallback",
        "Source : auteur, d'après docs/analysis-issue-9-ports-wsl2.md, code/backend/app/core/config.py et docs/test-evidence/ocr-beta-loop/report.md.",
        5.9,
    )

    replace_exact(
        doc,
        "Le pipeline part de la capture mobile. Le client ouvre une session, transmet les pièces attendues et confirme les données extraites. Chaque document est stocké dans un volume documentaire, tandis que PostgreSQL conserve le type de document, le chemin relatif, le hash, le statut OCR et les métriques de qualité.",
        "Le pipeline part de la capture mobile. Le client ouvre une session, transmet les pièces attendues et confirme les données extraites. Chaque document est stocké dans un volume documentaire, tandis que PostgreSQL conserve le type de document, le chemin relatif, le hash, le statut OCR et les métriques de qualité. Les états dégradés doivent aussi rester visibles : LOCKED_LIVENESS signale un verrouillage temporaire après échecs répétés de preuve de vie, tandis que ABANDONED représente un dossier interrompu avant soumission.",
    )

    replace_exact(
        doc,
        "Le traitement OCR vise à extraire les champs utiles de la CNI : nom, prénom, date de naissance, numéro du document, date d'expiration et informations complémentaires disponibles selon la qualité de la capture. Le choix technique documenté dans le projet repose sur PaddleOCR comme moteur rapide, avec un traitement GLM/OCR possible pour les cas plus complexes.",
        "Le traitement OCR vise à extraire les champs utiles de la CNI : nom, prénom, date de naissance, numéro du document, date d'expiration et informations complémentaires disponibles selon la qualité de la capture. Le choix technique documenté dans le projet repose sur PaddleOCR comme moteur rapide, avec un traitement GLM OCR possible pour les cas plus complexes.",
    )
    replace_exact(
        doc,
        "Le prétraitement des images est nécessaire avant reconnaissance. Il comprend le contrôle de cadrage, la détection de flou, la normalisation de la luminosité, la réduction du bruit et la vérification que la pièce occupe une zone suffisante de l'image. Ces opérations ne garantissent pas une extraction parfaite, mais elles augmentent la probabilité de produire des champs exploitables.",
        "Le prétraitement des images est nécessaire avant reconnaissance. Il comprend le contrôle de cadrage, la détection de flou, la normalisation de la luminosité, la réduction du bruit et la vérification que la pièce occupe une zone suffisante de l'image. La largeur OCR configurée à 600 pixels traduit un compromis : limiter le coût mémoire et la latence, tout en conservant une qualité suffisante sur les champs recherchés. Ces opérations ne garantissent pas une extraction parfaite, mais elles augmentent la probabilité de produire des champs exploitables.",
    )
    add_paragraphs_after(
        find_contains(doc, "doivent être considérés comme des paramètres métier"),
        [
            "La règle de décision peut être exprimée simplement. Le score global d'un document est calculé par S_ocr(d) = somme(w_f c_f) / somme(w_f), où c_f représente la confiance du champ f et w_f son poids métier. Dans la configuration du prototype, le seuil de confiance OCR est fixé à 0,90, tandis que le seuil d'édition client est fixé à 0,95. Le déclenchement GLM OCR reste conditionnel : GLM(d) = 1 si min(c_f) < 0,90 ou n_champs(d) < 2. Cette règle protège la mémoire disponible et réserve le moteur plus coûteux aux documents qui le justifient.",
            "Les post traitements transforment une sortie OCR brute en donnée contrôlable. Les champs sont normalisés, les dates sont vérifiées, le numéro CNI est contrôlé par format, et les incohérences entre date d'émission et date d'expiration déclenchent une revue. Un champ validé par l'utilisateur conserve sa trace de correction, afin de distinguer valeur extraite, valeur corrigée et valeur retenue.",
        ],
        "Memoire Body",
    )

    replace_exact(
        doc,
        "Le choix PostgreSQL se justifie aussi par la distinction entre OLTP et OLAP. VeriPass doit d'abord instruire des dossiers, enregistrer des décisions et préserver des transitions cohérentes ; il relève donc d'un besoin transactionnel. Une architecture OLAP serait pertinente pour analyser les volumes, les délais et les motifs de rejet à partir de données agrégées, mais elle ne doit pas porter la décision KYC en temps réel. Le modèle retenu prépare donc le décisionnel sans sacrifier la cohérence opérationnelle.",
        "Le choix PostgreSQL se justifie aussi par la distinction entre OLTP et OLAP. VeriPass doit d'abord instruire des dossiers, enregistrer des décisions et préserver des transitions cohérentes; il relève donc d'un besoin transactionnel. Une architecture OLAP serait pertinente pour analyser les volumes, les délais et les motifs de rejet à partir de données agrégées, mais elle ne doit pas porter la décision KYC en temps réel. Le modèle retenu prépare donc le décisionnel sans sacrifier la cohérence opérationnelle.",
    )
    replace_exact(
        doc,
        "Dans cette logique, le référentiel de données n'est pas un entrepôt analytique. Il identifie les objets métier stables, les entités persistantes et les relations qui rendent le dossier interprétable. Les champs JSONB absorbent les sorties variables des moteurs, mais les responsabilités critiques restent relationnelles : dossier, document, champ, biométrie, décision et audit.",
        "Dans cette logique, le référentiel de données n'est pas un entrepôt analytique. Il identifie cinq objets métier stables : dossier KYC, document, champ OCR, résultat biométrique et décision. PostgreSQL conserve ces objets comme données OLTP, avec des relations explicites entre session, fichiers, scores, corrections et audit. Les champs JSONB absorbent les sorties variables des moteurs, mais les responsabilités critiques restent relationnelles.",
    )

    replace_exact(
        doc,
        "L'intégration AML/CFT donne au back office une profondeur supplémentaire. Les alertes de sanctions, les conflits de NIU, les documents expirants ou les suspicions de doublon ne relèvent pas du même traitement qu'une simple erreur de saisie. VeriPass prépare donc des signaux distincts afin que chaque rôle puisse traiter le dossier selon sa responsabilité.",
        "L'intégration AML/CFT doit être comprise comme une préparation fonctionnelle du back office. Certaines alertes sont représentées dans le prototype, tandis que les vérifications complètes de sanctions, de doublons et de conflits NIU relèvent d'un périmètre à valider avant production. Cette séparation évite de présenter VeriPass comme un moteur AML/CFT complet, tout en montrant que le modèle prépare les signaux utiles aux rôles conformité.",
    )
    replace_exact(
        doc,
        "Le parallélisme a dû être conçu de manière sélective. Certaines tâches peuvent être traitées en file sans risque, comme les notifications ou des traitements légers. D'autres, notamment GLM OCR et certains contrôles d'image, doivent être limités par des verrous et par une affectation selon la charge active. Le principe retenu rapproche l'affectation de la logique Weighted Round Robin et Least Connections : répartir les dossiers quand cela est possible, mais bloquer la concurrence lorsque la mémoire ou la cohérence du dossier l'exige.",
        "Le parallélisme a été limité lorsque la mémoire disponible ou la cohérence du dossier l'exigeait. Les notifications et contrôles légers peuvent être répartis en file, mais GLM OCR et certains contrôles d'image doivent être verrouillés. L'arbitrage peut être modélisé par Charge(a) = q_a / w_a + alpha t_a + beta r_a, où q_a représente la file d'un agent ou worker, w_a sa capacité, t_a son temps moyen récent et r_a un facteur de risque. Le choix a_choisi = argmin Charge(a) exprime le principe de routage sans imposer une concurrence dangereuse.",
    )
    add_paragraphs_after(
        find_contains(doc, "sans imposer une concurrence dangereuse."),
        [
            "Le principe asynchrone n'est pas seulement technique. Il permet de lancer une opération longue, de rendre immédiatement un statut compréhensible, puis de reprendre le dossier lorsque le worker a terminé. Cette logique, utilisée pour l'OCR et les notifications, évite que le navigateur mobile reste bloqué sur une requête longue. Elle impose en contrepartie des statuts exacts, des verrous à durée limitée et des reprises explicables.",
            "Les données sensibles doivent être protégées à deux niveaux. Les échanges applicatifs sont chiffrés par TLS, tandis que les pièces KYC et les sauvegardes documentaires doivent être chiffrées au repos. Pour les identifiants comme le numéro CNI ou le NIU, une approche robuste consiste à conserver une valeur chiffrée pour l'affichage autorisé et un index HMAC séparé pour la déduplication exacte, sans exposer la donnée en clair dans PostgreSQL.",
        ],
        "Memoire Body",
    )

    replace_exact(
        doc,
        "Le résultat fonctionnel est significatif : le dossier peut être soumis, passer en PENDING_AGENT_REVIEW, revenir en PENDING_INFO lorsqu'un complément est demandé, puis être approuvé. Le client voit l'évolution de son statut et le back office dispose d'un dossier exploitable. Ce scénario donne une preuve concrète de l'enchaînement entre mobile, API, base, support et décision.",
        "Le scénario apporte une preuve fonctionnelle du parcours : un dossier peut être soumis, passer en PENDING_AGENT_REVIEW, revenir en PENDING_INFO lorsqu'un complément est demandé, puis être approuvé. Le client voit l'évolution de son statut et le back office dispose d'un dossier exploitable. Ce scénario vérifie l'enchaînement entre mobile, API, base, support et décision.",
    )
    replace_exact(
        doc,
        "Ce résultat ne doit toutefois pas être surinterprété. Il ne constitue pas encore une mesure de précision par champ, ni un taux d'erreur statistiquement représentatif de toutes les CNI camerounaises rencontrées sur le terrain. Il valide plutôt la capacité du pipeline à produire une revue OCR exploitable, à gérer des reprises et à transformer des observations manuelles en règles de post traitement.",
        "Ce résultat ne doit toutefois pas être surinterprété. Il doit être lu comme un indicateur d'exploitabilité après revue, pas comme une précision parfaite par champ. Une mesure plus industrielle devra distinguer le taux de documents exploitables, le taux de champs corrigés, le score moyen OCR, le nombre de déclenchements GLM OCR et le temps moyen de traitement par document.",
    )
    add_paragraphs_after(
        find_contains(doc, "temps agent par dossier"),
        [
            "Pour préparer un pilote bancaire, les métriques prioritaires sont le temps moyen de constitution du dossier, le taux de dossiers incomplets, le nombre moyen de corrections OCR par dossier, le taux de recours à GLM OCR, le taux de verrouillage liveness, le temps agent back office et le coût par dossier instruit. Ces indicateurs relient l'ingénierie data à l'utilité opérationnelle, car ils mesurent le flux réel plutôt que la seule existence des composants.",
            "Le coût complet peut être posé sous la forme C_total = C_machine + C_internet + C_electricite + C_transport + C_assistance_IA + C_ressources_humaines + C_hebergement + C_securite + C_maintenance. Le seul poste directement chiffré ici est le transport : du 19 janvier 2026 au 19 juin 2026, sur une base de cinq jours par semaine et hors jours fériés non déduits, on obtient 110 jours ouvrés. Avec 2 200 FCFA par aller retour, C_transport = 2 200 x 110 = 242 000 FCFA.",
        ],
        "Memoire Body",
    )
    insert_figure_after(
        find_contains(doc, "C_transport = 2 200 x 110 = 242 000 FCFA."),
        FIG_COST,
        "Figure 7. Courbe cumulative du coût de transport du stage",
        "Source : calcul de l'auteur, sur la base du coût transport communiqué et de la période du 19 janvier au 19 juin 2026.",
        5.4,
    )

    replace_exact(
        doc,
        "Sur le plan humain, le projet a demandé une posture de leadership mesurée. Il a fallu organiser le travail, construire des documents de dialogue, maintenir le cap malgré les procédures, transformer les critiques en améliorations, et tenir une trajectoire cohérente jusqu'au prototype. Cette dimension est essentielle dans un mémoire d'ingénieur, car la qualité finale d'un système bancaire dépend aussi de la manière dont les acteurs comprennent et acceptent ses choix.",
        "Sur le plan humain, le projet a exigé une posture de coordination : organiser le travail, formaliser les échanges, intégrer les critiques, arbitrer les priorités et maintenir une trajectoire cohérente jusqu'au prototype. Cette dimension est essentielle dans un mémoire d'ingénieur, car la qualité finale d'un système bancaire dépend aussi de la manière dont les acteurs comprennent et acceptent ses choix.",
    )
    final_p = find_contains(doc, "À terme, VeriPass peut devenir un socle RegTech")
    set_text(
        final_p,
        final_p.text.replace(
            "À terme, VeriPass peut devenir un socle RegTech pour l'onboarding bancaire dans la zone CEMAC, à condition de conserver son principe directeur : automatiser ce qui peut être structuré, journaliser ce qui doit être prouvé, et laisser aux acteurs habilités la responsabilité des décisions sensibles.",
            "À terme, VeriPass peut constituer une base de travail pour un futur socle RegTech d'onboarding bancaire dans la zone CEMAC, sous réserve d'un pilote, d'une calibration documentée et d'une validation conformité. Son principe directeur demeure le suivant : automatiser ce qui peut être structuré, journaliser ce qui doit être prouvé, et laisser aux acteurs habilités la responsabilité des décisions sensibles.",
        ),
    )


def global_cleanup(doc: Document) -> None:
    for p in doc.paragraphs:
        if "GLM/OCR" in p.text or "GLM-OCR" in p.text:
            set_text(p, p.text.replace("GLM/OCR", "GLM OCR").replace("GLM-OCR", "GLM OCR"))
        if " ;" in p.text:
            set_text(p, p.text.replace(" ;", ";"))


def guardrails(doc: Document) -> None:
    text = "\n".join(p.text for p in doc.paragraphs)
    forbidden = [
        "\u2014",
        "\u2013",
        "Jean",
        "Thomas",
        "Sylvie",
        "Admin IT",
        "MiniFASNet",
        "800 collaborateurs",
        "SOMMAIRE PROVISOIRE",
        "Honestly?",
        "holistic",
        "nuanced",
        "delve",
        "tapestry",
        "realm",
        "interplay",
        "pivotal",
        "testament",
        "landscape",
        "genuinely",
        "quietly",
        "no fluff",
    ]
    hits = [token for token in forbidden if token in text]
    if hits:
        raise AssertionError(f"Forbidden tokens in document: {hits}")
    if re.search(r"\s-\s", text):
        raise AssertionError("Spaced dash separators remain in document")


def main() -> None:
    make_figures()
    shutil.copyfile(SRC, OUT)
    doc = Document(OUT)
    update_front_lists(doc)
    replace_content(doc)
    add_bibliography_entries(doc)
    global_cleanup(doc)
    guardrails(doc)
    doc.save(OUT)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
