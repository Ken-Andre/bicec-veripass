"""
Synthetic CNI Data Generation
==============================

Generate realistic Cameroonian CNI images for OCR training:
- Faker-based personal data generation
- Pillow template rendering (text on blank CNI template)
- Albumentations augmentation (rotation, blur, noise, perspective)

Run:  marimo edit 02_synthetic_cni_generation.py
"""

import marimo as mo

app = mo.App()


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

    return (
        mo, os, sys, io, json, random, Path, np, Image, ImageDraw, ImageFont, Faker,
        CAMEROON_SURNAMES, CAMEROON_FIRSTNAMES, CAMEROON_CITIES,
        CAMEROON_PROFESSIONS, CAMEROON_REGIONS,
        paddle_ocr_pipeline, numpy_to_pil, image_to_bytes,
        images_dir, output_dir, _notebook_dir,
    )


@app.cell
def _(mo):
    """Header."""
    mo.md("""# 🏭 Synthetic CNI Data Generation

    Generate realistic Cameroonian CNI images for OCR model training.
    **Pipeline:** Faker data → Pillow render → Albumentations augment → Dataset export.
    """)


@app.cell
def _(mo, images_dir):
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
def _(mo, template_picker, Image, Path):
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

    return (template_image,)


@app.cell
def _(mo, Faker):
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

    return (fake, num_records, generate_btn)


@app.cell
def _(fake, random, CAMEROON_SURNAMES, CAMEROON_FIRSTNAMES, CAMEROON_CITIES, CAMEROON_PROFESSIONS):
    """Generate a single CNI record."""
    def generate_cni_record() -> dict:
        return {
            "nom": random.choice(CAMEROON_SURNAMES),
            "prenom": random.choice(CAMEROON_FIRSTNAMES),
            "date_naissance": fake.date_of_birth(
                minimum_age=18, maximum_age=80
            ).strftime("%d.%m.%Y"),
            "lieu_naissance": random.choice(CAMEROON_CITIES),
            "profession": random.choice(CAMEROON_PROFESSIONS),
            "numero_cni": f"{random.randint(100000000, 999999999):09d}",
            "date_delivrance": fake.date_between(
                start_date="-5y", end_date="today"
            ).strftime("%d.%m.%Y"),
            "date_expiration": fake.date_between(
                start_date="today", end_date="+10y"
            ).strftime("%d.%m.%Y"),
            "sexe": random.choice(["M", "F"]),
        }

    return (generate_cni_record,)


@app.cell
def _(generate_btn, num_records, generate_cni_record, mo):
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
def _(mo, template_image):
    """Template field positioning — configure text positions on CNI."""
    _w, _h = template_image.size if template_image else (800, 500)

    field_positions_x = mo.ui.dictionary({
        "nom": mo.ui.slider(start=0, stop=_w, step=5, value=int(_w * 0.15), label="Nom X"),
        "prenom": mo.ui.slider(start=0, stop=_w, step=5, value=int(_w * 0.15), label="Prénom X"),
        "numero_cni": mo.ui.slider(start=0, stop=_w, step=5, value=int(_w * 0.55), label="N°CNI X"),
        "date_naissance": mo.ui.slider(start=0, stop=_w, step=5, value=int(_w * 0.15), label="Naissance X"),
    })

    field_positions_y = mo.ui.dictionary({
        "nom": mo.ui.slider(start=0, stop=_h, step=5, value=int(_h * 0.28), label="Nom Y"),
        "prenom": mo.ui.slider(start=0, stop=_h, step=5, value=int(_h * 0.38), label="Prénom Y"),
        "numero_cni": mo.ui.slider(start=0, stop=_h, step=5, value=int(_h * 0.08), label="N°CNI Y"),
        "date_naissance": mo.ui.slider(start=0, stop=_h, step=5, value=int(_h * 0.48), label="Naissance Y"),
    })

    _pos_msg = (
        f"### ✏️ Field Positioning\n**Image dimensions:** {_w}×{_h} — adjust X/Y sliders for each field"
        if template_image
        else "*Load a template image first to configure field positions.*"
    )

    mo.vstack([
        mo.md(_pos_msg),
        mo.hstack([field_positions_x, field_positions_y]),
    ])

    return (field_positions_x, field_positions_y)


@app.cell
def _(mo):
    """Font settings."""
    font_size = mo.ui.slider(start=14, stop=48, step=2, value=24, label="Font size")
    font_path_input = mo.ui.text(
        value="",
        label="Font path (leave empty for default PIL font)",
        placeholder="C:\\Windows\\Fonts\\arial.ttf",
    )

    mo.vstack([
        mo.md("### 🔤 Font Settings"),
        font_size,
        font_path_input,
    ])

    return (font_size, font_path_input)


@app.cell
def _(mo):
    """Render button."""
    render_btn = mo.ui.run_button(label="🖼️ Render Preview (5 samples)")

    mo.vstack([
        mo.md("### Render Preview"),
        render_btn,
    ])

    return (render_btn,)


