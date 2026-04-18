"""
Interactive OCR Testing — PaddleOCR & GLM-OCR
==============================================

Dynamically test OCR on CNI images with zero hardcoding.
Upload any image, choose your engine, and inspect extracted fields.

Run:  marimo edit 01_interactive_ocr_testing.py
"""

import marimo

__generated_with = "0.23.1"
app = marimo.App(layout_file="layouts/01_interactive_ocr_testing.slides.json")


@app.cell
def _():
    """Imports and shared state."""
    import marimo as mo
    import os
    import sys
    import json
    import io
    from pathlib import Path

    import numpy as np
    from PIL import Image

    # Add parent dir so we can import ocr_utils
    _notebook_dir = Path(globals().get("__file__", ".")).resolve().parent
    sys.path.insert(0, str(_notebook_dir))
    from ocr_utils import (
        get_paddle_ocr,
        paddle_ocr_pipeline,
        glm_ocr_extract,
        DEFAULT_GLM_RECTO_PROMPT,
        DEFAULT_GLM_VERSO_PROMPT,
        DEFAULT_GLM_AUTO_PROMPT,
        sanitize_glm_output,
        set_glm_ocr_model_path,
        find_gguf_models,
        draw_ocr_boxes,
        numpy_to_pil,
        image_to_bytes,
        compute_sha256,
        combine_extractions,
        CNI_FIELDS,
    )

    # Base directory for sample images
    images_dir = _notebook_dir.parent / "images"
    return (
        DEFAULT_GLM_AUTO_PROMPT,
        DEFAULT_GLM_RECTO_PROMPT,
        DEFAULT_GLM_VERSO_PROMPT,
        Image,
        Path,
        compute_sha256,
        draw_ocr_boxes,
        find_gguf_models,
        glm_ocr_extract,
        image_to_bytes,
        combine_extractions,
        images_dir,
        io,
        mo,
        numpy_to_pil,
        paddle_ocr_pipeline,
        sanitize_glm_output,
        set_glm_ocr_model_path,
    )


@app.cell
def _(images_dir, mo):
    """Header + discover sample images."""
    sample_files = []
    if images_dir.exists():
        sample_files = sorted(
            f.name for f in images_dir.iterdir()
            if f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")
        )

    mo.md("""# 🔍 Interactive OCR Testing

    Upload any CNI image (recto/verso) and compare PaddleOCR vs GLM-OCR extraction.
    """)
    return (sample_files,)


@app.cell
def _(Path, find_gguf_models, mo):
    """GLM-OCR model discovery and selector."""
    gguf_models = find_gguf_models()
    # Only show main LLM models in dropdown; mmproj is auto-detected by get_glm_ocr()
    _main_models = [m for m in gguf_models if m.get("role") != "mmproj"]

    if _main_models:
        _glm_options = {
            f"{m['name']} ({m['size_mb']:.0f} MB) — {Path(m['path']).parent.name}": m["path"]
            for m in _main_models
        }
        glm_selector = mo.ui.dropdown(
            options=_glm_options,
            label="🤖 GLM-OCR Model",
        )
        _glm_status = f"Found {len(_main_models)} main model(s), {len(gguf_models) - len(_main_models)} mmproj auto-detected"
    else:
        glm_selector = mo.ui.text(
            value="",
            label="🤖 GLM-OCR Model Path (paste GGUF path)",
            placeholder="C:\\path\\to\\GLM-OCR.i1-Q4_K_M.gguf",
        )
        _glm_status = "No GGUF models auto-detected. Paste the path to your GLM-OCR model."

    mo.vstack([
        mo.md(f"### GLM-OCR Model\n{_glm_status}"),
        glm_selector,
    ])
    return (glm_selector,)


@app.cell
def _(glm_selector, mo, set_glm_ocr_model_path):
    """Activate GLM-OCR model."""
    _glm_status = "⚠️ No GLM-OCR model selected (PaddleOCR still works)"
    _val = glm_selector.value
    if _val and isinstance(_val, str) and _val.strip():
        set_glm_ocr_model_path(_val.strip())
        _glm_status = "✅ Model path set"

    mo.md(f"**GLM-OCR Status:** {_glm_status}")
    return


