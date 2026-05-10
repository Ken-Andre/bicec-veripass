"""
Synthetic CNI Data Generation
==============================

Generate realistic Cameroonian CNI images for OCR training:
- Faker-based personal data generation
- Pillow template rendering (text on blank CNI template)
- Albumentations augmentation (rotation, blur, noise, perspective)

Run:  marimo edit 02_synthetic_cni_generation.py
"""

import marimo

__generated_with = "0.23.5"
app = marimo.App()


@app.cell
def _():
    """Imports."""
    import marimo as mo
    import os
    import sys
    from io import BytesIO
    import json
    import random
    from pathlib import Path

    import string
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
    from faker import Faker

    _notebook_dir = Path(globals().get("__file__", ".")).resolve().parent
    sys.path.insert(0, str(_notebook_dir))
    from ocr_utils import (
        CAMEROON_SURNAMES,
        CAMEROON_FIRSTNAMES,
        CAMEROON_CITIES,
        CAMEROON_PROFESSIONS,
        CAMEROON_REGIONS,
        paddle_ocr_pipeline,
        numpy_to_pil,
        image_to_bytes,
    )

    images_dir = _notebook_dir.parent / "images"
    output_dir = _notebook_dir / "output"
    output_dir.mkdir(exist_ok=True)

    # Standardized CNI Layout Configuration (Normalized to 800x500)
    # Positions calibrated precisely using text detection bounding boxes
    # Fonts used: 'sans_bold' -> Arial Bold, 'handwriting' -> Segoesc (for signature)

    CNI_FIELD_CONFIG = {
        "horizontal": {
            "recto": {
                # Text fields are placed precisely below their corresponding labels
                "nom_value": {"pos": (227, 107), "field": "nom", "color": (10, 10, 10), "font": "sans_bold", "size": 18},
                "prenom_value": {"pos": (227, 172), "field": "prenom", "color": (10, 10, 10), "font": "sans_bold", "size": 16},
                "date_naissance_value": {"pos": (227, 238), "field": "date_naissance", "color": (10, 10, 10), "font": "sans", "size": 13},
                "lieu_naissance_value": {"pos": (227, 274), "field": "lieu_naissance", "color": (10, 10, 10), "font": "sans", "size": 13},
                "sexe_value": {"pos": (227, 313), "field": "sexe", "color": (10, 10, 10), "font": "sans", "size": 13},
                "taille_value": {"pos": (320, 313), "field": "taille", "color": (10, 10, 10), "font": "sans", "size": 13},
                "profession_value": {"pos": (227, 348), "field": "profession", "color": (10, 10, 10), "font": "sans", "size": 12},
            },
            "verso": {
                # ── Colonne gauche (X≈31) — Parents, SP, Adresse ──
                "pere_value": {"pos": (31, 55), "field": "pere", "color": (10, 10, 10), "font": "sans", "size": 14},
                "mere_value": {"pos": (31, 122), "field": "mere", "color": (10, 10, 10), "font": "sans", "size": 14},
                "sp_value": {"pos": (31, 184), "field": "sp", "color": (10, 10, 10), "font": "sans_bold", "size": 14},
                "adresse_value": {"pos": (31, 238), "field": "adresse", "color": (10, 10, 10), "font": "sans", "size": 12},
                # ── Colonne centre (X≈232) — Autorité ──
                "autorite_name": {"pos": (232, 238), "field": "autorite", "color": (10, 10, 10), "font": "sans_bold", "size": 12},
                # ── Colonne droite-centre (X≈430) — Dates ──
                "delivrance_value": {"pos": (430, 204), "field": "date_delivrance", "color": (10, 10, 10), "font": "sans", "size": 12},
                "expiration_value": {"pos": (430, 258), "field": "date_expiration", "color": (10, 10, 10), "font": "sans", "size": 12},
                # ── Colonne extrême-droite (X≈582) — Poste + Identifiant ──
                "poste_value": {"pos": (582, 204), "field": "poste_identification", "color": (10, 10, 10), "font": "sans_bold", "size": 12},
                "identifiant_value": {"pos": (582, 258), "field": "numero_cni", "color": (10, 10, 10), "font": "sans_bold", "size": 10},
                # ── MRZ (bas de carte) ──
                "mrz_l1": {"pos": (60, 335), "field": "mrz_l1", "color": (0, 0, 0), "font": "mono", "size": 16},
                "mrz_l2": {"pos": (60, 415), "field": "mrz_l2", "color": (0, 0, 0), "font": "mono", "size": 16},
                "mrz_l3": {"pos": (60, 495), "field": "mrz_l3", "color": (0, 0, 0), "font": "mono", "size": 16},
            }
        },
        "vertical": {
            "recto": {},
            "verso": {}
        }
    }
    return (
        BytesIO,
        CAMEROON_CITIES,
        CAMEROON_FIRSTNAMES,
        CAMEROON_PROFESSIONS,
        CAMEROON_SURNAMES,
        CNI_FIELD_CONFIG,
        Faker,
        Image,
        ImageDraw,
        ImageFont,
        Path,
        image_to_bytes,
        images_dir,
        json,
        mo,
        np,
        output_dir,
        random,
    )