@app.cell
def _(
    render_btn, template_image, records, field_positions_x, field_positions_y,
    font_size, font_path_input, Image, ImageDraw, ImageFont, random,
    mo, image_to_bytes,
):
    """Execute rendering."""
    preview_gallery = []

    if render_btn.value and template_image and records:
        # Load font
        _font = ImageFont.load_default()
        try:
            if font_path_input.value.strip():
                _font = ImageFont.truetype(font_path_input.value.strip(), font_size.value)
            else:
                for _candidate in ["arial.ttf", "Arial.ttf", "arialbd.ttf"]:
                    _candidate_path = f"C:\\Windows\\Fonts\\{_candidate}"
                    try:
                        _font = ImageFont.truetype(_candidate_path, font_size.value)
                        break
                    except OSError:
                        continue
        except (OSError, IOError):
            pass

        # Render up to 5 previews
        for _record in records[:5]:
            _img = template_image.copy()
            _draw = ImageDraw.Draw(_img)

            _field_map = {
                "nom": _record.get("nom", ""),
                "prenom": _record.get("prenom", ""),
                "numero_cni": _record.get("numero_cni", ""),
                "date_naissance": _record.get("date_naissance", ""),
            }

            for _field_name, _text in _field_map.items():
                if not _text:
                    continue
                _x_val = field_positions_x.value.get(_field_name, 0)
                _y_val = field_positions_y.value.get(_field_name, 0)
                _x = int(_x_val) + random.randint(-3, 3)
                _y = int(_y_val) + random.randint(-3, 3)
                _draw.text((_x, _y), _text, fill=(0, 0, 0), font=_font)

            preview_gallery.append(_img)

    # Display gallery
    _gallery_items = []
    for _i, _img in enumerate(preview_gallery):
        _img_bytes = image_to_bytes(_img)
        _gallery_items.append(
            mo.vstack([
                mo.md(f"**Sample {_i+1}**: {records[_i]['nom']} {records[_i]['prenom']}"),
                mo.image(src=_img_bytes),
            ])
        )

    _render_output = (
        mo.hstack(_gallery_items)
        if _gallery_items
        else mo.md("Generate records and load a template, then click Render.")
    )
    _render_output

    return (preview_gallery,)


@app.cell
def _(mo):
    """Augmentation configuration."""
    try:
        import albumentations  # noqa: F401 — only checking availability
        _has_alb = True
    except ImportError:
        _has_alb = False

    aug_count = mo.ui.slider(start=1, stop=20, step=1, value=5, label="Augmented variants per image")
    rotation_limit = mo.ui.slider(start=1, stop=15, step=1, value=5, label="Max rotation (degrees)")
    blur_limit = mo.ui.slider(start=1, stop=15, step=1, value=5, label="Max blur radius")
    noise_var = mo.ui.slider(start=1, stop=50, step=5, value=15, label="Gaussian noise variance")
    brightness_limit = mo.ui.slider(start=5, stop=40, step=5, value=20, label="Brightness limit (%)")

    _aug_config_output = mo.md("⚠️ **Albumentations not installed.** Install with: `uv pip install albumentations`")
    if _has_alb:
        _aug_config_output = mo.vstack([
            mo.md("### 🔄 Data Augmentation (Albumentations)"),
            aug_count,
            rotation_limit,
            blur_limit,
            noise_var,
            brightness_limit,
        ])
    _aug_config_output

    return (_has_alb, aug_count, rotation_limit, blur_limit, noise_var, brightness_limit)


@app.cell
def _(mo, _has_alb):
    """Augment button."""
    aug_btn = mo.ui.run_button(label="🔄 Augment Preview (3 samples)") if _has_alb else None

    _aug_btn_output = mo.md("")
    if _has_alb and aug_btn:
        _aug_btn_output = mo.vstack([
            mo.md("### Augmented Samples"),
            aug_btn,
        ])
    _aug_btn_output

    return (aug_btn,)


@app.cell
def _(
    mo, _has_alb, aug_btn, preview_gallery,
    rotation_limit, blur_limit, noise_var, brightness_limit,
    image_to_bytes, np, Image,
):
    """Execute augmentation."""
    _aug_output = mo.md("")

    if _has_alb and aug_btn and aug_btn.value and preview_gallery:
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
            A.Resize(height=500, width=800),
        ])

        _augmented_samples = []
        for _img in preview_gallery[:3]:
            _img_np = np.array(_img)
            for _ in range(2):
                _augmented = _transform(image=_img_np)["image"]
                _aug_pil = Image.fromarray(_augmented)
                _augmented_samples.append(_aug_pil)

        _items = []
        for _img in _augmented_samples[:6]:
            _img_bytes = image_to_bytes(_img)
            _items.append(mo.image(src=_img_bytes))

        _aug_output = mo.vstack([
            mo.md(f"**{len(_augmented_samples)} augmented variants generated**"),
            mo.hstack(_items) if _items else mo.md(""),
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
def _(export_btn, records, json, output_dir, mo):
    """Execute export."""
    _export_output = mo.md("")

    if export_btn.value and records:
        _output_path = output_dir / "cni_dataset.json"
        _output_path.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")
        _export_output = mo.md(f"✅ **Exported {len(records)} records** to `{_output_path}`")

    _export_output
    return


if __name__ == "__main__":
    app.run()
