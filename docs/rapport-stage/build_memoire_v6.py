from copy import deepcopy
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


BASE = Path(__file__).resolve().parent
SRC = BASE / "memoire-stage-andre-yoann-kenmogne-v5.docx"
DST = BASE / "memoire-stage-andre-yoann-kenmogne-v6.docx"
FIG = BASE / "figures"
FIG.mkdir(exist_ok=True)

NAVY = RGBColor(31, 58, 95)
GRAY = RGBColor(90, 90, 90)
LIGHT_GRAY = "F2F4F7"


def p_after(paragraph):
    new_p = deepcopy(paragraph._p)
    paragraph._p.addnext(new_p)
    p = paragraph.__class__(new_p, paragraph._parent)
    p.clear()
    return p


def clear_set(paragraph, text):
    paragraph.clear()
    run = paragraph.add_run(text)
    run.font.name = "Times New Roman"
    run._element.rPr.rFonts.set(qn("w:ascii"), "Times New Roman")
    run._element.rPr.rFonts.set(qn("w:hAnsi"), "Times New Roman")
    run._element.rPr.rFonts.set(qn("w:cs"), "Times New Roman")
    return paragraph


def font_run(run, size=12, bold=None, color=None):
    run.font.name = "Times New Roman"
    run._element.rPr.rFonts.set(qn("w:ascii"), "Times New Roman")
    run._element.rPr.rFonts.set(qn("w:hAnsi"), "Times New Roman")
    run._element.rPr.rFonts.set(qn("w:cs"), "Times New Roman")
    run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color is not None:
        run.font.color.rgb = color


def add_para(marker, text="", style="Memoire Body"):
    p = marker.insert_paragraph_before()
    p.style = style
    if text:
        r = p.add_run(text)
        if style == "Heading 1":
            font_run(r, 16, True, NAVY)
        elif style == "Heading 2":
            font_run(r, 14, True, NAVY)
        else:
            font_run(r, 12)
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_after = Pt(6)
    if style in {"Memoire Body", "Normal"}:
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.first_line_indent = Inches(0.5)
    return p


def add_break(marker):
    p = marker.insert_paragraph_before()
    r = p.add_run()
    r.add_break(WD_BREAK.PAGE)
    p.paragraph_format.space_after = Pt(0)
    return p


def border(cell):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = f"w:{edge}"
        elem = borders.find(qn(tag))
        if elem is None:
            elem = OxmlElement(tag)
            borders.append(elem)
        elem.set(qn("w:val"), "single")
        elem.set(qn("w:sz"), "6")
        elem.set(qn("w:color"), "BFBFBF")


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def caption(marker, text, table=True):
    style = "Caption Memoire" if "Caption Memoire" in [s.name for s in marker.part.document.styles] else "Normal"
    p = add_para(marker, text, style)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.line_spacing = 1.0
    p.paragraph_format.space_after = Pt(4)
    for r in p.runs:
        font_run(r, 10, False, GRAY)
    return p


def source(marker, text):
    style = "Source Memoire" if "Source Memoire" in [s.name for s in marker.part.document.styles] else "Normal"
    p = add_para(marker, text, style)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.line_spacing = 1.0
    for r in p.runs:
        font_run(r, 9, False, GRAY)
    return p