@app.cell
def _(mo):
    """Header."""
    mo.md("""# 🏭 Synthetic CNI Data Generation

    Generate realistic Cameroonian CNI images for OCR model training.
    **Pipeline:** Faker data → Pillow render → Albumentations augment → Dataset export.
    """)
    return


@app.cell
def _(Faker, mo):
    """Configure Faker for Cameroon-specific data."""
    fake = Faker("fr_FR")

    num_records = mo.ui.slider(
        start=10, stop=1000, step=10, value=50,
        label="Number of records to generate",
    )

    generate_btn = mo.ui.run_button(label="🎲 Generate Dataset")

    mo.vstack([
        mo.md("### 🎲 Data Generation Config"),
        num_records,
        generate_btn,
    ])
    return fake, generate_btn, num_records


@app.cell
def _(
    CAMEROON_CITIES,
    CAMEROON_FIRSTNAMES,
    CAMEROON_PROFESSIONS,
    CAMEROON_SURNAMES,
    fake,
    random,
):
    """Generate a single CNI record with all fields and MRZ compliant check digits."""

    def calculate_check_digit(data: str) -> int:
        """Calculate MRZ check digit using 7-3-1 weighting."""
        weights = [7, 3, 1]
        total = 0
        for i, char in enumerate(data):
            if char == '<':
                val = 0
            elif char.isdigit():
                val = int(char)
            elif char.isalpha():
                val = ord(char.upper()) - 55
            else:
                val = 0
            total += val * weights[i % 3]
        return total % 10

    def generate_cni_record() -> dict:
        nom = random.choice(CAMEROON_SURNAMES).upper()
        prenom = f"{random.choice(CAMEROON_FIRSTNAMES)} {random.choice(CAMEROON_FIRSTNAMES)}".upper()
        dob = fake.date_of_birth(minimum_age=18, maximum_age=80)
        issue_date = fake.date_between(start_date="-5y", end_date="today")
        expiry_date = issue_date.replace(year=issue_date.year + 10)

        # NIN camerounais : YYYY (année délivrance) + 13 chiffres = 17 chiffres total
        # Ex réel: 20210474231620883 (2021 + 0474231620883)
        nin_year = issue_date.strftime("%Y")  # 4 chiffres
        nin_seq = f"{random.randint(1000000000000, 9999999999999)}"  # 13 chiffres
        nin = f"{nin_year}{nin_seq}"

        # MRZ Generation (TD1 format: 3 lines x 30 characters)
        # Line 1: I<CMR[DocumentNumber][CheckDigit]<<<<<<<<<<<<<<<
        doc_num = nin[:9] # Using first 9 digits as doc number for MRZ
        doc_check = calculate_check_digit(doc_num)
        mrz_l1 = f"I<CMR{doc_num}{doc_check}".ljust(30, "<")[:30]

        # Line 2: [DOB-YYMMDD][CheckDigit][Gender][EXP-YYMMDD][CheckDigit]CMR<<<<<<<<<<<[CheckDigit]
        gender = random.choice(["M", "F"])
        dob_mrz = dob.strftime("%y%m%d")
        dob_check = calculate_check_digit(dob_mrz)
        exp_mrz = expiry_date.strftime("%y%m%d")
        exp_check = calculate_check_digit(exp_mrz)

        # Final composite check digit (DocNum + DOB + EXP)
        composite_raw = f"{doc_num}{doc_check}{dob_mrz}{dob_check}{exp_mrz}{exp_check}"
        composite_check = calculate_check_digit(composite_raw)

        mrz_l2 = f"{dob_mrz}{dob_check}{gender}{exp_mrz}{exp_check}CMR<<<<<<<<<<<{composite_check}".ljust(30, "<")[:30]

        # Line 3: [Surname]<<[Names]
        names_combined = f"{nom}<<{prenom.replace(' ', '<')}"
        mrz_l3 = names_combined.ljust(30, "<")[:30]

        return {
            "nom": nom,
            "prenom": prenom,
            "date_naissance": dob.strftime("%d.%m.%Y"),
            "lieu_naissance": random.choice(CAMEROON_CITIES).upper(),
            "sexe": gender,
            # Taille avec virgule comme sur la vraie carte (ex: 1,54)
            "taille": f"{random.uniform(1.50, 1.95):.2f}".replace(".", ","),
            "profession": random.choice(CAMEROON_PROFESSIONS).upper(),
            "pere": f"{random.choice(CAMEROON_SURNAMES)} {random.choice(CAMEROON_FIRSTNAMES)}".upper(),
            "mere": f"{random.choice(CAMEROON_SURNAMES)} {random.choice(CAMEROON_FIRSTNAMES)}".upper(),
            # SP = 6 chiffres uniquement (ex: 600001, 123456)
            "sp": f"{random.randint(100000, 999999)}",
            # Adresse = VILLE simple ou VILLE - QUARTIER
            "adresse": random.choice([
                random.choice(CAMEROON_CITIES).upper(),
                f"{random.choice(CAMEROON_CITIES)} - {random.choice(['BASTOS', 'MELEN', 'MVOG-MBI', 'BIYEM-ASSI', 'ESSOS', 'AKWA', 'BONABERI', 'MAKEPE', 'NDOKOTI'])}".upper(),
            ]),
            "numero_cni": nin,
            "date_delivrance": issue_date.strftime("%d.%m.%Y"),
            "date_expiration": expiry_date.strftime("%d.%m.%Y"),
            "autorite": "MARTIN MBARGA AGUÈLE",
            "poste_identification": f"{random.choice(['AD','CE','EN','ES','LT','NO','NW','OU','SU','SW'])}{random.randint(1, 99):02d}",
            "mrz_l1": mrz_l1,
            "mrz_l2": mrz_l2,
            "mrz_l3": mrz_l3,
        }

    return (generate_cni_record,)


