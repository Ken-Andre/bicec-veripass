"""
ENEO Bill & Sanctions Data Exploration
=======================================

Interactive exploration of:
- ENEO electricity bill OCR extraction
- PEP / sanctions screening data analysis
- KYC session metrics visualization

Run:  marimo edit 04_eneo_sanctions_exploration.py
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
    import re
    import random
    from pathlib import Path
    from datetime import datetime, timedelta

    import numpy as np
    from PIL import Image
    from faker import Faker

    _notebook_dir = Path(globals().get("__file__", ".")).resolve().parent
    sys.path.insert(0, str(_notebook_dir))
    from ocr_utils import (
        get_paddle_ocr,
        draw_ocr_boxes,
        numpy_to_pil,
        pil_to_numpy,
        image_to_bytes,
        compute_sha256,
        CAMEROON_CITIES,
        CAMEROON_REGIONS,
    )

    images_dir = _notebook_dir.parent / "images"
    output_dir = _notebook_dir / "output"
    output_dir.mkdir(exist_ok=True)

    return (
        mo, os, sys, io, json, re, random, Path, datetime, timedelta, np, Image, Faker,
        get_paddle_ocr, draw_ocr_boxes, numpy_to_pil, pil_to_numpy,
        image_to_bytes, compute_sha256, CAMEROON_CITIES, CAMEROON_REGIONS,
        images_dir, output_dir, _notebook_dir,
    )


@app.cell
def _(mo):
    """Header."""
    mo.md("""# 🧾 ENEO Bill & Sanctions Exploration

    Two exploration modes:
    - **ENEO Bill OCR**: Extract and structure data from electricity bills
    - **Sanctions / PEP**: Explore screening data and match patterns
    """)


# ============================================================================
# ENEO BILL OCR
# ============================================================================

@app.cell
def _(mo, images_dir):
    """ENEO bill image source — create widgets only (no .value reads here)."""
    bill_files = []
    if images_dir.exists():
        bill_files = sorted(
            f.name for f in images_dir.iterdir()
            if f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")
            and any(kw in f.name.lower() for kw in ["facture", "eneo", "bill", "receipt"])
        )

    bill_radio = mo.ui.radio(
        options=["Upload Bill", "Pick from samples"],
        value="Pick from samples" if bill_files else "Upload Bill",
        label="📸 Bill source",
    )

    bill_upload = mo.ui.file(
        label="📤 Upload ENEO bill image",
        filetypes=[".png", ".jpg", ".jpeg", ".webp"],
        kind="area",
    )

    bill_picker = mo.ui.dropdown(
        options={f: str(images_dir / f) for f in bill_files} if bill_files else {},
        label="📄 Bill images",
        value=bill_files[0] if bill_files else None,
    )

    return (bill_radio, bill_upload, bill_picker, bill_files)


@app.cell
def _(mo, bill_radio, bill_upload, bill_picker, bill_files):
    """Display bill source widgets — reactive on bill_radio.value."""
    _bill_source_widget = bill_upload if bill_radio.value == "Upload Bill" else bill_picker

    mo.vstack([
        mo.md(f"### 📸 ENEO Bill Source\nFound {len(bill_files)} bill image(s)"),
        bill_radio,
        _bill_source_widget,
    ])


@app.cell
def _(mo, bill_radio, bill_upload, bill_picker, Image, io, compute_sha256, Path):
    """Load bill image."""
    bill_image = None
    bill_name = ""
    bill_bytes = b""

    if bill_radio.value == "Upload Bill":
        if bill_upload.value:  # tuple of FileUploadResults
            bill_bytes = bill_upload.contents(0)
            bill_name = bill_upload.name(0) or "uploaded_bill"
            bill_image = Image.open(io.BytesIO(bill_bytes)).convert("RGB")
    else:
        _fpath_str = bill_picker.value
        if _fpath_str:
            _fpath = Path(_fpath_str)
            if _fpath.exists():
                bill_bytes = _fpath.read_bytes()
                bill_image = Image.open(io.BytesIO(bill_bytes)).convert("RGB")
                bill_name = _fpath.name

    _bill_sha = compute_sha256(bill_bytes) if bill_bytes else ""
    _bill_load_output = (
        mo.vstack([
            mo.md(
                f"**Bill loaded:** `{bill_name}`  \n"
                f"**Size:** {bill_image.size[0]}×{bill_image.size[1]}  \n"
                f"**SHA-256:** `{_bill_sha[:16]}…`"
            ),
            mo.image(src=bill_bytes),
        ])
        if bill_image
        else mo.md("*No bill image loaded.*")
    )
    _bill_load_output

    return (bill_image, bill_name, bill_bytes)


@app.cell
def _(mo):
    """OCR button."""
    run_bill_ocr = mo.ui.run_button(label="🔍 OCR Bill")

    mo.vstack([
        mo.md("### OCR Extraction"),
        run_bill_ocr,
    ])

    return (run_bill_ocr,)


@app.cell
def _(run_bill_ocr, bill_image, get_paddle_ocr, draw_ocr_boxes, numpy_to_pil, pil_to_numpy, mo, image_to_bytes, re):
    """Execute bill OCR and extract structured fields."""
    bill_ocr_result = None
    bill_blocks = []
    _bill_ocr_output = mo.md("*Load a bill image and click 'OCR Bill'.*")

    if run_bill_ocr.value and bill_image:
        _ocr = get_paddle_ocr()
        _img_np = pil_to_numpy(bill_image)
        _results = _ocr.ocr(_img_np, cls=True)

        if _results and _results[0]:
            bill_blocks = []
            for _el in _results[0]:
                _coords, (_text, _conf) = _el[0], _el[1]
                _cx = sum(_p[0] for _p in _coords) / 4
                _cy = sum(_p[1] for _p in _coords) / 4
                bill_blocks.append({"text": _text.strip(), "cx": _cx, "cy": _cy, "conf": float(_conf)})

            # Annotated image
            _annotated = draw_ocr_boxes(_img_np, bill_blocks)
            _annotated_pil = numpy_to_pil(_annotated)

            # Extract ENEO-specific fields
            _extracted = {
                "num_contrat": None,
                "nom_client": None,
                "adresse": None,
                "index_actuel": None,
                "index_precedent": None,
                "montant": None,
                "date_limite": None,
                "agence": None,
            }

            _all_text = " ".join(_b["text"] for _b in bill_blocks)

            # Contract number (10+ digits)
            _m = re.search(r"\b\d{10,}\b", _all_text)
            if _m:
                _extracted["num_contrat"] = _m.group()

            # Amount
            _m = re.search(r"[\d\s]+[.,]\d{2}\s*(FCFA|F\s*CFA|F)?", _all_text)
            if _m:
                _extracted["montant"] = _m.group().strip()

            # Index patterns
            for _b in bill_blocks:
                _m = re.search(r"\b(\d{3,5})\b", _b["text"])
                if _m:
                    _val = int(_m.group(1))
                    if 100 <= _val <= 99999:
                        if _extracted["index_actuel"] is None:
                            _extracted["index_actuel"] = str(_val)
                        elif _extracted["index_precedent"] is None:
                            _extracted["index_precedent"] = str(_val)

            # Date patterns
            _m = re.search(r"\b\d{2}[/.]\d{2}[/.]\d{4}\b", _all_text)
            if _m:
                _extracted["date_limite"] = _m.group()

            bill_ocr_result = {
                "blocks": bill_blocks,
                "extracted": _extracted,
                "annotated_pil": _annotated_pil,
                "raw_text": _all_text,
            }

            # Build output
            _bill_rows = []
            for _bk, _bv in _extracted.items():
                _bstatus = "✅" if _bv else "❌"
                _bill_rows.append(f"| {_bk} | `{_bv or '—'}` | {_bstatus} |")

            _bill_table = "| Field | Value | Status |\n|-------|-------|--------|\n" + "\n".join(_bill_rows)

            _bill_ocr_output = mo.vstack([
                mo.md(f"**Blocks detected:** {len(bill_blocks)}\n\n{_bill_table}"),
                mo.md("#### Annotated Bill"),
                mo.image(src=image_to_bytes(_annotated_pil)),
                mo.md(f"<details><summary>📄 Raw OCR Text ({len(_all_text)} chars)</summary>\n\n```\n{_all_text[:1000]}\n```</details>"),
            ])
        else:
            _bill_ocr_output = mo.md("❌ No text detected in bill image")

    _bill_ocr_output

    return (bill_ocr_result, bill_blocks)


# ============================================================================
# SANCTIONS / PEP EXPLORATION
# ============================================================================

@app.cell
def _(mo):
    """Sanctions / PEP section header."""
    mo.md("""---

    # 🛡️ Sanctions & PEP Screening Exploration

    Simulate and explore PEP/sanctions matching for KYC compliance.
    """)


@app.cell
def _(mo, Faker):
    """PEP/Sanctions generation controls."""
    _fake = Faker("fr_FR")

    pep_count = mo.ui.slider(start=10, stop=500, step=10, value=50, label="PEP records")
    sanctions_count = mo.ui.slider(start=10, stop=500, step=10, value=30, label="Sanctions records")
    generate_pep_btn = mo.ui.run_button(label="🎲 Generate PEP/Sanctions Data")

    mo.vstack([
        mo.md("### 📋 Synthetic Screening Data"),
        pep_count,
        sanctions_count,
        generate_pep_btn,
    ])

    return (_fake, pep_count, sanctions_count, generate_pep_btn)


@app.cell
def _(
    mo, generate_pep_btn, pep_count, sanctions_count,
    _fake, random, CAMEROON_SURNAMES, CAMEROON_FIRSTNAMES, CAMEROON_CITIES,
):
    """Generate and display PEP/sanctions data."""
    pep_data = []
    sanctions_data = []

    if generate_pep_btn.value:
        # PEP generation
        _pep_categories = [
            "Head of State", "Minister", "Senator", "Member of Parliament",
            "Governor", "Mayor", "Judge", "Military General",
            "Ambassador", "Central Bank Director",
        ]
        _pep_risk_levels = ["High", "Medium", "Low"]

        for _i in range(pep_count.value):
            pep_data.append({
                "id": f"PEP-{_i:04d}",
                "name": f"{random.choice(CAMEROON_SURNAMES)} {random.choice(CAMEROON_FIRSTNAMES)}",
                "category": random.choice(_pep_categories),
                "country": "Cameroon",
                "risk_level": random.choice(_pep_risk_levels),
                "source": random.choice(["World-Check", "Dow Jones", "UN Security Council", "EU List"]),
                "date_listed": _fake.date_between(start_date="-10y", end_date="today").isoformat(),
            })

        # Sanctions generation
        _sanctions_types = [
            "Asset Freeze", "Travel Ban", "Arms Embargo", "Trade Restriction",
            "Financial Prohibition", "Entry Ban",
        ]
        _sanctions_programs = [
            "UN SC Res. 2582", "EU Reg. 2020/1122", "OFAC SDN List",
            "UK Sanctions List", "AU Sanctions", "CEMAC Regulation",
        ]

        for _i in range(sanctions_count.value):
            sanctions_data.append({
                "id": f"SAN-{_i:04d}",
                "name": f"{random.choice(CAMEROON_SURNAMES)} {random.choice(CAMEROON_FIRSTNAMES)}",
                "sanction_type": random.choice(_sanctions_types),
                "program": random.choice(_sanctions_programs),
                "country": random.choice(["Cameroon", "Nigeria", "Chad", "CAR", "Equatorial Guinea"]),
                "date_imposed": _fake.date_between(start_date="-5y", end_date="today").isoformat(),
                "active": random.choice([True, True, True, False]),
            })

    # Show samples
    _gen_pep_output = mo.md("*Click 'Generate' to create synthetic screening data.*")
    if pep_data or sanctions_data:
        _pep_rows = "\n".join(
            f"| {p['id']} | {p['name']} | {p['category']} | {p['risk_level']} |"
            for p in pep_data[:5]
        )
        _san_rows = "\n".join(
            f"| {s['id']} | {s['name']} | {s['sanction_type']} | {'🟢' if s['active'] else '🔴'} |"
            for s in sanctions_data[:5]
        )
        _gen_pep_output = mo.md(
            f"**Generated:** {len(pep_data)} PEP + {len(sanctions_data)} sanctions records\n\n"
            f"#### PEP Sample (top 5)\n"
            f"| ID | Name | Category | Risk |\n|----|------|----------|------|\n{_pep_rows}\n\n"
            f"#### Sanctions Sample (top 5)\n"
            f"| ID | Name | Type | Active |\n|----|------|------|--------|\n{_san_rows}"
        )
    _gen_pep_output

    return (pep_data, sanctions_data)


@app.cell
def _(mo):
    """Interactive PEP/sanctions name search."""
    search_input = mo.ui.text(
        label="🔍 Search name (fuzzy match)",
        placeholder="e.g. KANA",
    )

    search_input

    return (search_input,)


@app.cell
def _(mo, search_input, pep_data, sanctions_data):
    """Execute name search."""
    _search_output = mo.md("")

    if search_input.value.strip():
        _query = search_input.value.strip().upper()

        _pep_matches = [p for p in pep_data if _query in p["name"].upper()]
        _san_matches = [s for s in sanctions_data if _query in s["name"].upper()]

        _results_md = f"### Search Results for `{_query}`\n\n"

        if _pep_matches:
            _pep_match_rows = "\n".join(
                f"| {p['name']} | {p['category']} | {p['risk_level']} | {p['source']} |"
                for p in _pep_matches[:10]
            )
            _results_md += (
                f"**PEP Matches ({len(_pep_matches)}):**\n\n"
                f"| Name | Category | Risk | Source |\n|------|----------|------|--------|\n{_pep_match_rows}\n\n"
            )
        else:
            _results_md += "**PEP:** No matches ✅\n\n"

        if _san_matches:
            _san_match_rows = "\n".join(
                f"| {s['name']} | {s['sanction_type']} | {s['program']} | {'🟢 Active' if s['active'] else '🔴 Expired'} |"
                for s in _san_matches[:10]
            )
            _results_md += (
                f"**Sanctions Matches ({len(_san_matches)}):**\n\n"
                f"| Name | Type | Program | Status |\n|------|------|---------|--------|\n{_san_match_rows}\n\n"
            )
        else:
            _results_md += "**Sanctions:** No matches ✅\n\n"

        _risk = "⚠️ **ALERT: Potential match found**" if (_pep_matches or _san_matches) else "✅ No matches"
        _results_md += _risk

        _search_output = mo.md(_results_md)

    _search_output
    return


@app.cell
def _(mo, pep_data, sanctions_data):
    """Risk distribution visualization."""
    _risk_output = mo.md("")

    if pep_data:
        # PEP risk level distribution
        _risk_counts = {}
        for _p in pep_data:
            _r = _p["risk_level"]
            _risk_counts[_r] = _risk_counts.get(_r, 0) + 1

        _risk_bars = "\n".join(
            f"**{_r}**: {'█' * int(_c / max(_risk_counts.values()) * 30)} ({_c})"
            for _r, _c in sorted(_risk_counts.items(), key=lambda x: -x[1])
        )

        # PEP category distribution
        _cat_counts = {}
        for _p in pep_data:
            _c = _p["category"]
            _cat_counts[_c] = _cat_counts.get(_c, 0) + 1

        _cat_bars = "\n".join(
            f"**{_c}**: {'█' * int(_n / max(_cat_counts.values()) * 25)} ({_n})"
            for _c, _n in sorted(_cat_counts.items(), key=lambda x: -x[1])
        )

        # Sanctions by program
        _san_bars = "*No sanctions data*"
        if sanctions_data:
            _san_programs = {}
            for _s in sanctions_data:
                _prog = _s["program"]
                _san_programs[_prog] = _san_programs.get(_prog, 0) + 1

            _san_bars = "\n".join(
                f"**{_p}**: {'█' * int(_n / max(_san_programs.values()) * 20)} ({_n})"
                for _p, _n in sorted(_san_programs.items(), key=lambda x: -x[1])
            )

        _risk_output = mo.md(
            f"### 📊 Risk & Category Distribution\n\n"
            f"#### PEP Risk Levels\n{_risk_bars}\n\n"
            f"#### PEP Categories\n{_cat_bars}\n\n"
            f"#### Sanctions by Program\n{_san_bars}"
        )

    _risk_output
    return


@app.cell
def _(mo):
    """Export screening data."""
    export_btn = mo.ui.run_button(label="💾 Export Screening Data")

    mo.vstack([
        mo.md("### Export"),
        export_btn,
    ])

    return (export_btn,)


@app.cell
def _(export_btn, pep_data, sanctions_data, json, output_dir, mo):
    """Execute export."""
    _export_output = mo.md("")

    if export_btn.value and (pep_data or sanctions_data):
        if pep_data:
            _pep_path = output_dir / "pep_dataset.json"
            _pep_path.write_text(json.dumps(pep_data, indent=2, ensure_ascii=False), encoding="utf-8")

        if sanctions_data:
            _san_path = output_dir / "sanctions_dataset.json"
            _san_path.write_text(json.dumps(sanctions_data, indent=2, ensure_ascii=False), encoding="utf-8")

        _export_output = mo.md(f"✅ Exported {len(pep_data)} PEP + {len(sanctions_data)} sanctions records to `output/`")

    _export_output
    return


if __name__ == "__main__":
    app.run()