@app.cell
def _(mo, sample_files):
    """Image source selector — create widgets only (no .value reads here)."""
    source_radio = mo.ui.radio(
        options=["Upload Image", "Sample Images"],
        value="Sample Images" if sample_files else "Upload Image",
        label="📸 Primary image source",
    )

    file_upload = mo.ui.file(
        label="Drop a CNI image (PNG/JPG/WEBP)",
        filetypes=[".png", ".jpg", ".jpeg", ".webp"],
        kind="area",
        multiple=False,
    )

    sample_dropdown = mo.ui.dropdown(
        options={f: f for f in sample_files} if sample_files else {"(none)": ""},
        label="Pick from paddleocr_test/images/",
        value=sample_files[0] if sample_files else None,
    )

    # Second image (for auto-combine mode: upload the OTHER side)
    source_radio2 = mo.ui.radio(
        options=["None", "Upload Image", "Sample Images"],
        value="None",
        label="📸 Second image (other side, for AUTO combine)",
    )

    file_upload2 = mo.ui.file(
        label="Drop the OTHER side image",
        filetypes=[".png", ".jpg", ".jpeg", ".webp"],
        kind="area",
        multiple=False,
    )

    sample_dropdown2 = mo.ui.dropdown(
        options={f: f for f in sample_files} if sample_files else {"(none)": ""},
        label="Pick second image from paddleocr_test/images/",
        value=sample_files[1] if len(sample_files) > 1 else None,
    )
    return file_upload, file_upload2, sample_dropdown, sample_dropdown2, source_radio, source_radio2


@app.cell
def _(file_upload, file_upload2, mo, sample_dropdown, sample_dropdown2, source_radio, source_radio2):
    """Display image source widgets — reactive on source_radio.value."""
    _source_widget = file_upload if source_radio.value == "Upload Image" else sample_dropdown
    _source_widget2 = file_upload2 if source_radio2.value == "Upload Image" else sample_dropdown2

    mo.vstack([
        mo.md("### 📸 Primary Image (main side)"),
        source_radio,
        _source_widget,
        mo.md("---"),
        mo.md("### 📸 Second Image (other side, optional — for AUTO combine)"),
        source_radio2,
        _source_widget2,
    ])
    return


@app.cell
def _(
    Image,
    compute_sha256,
    file_upload,
    file_upload2,
    images_dir,
    io,
    mo,
    sample_dropdown,
    sample_dropdown2,
    source_radio,
    source_radio2,
):
    """Load the selected images into memory."""
    pil_image = None
    image_name = ""
    image_sha256 = ""
    image_bytes = b""
    pil_image2 = None
    image_name2 = ""
    image_bytes2 = b""

    # --- Primary image ---
    if source_radio.value == "Upload Image":
        if file_upload.value:  # tuple of FileUploadResults
            image_bytes = file_upload.contents(0)
            image_name = file_upload.name(0) or "uploaded"
            pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            image_sha256 = compute_sha256(image_bytes)
    else:
        _fname = sample_dropdown.value
        if _fname and _fname != "(none)":
            _fpath = images_dir / _fname
            if _fpath.exists():
                image_bytes = _fpath.read_bytes()
                pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                image_name = _fname
                image_sha256 = compute_sha256(image_bytes)

    # --- Second image (other side, for auto-combine) ---
    if source_radio2.value == "Upload Image":
        if file_upload2.value:
            image_bytes2 = file_upload2.contents(0)
            image_name2 = file_upload2.name(0) or "uploaded-2"
            pil_image2 = Image.open(io.BytesIO(image_bytes2)).convert("RGB")
    elif source_radio2.value == "Sample Images":
        _fname2 = sample_dropdown2.value
        if _fname2 and _fname2 != "(none)":
            _fpath2 = images_dir / _fname2
            if _fpath2.exists():
                image_bytes2 = _fpath2.read_bytes()
                pil_image2 = Image.open(io.BytesIO(image_bytes2)).convert("RGB")
                image_name2 = _fname2

    _img2_md = (
        mo.md(f"**2nd image:** `{image_name2}`")
        if pil_image2
        else mo.md("*No 2nd image (combine mode disabled).*")
    )

    _load_output = (
        mo.vstack([
            mo.image(src=image_bytes),
            mo.md(
                f"**Loaded:** `{image_name}`  \n"
                f"**Size:** {pil_image.size[0]}\u00d7{pil_image.size[1]}  \n"
                f"**SHA-256:** `{image_sha256[:16]}\u2026`"
            ),
            _img2_md,
        ])
        if pil_image
        else mo.md("*No image loaded yet. Upload or select one above.*")
    )
    _load_output
    return image_bytes, image_bytes2, pil_image, pil_image2