@app.cell
def _(generate_btn, generate_cni_record, mo, num_records):
    """Generate and display records."""
    records = []

    if generate_btn.value:
        records = [generate_cni_record() for _ in range(num_records.value)]

    _gen_output = mo.md("*Click 'Generate Dataset' to create records.*")
    if records:
        _header = "| # | Nom | Prénom | N° CNI | Naissance | Profession |\n|---|-----|--------|--------|-----------|------------|\n"
        _gen_rows = []
        for _i, _r in enumerate(records[:10]):
            _gen_rows.append(
                f"| {_i} | {_r['nom']} | {_r['prenom']} | {_r['numero_cni']} | "
                f"{_r['date_naissance']} | {_r['profession']} |"
            )
        _gen_output = mo.md(
            f"**Generated {len(records)} records** (showing first 10)\n\n"
            f"{_header}{''.join(_gen_rows)}"
        )
    _gen_output
    return (records,)


@app.cell
def _(images_dir, mo):
    """Template picker recto+verso — scanne dossiers + upload depuis la machine."""
    _SCAN_DIRS = [
        images_dir,
        images_dir.parent / "output" / "pdf_pages" / "trybeg",
    ]
    _options: dict[str, str] = {}
    for _d in _SCAN_DIRS:
        if _d.exists():
            for _f in sorted(_d.iterdir()):
                if _f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
                    _label = f"{_d.name}/{_f.name}"
                    _options[_label] = str(_f)

    # 6.png = recto, 3.png = verso (templates vus sur les vraies cartes)
    _recto_default = next((k for k in _options if k.endswith("6.png")), next(iter(_options), None))
    _verso_default = next((k for k in _options if k.endswith("3.png")), None)

    recto_picker = mo.ui.dropdown(
        options=_options,
        label="📄 Recto (depuis les dossiers)",
        value=_recto_default,
    )
    verso_picker = mo.ui.dropdown(
        options=_options,
        label="📄 Verso (depuis les dossiers)",
        value=_verso_default,
    )

    recto_upload = mo.ui.file(
        filetypes=[".png", ".jpg", ".jpeg", ".webp"],
        label="☝️ Ou uploader une image Recto",
        multiple=False,
    )
    verso_upload = mo.ui.file(
        filetypes=[".png", ".jpg", ".jpeg", ".webp"],
        label="☝️ Ou uploader une image Verso",
        multiple=False,
    )

    mo.vstack([
        mo.md(f"### 📑 Sélection des Templates\n*{len(_options)} images trouvées dans les dossiers*"),
        mo.hstack([recto_picker, verso_picker]),
        mo.md("---"),
        mo.hstack([recto_upload, verso_upload]),
    ])
    return recto_picker, recto_upload, verso_picker, verso_upload


