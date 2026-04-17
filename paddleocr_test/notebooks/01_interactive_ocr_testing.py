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
        DEFAULT_GLM_KYC_PROMPT,
        set_glm_ocr_model_path,
        find_gguf_models,
        draw_ocr_boxes,
        numpy_to_pil,
        image_to_bytes,
        compute_sha256,
        CNI_FIELDS,
    )

    # Base directory for sample images
    images_dir = _notebook_dir.parent / "images"
    return (
        DEFAULT_GLM_KYC_PROMPT,
        Image,
        Path,
        compute_sha256,
        draw_ocr_boxes,
        find_gguf_models,
        glm_ocr_extract,
        image_to_bytes,
        images_dir,
        io,
        mo,
        numpy_to_pil,
        paddle_ocr_pipeline,
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
        label="📸 Image source",
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
    return file_upload, sample_dropdown, source_radio


@app.cell
def _(file_upload, mo, sample_dropdown, source_radio):
    """Display image source widgets — reactive on source_radio.value."""
    _source_widget = file_upload if source_radio.value == "Upload Image" else sample_dropdown

    mo.vstack([
        source_radio,
        _source_widget,
    ])
    return


@app.cell
def _(
    Image,
    compute_sha256,
    file_upload,
    images_dir,
    io,
    mo,
    sample_dropdown,
    source_radio,
):
    """Load the selected image into memory."""
    pil_image = None
    image_name = ""
    image_sha256 = ""
    image_bytes = b""

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

    _load_output = (
        mo.vstack([
            mo.image(src=image_bytes),
            mo.md(
                f"**Loaded:** `{image_name}`  \n"
                f"**Size:** {pil_image.size[0]}\u00d7{pil_image.size[1]}  \n"
                f"**SHA-256:** `{image_sha256[:16]}\u2026`"
            ),
        ])
        if pil_image
        else mo.md("*No image loaded yet. Upload or select one above.*")
    )
    _load_output
    return image_bytes, pil_image


@app.cell
def _(DEFAULT_GLM_KYC_PROMPT, mo):
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

    show_blocks = mo.ui.checkbox(label="Show OCR block details", value=True)

    # GLM-OCR prompt — two modes:
    # - KYC structured extraction (default): asks model for JSON output
    # - Native OCR transcription: type "OCR" to use the fine-tuned prompt
    glm_prompt = mo.ui.text(
        value=DEFAULT_GLM_KYC_PROMPT,
        label="🟣 GLM-OCR Prompt",
        placeholder="KYC JSON prompt (default) or 'OCR' for native transcription",
        full_width=True,
    )

    run_button = mo.ui.run_button(label="🚀 Run OCR")

    mo.vstack([
        mo.md("### ⚙️ OCR Engine & Options"),
        engine_choice,
        show_blocks,
        glm_prompt,
        run_button,
    ])
    return engine_choice, glm_prompt, run_button, show_blocks


@app.cell
def _(
    DEFAULT_GLM_KYC_PROMPT,
    draw_ocr_boxes,
    engine_choice,
    glm_ocr_extract,
    glm_prompt,
    image_bytes,
    numpy_to_pil,
    paddle_ocr_pipeline,
    pil_image,
    run_button,
    show_blocks,
):
    """Run OCR on the loaded image."""
    paddle_result = None
    glm_result = None
    annotated_pil = None

    if run_button.value and pil_image is not None:
        _engine = engine_choice.value

        # --- PaddleOCR ---
        if _engine in ("paddleocr", "both"):
            paddle_result = paddle_ocr_pipeline(pil_image)
            if "aligned_image" in paddle_result and paddle_result["aligned_image"] is not None:
                _aligned = paddle_result["aligned_image"]
                if show_blocks.value and "blocks" in paddle_result:
                    _annotated = draw_ocr_boxes(_aligned, paddle_result["blocks"])
                else:
                    _annotated = _aligned
                annotated_pil = numpy_to_pil(_annotated)

        # --- GLM-OCR ---
        if _engine in ("glm_ocr", "both") and image_bytes:
            try:
                glm_result = glm_ocr_extract(
                    image_bytes,
                    prompt=glm_prompt.value.strip() or DEFAULT_GLM_KYC_PROMPT,
                )
            except Exception as _e:
                glm_result = {"error": str(_e), "model": "glm_ocr", "success": False}
    return annotated_pil, glm_result, paddle_result


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
        _paddle_rows = []
        for _key in CNI_FIELDS:
            _field = _extraction.get(_key, {})
            _val = _field.get("value", "—") if isinstance(_field, dict) else _field
            _conf = _field.get("conf", 0.0) if isinstance(_field, dict) else 0.0
            _status = "✅" if _conf >= 0.85 else "⚠️" if _conf >= 0.6 else "❌"
            _paddle_rows.append(f"| {_key} | `{_val}` | {_conf:.2f} | {_status} |")

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