@app.cell
def _(mo):
    """Engine selection and options."""
    engine_choice = mo.ui.dropdown(
        options={
            "PaddleOCR only": "paddleocr",
            "GLM-OCR only": "glm_ocr",
            "Both (compare)": "both",
        },
        value="Both (compare)",
        label="Engine",
    )

    card_side = mo.ui.radio(
        options={
            "🤖 Auto-detect (god mode with 2 images)": "auto",
            "📄 Recto (Identity)": "recto",
            "📂 Verso (NIN/Validity)": "verso",
        },
        value="🤖 Auto-detect (god mode with 2 images)",
        label="Card Side",
    )

    show_blocks = mo.ui.checkbox(label="Show OCR block details", value=True)

    run_button = mo.ui.run_button(label="🚀 Run OCR", kind="neutral")

    mo.vstack([
        mo.md("### ⚙️ OCR Engine & Options"),
        mo.hstack([engine_choice, card_side]),
        show_blocks,
        run_button,
    ])
    return card_side, engine_choice, run_button, show_blocks


@app.cell
def _(DEFAULT_GLM_AUTO_PROMPT, DEFAULT_GLM_RECTO_PROMPT, DEFAULT_GLM_VERSO_PROMPT, card_side, mo):
    """Show the active prompt for the selected card side (read-only info)."""
    _side_val = card_side.value
    if _side_val == "verso":
        _active_prompt = DEFAULT_GLM_VERSO_PROMPT
        _side_label = "📂 VERSO — NIN & Validity only"
    elif _side_val == "recto":
        _active_prompt = DEFAULT_GLM_RECTO_PROMPT
        _side_label = "📄 RECTO — Identity fields only"
    else:
        _active_prompt = DEFAULT_GLM_AUTO_PROMPT
        _side_label = "🤖 AUTO — Extract ALL fields from any side"
    mo.md(f"**Active prompt mode:** {_side_label}\n\n```\n{_active_prompt}\n```")
    return


@app.cell
def _(
    DEFAULT_GLM_AUTO_PROMPT,
    DEFAULT_GLM_RECTO_PROMPT,
    DEFAULT_GLM_VERSO_PROMPT,
    card_side,
    combine_extractions,
    draw_ocr_boxes,
    engine_choice,
    glm_ocr_extract,
    image_bytes,
    image_bytes2,
    numpy_to_pil,
    paddle_ocr_pipeline,

    pil_image,
    pil_image2,
    run_button,
    sanitize_glm_output,
    show_blocks,
):
    """Run OCR on the loaded image(s). In AUTO mode with 2 images, combines both sides."""
    paddle_result = None
    paddle_result2 = None
    combined_result = None
    glm_result = None
    annotated_pil = None
    detected_side = "recto"

    if run_button.value and pil_image is not None:
        _engine = engine_choice.value
        _is_auto = card_side.value == "auto"
        _has_second = pil_image2 is not None

        # --- PaddleOCR on primary image ---
        if _engine in ("paddleocr", "both"):
            paddle_result = paddle_ocr_pipeline(pil_image)
            if "extraction" in paddle_result:
                _method = paddle_result["extraction"].get("methode", "")
                if "VERSO" in _method:
                    detected_side = "verso"

            if "aligned_image" in paddle_result and paddle_result["aligned_image"] is not None:
                _aligned = paddle_result["aligned_image"]
                if show_blocks.value and "blocks" in paddle_result:
                    _annotated = draw_ocr_boxes(_aligned, paddle_result["blocks"])
                else:
                    _annotated = _aligned
                annotated_pil = numpy_to_pil(_annotated)

        # --- PaddleOCR on second image (for auto-combine) ---
        if _is_auto and _has_second and _engine in ("paddleocr", "both"):
            paddle_result2 = paddle_ocr_pipeline(pil_image2)

        # --- Card Side Final Choice ---
        final_side = card_side.value if card_side.value != "auto" else detected_side

        # --- Combine extractions (auto + 2 images = god mode) ---
        if _is_auto and paddle_result and paddle_result2:
            combined_result = combine_extractions(paddle_result, paddle_result2)
            # Replace the extraction in paddle_result with the combined one
            paddle_result = {**paddle_result, "extraction": combined_result}

        # --- GLM-OCR ---
        if _engine in ("glm_ocr", "both") and image_bytes:
            # Determine prompt
            if _is_auto:
                _prompt = DEFAULT_GLM_AUTO_PROMPT
            elif final_side == "verso":
                _prompt = DEFAULT_GLM_VERSO_PROMPT
            else:
                _prompt = DEFAULT_GLM_RECTO_PROMPT

            try:
                glm_res = glm_ocr_extract(image_bytes, prompt=_prompt)
                # Apply sanitization — auto mode doesn't suppress fields
                if glm_res.get("success") and "parsed_fields" in glm_res:
                    glm_res["parsed_fields"] = sanitize_glm_output(glm_res["parsed_fields"], side=card_side.value)
                    glm_res["detected_side"] = final_side
                glm_result = glm_res
            except Exception as _e:
                glm_result = {"error": str(_e), "model": "glm_ocr", "success": False}
    return annotated_pil, combined_result, detected_side, glm_result, paddle_result, paddle_result2