@app.cell
def _(Image, BytesIO, Path, layout_type, mo, recto_picker, recto_upload, verso_picker, verso_upload):
    """Load and display templates (uploads prioritaire sinon dropdown)."""
    def load_img(p):
        if not (p and Path(p).exists()): return None
        img = Image.open(p).convert("RGB")
        target_size = (800, 500) if layout_type.value == "horizontal" else (500, 800)
        return img.resize(target_size)

    def load_uploaded(uploaded):
        if not uploaded: return None
        img = Image.open(BytesIO(uploaded[0].contents)).convert("RGB")
        target_size = (800, 500) if layout_type.value == "horizontal" else (500, 800)
        return img.resize(target_size)

    recto_img = load_uploaded(recto_upload.value) or load_img(recto_picker.value)
    verso_img = load_uploaded(verso_upload.value) or load_img(verso_picker.value)

    _tmpl_output = (
        mo.hstack([
            mo.vstack([mo.md("**Recto**"), mo.image(recto_img) if recto_img else mo.md("N/A")]),
            mo.vstack([mo.md("**Verso**"), mo.image(verso_img) if verso_img else mo.md("N/A")]),
        ])
    )
    _tmpl_output
    return recto_img, verso_img


@app.cell
def _(mo):
    """Font and rendering settings."""
    layout_type = mo.ui.radio(
        options=["horizontal", "vertical"],
        value="horizontal",
        label="CNI Card Orientation Layout"
    )

    font_size_mult = mo.ui.slider(start=0.5, stop=2.0, step=0.1, value=1.0, label="Font Size Multiplier")

    render_btn = mo.ui.run_button(label="🖼️ Render Dual-Side Preview (3 samples)")

    mo.vstack([
        mo.md("### 🔤 Rendering Settings"),
        layout_type,
        mo.hstack([font_size_mult, render_btn]),
    ])
    return font_size_mult, layout_type, render_btn


@app.cell
def _(Image, ImageDraw, ImageFont, font_size_mult):
    """Shared Rendering Functions (DRY)."""

    def get_font(font_type, size):
        size = int(size * font_size_mult.value)
        # Search for professional fonts
        candidates = {
            "serif": ["times.ttf", "georgia.ttf", "serif"],
            "serif_bold": ["timesbd.ttf", "georgiab.ttf", "serif-bold"],
            "sans": ["arial.ttf", "helvetica.ttf", "sans-serif"],
            "sans_bold": ["arialbd.ttf", "helveticabd.ttf", "sans-serif-bold"],
            "mono": ["cour.ttf", "consolas.ttf", "monospace"],
            "handwriting": ["segoesc.ttf", "cursive.ttf", "arial.ttf"]
        }

        for name in candidates.get(font_type, ["arial.ttf"]):
            try:
                # Windows path
                path = f"C:\\Windows\\Fonts\\{name}"
                return ImageFont.truetype(path, size)
            except:
                continue
        return ImageFont.load_default()

    def render_side(base_img, record, side_config):
        if base_img is None: return None
        img = base_img.copy().convert("RGBA")

        for key, cfg in side_config.items():
            text = cfg.get("text")
            if not text and "field" in cfg:
                text = str(record.get(cfg["field"], ""))

            if not text: continue

            font = get_font(cfg["font"], cfg["size"])
            pos = cfg["pos"]
            color = cfg["color"]

            if cfg.get("rotate"):
                draw_temp = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
                bbox = draw_temp.textbbox((0, 0), text, font=font)
                tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]

                # Padding for anti-aliasing
                txt_canvas = Image.new("RGBA", (tw + 20, th + 20), (0, 0, 0, 0))
                ImageDraw.Draw(txt_canvas).text((10, 10), text, fill=color, font=font)

                # Rotate with BICUBIC resample
                rotated = txt_canvas.rotate(cfg["rotate"], expand=True, resample=Image.BICUBIC)
                img.alpha_composite(rotated, (pos[0], pos[1]))
            else:
                draw = ImageDraw.Draw(img)
                w = draw.textlength(text, font=font)
                if cfg.get("align") == "center":
                    draw.text((pos[0] - w/2, pos[1]), text, fill=color, font=font)
                elif cfg.get("align") == "right":
                    draw.text((pos[0] - w, pos[1]), text, fill=color, font=font)
                else:
                    draw.text(pos, text, fill=color, font=font)

        return img.convert("RGB")

    return (render_side,)


