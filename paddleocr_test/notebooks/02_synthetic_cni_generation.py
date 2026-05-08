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
    import io
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
    CNI_FIELD_CONFIG = {
        "horizontal": {
            "recto": {
                # Header (Gold Serif)
                "header_fr": {"pos": (400, 35), "text": "RÉPUBLIQUE DU CAMEROUN", "color": (153, 115, 0), "font": "serif_bold", "size": 22, "align": "center"},
                "header_en": {"pos": (400, 60), "text": "REPUBLIC OF CAMEROON", "color": (153, 115, 0), "font": "serif_bold", "size": 22, "align": "center"},

                # Vertical Labels (Left Side)
                "vert_label_en": {"pos": (30, 40), "text": "NATIONAL IDENTITY CARD", "color": (153, 115, 0), "font": "sans", "size": 16, "rotate": 90},
                "vert_label_fr": {"pos": (30, 280), "text": "CARTE NATIONALE D'IDENTITÉ", "color": (0, 102, 51), "font": "sans", "size": 16, "rotate": 90},

                # Values (Black Sans Bold)
                "nom_value": {"pos": (240, 155), "field": "nom", "color": (5, 5, 5), "font": "sans_bold", "size": 24},
                "prenom_value": {"pos": (240, 215), "field": "prenom", "color": (5, 5, 5), "font": "sans_bold", "size": 22},
                "date_naissance_value": {"pos": (240, 275), "field": "date_naissance", "color": (5, 5, 5), "font": "sans_bold", "size": 19},
                "lieu_naissance_value": {"pos": (240, 330), "field": "lieu_naissance", "color": (5, 5, 5), "font": "sans_bold", "size": 19},
                "sexe_value": {"pos": (240, 395), "field": "sexe", "color": (5, 5, 5), "font": "sans_bold", "size": 19},
                "taille_value": {"pos": (365, 395), "field": "taille", "color": (5, 5, 5), "font": "sans_bold", "size": 19},
                "profession_value": {"pos": (240, 455), "field": "profession", "color": (5, 5, 5), "font": "sans_bold", "size": 18},

                # Signature (Blue ink)
                "signature_value": {"pos": (480, 450), "field": "prenom", "color": (10, 30, 150), "font": "handwriting", "size": 32, "align": "center"},

                # NIN on Recto
                "nin_recto": {"pos": (620, 115), "field": "numero_cni", "color": (5, 5, 5), "font": "sans_bold", "size": 16},
            },
            "verso": {
                "pere_value": {"pos": (40, 60), "field": "pere", "color": (5, 5, 5), "font": "sans_bold", "size": 18},
                "mere_value": {"pos": (40, 150), "field": "mere", "color": (5, 5, 5), "font": "sans_bold", "size": 18},
                "sp_value": {"pos": (40, 245), "field": "sp", "color": (5, 5, 5), "font": "sans_bold", "size": 18},
                "adresse_value": {"pos": (40, 335), "field": "adresse", "color": (5, 5, 5), "font": "sans_bold", "size": 18},

                # Authority & Dates
                "autorite_name": {"pos": (380, 420), "field": "autorite", "color": (5, 5, 5), "font": "sans_bold", "size": 16, "align": "center"},
                "delivrance_value": {"pos": (540, 265), "field": "date_delivrance", "color": (5, 5, 5), "font": "sans_bold", "size": 16},
                "expiration_value": {"pos": (540, 355), "field": "date_expiration", "color": (5, 5, 5), "font": "sans_bold", "size": 16},
                "poste_value": {"pos": (730, 265), "field": "poste_identification", "color": (5, 5, 5), "font": "sans_bold", "size": 16},
                "identifiant_value": {"pos": (730, 355), "field": "numero_cni", "color": (5, 5, 5), "font": "sans_bold", "size": 16},

                # Card Serial
                "serial_value": {"pos": (780, 475), "field": "serial", "color": (5, 5, 5), "font": "sans_bold", "size": 22, "align": "right"},

                # MRZ for Horizontal (Bottom)
                "mrz_l1": {"pos": (40, 400), "field": "mrz_l1", "color": (5, 5, 5), "font": "mono", "size": 18},
                "mrz_l2": {"pos": (40, 425), "field": "mrz_l2", "color": (5, 5, 5), "font": "mono", "size": 18},
                "mrz_l3": {"pos": (40, 450), "field": "mrz_l3", "color": (5, 5, 5), "font": "mono", "size": 18},
            }
        },
        "vertical": {
            "recto": {
                # Header
                "header_fr": {"pos": (250, 40), "text": "RÉPUBLIQUE DU CAMEROUN", "color": (153, 115, 0), "font": "serif_bold", "size": 18, "align": "center"},
                "header_en": {"pos": (250, 65), "text": "REPUBLIC OF CAMEROON", "color": (153, 115, 0), "font": "serif_bold", "size": 18, "align": "center"},

                # Main fields
                "nom_value": {"pos": (50, 650), "field": "nom", "color": (5, 5, 5), "font": "sans_bold", "size": 24},
                "prenom_value": {"pos": (50, 710), "field": "prenom", "color": (5, 5, 5), "font": "sans_bold", "size": 22},
                "date_naissance_value": {"pos": (50, 780), "field": "date_naissance", "color": (5, 5, 5), "font": "sans_bold", "size": 20},
                "lieu_naissance_value": {"pos": (280, 780), "field": "lieu_naissance", "color": (5, 5, 5), "font": "sans_bold", "size": 20},
                "sexe_value": {"pos": (50, 840), "field": "sexe", "color": (5, 5, 5), "font": "sans_bold", "size": 20},
                "taille_value": {"pos": (180, 840), "field": "taille", "color": (5, 5, 5), "font": "sans_bold", "size": 20},
                "profession_value": {"pos": (50, 900), "field": "profession", "color": (5, 5, 5), "font": "sans_bold", "size": 18},

                # NIN (Vertical on Recto for some versions)
                "nin_value": {"pos": (460, 650), "field": "numero_cni", "color": (5, 5, 5), "font": "sans_bold", "size": 26, "rotate": 90},
            },
            "verso": {
                # Top part
                "pere_value": {"pos": (50, 60), "field": "pere", "color": (5, 5, 5), "font": "sans_bold", "size": 18},
                "mere_value": {"pos": (50, 120), "field": "mere", "color": (5, 5, 5), "font": "sans_bold", "size": 18},
                "adresse_value": {"pos": (50, 180), "field": "adresse", "color": (5, 5, 5), "font": "sans_bold", "size": 16},

                # Authority
                "autorite": {"pos": (250, 350), "field": "autorite", "color": (5, 5, 5), "font": "sans_bold", "size": 16, "align": "center"},

                # MRZ (Rotated 90 on Vertical Verso)
                "mrz_l1": {"pos": (450, 80), "field": "mrz_l1", "color": (5, 5, 5), "font": "mono", "size": 22, "rotate": 90},
                "mrz_l2": {"pos": (485, 80), "field": "mrz_l2", "color": (5, 5, 5), "font": "mono", "size": 22, "rotate": 90},
                "mrz_l3": {"pos": (520, 80), "field": "mrz_l3", "color": (5, 5, 5), "font": "mono", "size": 22, "rotate": 90},

                # Serial (Bottom Right)
                "serial_value": {"pos": (400, 470), "field": "serial", "color": (5, 5, 5), "font": "sans_bold", "size": 18, "align": "right"},

                # Additional Verso Fields
                "sp_value": {"pos": (50, 240), "field": "sp", "color": (5, 5, 5), "font": "sans_bold", "size": 18},
                "delivrance_value": {"pos": (50, 300), "field": "date_delivrance", "color": (5, 5, 5), "font": "sans_bold", "size": 16},
                "expiration_value": {"pos": (280, 300), "field": "date_expiration", "color": (5, 5, 5), "font": "sans_bold", "size": 16},
                "poste_value": {"pos": (50, 360), "field": "poste_identification", "color": (5, 5, 5), "font": "sans_bold", "size": 16},
                "identifiant_value": {"pos": (280, 360), "field": "numero_cni", "color": (5, 5, 5), "font": "sans_bold", "size": 16},
            }
        }
    }
    return (
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
def _(images_dir, mo):
    """Template selection."""
    _template_files = []
    if images_dir.exists():
        _template_files = sorted(
            f.name for f in images_dir.iterdir()
            if f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")
            and "cni" in f.name.lower()
        )

    template_picker = mo.ui.dropdown(
        options={f: str(images_dir / f) for f in _template_files} if _template_files else {},
        label="📄 CNI Template Image",
        value=_template_files[0] if _template_files else None,
    )

    mo.vstack([
        mo.md(f"### Template Selection\nAvailable CNI images: {len(_template_files)}"),
        template_picker,
    ])
    return (template_picker,)


@app.cell
def _(Image, Path, mo, template_picker):
    """Load and display template."""
    _template_path = template_picker.value
    template_image = None

    if _template_path and Path(_template_path).exists():
        template_image = Image.open(_template_path).convert("RGB")

    _tmpl_output = (
        mo.vstack([
            mo.md(
                f"**Template loaded:** `{Path(_template_path).name}`  \n"
                f"**Size:** {template_image.size[0]}×{template_image.size[1]}"
            ),
            mo.image(src=Path(_template_path).read_bytes()),
        ])
        if template_image
        else mo.md("*No template selected. Choose a CNI image above.*")
    )
    _tmpl_output
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

        # Cameroon NIN format: [Year][ID Type][Random/Sequence] - 17 digits
        nin_prefix = issue_date.strftime("%Y") + "1"
        nin_random = f"{random.randint(100000000000, 999999999999)}"
        nin = f"{nin_prefix}{nin_random}"

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
            "taille": f"{random.uniform(1.50, 1.95):.2f}",
            "profession": random.choice(CAMEROON_PROFESSIONS).upper(),
            "pere": f"{random.choice(CAMEROON_SURNAMES)} {random.choice(CAMEROON_FIRSTNAMES)}".upper(),
            "mere": f"{random.choice(CAMEROON_SURNAMES)} {random.choice(CAMEROON_FIRSTNAMES)}".upper(),
            "sp": f"{random.choice(['A', 'B', 'C', 'LT'])}{random.randint(10000, 99999)}",
            "adresse": f"{random.choice(CAMEROON_CITIES)} - {fake.street_name()}".upper(),
            "numero_cni": nin,
            "date_delivrance": issue_date.strftime("%d.%m.%Y"),
            "date_expiration": expiry_date.strftime("%d.%m.%Y"),
            "autorite": "MARTIN MBARGA NGUÉLÉ",
            "poste_identification": f"{random.choice(['CE', 'LT', 'OU', 'AD', 'EN'])}{random.randint(1, 20):02d}",
            "serial": f"{random.randint(100000000, 999999999)}",
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
    """Template picker for both sides."""
    _template_files = []
    if images_dir.exists():
        _template_files = sorted(
            f.name for f in images_dir.iterdir()
            if f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")
            and "cni" in f.name.lower()
        )

    recto_picker = mo.ui.dropdown(
        options={f: str(images_dir / f) for f in _template_files} if _template_files else {},
        label="📄 Recto (Front) Template",
        value=next((f for f in _template_files if "recto" in f.lower()), _template_files[0] if _template_files else None),
    )

    verso_picker = mo.ui.dropdown(
        options={f: str(images_dir / f) for f in _template_files} if _template_files else {},
        label="📄 Verso (Back) Template",
        value=next((f for f in _template_files if "verso" in f.lower()), _template_files[1] if len(_template_files) > 1 else None),
    )

    mo.vstack([
        mo.md("### 📑 Template Configuration"),
        mo.hstack([recto_picker, verso_picker]),
    ])
    return recto_picker, verso_picker


@app.cell
def _(Image, Path, layout_type, mo, recto_picker, verso_picker):
    """Load and display templates."""
    def load_img(p):
        if not (p and Path(p).exists()): return None
        img = Image.open(p).convert("RGB")
        target_size = (800, 500) if layout_type.value == "horizontal" else (500, 800)
        return img.resize(target_size)

    recto_img = load_img(recto_picker.value)
    verso_img = load_img(verso_picker.value)

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
    mo.md("### 🔤 Rendering Settings")

    layout_type = mo.ui.radio(
        options=["horizontal", "vertical"],
        value="horizontal",
        label="CNI Card Orientation Layout"
    )

    font_size_mult = mo.ui.slider(start=0.5, stop=2.0, step=0.1, value=1.0, label="Font Size Multiplier")

    render_btn = mo.ui.run_button(label="🖼️ Render Dual-Side Preview (3 samples)")

    mo.vstack([
        layout_type,
        mo.hstack([font_size_mult, render_btn])
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
                    mo.image(src=_r_bytes) if _r else mo.md("No Recto"),
                    mo.image(src=_v_bytes) if _v else mo.md("No Verso")
                ])
            ])
        )

    _render_output = (
        mo.vstack(_gallery_items)
        if _gallery_items
        else mo.md("Click Render to see preview.")
    )
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
    return blur_limit, brightness_limit, has_alb, noise_var, rotation_limit


@app.cell
def _(has_alb, mo):
    """Augment button."""
    aug_btn = mo.ui.run_button(label="🔄 Augment Preview (3 samples)") if has_alb else None

    _aug_btn_output = mo.md("")
    if has_alb and aug_btn:
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

    if has_alb and aug_btn and aug_btn.value and preview_gallery:
        import albumentations as A

        _transform = A.Compose([
            A.Rotate(limit=rotation_limit.value, p=0.8),
            A.GaussianBlur(blur_limit=blur_limit.value, p=0.5),
            A.GaussNoise(var_limit=noise_var.value, p=0.4),
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