@app.cell
def _(CNI_FIELDS, annotated_pil, image_to_bytes, mo, paddle_result, show_blocks):
    """Display PaddleOCR results."""
    if paddle_result is None:
        _paddle_output = mo.md("")
    elif "error" in paddle_result:
        _paddle_output = mo.md(f"### PaddleOCR Result\n❌ **Error:** {paddle_result['error']}")
    else:
        _blocks = paddle_result.get("blocks", [])
        _extraction = paddle_result.get("extraction", {})
        _method = _extraction.get("methode", "N/A")

        # Build field table
        _has_source = any(
            isinstance(_extraction.get(_k), dict) and "source" in _extraction.get(_k, {})
            for _k in CNI_FIELDS
        )
        _paddle_rows = []
        for _key in CNI_FIELDS:
            _field = _extraction.get(_key, {})
            _val = _field.get("value", "—") if isinstance(_field, dict) else _field
            _conf = _field.get("conf", 0.0) if isinstance(_field, dict) else 0.0
            _src = _field.get("source", "") if isinstance(_field, dict) else ""
            _status = "✅" if _conf >= 0.85 else "⚠️" if _conf >= 0.6 else "❌"
            if _has_source:
                _paddle_rows.append(f"| {_key} | `{_val}` | {_conf:.2f} | {_status} | {_src or '—'} |")
            else:
                _paddle_rows.append(f"| {_key} | `{_val}` | {_conf:.2f} | {_status} |")

        if _has_source:
            _paddle_table = (
                "| Field | Value | Confidence | Status | Source |\n|-------|-------|-----------|--------|--------|\n"
                + "\n".join(_paddle_rows)
            )
        else:
            _paddle_table = (
                "| Field | Value | Confidence | Status |\n|-------|-------|-----------|--------|\n"
                + "\n".join(_paddle_rows)
            )

        # Block details
        _blocks_md = ""
        if show_blocks.value and _blocks:
            _block_rows = []
            for _i, _b in enumerate(_blocks[:20]):
                _block_rows.append(
                    f"| {_i} | `{_b['text'][:30]}` | {_b['cx']:.0f} | {_b['cy']:.0f} | {_b['conf']:.2f} |"
                )
            _blocks_md = (
                "\n\n#### OCR Blocks (top 20)\n"
                "| # | Text | X | Y | Conf |\n|---|------|---|---|------|\n"
                + "\n".join(_block_rows)
            )

        # Annotated image
        _img_widget = mo.md("")
        if annotated_pil:
            _img_bytes = image_to_bytes(annotated_pil)
            _img_widget = mo.image(src=_img_bytes)

        _paddle_output = mo.vstack([
            mo.md(
                f"### 🟢 PaddleOCR Result\n"
                f"**Method:** `{_method}`  \n"
                f"**Blocks detected:** {len(_blocks)}\n\n"
                f"{_paddle_table}\n"
                f"{_blocks_md}"
            ),
            mo.md("#### Annotated Image (PaddleOCR)"),
            _img_widget,
        ])

    _paddle_output
    return


@app.cell
def _(CNI_FIELDS, glm_result, mo):
    """Display GLM-OCR results."""
    if glm_result is None:
        _glm_output = mo.md("")
    elif glm_result.get("error"):
        _glm_output = mo.md(f"### 🟣 GLM-OCR Result\n❌ **Error:** {glm_result['error']}")
    else:
        _raw = glm_result.get("raw_text", "")
        _parsed = glm_result.get("parsed_fields", {})
        _mode = glm_result.get("parsing_mode", "plaintext")
        _mode_label = {
            "json": "📋 JSON (structured)",
            "json_fallback_plaintext": "📋→📝 JSON failed, plaintext fallback",
            "plaintext": "📝 Plaintext (native OCR)",
        }.get(_mode, _mode)

        if _parsed and any(v is not None for v in _parsed.values()):
            _glm_rows = []
            for _gkey in CNI_FIELDS:
                _gval = _parsed.get(_gkey, "—") or "—"
                _glm_rows.append(f"| {_gkey} | `{_gval}` |")
            _glm_table = (
                "| Field | Value |\n|-------|-------|\n" + "\n".join(_glm_rows)
            )
        else:
            _glm_table = f"**Raw output:**\n```\n{_raw[:500]}\n```"

        _raw_collapsible = mo.accordion(
            {"📄 Raw output": f"```\n{_raw[:1000]}\n```"},
        )

        _glm_output = mo.vstack([
            mo.md(
                f"### 🟣 GLM-OCR Result\n"
                f"**Model:** `{glm_result.get('model', 'N/A')}`  \n"
                f"**Success:** {glm_result.get('success', False)}  \n"
                f"**Parsing mode:** {_mode_label}\n\n"
                f"{_glm_table}"
            ),
            _raw_collapsible,
        ])

    _glm_output
    return