@app.cell
def _(
    CNI_FIELD_CONFIG,
    image_to_bytes,
    layout_type,
    mo,
    records,
    recto_img,
    render_btn,
    render_side,
    verso_img,
):
    """Execute high-fidelity rendering for preview."""
    preview_gallery = []

    if render_btn.value and records:
        _config = CNI_FIELD_CONFIG[layout_type.value]
        for _record in records[:3]:
            r_render = render_side(recto_img, _record, _config["recto"])
            v_render = render_side(verso_img, _record, _config["verso"])
            preview_gallery.append((r_render, v_render))

    # Display gallery
    _gallery_items = []
    for _i, _item in enumerate(preview_gallery):
        _r, _v = _item
        _r_bytes = image_to_bytes(_r) if _r else b""
        _v_bytes = image_to_bytes(_v) if _v else b""
        _gallery_items.append(
            mo.vstack([
                mo.md(f"#### Sample {_i+1}: {records[_i]['nom']} {records[_i]['prenom']}"),
                mo.hstack([
                    mo.image(src=_r_bytes, width=400) if _r else mo.md("No Recto"),
                    mo.image(src=_v_bytes, width=400) if _v else mo.md("No Verso")
                ], justify="start")
            ])
        )

    if _gallery_items:
        _render_output = mo.vstack(_gallery_items)
    elif not records:
        _render_output = mo.md("⚠️ **Aucune donnée générée.** Clique d'abord sur **🎲 Generate Dataset** dans la section **Data Generation Config** ci-dessus, puis sur **🖼️ Render Dual-Side Preview**.")
    elif not recto_img or not verso_img:
        _render_output = mo.md("⚠️ **Template(s) manquant(s).** Sélectionne une image Recto et Verso dans la section **Sélection des Templates** ci-dessus (dropdown ou upload).")
    elif not render_btn.value:
        _render_output = mo.md("💡 **Prêt à rendere.** Remonte à la section **🔤 Rendering Settings** et clique sur **🖼️ Render Dual-Side Preview (3 samples)**.")
    else:
        _render_output = mo.md("⚠️ La génération a échoué — vérifie tes templates et réessaie.")
    _render_output
    return (preview_gallery,)


@app.cell
def _(mo):
    """Augmentation configuration."""
    try:
        import albumentations  # noqa: F401 — only checking availability
        has_alb = True
    except ImportError:
        has_alb = False

    aug_count = mo.ui.slider(start=1, stop=20, step=1, value=5, label="Augmented variants per image")
    rotation_limit = mo.ui.slider(start=1, stop=15, step=1, value=5, label="Max rotation (degrees)")
    blur_limit = mo.ui.slider(start=1, stop=15, step=1, value=5, label="Max blur radius")
    noise_var = mo.ui.slider(start=1, stop=50, step=5, value=15, label="Gaussian noise variance")
    brightness_limit = mo.ui.slider(start=5, stop=40, step=5, value=20, label="Brightness limit (%)")

    _aug_config_output = mo.md("⚠️ **Albumentations not installed.** Install with: `uv pip install albumentations`")
    if has_alb:
        _aug_config_output = mo.vstack([
            mo.md("### 🔄 Data Augmentation (Albumentations)"),
            aug_count,
            rotation_limit,
            blur_limit,
            noise_var,
            brightness_limit,
        ])
    _aug_config_output
    return aug_count, blur_limit, brightness_limit, has_alb, noise_var, rotation_limit