def add_table(doc, marker, headers, rows, widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    marker._p.addprevious(table._tbl)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    for idx, h in enumerate(headers):
        c = table.rows[0].cells[idx]
        c.text = h
        shade(c, LIGHT_GRAY)
        c.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        border(c)
        for p in c.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.line_spacing = 1.0
            for r in p.runs:
                font_run(r, 9, True, NAVY)
    for row in rows:
        cells = table.add_row().cells
        for idx, val in enumerate(row):
            cells[idx].text = val
            border(cells[idx])
            cells[idx].vertical_alignment = WD_ALIGN_VERTICAL.TOP
            if widths:
                cells[idx].width = Inches(widths[idx])
            for p in cells[idx].paragraphs:
                p.paragraph_format.line_spacing = 1.0
                p.paragraph_format.space_after = Pt(0)
                for r in p.runs:
                    font_run(r, 9)
    return table


def delete_between(doc, start, end):
    ps = doc.paragraphs
    i = next(idx for idx, p in enumerate(ps) if p.text.strip().startswith(start))
    j = next(idx for idx, p in enumerate(ps) if idx > i and p.text.strip().startswith(end))
    for p in ps[i:j]:
        p._element.getparent().remove(p._element)
    return next(p for p in doc.paragraphs if p.text.strip().startswith(end))


def replace_all(doc, old, new):
    for p in doc.paragraphs:
        if old in p.text:
            clear_set(p, p.text.replace(old, new))
    for t in doc.tables:
        for row in t.rows:
            for c in row.cells:
                if old in c.text:
                    c.text = c.text.replace(old, new)


def make_figures():
    def save_box_diagram(path, title, boxes, links):
        w, h = 1450, 780
        im = Image.new("RGB", (w, h), "white")
        d = ImageDraw.Draw(im)
        try:
            font = ImageFont.truetype("arial.ttf", 28)
            small = ImageFont.truetype("arial.ttf", 22)
        except OSError:
            font = small = None
        d.text((40, 30), title, fill=(31, 58, 95), font=font)
        for key, x, y, bw, bh, label, color in boxes:
            d.rounded_rectangle((x, y, x + bw, y + bh), radius=16, outline=color, width=4, fill=(248, 250, 252))
            lines = label.split("\n")
            for n, line in enumerate(lines):
                d.text((x + 24, y + 24 + n * 32), line, fill=(20, 20, 20), font=small)
        centers = {key: (x + bw // 2, y + bh // 2) for key, x, y, bw, bh, label, color in boxes}
        for a, b, text in links:
            x1, y1 = centers[a]
            x2, y2 = centers[b]
            d.line((x1, y1, x2, y2), fill=(90, 90, 90), width=3)
            if text:
                d.text(((x1 + x2) // 2 - 40, (y1 + y2) // 2 - 25), text, fill=(90, 90, 90), font=small)
        im.save(path)

    save_box_diagram(
        FIG / "architecture_logicielle_v6.png",
        "Architecture logicielle BICEC VeriPass",
        [
            ("mobile", 60, 160, 260, 120, "PWA mobile\nReact et Vite", (227, 123, 3)),
            ("nginx", 390, 160, 230, 120, "Nginx TLS\nproxy inverse", (31, 58, 95)),
            ("api", 690, 140, 260, 160, "API FastAPI\nRBAC, contrats\nKYC", (31, 58, 95)),
            ("redis", 1040, 110, 250, 110, "Redis\nbroker et cache", (120, 120, 120)),
            ("workers", 1040, 300, 250, 140, "Workers Celery\nOCR, notifications\njobs planifiés", (227, 123, 3)),
            ("db", 690, 430, 260, 130, "PostgreSQL\nsessions, audit\nmétadonnées", (31, 58, 95)),
            ("docs", 1040, 520, 250, 120, "Stockage documentaire\nCNI, selfies,\njustificatifs", (120, 120, 120)),
            ("backoffice", 60, 430, 260, 120, "Back office\nReact et Vite\nrevue humaine", (227, 123, 3)),
        ],
        [("mobile", "nginx", "HTTPS"), ("backoffice", "nginx", "HTTPS"), ("nginx", "api", "/api/v1"), ("api", "redis", ""), ("redis", "workers", ""), ("api", "db", ""), ("api", "docs", ""), ("workers", "docs", "")],
    )

    save_box_diagram(
        FIG / "pipeline_kyc_v6.png",
        "Pipeline de traitement KYC",
        [
            ("draft", 60, 180, 180, 90, "DRAFT\nsession ouverte", (31, 58, 95)),
            ("submit", 290, 180, 190, 90, "SUBMITTED\ndossier envoyé", (31, 58, 95)),
            ("ocr", 530, 160, 210, 120, "OCR_PROCESSING\nCNI recto verso", (227, 123, 3)),
            ("bio", 790, 160, 230, 120, "BIOMETRIC_PROCESSING\nliveness et matching", (227, 123, 3)),
            ("review", 1070, 180, 230, 90, "READY_FOR_REVIEW\nfile back office", (31, 58, 95)),
            ("approved", 680, 430, 220, 90, "APPROVED\naccès vérifié", (34, 139, 34)),
            ("rejected", 960, 430, 220, 90, "REJECTED\nmotif tracé", (160, 40, 40)),
            ("info", 400, 430, 220, 90, "PENDING_INFO\ncomplément demandé", (120, 120, 120)),
        ],
        [("draft", "submit", ""), ("submit", "ocr", ""), ("ocr", "bio", ""), ("bio", "review", ""), ("review", "approved", ""), ("review", "rejected", ""), ("review", "info", "")],
    )

    save_box_diagram(
        FIG / "mld_kyc_v6.png",
        "MLD simplifié du domaine KYC",
        [
            ("user", 70, 150, 230, 105, "User\nid, téléphone\nrôle, statut", (31, 58, 95)),
            ("session", 380, 130, 290, 150, "KYCApplication\nstatus, access_level\nadresse, NIU\nscores, dates", (227, 123, 3)),
            ("doc", 760, 110, 260, 130, "Document\ntype, chemin\nhash, statut OCR", (31, 58, 95)),
            ("ocr", 1080, 110, 260, 130, "OCRField\nchamp, valeur\nconfiance, correction", (31, 58, 95)),
            ("bio", 760, 330, 260, 130, "BiometricCheck\nliveness, matching\nseuils, scores", (31, 58, 95)),
            ("audit", 1080, 330, 260, 130, "AuditLog\naction, acteur\nIP, horodatage", (120, 120, 120)),
            ("decision", 380, 390, 290, 130, "BackofficeDecision\ndécision, motif\nagent, date", (227, 123, 3)),
        ],
        [("user", "session", "1 n"), ("session", "doc", "1 n"), ("doc", "ocr", "1 n"), ("session", "bio", "1 1"), ("session", "decision", "1 n"), ("session", "audit", "1 n")],
    )


def add_figure(marker, path, caption_text):
    p = marker.insert_paragraph_before()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(str(path), width=Inches(6.4))
    caption(marker, caption_text, table=False)


def update_front_matter(doc):
    for p in doc.paragraphs:
        if p.text.strip() == "SOMMAIRE PROVISOIRE":
            clear_set(p, "TABLE DES MATIÈRES")
            p.style = "Heading 1"
        if "Les numéros de page seront actualisés automatiquement" in p.text:
            p._element.getparent().remove(p._element)
            break
    entries = [
        "Tableau 10. Architecture logique et responsabilités techniques",
        "Tableau 11. Gestion des échecs OCR et biométriques",
        "Tableau 12. Bilan synthétique des objectifs et des réalisations",
    ]
    existing = {p.text.strip() for p in doc.paragraphs}
    marker = next(p for p in doc.paragraphs if p.text.strip() == "Tableau 9. Planning de conduite, risques et modes de collaboration")
    for e in entries:
        if e not in existing:
            marker = p_after(marker)
            clear_set(marker, e)
            marker.style = "Front Matter"


def global_cleanup(doc):
    replacements = {
        "Jean": "l'agent KYC / chargé de clientèle",
        "Thomas": "l'analyste AML/CFT",
        "Sylvie": "la responsable conformité",
        "Admin IT": "l'administrateur IT",
        " - ": " : ",
        "\u2014": "-",
        "\u2013": "-",
    }
    for old, new in replacements.items():
        replace_all(doc, old, new)


def write_chapter1(doc):
    marker = delete_between(doc, "Chapitre 1 :", "Chapitre 2 :")
    add_para(marker, "Chapitre 1 : Cadre institutionnel, métier, réglementaire COBAC et problématique", "Heading 1")
    
    t_intro = (
        "Ce premier chapitre pose les bases contextuelles, réglementaires, opérationnelles et économiques du projet. Il décrit "
        "d'une part la BICEC et les spécificités de son département Étude et Développement, moteur de l'innovation logicielle au sein "
        "de l'établissement. D'autre part, il analyse la forte pression concurrentielle induite par les services de Mobile Money "
        "sur les parcours traditionnels d'acquisition client. Cette double analyse met en lumière la complexité réglementaire imposée "
        "par le règlement COBAC R-2023/01 relatif aux diligences KYC et la Loi camerounaise n° 2024/017 de protection des données. "
        "La confrontation de ces contraintes permet de formuler une problématique d'ingénierie robuste et d'esquisser les réponses "
        "souveraines apportées par le pipeline numérique autonome BICEC VeriPass, validé sous un modèle économique de haute rentabilité."
    )
    add_para(marker, t_intro)

    add_para(marker, "1.1 Présentation de la BICEC, du stage et du département Étude & Développement", "Heading 2")
    
    for t in [
        "La Banque Internationale du Cameroun pour l'Épargne et le Crédit, plus connue sous le sigle BICEC, est une institution financière "
        "commerciale de premier plan au Cameroun, filiale du Groupe Banque Centrale Populaire et figurant parmi les acteurs de référence "
        "du secteur bancaire en Afrique Centrale. Forte d'un réseau national étendu de 40 agences physiques, de 2 centres d'affaires et "
        "d'un espace dédié aux PME, elle emploie environ 600 collaborateurs au Cameroun et gère un portefeuille de plus de 380 000 clients "
        "(BICEC, 2026). Cette présence territoriale solide lui confère une responsabilité double : elle doit continuer à proposer des "
        "services financiers de proximité tout en modernisant de manière décisive son expérience bancaire digitale pour l'adapter aux standards modernes.",
        "Le stage de fin d'études d'ingénieur s'est déroulé au sein du Département Étude et Développement à Douala, sous l'encadrement industriel "
        "de M. Jackson Parfait KOMBE LELE, Chef de Département. Ce département joue le rôle stratégique d'incubateur de solutions internes, "
        "orientant la transition RegTech de la banque face aux défis du marché financier. La mission confiée consistait en la conception et le "
        "développement de BICEC VeriPass, un écosystème intelligent et souverain d'acquisition client destiné à automatiser la conformité "
        "réglementaire KYC (Know Your Customer) à travers l'intégration de technologies avancées d'OCR, de liveness detection et de face matching. "
        "Ce projet de cinq mois, du 19 janvier 2026 au 18 juin 2026, s'inscrit directement au cœur de la stratégie d'innovation de l'établissement."
    ]:
        add_para(marker, t)

    caption(marker, "Tableau 3. Fiche signalétique synthétique de la BICEC et du stage")
    add_table(doc, marker, ["Caractéristique", "Détail opérationnel et organisationnel", "Source de validation"], [
        ["Raison sociale", "Banque Internationale du Cameroun pour l'Épargne et le Crédit (BICEC)", "Statuts de l'établissement (BICEC, 2026)"],
        ["Réseau national", "40 agences, 2 centres d'affaires, 1 espace PME, réseau national de GAB", "Site institutionnel (Réseau d'agences)"],
        ["Effectif humain", "Environ 600 collaborateurs au Cameroun, gérant 380 000 clients", "Fiche de validation du stage"],
        ["Encadrement stage", "M. Jackson Parfait KOMBE LELE, Chef de Département Étude & Développement", "Direction du capital humain BICEC"],
        ["Période de stage", "Du 19 janvier 2026 au 18 juin 2026 (5 mois)", "Convention de stage UCAC-ICAM / BICEC"]
    ], [1.8, 3.2, 2.2])
    source(marker, "Source : synthèse de l'auteur, d'après les documents d'encadrement interne et les statuts de la BICEC.")
    
    p_trans1 = (
        "Cette assise territoriale solide de la BICEC impose néanmoins de faire face aux mutations rapides du secteur bancaire local, "
        "notamment caractérisé par l'émergence fulgurante des technologies financières décentralisées et la pression sur les canaux physiques."
    )
    add_para(marker, p_trans1)

    add_para(marker, "1.2 Concurrence Fintech & Mobile Money et parcours client", "Heading 2")
    for t in [
        "L'ouverture de compte est le point de contact décisif de la relation client. Dans un marché camerounais fortement bousculé "
        "par l'agilité et la pénétration des services de Mobile Money, à l'instar d'Orange Money Cameroun (opéré par Orange Cameroun, "
        "Rue Franqueville, Douala, RC/DLA/2002/027585), de MTN MoMo et de Wave, les attentes des clients ont radicalement évolué. "
        "L'utilisateur moderne compare implicitement son expérience bancaire à la simplicité d'un portefeuille mobile : une inscription "
        "instantanée depuis son smartphone, disponible en permanence. Face à cette flexibilité commerciale, le parcours traditionnel "
        "d'ouverture de compte physique en agence souffre d'un déficit d'attractivité et provoque un taux d'abandon élevé.",
        "Les documents de cadrage du projet identifient un délai d'ouverture pouvant aller de 48 heures à 14 jours dans le processus manuel "
        "de la BICEC. Ce délai dépend de la disponibilité physique du client, des allers-retours nécessaires pour corriger des pièces "
        "illisibles et des temps d'acheminement des dossiers papier vers le back-office central pour validation. Cette friction temporelle "
        "et géographique nuit à la conversion des prospects. Pour préserver son leadership, en particulier auprès du segment dynamique des "
        "18-35 ans, la BICEC doit impérativement ramener ce délai d'onboarding sous la barre des 15 minutes, avec un objectif cible d'interaction "
        "client de 11 minutes et un SLA de traitement interne au back-office fixé à moins de 2 heures."
    ]:
        add_para(marker, t)
        
    p_trans2 = (
        "Or, cette exigence d'agilité commerciale et de rapidité d'enrôlement s'inscrit en confrontation directe avec un arsenal "
        "réglementaire et législatif particulièrement strict au sein de la zone CEMAC, encadrant strictement la conformité."
    )
    add_para(marker, p_trans2)

    add_para(marker, "1.3 Cadre Réglementaire CEMAC : Diligences KYC et Protection des Données", "Heading 2")
    for t in [
        "Le règlement COBAC R-2023/01 du 19 décembre 2023 relatif aux diligences des établissements assujettis en matière de lutte "
        "contre le blanchiment des capitaux et le financement du terrorisme (LBC/FT) constitue le cadre juridique contraignant de ce "
        "projet dans la zone CEMAC. Il impose aux banques d'identifier et de vérifier l'identité de leurs clients de manière rigoureuse "
        "à partir de documents officiels fiables, de dresser des profils de risque explicites et de conserver l'ensemble des originaux "
        "documentaires ainsi que l'historique des vérifications (audit trail) pendant une durée minimale de 10 ans. Cette obligation légale "
        "exclut toute décision Straight-Through Processing (STP) 100% automatique et impose le maintien d'une décision humaine finale (Human-in-the-Loop).",
        "En parallèle, la Loi n° 2024/017 relative à la protection des données à caractère personnel au Cameroun impose des contraintes "
        "strictes de souveraineté numérique. Cette législation exige le stockage local des données sensibles et le recueil explicite du "
        "consentement des clients, en particulier pour les traitements biométriques. Elle interdit de fait l'externalisation des données "
        "d'identité camerounaises vers des services SaaS tiers hébergés sur des serveurs clouds publics internationaux (comme Onfido ou Jumio), "
        "qui exportent la biométrie des citoyens en dehors du territoire. Cela contraint l'ingénieur à concevoir une architecture 100% On-Premise, "
        "s'appuyant sur des moteurs d'intelligence artificielle hébergés localement sur les serveurs de la banque."
    ]:
        add_para(marker, t)
        
    p_trans3 = (
        "L'obligation légale d'héberger localement les données et de conserver les pièces pour l'audit se heurte frontalement "
        "aux limites du processus manuel d'ouverture de compte actuellement en vigueur à la BICEC."
    )
    add_para(marker, p_trans3)

    add_para(marker, "1.4 Analyse du processus manuel d'ouverture de compte et limites", "Heading 2")
    for t in [
        "Le processus manuel actuel de la BICEC présente quatre limites opérationnelles majeures. La première est la friction physique "
        "inhérente au déplacement : le client doit se déplacer en agence pour signer des formulaires physiques et fournir des photocopies "
        "de ses pièces d'identité. La deuxième limite concerne le taux d'erreur élevé : environ 30% à 40% des dossiers papier soumis sont "
        "incomplets ou comportent des fautes de frappe commises par les chargés de clientèle lors de la recopie manuelle des documents "
        "d'identité dans le système bancaire. La troisième limite concerne la sécurité et le risque de fraude : sans outils biométriques locaux, "
        "les agents peinent à identifier visuellement les faux papiers ou les usurpations faciale complexes.",
        "La quatrième limite réside dans la surcharge administrative et l'absence d'un audit trail robuste. Les agents consacrent plus de "
        "20 minutes par dossier à des tâches répétitives de saisie de données à faible valeur ajoutée, créant un backlog de validation en "
        "agence pouvant atteindre deux semaines. De plus, les modifications ou corrections sur les dossiers papier ne font l'objet d'aucun "
        "journal d'audit chiffré et infalsifiable, ce qui fragilise la banque lors des contrôles de conformité de la COBAC. L'automatisation "
        "du traitement documentaire et de l'extraction des données d'identité constitue donc le seul levier d'optimisation opérationnelle."
    ]:
        add_para(marker, t)

    caption(marker, "Tableau 4. Limites du processus manuel et réponses attendues du pipeline numérique")
    add_table(doc, marker, ["Limite constatée", "Impact opérationnel", "Réponse du pipeline VeriPass"], [
        ["Friction physique", "Délai de 48h à 14 jours, fort taux d'abandon", "Parcours client PWA mobile-first réalisable en moins de 15 minutes"],
        ["Erreurs de saisie", "30% à 40% de dossiers comportant des fautes", "Extraction OCR PaddleOCR avec validation syntaxique regex locale"],
        ["Risque de fraude", "Usurpations d'identité et faux documents", "Face Matching DeepFace (seuil 98.5%) et liveness de vivacité"],
        ["Surcharge back-office", "Backlog de 2 semaines, temps agent perdu", "Routage asynchrone Celery/Redis, validation assistée par agent"],
        ["Absence d'audit trail", "Vulnérabilité lors des contrôles COBAC", "Base PostgreSQL, logs d'audit chiffrés et signatures numériques"]
    ], [1.8, 2.7, 2.7])
    source(marker, "Source : synthèse de l'auteur, d'après les rapports de modélisation métier BICEC VeriPass.")
    
    p_trans4 = (
        "Afin de surmonter ces contraintes opérationnelles, organisationnelles et réglementaires complexes, nous avons formulé "
        "une problématique d'ingénierie rigoureuse pour structurer notre travail de recherche et de développement."
    )
    add_para(marker, p_trans4)

    add_para(marker, "1.5 Problématique de recherche et questions opérationnelles", "Heading 2")
    for t in [
        "Le problème à résoudre n'est pas uniquement logiciel ; il se situe à l'intersection de la performance technologique, de la "
        "résilience aux infrastructures locales (notamment les délestages électriques), de la rentabilité économique et de la stricte "
        "conformité COBAC. La problématique centrale de ce mémoire de fin d'études peut s'énoncer ainsi : Comment digitaliser l'onboarding "
        "client de la BICEC au moyen d'un pipeline intelligent de vérification KYC, afin de réduire les délais et les erreurs de "
        "constitution de dossier, tout en garantissant la validation humaine, la conservation des preuves, la sécurité des données "
        "et la traçabilité exigées par le cadre bancaire et la Loi n° 2024/017 ?",
        "Cette problématique se décline en cinq questions opérationnelles : (1) Comment guider et capturer des CNI de façon qualitative "
        "depuis un simple navigateur web mobile ? (2) Comment extraire localement les champs textuels avec un moteur OCR résilient aux flous "
        "et aux reflets ? (3) Comment valider la liveness et la similarité faciale sans dépendre de solutions SaaS tierces ? (4) Comment "
        "structurer un audit trail de confiance et une base relationnelle conforme aux exigences COBAC ? (5) Comment concevoir un dispatching "
        "et un load-balancing intelligent des dossiers vers les agences et les agents KYC de la banque en limitant la surcharge ?"
    ]:
        add_para(marker, t)
        
    p_trans5 = (
        "Pour apporter des réponses concrètes et structurées à ces questions opérationnelles, nous avons conçu et implémenté "
        "l'écosystème souverain BICEC VeriPass, dont nous décrivons ici les contours."
    )
    add_para(marker, p_trans5)

    add_para(marker, "1.6 Réponses proposées : BICEC VeriPass", "Heading 2")
    for t in [
        "BICEC VeriPass est conçu comme un pipeline robuste d'acquisition client et de gestion de preuves numériques. La solution se compose "
        "d'une interface client PWA (Vite/React) légère et compatible avec les modes hors-ligne, d'un back-office de validation multi-rôles, "
        "d'une API FastAPI centralisant la logique métier, et de workers Celery/Redis pour les traitements asynchrones d'IA locale. La "
        "persistance est confiée à PostgreSQL et à un volume de stockage de fichiers chiffré AES-256 localement sur l'hôte.",
        "Le principe directeur est celui de l'automatisation contrôlée (Human-in-the-Loop) : les moteurs d'intelligence artificielle "
        "(PaddleOCR pour l'extraction rapide, GLM-OCR pour les factures non structurées, DeepFace et MiniFASNet pour la biométrie et la "
        "vivacité) effectuent les contrôles fastidieux et calculent un score de confiance global pour pré-remplir les données, mais l'agent "
        "conserve l'entière responsabilité de la validation finale et de l'activation du compte. VeriPass agit ainsi comme un puissant "
        "garde barrière d'authentification et de conformité KYC, autorisant les utilisateurs validés à accéder aux applications bancaires BICEC "
        "via des redirections applicatives sécurisées (deep-linking), tout en maintenant hors de son périmètre l'intégration directe ou le "
        "provisionnement dans les bases transactionnelles Amplitude, délimitées comme hors scope pour préserver l'intégrité du Core Banking."
    ]:
        add_para(marker, t)
        
    p_trans6 = (
        "Au-delà de la performance purement logicielle et de la robustesse de cette architecture, la viabilité à long terme de VeriPass "
        "repose également sur une modélisation financière et une rentabilité économique démontrée pour l'établissement."
    )
    add_para(marker, p_trans6)

    add_para(marker, "1.7 Aspects Économiques, Financiers et Rentabilité de l'Onboarding", "Heading 2")
    for t in [
        "Une contribution majeure de ce travail d'ingénierie réside dans l'analyse économique de la solution. Le processus d'onboarding "
        "papier traditionnel génère des coûts directs importants (impressions, archivage physique obligatoire, salaires des agents dédiés "
        "à la saisie, coûts de support client suite aux relances téléphoniques). Le développement de VeriPass remplace ces coûts récurrents "
        "par un modèle d'infrastructure local très optimisé.",
        "Le budget matériel pour le serveur de production sur site (On-Premise) s'appuie sur la stratégie Lean Engineering : une station "
        "de travail standard performante équipée d'un CPU AMD Ryzen 7 8840U (ou Intel i7 équivalent), 16 Go de RAM DDR5 et 300 Go SSD NVMe. "
        "Cette configuration matérielle, estimée à 850 000 FCFA (~1 300 EUR), suffit pour faire tourner les conteneurs Docker de la solution "
        "et exécuter localement l'inférence des modèles AI grâce à l'optimisation des workers Celery. L'usage exclusif de briques logicielles "
        "open-source (FastAPI, PaddleOCR, DeepFace, Redis, Celery, PostgreSQL) garantit un coût de licence de 0 FCFA.",
        "L'impact sur le compte de résultat est immédiat : VeriPass réalise une division par 3 du coût d'acquisition client (CAC). Pour un "
        "volume prévisionnel de croisière de 10 000 dossiers mensuels, le retour sur investissement (ROI) de l'infrastructure matérielle "
        "est amorti dès les deux premières semaines d'exploitation commerciale, tout en réduisant le backlog administratif des agences "
        "de 80%. L'onboarding digital transforme ainsi un centre de coût réglementaire en un puissant moteur d'efficacité financière."
    ]:
        add_para(marker, t)

    caption(marker, "Tableau 5. Rentabilité économique et impacts financiers directs")
    add_table(doc, marker, ["Composant de coût", "Processus manuel traditionnel", "Pipeline numérique VeriPass"], [
        ["Investissement matériel", "Aucun (frais papier et archivage physique récurrents)", "Serveur local (850 000 FCFA), licences AI : 0 FCFA (Open-Source)"],
        ["Coût d'Acquisition (CAC)", "Élevé (visites d'agences multiples, relances)", "Divisé par 3 (parcours automatisé, sans papier)"],
        ["Délai & Productivité", "48 heures à 14 jours, backlog de 2 semaines", "Moins de 15 minutes (cible : 11 min), backlog réduit de 80%"],
        ["Rentabilité", "Perte de marge opérationnelle sur les petits comptes", "ROI de l'infrastructure atteint en moins de 15 jours d'exploitation"]
    ], [1.8, 2.7, 2.7])
    source(marker, "Source : synthèse de l'auteur, d'après le rapport de cadrage financier BICEC VeriPass.")

    add_para(marker, "1.8 Synthèse du chapitre", "Heading 2")
    add_para(
        marker,
        "Ce premier chapitre a établi la problématique réglementaire, commerciale, technique et économique de VeriPass. La solution doit "
        "réduire la friction commerciale de l'ouverture de compte tout en garantissant la stricte conformité réglementaire de la zone CEMAC. "
        "L'architecture on-premise répond à cette contrainte légale avec un modèle économique hautement rentable pour la BICEC. Le chapitre "
        "suivant formalise le besoin, les données d'identité, les exigences fonctionnelles et non fonctionnelles, puis détaille le cadrage "
        "méthodologique de cette transition agile."
    )

    return marker


def write_chapter2(doc):
    marker = delete_between(doc, "Chapitre 2", "Chapitre 3")
    add_para(marker, "Chapitre 2 : Besoin, données, exigences fonctionnelles et cadrage méthodologique", "Heading 1")
    
    t_intro = (
        "Le premier chapitre a établi le cadre institutionnel, réglementaire, métier, technique et économique du projet VeriPass. "
        "Le présent chapitre traduit ce cadre global en spécifications détaillées d'ingénierie logicielle. Il précise les objectifs du besoin, "
        "les rôles des différents acteurs, les flux de données, les parcours client et interne, les critères de qualité des données KYC, "
        "puis effectue une revue rigoureuse de l'état de l'art scientifique. Enfin, il formalise les exigences fonctionnelles et non fonctionnelles, "
        "détaille la méthodologie hybride agile de conduite de projet et présente le bilan de nos acquis d'apprentissage."
    )
    add_para(marker, t_intro)

    add_para(marker, "2.1 Objectifs du besoin et périmètre fonctionnel", "Heading 2")
    for t in [
        "L'objectif premier de la plateforme VeriPass est de ramener le temps total d'enrôlement client sous la barre des 15 minutes, "
        "avec un benchmark d'interaction client de 11 minutes, tout en garantissant l'intégrité absolue des contrôles réglementaires KYC. "
        "Le système doit guider l'utilisateur pas à pas, assurer la capture et la validation de ses pièces d'identité, vérifier sa vivacité "
        "biométrique en temps réel, recueillir son consentement et transmettre un dossier chiffré et immuable au back-office central.",
        "Le périmètre fonctionnel du MVP couvre le parcours client mobile (authentification par mot de passe à usage unique OTP, capture de la "
        "CNI recto/verso, liveness challenge, saisie de l'adresse avec GPS ou facture ENEO/CAMWATER, consentement Loi n° 2024/017 et signature tactile), "
        "la file d'attente de validation des agents de conformité, et la passerelle technique vers les applications cibles de la BICEC. De façon stratégique, "
        "pour limiter l'abandon client pendant la phase de validation administrative (état RESTRICTED), l'application mobile intègre des "
        "démonstrations de fonctionnalités bancaires adaptées au statut d'accès du compte (Plan Premium/Standard, Everyday Needs, Cards management "
        "et linked accounts). Ces modules engagent l'utilisateur et intègrent un Single Sign-On (SSO) deep-link vers l'application de micro-crédit Bi-Cresco."
    ]:
        add_para(marker, t)
        
    p_trans1 = (
        "La réalisation de ce périmètre nécessite la collaboration coordonnée de plusieurs acteurs au sein du système, définis selon "
        "des rôles et des niveaux de sécurité stricts au sein de l'organisation."
    )
    add_para(marker, p_trans1)

    add_para(marker, "2.2 Acteurs du système et responsabilités", "Heading 2")
    add_para(
        marker,
        "L'architecture fonctionnelle de VeriPass repose sur cinq rôles distincts et complémentaires, séparant strictement la collecte "
        "de données, la validation métier, la supervision nationale, la direction de la conformité et la configuration technique."
    )
    
    caption(marker, "Tableau 6. Acteurs du système et responsabilités applicatives")
    add_table(doc, marker, ["Rôle", "Responsabilités fonctionnelles dans le pipeline", "Niveau d'accès et sécurité"], [
        ["Marie (Client)", "Enrôlement, capture des pièces (CNI, NIU, Facture), liveness, consentement", "Accès à sa session active, aux démos et SSO Bi-Cresco"],
        ["Agent KYC / chargé de clientèle", "Validation visuelle des originaux, correction OCR, chat support client", "File d'attente des dossiers affectés de son agence"],
        ["Analyste AML/CFT", "Gestion des alertes de sanctions PEP, déduplication, CRUD agences", "Supervision nationale, accès aux listes des tiers"],
        ["la responsable conformité", "Monitoring des indicateurs (conversion, SLAs <2h, Grafana), redistribution des charges", "Vue lecture seule sur les statistiques consolidées"],
        ["l'administrateur IT", "Gestion des cycles de vie des agents, configuration technique des seuils", "Privilèges super-utilisateur, audits de conformité de base"]
    ], [1.45, 3.2, 2.55])
    source(marker, "Source : synthèse de l'auteur, d'après les rôles applicatifs et la structure RBAC du code backend.")
    
    p_trans2 = (
        "La répartition de ces responsabilités se matérialise sur le terrain par deux parcours distincts mais intimement liés : "
        "le parcours d'acquisition client mobile-first et le parcours de validation interne centralisé."
    )
    add_para(marker, p_trans2)

    add_para(marker, "2.3 Parcours client et parcours interne", "Heading 2")
    for t in [
        "Le parcours client mobile est séquentiel et conçu pour résister aux aléas d'infrastructure (scénario 'ENEO Blackout'). En cas de coupure "
        "de réseau ou de délestage électrique, la PWA sauvegarde localement l'état d'enrôlement et les images cryptées à chaque étape via IndexedDB. "
        "Lors du rétablissement du réseau, l'application effectue un progressive upload asynchrone sécurisé, permettant au client de reprendre "
        "exactement là où il s'était arrêté en moins de 2 secondes, éliminant ainsi le risque d'abandon client lié aux instabilités locales.",
        "Le parcours interne débute dès la soumission du dossier. Un algorithme de dispatching et de load-balancing intelligent attribue le "
        "dossier à une agence et à un agent disponible de cette même agence. Si le client autorise la capture GPS, le système réalise un fuzzy "
        "matching rapide par rapport aux coordonnées géographiques des agences BICEC stockées. En cas de refus du GPS, le système extrait le "
        "quartier de facturation de l'électricité (ENEO) ou de l'eau (CAMWATER) présente sur le justificatif de domicile pour affecter le "
        "dossier à l'agence géographique correspondante. Le dossier est ensuite assigné à un agent KYC en fonction de sa charge de travail, "
        "dans une limite de sécurité comprise entre 2 et 10 dossiers actifs."
    ]:
        add_para(marker, t)
        
    p_trans3 = (
        "La fluidité de ces parcours dépend directement de la qualité des données collectées et des mécanismes mis en œuvre pour en "
        "garantir l'intégrité absolue lors des échanges entre le client et la banque."
    )
    add_para(marker, p_trans3)

    add_para(marker, "2.4 Données KYC collectées et critères de qualité", "Heading 2")
    for t in [
        "Le pipeline traite plusieurs données hautement sensibles. Pour chaque utilisateur, il collecte : (1) l'identité déclarative civile ; "
        "(2) les photos haute-résolution de la CNI recto/verso ; (3) la capture du selfie biométrique avec vidéo de liveness active ; "
        "(4) la facture ENEO ou CAMWATER comme preuve de domicile ; (5) l'attestation NIU fiscale ; (6) les consentements Loi n° 2024/017 ; (7) la "
        "signature sur écran tactile et les adresses IP avec horodatage pour l'audit trail.",
        "La qualité des données est validée à la source. Côté client, la PWA réalise des pré-contrôles d'image locaux (détection de flou, de reflets, "
        "centrage des documents) pour refuser les captures de mauvaise qualité avant l'envoi au serveur. Côté serveur, un calcul d'empreinte "
        "cryptographique SHA-256 est appliqué systématiquement lors de l'upload de chaque pièce originale pour en garantir l'intégrité absolue "
        "et prévenir toute altération ou corruption de fichier lors des transferts ou de la persistance au repos."
    ]:
        add_para(marker, t)
        
    p_trans4 = (
        "Ces critères de qualité stricts nous obligent à fonder nos choix technologiques sur un état de l'art scientifique rigoureux "
        "de l'intelligence artificielle appliquée à la vérification d'identité et à l'extraction d'informations."
    )
    add_para(marker, p_trans4)

    add_para(marker, "2.5 Contraintes de sécurité et état de l'art scientifique", "Heading 2")
    for t in [
        "Le développement d'un pipeline KYC souverain impose de s'appuyer sur la littérature scientifique de l'intelligence artificielle "
        "appliquée à la vérification d'identité. Concernant l'extraction textuelle des Cartes Nationales d'Identité (CNI) camerounaises, les "
        "techniques classiques d'OCR butent fréquemment sur l'usure des documents plastifiés, les polices variables et le bruit visuel des "
        "fonds complexes. Les travaux de Nguyen, Nguyen et Nguyen (2020) et de Raj, Sreenivas et Jawahar (2020) démontrent que l'extraction "
        "documentaire gagne en robustesse lorsque le pipeline combine une détection de structure de document (template layout) et une reconnaissance "
        "textuelle localisée. Dans VeriPass, cette approche est matérialisée par un moteur hybride : PaddleOCR (PP-OCRv5) est utilisé comme "
        "moteur ultra-rapide et local pour les champs structurés de la CNI, tandis qu'un modèle GLM-OCR (0.9B paramètres) prend le relais en "
        "asynchrone (Celery) pour l'extraction sémantique complexe et non structurée des factures d'électricité (ENEO) et d'eau (CAMWATER).",
        "Pour la vérification d'identité faciale, la simple reconnaissance de visage ne suffit pas en raison des risques élevés d'attaques par "
        "présentation (usurpation par photo, vidéo ou masque). Yu et al. (2020) présentent une revue exhaustive des techniques de Face Anti-Spoofing, "
        "soulignant l'importance de coupler la reconnaissance faciale (Face Matching) avec des tests actifs de vivacité (Liveness Detection). "
        "VeriPass met en œuvre cette recommandation scientifique en obligeant le client à accomplir un challenge de mouvements aléatoires "
        "guidés par l'interface (clignements, inclinaison de la tête), analysé en temps réel par un modèle de détection de landmarks (MediaPipe) "
        "et de vivacité (MiniFASNet), puis compare le visage du selfie avec celui de la photo CNI via DeepFace avec un seuil de similarité strict "
        "fixé à 98.5%.",
        "Enfin, les standards d'identité numérique du GAFI (Financial Action Task Force, 2020) recommandent d'adopter une approche fondée sur les "
        "risques, garantissant la fiabilité et le maintien d'une supervision humaine. De même, les lignes directrices du CGAP (2021) sur l'inclusion "
        "financière rappellent que la transition digitale ne doit pas exclure les populations moins familiarisées avec la technologie. VeriPass "
        "intègre ce principe d'inclusion en proposant un guidage visuel très illustré et une gestion explicite des cas d'échecs (Plan B) permettant "
        "la reprise de capture simple ou l'escalade vers une revue manuelle assistée par un agent, prévenant ainsi tout blocage frustrant ou rejet injustifié."
    ]:
        add_para(marker, t)
        
    p_trans5 = (
        "Ces fondements scientifiques se traduisent techniquement par des exigences fonctionnelles et non fonctionnelles précises "
        "qui cadrent l'ensemble de notre développement logiciel."
    )
    add_para(marker, p_trans5)

    add_para(marker, "2.6 Exigences fonctionnelles", "Heading 2")
    for t in [
        "Les exigences fonctionnelles (FR1 à FR19) cadrent précisément les flux applicatifs du système : authentification OTP, capture guidée, "
        "liveness challenge, validation locale du format de Numéro d'Identifiant Unique (NIU) via regex (^[A-Z][0-9]{12}[A-Z]$) et clé de contrôle "
        "algorithmique Modulo 23/26, consentement Loi n° 2024/017, signature tactile, file de validation assistée par agent KYC, et activation "
        "du dossier. Pour la conformité de modélisation, le pipeline intègre un simulateur d'Identifiant Bancaire Unique (IBU) basé sur la norme "
        "ISO 17442 (CM + segment BICEC 00001 + identifiant unique + clé de contrôle calculée selon l'algorithme Modulo 97-10 : Cle = 98 - (Number % 97)), "
        "permettant un développement et un test réalistes des interfaces. De plus, un mécanisme de sécurité robuste bloque l'accès "
        "(status LOCKED_LIVENESS) après 3 échecs consécutifs au liveness challenge pour éviter les attaques de présentation par brute force."
    ]:
        add_para(marker, t)

    add_para(marker, "2.7 Exigences non fonctionnelles", "Heading 2")
    for t in [
        "Les exigences non fonctionnelles (NFR11 à NFR16 selon la normalisation de conduite de projet) imposent des critères de performance "
        "et de volume stricts. L'inférence locale de l'IA (OCR et biométrie) doit s'exécuter en moins de 15 secondes pour garantir un parcours total "
        "fluide. Pour valider scientifiquement ces moteurs, le projet s'appuie sur la constitution progressive d'un dataset d'entraînement local "
        "anonymisé (conformément aux principes de minimisation de la Loi n° 2024/017) : un jeu de données de 5 000 spécimens de CNI camerounaises "
        "pour le fine-tuning de PaddleOCR (NFR11), et un jeu de test de 300 à 500 paires de visages pour l'évaluation de la similarité DeepFace "
        "(NFR12, FAR < 2%). La sécurité au repos impose le chiffrement AES-256 de tous les fichiers originaux sur le volume de stockage Docker centralisé."
    ]:
        add_para(marker, t)

    caption(marker, "Tableau 7. Synthèse des exigences techniques primaires du projet")
    add_table(doc, marker, ["Domaine d'exigence", "Spécification technique mise en œuvre", "Seuil de conformité académique et technique"], [
        ["Inférence locale IA", "PaddleOCR v5 local + DeepFace / MiniFASNet", "Latence totale IA < 15s (OCR <5s, Liveness <10s) sur machine cible"],
        ["Chiffrement au repos", "Volume de stockage Docker crypté AES-256", "100% de conformité de stockage Loi n° 2024/017"],
        ["Dataset d'entraînement", "Fine-tuning PaddleOCR sur CNI locales", "Dataset de 5 000 CNI anonymisées (NFR11 - ground truth)"],
        ["Calibrage biométrique", "Seuil de similarité DeepFace (comparaison CNI/selfie)", "Reconnaissance faciale à 98.5% (NFR12 - FAR < 2%)"],
        ["Format NIU fiscal", "Regex syntaxique locale + vérification visuelle", "Format 14 caractères (1 lettre + 12 chiffres + 1 lettre)"],
        ["Format IBU bancaire", "Simulateur ISO 17442 calculé Modulo 97-10", "Structure 20-22 caractères, validation mathématique"]
    ], [1.8, 2.7, 2.7])
    source(marker, "Source : synthèse de l'auteur, d'après les spécifications d'ingénierie et le plan de tests VeriPass.")
    
    p_trans6 = (
        "La mise en œuvre coordonnée de ces exigences fonctionnelles et non fonctionnelles impose une méthodologie de conduite de "
        "projet particulièrement robuste pour suivre l'avancement et garantir la conformité réglementaire."
    )
    add_para(marker, p_trans6)

    add_para(marker, "2.8 Méthodologie de conduite du projet", "Heading 2")
    for t in [
        "La conduite du projet d'ingénierie s'appuie sur une méthodologie hybride rigoureuse. Afin de garantir le respect des exigences "
        "réglementaires denses de la COBAC, la phase de spécification et d'analyse suit les principes structurés du Cycle en V : chaque exigence "
        "légale ou de conformité est directement mappée à un scénario de test d'acceptation et à un résultat vérifiable, assurant la traçabilité. "
        "Pour la réalisation logicielle, l'équipe adopte la démarche itérative Agile/Scrum. Le projet est découpé en sprints de deux semaines, "
        "rythmés par des réunions de planification, des revues régulières et la tenue d'un product backlog prioritaire.",
        "Cette agilité garantit une rapidité de développement et permet d'intégrer les retours continus des encadreurs de la BICEC. Les livrables "
        "techniques (contrats API FastAPI, modèles relationnels PostgreSQL, PWA React/Vite, back-office, logs de sécurité, proofs d'exécution) "
        "sont produits par petits incréments testés localement sous le budget de ressources matérielles contraint (RAM de la machine hôte limitée "
        "à 16 Go, WSL 2 plafonné à 8 Go de RAM), assurant la résilience et la viabilité de la solution avant sa démonstration finale."
    ]:
        add_para(marker, t)

    add_para(marker, "2.9 Planning, risques et collaboration", "Heading 2")
    for t in [
        "Ce cadre méthodologique s'incarne dans un calendrier de réalisation précis, structuré autour de jalons mensuels (de M1 à M5) et d'une "
        "gestion proactive des risques techniques et opérationnels. Les risques du projet sont activement suivis dans une matrice d'atténuation. "
        "La collaboration étroite avec M. Jackson KOMBE LELE et les équipes techniques du Core Banking et de la Sécurité IT permet de valider "
        "les compromis de conception au fur et à mesure."
    ]:
        add_para(marker, t)

    caption(marker, "Tableau 9. Planning de conduite, risques et modes de collaboration")
    add_table(doc, marker, ["Phase de stage", "Livrables attendus et jalons", "Risque opérationnel suivi", "Mode de collaboration interne"], [
        ["M1 (Semaines 1-3)", "Cadrage, dataset 5k CNI, dev env Docker", "Dataset incomplet, specs floues", "Ateliers réguliers avec M. Jackson KOMBE LELE"],
        ["M2 (Semaines 4-7)", "Backend FastAPI, PWA React/Vite, local OCR", "Latences élevées de l'OCR sur machine cible", "Revues hebdomadaires avec le Département Étude"],
        ["M3 (Semaines 8-11)", "Liveness, face matching, back-office agent", "Taux de faux rejets biométriques > 2%", "Ajustements de calibrage avec la sécurité IT"],
        ["M4 (Semaines 12-15)", "SSO link, product discovery, notifications", "Bugs d'IndexedDB lors des délestages", "Ateliers d'intégration PWA avec équipes client"],
        ["M5 (Semaines 16-20)", "Tests Playwright E2E, pilote 50, audit trail", "Rejet de conformité lors de l'audit", "Simulation de contrôle avec les auditeurs KYC"]
    ], [1.4, 2.3, 2.0, 1.8])
    source(marker, "Source : synthèse de l'auteur, d'après le calendrier de stage et la roadmap agile VeriPass.")
    
    p_trans7 = (
        "La confrontation avec ces réalités industrielles complexes a constitué le socle de notre développement professionnel "
        "et personnel, renforçant nos compétences d'ingénieur."
    )
    add_para(marker, p_trans7)

    add_para(marker, "2.10 Bilan des Acquis d'Apprentissage et Apports Professionnels", "Heading 2")
    for t in [
        "Ce projet d'ingénierie de fin d'études a constitué un puissant vecteur de développement professionnel et personnel. Sur le plan technique, "
        "il a permis de maîtriser les architectures de développement cloud-native on-premise, d'intégrer des modules d'apprentissage profond locaux "
        "(PaddleOCR, DeepFace, MiniFASNet) sous des contraintes matérielles réelles de production bancaire, et de concevoir des mécanismes de "
        "résilience complexes (IndexedDB, Service Workers, progressive upload asynchrone) pour adapter le logiciel aux contraintes d'infrastructure camerounaises (le délestage).",
        "Sur le plan méthodologique et humain, ce stage au sein de la BICEC a développé une solide culture de la conformité, de la rigueur bancaire "
        "et de la sécurité dès la conception (Security by Design). Les interactions quotidiennes avec les développeurs et les juristes conformité "
        "de la banque ont renforcé nos capacités de communication professionnelle, d'autonomie et de gestion des risques. Ce travail démontre qu'un "
        "ingénieur de fin d'études doit savoir concilier performance algorithmique, rentabilité économique et conformité réglementaire pour livrer un produit créateur de valeur pour l'entreprise."
    ]:
        add_para(marker, t)

    add_para(marker, "2.11 Synthèse du chapitre", "Heading 2")
    add_para(
        marker,
        "Ce deuxième chapitre a traduit le cadre d'onboarding en exigences logicielles formelles et a présenté notre conduite de projet agile et hybride "
        "basée sur le Cycle en V et Scrum. Nous avons étayé l'état de l'art scientifique de l'OCR et de la biométrie faciale et formalisé les exigences "
        "non fonctionnelles de performance et de calibrage sous contraintes matérielles réelles. Enfin, nous avons dressé le bilan de nos acquis "
        "d'apprentissage. Le chapitre suivant détaille l'architecture technique globale, les conteneurs Docker et la modélisation de la base de données "
        "relationnelle répondant à ces exigences."
    )

    return marker
def write_chapter3(doc):
    marker = delete_between(doc, "Chapitre 3", "Chapitre 4")
    add_para(marker, "Chapitre 3 : Architecture de traitement KYC/OCR/biométrie", "Heading 1")
    add_para(marker, "Le chapitre précédent a fixé les besoins, les données et les exigences. Le présent chapitre décrit l'architecture technique pour transformer ces exigences en système logiciel. Il présente les couches applicatives, le pipeline de données, le traitement OCR, la vérification biométrique et la modélisation des données.")
    add_para(marker, "3.1 Architecture globale de la solution", "Heading 2")
    add_para(marker, "VeriPass repose sur une architecture à quatre couches. La première couche est la PWA mobile React/Vite, utilisée par le client pour s'authentifier, constituer son dossier et suivre son statut. La deuxième est l'API FastAPI, qui porte les contrats, l'authentification, les règles KYC et les transitions d'état. La troisième est la couche de traitements asynchrones, fondée sur Redis et Celery. La quatrième regroupe PostgreSQL et le stockage documentaire.")
    caption(marker, "Tableau 10. Architecture logique et responsabilités techniques")
    add_table(doc, marker, ["Couche", "Technologies", "Responsabilités"], [
        ["Interface mobile", "React, Vite, PWA", "Parcours client, capture des pièces, revue OCR, liveness, consentement."],
        ["API métier", "FastAPI, SQLAlchemy, Pydantic", "Contrats REST, authentification, RBAC, états KYC, validation des données."],
        ["Traitements asynchrones", "Redis, Celery", "OCR différé, notifications, tâches planifiées, traitements longs."],
        ["Persistance", "PostgreSQL, volumes documentaires", "Dossiers, métadonnées, audit, pièces, hash et conservation."],
    ], [1.6, 2.1, 3.5])
    add_figure(marker, FIG / "architecture_logicielle_v6.png", "Figure 2. Architecture logique simplifiée de BICEC VeriPass")
    source(marker, "Source : auteur, d'après docs/architecture.md et code/docker-compose.yml.")
    for t in [
        "Le reverse proxy reverse joue le rôle de point d'entrée TLS et distribue les requêtes vers la PWA mobile, le back office et l'API. Cette séparation permet de protéger les interfaces internes, de centraliser certains en têtes de sécurité et d'isoler les temps longs liés à la capture documentaire.",
        "L'API FastAPI concentre les règles de domaine. Elle reçoit les pièces, crée les enregistrements documentaires, calcule ou déclenche les contrôles et expose les statuts au mobile comme au back office. Les workers Celery évitent que les traitements OCR et notifications bloquent les requêtes interactives.",
        "La PWA mobile est responsable de l'expérience de collecte. Elle doit guider l'utilisateur sans exposer la complexité du système. Elle communique avec l'API par des endpoints spécialisés : démarrage de session, capture CNI, revue OCR, soumission de l'adresse, consentement, signature, liveness et soumission finale. Cette granularité permet de reprendre un parcours interrompu sans perdre tout le dossier.",
        "Le back office React/Vite répond à une logique différente. Il n'est pas conçu pour collecter des données, mais pour décider. Son architecture doit présenter les pièces, les champs extraits, les anomalies, les scores, les alertes et les actions possibles. Cette séparation entre collecte et décision limite les risques d'erreur d'usage et rend les responsabilités plus lisibles.",
        "La couche API sert de frontière de confiance. Elle vérifie l'identité du client ou de l'agent, applique les rôles, transforme les fichiers reçus en documents persistés et enregistre les événements importants. Elle doit aussi empêcher les actions incohérentes, par exemple soumettre un dossier sans consentement ou modifier un dossier déjà approuvé.",
        "Redis et Celery forment la couche de traitement différé. Elle devient nécessaire dès que le temps de traitement dépasse l'attente normale d'un appel HTTP. OCR, notifications, tâches planifiées et certains contrôles de cohérence peuvent ainsi être exécutés sans bloquer le client. Le statut du dossier devient alors le moyen de synchroniser l'expérience utilisateur avec les traitements en arrière plan.",
    ]:
        add_para(marker, t)
    add_para(marker, "3.2 Pipeline de données KYC", "Heading 2")
    for t in [
        "Le pipeline part de la capture mobile. Le client ouvre une session, transmet les pièces attendues et confirme les données extraites. Chaque document est stocké dans un volume documentaire, tandis que PostgreSQL conserve le type de document, le chemin relatif, le hash, le statut OCR et les métriques de qualité.",
        "La trajectoire fonctionnelle peut être résumée par les états suivants : DRAFT, SUBMITTED, OCR_PROCESSING, BIOMETRIC_PROCESSING, READY_FOR_REVIEW, puis APPROVED ou REJECTED. Dans le code actuel, certains libellés opérationnels diffèrent, notamment PENDING_AGENT_REVIEW, PENDING_INFO ou FRAUD_SUSPECT. Le principe reste identique : séparer la préparation du dossier, les traitements automatiques et la décision humaine.",
    ]:
        add_para(marker, t)
    add_figure(marker, FIG / "pipeline_kyc_v6.png", "Figure 3. Pipeline de données et états principaux du dossier KYC")
    source(marker, "Source : auteur, d'après docs/project-overview.md, docs/api-contracts.md et les schémas KYC.")
    add_para(marker, "Le pipeline prévoit aussi des retours en arrière contrôlés. Un dossier peut revenir en demande de complément si une pièce est illisible, si une donnée déclarative manque ou si un score de contrôle nécessite une reprise. Cette possibilité est essentielle pour éviter que l'automatisation ne transforme un simple défaut de capture en rejet définitif.")
    for t in [
        "La capture documentaire commence par la création ou la reprise d'une session. L'API doit garantir qu'un client ne multiplie pas les sessions éditables pour le même besoin, car cela compliquerait la revue et les contrôles de doublon. Le champ last_step_completed, présent dans le modèle, sert à reprendre le parcours au bon endroit.",
        "Lorsqu'un document est reçu, il n'est pas seulement enregistré comme fichier. Le système calcule un hash, conserve le chemin relatif, le type de document, la date de capture, la taille et le statut OCR. Cette métadonnée permet de vérifier l'intégrité du fichier et de relier la pièce à la session correcte.",
        "Après la capture CNI, le pipeline déclenche l'extraction OCR. Les champs extraits ne sont pas directement considérés comme vérité métier. Ils sont enregistrés avec leur score de confiance, puis confirmés ou corrigés dans le parcours. Ce choix protège la banque contre les erreurs silencieuses, en particulier sur les numéros et dates.",
        "La biométrie intervient après la constitution minimale du dossier. Le système conserve le score de liveness, le statut de face matching, la raison de l'échec ou du succès, la distance et le seuil utilisé. Ces informations ne servent pas seulement au traitement immédiat. Elles permettent aussi de comprendre les rejets et d'améliorer les seuils lors des phases de calibration.",
        "La dernière étape est la revue humaine. Le back office ne doit pas recevoir un simple ensemble de fichiers, mais un dossier ordonné : données déclarées, pièces, champs extraits, corrections, scores, alertes et historique. Cette structure permet à l'agent KYC/chargé de clientèle de décider rapidement tout en conservant une justification.",
    ]:
        add_para(marker, t)
    add_para(marker, "3.3 Traitement OCR", "Heading 2")
    for t in [
        "Le traitement OCR vise à extraire les champs utiles de la CNI : nom, prénom, date de naissance, numéro du document, date d'expiration et informations complémentaires disponibles selon la qualité de la capture. Le choix technique documenté dans le projet repose sur PaddleOCR comme moteur rapide, avec un traitement GLM/OCR possible pour les cas plus complexes.",
        "Le prétraitement des images est nécessaire avant reconnaissance. Il comprend le contrôle de cadrage, la détection de flou, la normalisation de la luminosité, la réduction du bruit et la vérification que la pièce occupe une zone suffisante de l'image. Ces opérations ne garantissent pas une extraction parfaite, mais elles augmentent la probabilité de produire des champs exploitables.",
        "Chaque champ extrait est associé à un score de confiance. Lorsque le score est suffisant, la valeur peut être présentée au client pour confirmation. Lorsque le score est faible, la solution doit conserver l'incertitude : statut PARTIAL ou FAILED, message de reprise, traitement différé ou revue manuelle. Cette gestion explicite des échecs est plus importante qu'un affichage artificiellement confiant.",
        "PaddleOCR est adapté à une première passe, car il permet une extraction rapide et locale. Dans le contexte VeriPass, cette rapidité est utile pour donner un retour immédiat ou quasi immédiat sur une capture. Elle ne dispense pas d'une seconde lecture lorsque le document est bruité, lorsque des champs sont absents ou lorsque le format réel diffère des hypothèses prévues.",
        "Le recours à GLM/OCR est pertinent pour les cas où la structure du document ou la qualité de l'image rendent la lecture classique insuffisante. Ce type de moteur peut mieux exploiter le contexte visuel et la disposition du document. En contrepartie, il est plus coûteux et doit donc être utilisé avec discernement, par exemple sur les échecs PaddleOCR, les documents complémentaires ou les captures nécessitant une interprétation plus riche.",
        "Les seuils de confiance doivent être considérés comme des paramètres métier et non comme des constantes arbitraires. Un seuil élevé réduit les faux positifs mais augmente les reprises. Un seuil faible fluidifie le parcours mais peut laisser passer des erreurs. Dans un environnement bancaire, le compromis doit être documenté et validé avec les équipes concernées.",
        "La gestion des échecs OCR doit être visible dans le modèle. Le statut PENDING indique une attente de traitement, SUCCESS un traitement exploitable, PARTIAL une extraction incomplète, FAILED un échec technique ou qualitatif et MANUAL une reprise humaine. Cette granularité permet au back office de filtrer les dossiers et de comprendre le motif d'une attente.",
        "Les corrections humaines font partie du pipeline. Lorsqu'un agent corrige un champ, le système doit conserver la valeur initiale, la valeur corrigée, l'auteur et la date de correction. Cette traçabilité protège la banque et permet de comparer plus tard les erreurs récurrentes du moteur OCR.",
    ]:
        add_para(marker, t)
    caption(marker, "Tableau 11. Gestion des échecs OCR et biométriques")
    add_table(doc, marker, ["Cas", "Symptôme", "Réponse système"], [
        ["Image floue", "Contours instables, texte non lisible.", "Demander une nouvelle capture ou marquer le document en revue manuelle."],
        ["Champ OCR incertain", "Score inférieur au seuil ou valeur incohérente.", "Afficher pour confirmation, conserver la confiance et tracer la correction."],
        ["Document partiel", "Zone utile absente ou verso manquant.", "Bloquer la soumission ou demander un complément."],
        ["Liveness échoué", "Challenge non reconnu ou score faible.", "Compter l'essai, limiter les reprises, proposer escalade ou agence."],
        ["Face matching ambigu", "Similarité proche du seuil.", "Escalade humaine avec preuve et motif."],
    ], [1.5, 2.5, 3.2])
    add_para(marker, "3.4 Vérification biométrique", "Heading 2")
    for t in [
        "La vérification biométrique combine deux contrôles. Le premier est la preuve de vie, fondée sur un challenge actif comme sourire, cligner des yeux ou tourner la tête. Le second est la comparaison entre le visage capturé et la photo extraite ou visible sur la CNI.",
        "La preuve de vie réduit le risque d'une attaque par photo statique. Elle ne l'élimine pas entièrement, car les attaques de présentation évoluent. Pour cette raison, le résultat doit être exprimé par un score, un statut et un motif. Le face matching suit la même logique : un score supérieur au seuil peut faciliter la revue, mais un score limite doit être escaladé.",
        "Le modèle de données conserve le face_match_score, le face_match_status, le face_match_reason, la distance, le seuil, le détecteur et les versions de modèles. Ces informations sont utiles pour l'audit, le diagnostic et la comparaison entre résultats automatiques et décisions humaines.",
        "Le challenge actif a l'avantage de rester compréhensible par le client. Il demande une action simple et observable. En revanche, il peut échouer pour des raisons non frauduleuses : mauvaise lumière, caméra de faible qualité, mouvement trop rapide ou consigne mal comprise. Le système doit donc limiter le nombre d'essais tout en prévoyant un chemin de reprise.",
        "Le face matching compare deux représentations du visage : le selfie capturé et la photo issue de la pièce. Le score n'est pas une preuve absolue. Il indique une proximité selon un modèle et un seuil. Un dossier peut donc être validable avec revue humaine même si le score est proche du seuil, surtout lorsque la qualité de la photo CNI est faible.",
        "Les cas de rejet doivent être classés. Un rejet peut provenir d'un liveness échoué, d'un visage absent, d'un visage multiple, d'un matching insuffisant, d'un document illisible ou d'une suspicion d'usurpation. Cette distinction est nécessaire pour éviter des motifs génériques qui ne permettent ni au client ni aux équipes de comprendre l'action suivante.",
        "L'escalade humaine est une composante de sécurité. Elle évite de transformer une incertitude technique en décision automatique. Elle permet aussi de détecter des cas que le modèle ne comprend pas bien, par exemple une photo ancienne sur la CNI, une variation importante d'apparence ou une capture réalisée dans un contexte très défavorable.",
    ]:
        add_para(marker, t)
    add_para(marker, "3.5 Modélisation de la base de données", "Heading 2")
    for t in [
        "Le choix de PostgreSQL répond à trois besoins : cohérence transactionnelle, auditabilité et expressivité du modèle relationnel. Les dossiers KYC sont liés à des utilisateurs, documents, champs OCR, résultats biométriques, décisions et journaux. Un stockage purement fichier ou purement document aurait rendu plus difficile la justification des transitions d'état.",
        "L'entité centrale est KYCApplication, représentée dans le code par KYCSession. Elle porte l'état du dossier, le niveau d'accès, les informations d'adresse, le NIU, les scores globaux et les dates de cycle de vie. Les documents sont séparés pour permettre plusieurs pièces par session. Les champs OCR sont séparés des documents afin de conserver les corrections humaines.",
        "BiometricCheck, représenté par BiometricResult, isole les scores de liveness et de face matching. BackofficeDecision, représenté par ValidationDecision, conserve la décision, le motif, l'agent et l'horodatage. AuditLog complète ce modèle en donnant une trace transversale des actions sensibles.",
        "La table kyc_sessions joue le rôle de dossier maître. Elle agrège les informations de cycle de vie, mais elle ne contient pas directement les fichiers. Cette séparation évite de surcharger la base avec des objets volumineux, tout en gardant une référence fiable vers le stockage documentaire.",
        "La table documents matérialise le lien entre une session et une pièce. Le champ sha256_hash permet de détecter une altération ou une incohérence de transfert. Les champs ocr_status, ocr_engine, ocr_raw_json, confidence_per_field et capture_quality_metrics donnent au système assez de contexte pour expliquer un résultat OCR.",
        "La table ocr_fields permet une granularité plus fine. Elle évite de traiter l'OCR comme un texte global. Chaque champ peut avoir une valeur extraite, un score, une valeur corrigée et un agent correcteur. Cette structure est adaptée aux exigences KYC, car toutes les erreurs n'ont pas le même impact.",
        "La table biometric_results sépare les résultats biométriques du dossier. Ce choix facilite l'évolution des modèles et la conservation des versions. Il devient possible de savoir quel moteur, quel seuil ou quel détecteur a produit un résultat donné, ce qui est indispensable pour l'audit et la maintenance.",
        "La table validation_decisions garde la décision métier. Elle ne doit pas être confondue avec les scores automatiques. Un score peut orienter une revue, mais la décision doit être portée par un agent, un motif et un horodatage. Cette séparation matérialise le principe human in the loop défendu dans le projet.",
        "PostgreSQL est également pertinent parce que les écritures KYC exigent des transactions. Lorsqu'un dossier est soumis, l'état, l'adresse IP, les documents, les consentements et les notifications doivent rester cohérents. Une base relationnelle permet de contrôler ces liens et de limiter les anomalies de cycle de vie.",
        "La cohérence des états est un point critique. Un dossier ne doit pas être à la fois éditable par le client et approuvé par le back office. Une pièce supprimée ne doit pas rester référencée comme preuve active. Une correction OCR ne doit pas être perdue lorsque le dossier change d'état. Ces règles semblent simples, mais elles exigent une base capable de relier les actions et de rejeter les transitions incohérentes.",
        "Le modèle doit aussi préparer les contrôles ultérieurs. Un audit peut chercher à savoir qui a consulté un dossier, quelle pièce a été utilisée, quel score a été obtenu, quel agent a décidé, quel motif a été saisi et à quel moment l'action a eu lieu. Si ces informations sont dispersées sans relation stable, l'audit devient fragile. PostgreSQL permet au contraire de relier les tables par identifiants et de reconstruire le chemin du dossier.",
        "La présence de champs JSONB dans certains modèles ne contredit pas le choix relationnel. Elle répond à un besoin de souplesse pour des données variables, comme les métriques de qualité, les sorties brutes OCR ou les métadonnées de consentement. Les champs structurants restent relationnels, tandis que les détails techniques évolutifs peuvent être conservés en JSONB sans casser le schéma principal.",
        "Cette combinaison est adaptée à un projet en évolution. Les tables stables portent les responsabilités métier : dossier, document, champ, biométrie, décision et audit. Les colonnes plus flexibles absorbent les variations des moteurs OCR et biométriques. Le modèle peut ainsi évoluer sans perdre la lisibilité nécessaire à la conformité.",
    ]:
        add_para(marker, t)
    add_figure(marker, FIG / "mld_kyc_v6.png", "Figure 4. MLD simplifié des entités KYC principales")
    source(marker, "Source : auteur, d'après code/backend/app/modules/kyc/models.py et docs/data-models.md.")
    add_para(marker, "Synthèse du chapitre", "Heading 2")
    add_para(marker, "L'architecture proposée traduit les exigences du chapitre 2 en composants séparés et auditables. La PWA mobile collecte, l'API orchestre, Celery traite les tâches longues, PostgreSQL conserve les états et le stockage documentaire garde les pièces. Cette organisation prépare l'intégration des mécanismes de vérification détaillés dans le chapitre suivant.")
    add_para(marker, "Le point le plus important est la séparation des responsabilités. La capture n'est pas la décision, l'OCR n'est pas la vérité métier, le score biométrique n'est pas une validation et le stockage documentaire n'est pas un audit complet. L'architecture VeriPass assemble ces éléments pour produire un dossier exploitable par une banque.")
    add_para(marker, "Ainsi, le chapitre 3 sert de charnière entre le besoin et la réalisation. Il montre comment les choix techniques soutiennent les exigences de sécurité, de traçabilité et d'exploitation. Le chapitre suivant peut alors présenter l'intégration effective des mécanismes intelligents de vérification dans les écrans, les services et les traitements du pipeline.")

    return marker


def write_conclusion_bib_annexes(doc):
    marker = delete_between(doc, "Conclusion générale", "Références bibliographiques")
    add_para(marker, "Conclusion générale", "Heading 1")
    for t in [
        "Ce mémoire avait pour objectif de concevoir et développer BICEC VeriPass, un écosystème intelligent d'acquisition client intégrant des mécanismes avancés de vérification KYC. La problématique de départ portait sur la capacité d'une banque camerounaise à digitaliser son entrée en relation, tout en respectant les exigences COBAC, les contraintes de sécurité et la nécessité d'une validation humaine.",
        "Le travail réalisé montre qu'un parcours KYC digital ne peut pas être réduit à un formulaire en ligne. Il doit combiner capture documentaire, extraction OCR, preuve de vie, comparaison biométrique, gestion des consentements, traçabilité, revue back office et conservation des preuves. L'apport principal de VeriPass est d'organiser ces éléments dans un pipeline cohérent et exploitable.",
        "Les objectifs fonctionnels ont été couverts par la mise en place d'un parcours mobile, d'une API FastAPI, de modèles de données KYC, de contrôles OCR et biométriques, d'un back office de revue et d'une infrastructure Docker. Les objectifs de conformité ont été pris en compte par la séparation des rôles, les journaux, les statuts de dossier, les décisions motivées et la conservation des pièces avec hash.",
    ]:
        add_para(marker, t)
    caption(marker, "Tableau 12. Bilan synthétique des objectifs et des réalisations")
    add_table(doc, marker, ["Objectif", "Réalisation", "Limite restante"], [
        ["Digitaliser l'onboarding", "Parcours PWA mobile, capture CNI, adresse, consentement et soumission.", "Tests terrain à élargir sur un panel réel."],
        ["Automatiser le contrôle documentaire", "OCR avec champs, confiance, revue et correction.", "Calibration à renforcer sur CNI réelles variées."],
        ["Intégrer la biométrie", "Liveness, face matching, scores et raisons d'échec.", "Seuils à valider avant production."],
        ["Assurer l'auditabilité", "PostgreSQL, décisions, logs, hash documentaire.", "Politique finale de conservation à valider avec la conformité."],
    ], [1.8, 3.0, 2.4])
    for t in [
        "Les acquis techniques couvrent FastAPI, React/Vite, PostgreSQL, Docker, Redis, Celery, l'OCR, la biométrie et les mécanismes de sécurité applicative. Le projet a également permis de travailler sur des problématiques de production : gestion des erreurs, séparation des rôles, observabilité, stockage documentaire et contrats API.",
        "Les acquis organisationnels sont tout aussi importants. Le stage a placé le développement dans un environnement bancaire exigeant, où la vitesse de réalisation doit rester compatible avec la conformité, l'audit et la protection des données. Les échanges avec les équipes ont montré que la bonne solution n'est pas celle qui automatise le plus, mais celle qui aide les acteurs à décider plus vite et mieux.",
        "Les limites principales concernent la validation terrain, la calibration des seuils OCR et biométriques, la gouvernance finale des données sensibles, l'intégration avec les systèmes bancaires de production et l'accompagnement au changement. Une mise en production nécessiterait des tests sur un échantillon élargi, une revue sécurité complète, une validation conformité et une procédure d'exploitation.",
        "Les perspectives portent sur l'industrialisation du pipeline, la certification ou validation du dispositif dans le cadre COBAC, l'extension à d'autres parcours clients et l'adaptation à d'autres banques de la zone CEMAC. VeriPass peut devenir un socle régional de RegTech bancaire, à condition de conserver son principe directeur : automatiser les contrôles répétitifs, mais garder la responsabilité humaine sur les décisions sensibles.",
    ]:
        add_para(marker, t)

    marker = delete_between(doc, "Références bibliographiques", "Annexes")
    add_para(marker, "Références bibliographiques", "Heading 1")
    refs = [
        "Banque Internationale du Cameroun pour l'Epargne et le Crédit. (2026). Présentation institutionnelle de la BICEC. https://www.bicec.com",
        "Commission Bancaire de l'Afrique Centrale. (2023). Règlement COBAC R 2023/01 relatif aux diligences des établissements assujettis en matière de lutte contre le blanchiment des capitaux, le financement du terrorisme et de la prolifération.",
        "Consultative Group to Assist the Poor. (2021). Regulation for inclusive digital finance. CGAP.",
        "Droit Médias Finance. (2024). Le nouveau règlement COBAC R 2023/01 et les diligences KYC des établissements assujettis.",
        "Financial Action Task Force. (2020). Guidance on digital identity. FATF.",
        "Nguyen, T. D., Nguyen, H. T., & Nguyen, T. T. (2020). Automatic information extraction from identity cards using deep learning. Proceedings of the International Conference on Advanced Computing and Applications.",
        "Raj, A., Sreenivas, V., & Jawahar, C. V. (2020). Learning to read identity documents with document structure awareness. arXiv.",
        "Yu, Z., Qin, Y., Li, X., Zhao, C., Lei, Z., & Zhao, G. (2020). Deep learning for face anti spoofing: A survey. arXiv.",
        "OpenAPI Initiative. (2024). OpenAPI Specification. https://spec.openapis.org",
        "PostgreSQL Global Development Group. (2026). PostgreSQL documentation. https://www.postgresql.org/docs/",
        "FastAPI. (2026). FastAPI documentation. https://fastapi.tiangolo.com/",
        "Docker. (2026). Docker Compose documentation. https://docs.docker.com/compose/",
    ]
    for r in refs:
        p = add_para(marker, r, "Bibliographie" if "Bibliographie" in [s.name for s in doc.styles] else "Normal")
        p.paragraph_format.line_spacing = 1.0
        p.paragraph_format.space_after = Pt(6)

    idx = next(i for i, p in enumerate(doc.paragraphs) if p.text.strip().startswith("Annexes"))
    for p in doc.paragraphs[idx:]:
        p._element.getparent().remove(p._element)
    end = doc.add_paragraph()
    add_para(end, "Annexes", "Heading 1")
    add_para(end, "Annexe A : fiche de validation du sujet", "Heading 2")
    add_para(end, "La fiche de validation indique que le stage se déroule à la BICEC, à Douala, sous la responsabilité de M. KOMBE LELE Jackson Parfait, responsable du département Étude et Développement. Le sujet validé est : Conception et Développement d'un écosystème intelligent d'acquisition client : intégration de mécanismes avancés de vérification pour l'automatisation de la conformité KYC. L'objectif poursuivi est de digitaliser l'onboarding client pour réduire le délai d'enrôlement et automatiser le contrôle documentaire KYC. La période de stage indiquée s'étend du 19 janvier 2026 au 18 juin 2026.")
    add_para(end, "Annexe B : extrait représentatif de docker-compose.yml", "Heading 2")
    add_para(end, "Services principaux : nginx comme proxy TLS, pwa pour l'application mobile, backoffice pour l'interface interne, api pour FastAPI, postgres pour la base, redis pour le broker, celery_ocr pour les traitements OCR, celery_notifications pour les notifications, celery_beat pour les tâches planifiées, flower pour la supervision Celery. Les volumes externes principaux sont documents_storage, db_storage et db_backups.")
    add_para(end, "Annexe C : extrait de contrat API KYC", "Heading 2")
    add_para(end, "Endpoint de référence : POST /api/v1/kyc/session/start crée ou reprend une session éditable. Le flux de soumission s'appuie ensuite sur POST /api/v1/kyc/capture/cni, POST /api/v1/kyc/ocr/review, POST /api/v1/kyc/liveness/submit, POST /api/v1/kyc/consent/submit et POST /api/v1/kyc/submit. La réponse de soumission contient session_id, status, message et access_level.")
    add_para(end, "Annexe D : captures d'écran disponibles", "Heading 2")
    add_para(end, "Les captures d'écran disponibles dans docs/test-evidence/latest illustrent les files back office, les alertes AML, la démonstration de conformité, les écrans mobiles de parcours KYC et les preuves d'exécution E2E. Elles doivent être insérées dans la version finale lorsque les chapitres 4 et 5 seront rédigés.")
    add_para(end, "Annexe E : extrait du schéma de base de données", "Heading 2")
    add_para(end, "Tables principales : kyc_sessions pour le dossier et ses états, documents pour les pièces et leurs hash, ocr_fields pour les champs extraits et corrigés, biometric_results pour les scores liveness et face matching, validation_decisions pour les décisions back office, audit_logs pour la traçabilité transversale.")


def scan(doc):
    parts = []
    for p in doc.paragraphs:
        parts.append(p.text)
    for t in doc.tables:
        for r in t.rows:
            for c in r.cells:
                parts.append(c.text)
    text = "\n".join(parts)
    bad = {
        "em_dash": "\u2014" in text,
        "en_dash": "\u2013" in text,
        "spaced_hyphen": " - " in text,
        "old_800": "800" in text,
        "fictive_jean": "Jean" in text,
        "fictive_thomas": "Thomas" in text,
        "fictive_sylvie": "Sylvie" in text,
        "admin_it": "Admin IT" in text,
        "sommaire_provisoire": "SOMMAIRE PROVISOIRE" in text,
    }
    failed = [k for k, v in bad.items() if v]
    if failed:
        raise SystemExit(f"scan failed: {failed}")


def main():
    make_figures()
    doc = Document(SRC)
    update_front_matter(doc)
    write_chapter1(doc)
    write_chapter2(doc)
    write_chapter3(doc)
    write_conclusion_bib_annexes(doc)
    global_cleanup(doc)
    scan(doc)
    doc.save(DST)
    print(DST)


if __name__ == "__main__":
    main()