@app.cell
def _(CNI_FIELDS, combined_result, mo, paddle_result2):
    """Show second image extraction and combined summary (auto-combine mode)."""
    _combine_output = mo.md("")

    if combined_result is not None:
        # Combined results table with source per field
        _comb_rows = []
        _filled = 0
        for _ckey in CNI_FIELDS:
            _field = combined_result.get(_ckey, {})
            _val = _field.get("value", "—") if isinstance(_field, dict) else _field
            _conf = _field.get("conf", 0.0) if isinstance(_field, dict) else 0.0
            _src = _field.get("source", "—") if isinstance(_field, dict) else "—"
            if _val and _val != "—":
                _filled += 1
            _comb_rows.append(f"| {_ckey} | `{_val}` | {_conf:.2f} | {_src} |")

        _comb_table = (
            "| Field | Value | Conf | Source |\n"
            "|-------|-------|------|--------|\n"
            + "\n".join(_comb_rows)
        )

        # Second image individual extraction
        _side2_md = ""
        if paddle_result2 and "extraction" in paddle_result2:
            _ext2 = paddle_result2["extraction"]
            _side2_detected = _ext2.get("detected_side", "?")
            _side2_rows = []
            for _sk in CNI_FIELDS:
                _sf = _ext2.get(_sk, {})
                _sv = _sf.get("value", "—") if isinstance(_sf, dict) else _sf
                if _sv and _sv != "—":
                    _side2_rows.append(f"| {_sk} | `{_sv}` |")
            _side2_table = (
                "| Field | Value |\n|-------|-------|\n" + "\n".join(_side2_rows)
            ) if _side2_rows else "*No fields extracted*"
            _side2_md = (
                f"\n\n#### 2nd Image Extraction (detected: **{_side2_detected}**)\n\n"
                + _side2_table
            )

        _combine_output = mo.md(
            f"### 🔗 Combined Result (Auto God Mode)\n\n"
            f"**Fields filled:** {_filled}/{len(CNI_FIELDS)}  \n"
            f"**Method:** `{combined_result.get('methode', 'N/A')}`  \n\n"
            f"{_comb_table}\n"
            f"{_side2_md}"
        )
    elif paddle_result2 is not None:
        # 2nd image was processed but no combine (non-auto mode)
        _combine_output = mo.md("*2nd image processed but not combined (select Auto mode to combine).*")

    _combine_output
    return


@app.cell
def _(CNI_FIELDS, glm_result, mo, paddle_result):
    """Side-by-side comparison table."""
    _comparison_output = mo.md("")

    if paddle_result and glm_result and "extraction" in paddle_result:
        _p_ext = paddle_result["extraction"]
        _g_parsed = glm_result.get("parsed_fields", {})

        _comp_rows = []
        for _ckey in CNI_FIELDS:
            _p_val = _p_ext.get(_ckey, {})
            _p_v = _p_val.get("value", "—") if isinstance(_p_val, dict) else _p_val
            _p_c = _p_val.get("conf", 0.0) if isinstance(_p_val, dict) else 0.0
            _g_v = _g_parsed.get(_ckey) or "—"
            _match = "✅" if str(_p_v).upper() == str(_g_v).upper() else "❌"
            _comp_rows.append(f"| {_ckey} | `{_p_v}` | {_p_c:.2f} | `{_g_v}` | {_match} |")

        _comparison_output = mo.md(
            "### 📊 Engine Comparison\n\n"
            "| Field | PaddleOCR | Conf | GLM-OCR | Match |\n"
            "|-------|-----------|------|---------|-------|\n"
            + "\n".join(_comp_rows)
        )

    _comparison_output
    return


if __name__ == "__main__":
    app.run()