@app.cell
def _(has_alb, mo):
    """Augment button."""
    aug_btn = mo.ui.run_button(label="🔄 Augment Preview (3 samples)") if has_alb else None

    _aug_btn_output = mo.md("")
    if has_alb and aug_btn is not None:
        _aug_btn_output = mo.vstack([
            mo.md("### Augmented Samples"),
            aug_btn,
        ])
    _aug_btn_output
    return (aug_btn,)


@app.cell
def _(
    Image,
    aug_btn,
    blur_limit,
    brightness_limit,
    has_alb,
    image_to_bytes,
    layout_type,
    mo,
    noise_var,
    np,
    preview_gallery,
    rotation_limit,
):
    """Execute augmentation."""
    _aug_output = mo.md("")

    if has_alb and aug_btn is not None and aug_btn.value and preview_gallery:
        import albumentations as A

        _transform = A.Compose([
            A.Rotate(limit=rotation_limit.value, p=0.8),
            A.GaussianBlur(blur_limit=blur_limit.value, p=0.5),
            # albumentations >= 2.0 : var_limit → std_range (tuple normalisé 0–1)
            A.GaussNoise(std_range=(0.01, noise_var.value / 255.0), p=0.4),
            A.RandomBrightnessContrast(
                brightness_limit=brightness_limit.value / 100.0,
                contrast_limit=0.2,
                p=0.6,
            ),
            A.Perspective(scale=(0.02, 0.05), p=0.3),
            A.Resize(
                height=500 if layout_type.value == "horizontal" else 800, 
                width=800 if layout_type.value == "horizontal" else 500
            ),
        ], additional_targets={'image_verso': 'image'})

        _augmented_samples = []
        for _pair in preview_gallery[:2]:  # Only first 2 pairs to avoid lag
            _r_img, _v_img = _pair
            if _r_img is None or _v_img is None: continue

            r_np = np.array(_r_img)
            v_np = np.array(_v_img)

            for _ in range(2):
                _aug_dict = _transform(image=r_np, image_verso=v_np)
                _r_aug = Image.fromarray(_aug_dict["image"])
                _v_aug = Image.fromarray(_aug_dict["image_verso"])
                _augmented_samples.append((_r_aug, _v_aug))

        _items = []
        for _r_aug, _v_aug in _augmented_samples[:4]: # 4 pairs
            _r_bytes = image_to_bytes(_r_aug)
            _v_bytes = image_to_bytes(_v_aug)
            _items.append(
                mo.hstack([
                    mo.image(src=_r_bytes, width=350),
                    mo.image(src=_v_bytes, width=350)
                ])
            )

        _aug_output = mo.vstack([
            mo.md(f"**{len(_augmented_samples)} augmented pairs generated**"),
            mo.vstack(_items) if _items else mo.md(""),
        ])

    _aug_output
    return


@app.cell
def _(mo):
    """Export dataset as JSON."""
    export_btn = mo.ui.run_button(label="💾 Export Dataset to JSON")

    mo.vstack([
        mo.md("### 💾 Export"),
        export_btn,
    ])
    return (export_btn,)


@app.cell
def _(
    CNI_FIELD_CONFIG,
    export_btn,
    json,
    layout_type,
    mo,
    output_dir,
    records,
    recto_img,
    render_side,
    verso_img,
):
    """Execute full dataset export (Images + JSON)."""
    _export_output = mo.md("")

    if export_btn.value and records:
        img_dir = output_dir / "images"
        img_dir.mkdir(exist_ok=True)

        _config = CNI_FIELD_CONFIG[layout_type.value]
        manifest = []

        for i, record in enumerate(records):
            _r_img = render_side(recto_img, record, _config["recto"])
            _v_img = render_side(verso_img, record, _config["verso"])

            r_name = f"cni_{i}_recto.jpg"
            v_name = f"cni_{i}_verso.jpg"

            if _r_img: _r_img.save(img_dir / r_name, "JPEG", quality=95)
            if _v_img: _v_img.save(img_dir / v_name, "JPEG", quality=95)

            manifest.append({
                "id": i,
                "recto": r_name if _r_img else None,
                "verso": v_name if _v_img else None,
                "data": record
            })

        _output_path = output_dir / "dataset_manifest.json"
        _output_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
        _export_output = mo.md(f"✅ **Exported {len(records)} image pairs** to `{img_dir}` and manifest to `{_output_path}`")

    _export_output
    return


if __name__ == "__main__":
    app.run()
