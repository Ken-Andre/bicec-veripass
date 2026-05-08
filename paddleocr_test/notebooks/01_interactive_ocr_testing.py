"""
Interactive OCR Testing — PaddleOCR & GLM-OCR
==============================================

Dynamically test OCR on CNI images with zero hardcoding.
Upload any image, capture from camera, choose your engine, and inspect extracted fields.

Run:  marimo edit 01_interactive_ocr_testing.py
"""

import marimo

__generated_with = "0.23.5"
app = marimo.App(layout_file="layouts/01_interactive_ocr_testing.slides.json")


@app.cell
def _():
    import marimo as mo
    import os
    import sys
    import json
    import io
    import base64
    from pathlib import Path

    _notebook_dir = Path.cwd()
    _venv_ocr = _notebook_dir / ".venv_ocr"
    _site_pkgs = _venv_ocr / "Lib" / "site-packages"
    if _site_pkgs.exists():
        sys.path.insert(0, str(_site_pkgs))
    sys.path.insert(0, str(_notebook_dir))

    import anywidget
    import numpy as np
    import traitlets
    from PIL import Image

    from ocr_utils import (
        get_paddle_ocr,
        paddle_ocr_pipeline,
        glm_ocr_extract,
        DEFAULT_GLM_RECTO_PROMPT,
        DEFAULT_GLM_VERSO_PROMPT,
        sanitize_glm_output,
        set_glm_ocr_model_path,
        find_gguf_models,
        draw_ocr_boxes,
        numpy_to_pil,
        image_to_bytes,
        compute_sha256,
        CNI_FIELDS,
    )

    images_dir = _notebook_dir.parent / "images"
    return (
        CNI_FIELDS,
        DEFAULT_GLM_RECTO_PROMPT,
        DEFAULT_GLM_VERSO_PROMPT,
        Image,
        Path,
        anywidget,
        base64,
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
        sanitize_glm_output,
        set_glm_ocr_model_path,
        traitlets,
    )


@app.cell
def _(anywidget, mo, traitlets):
    """Custom anywidget for camera capture using getUserMedia."""

    class CameraCapture(anywidget.AnyWidget):
        _esm = r"""
        function render({ model, el }) {
            const container = document.createElement("div");
            container.style.display = "flex";
            container.style.flexDirection = "column";
            container.style.alignItems = "center";
            container.style.gap = "8px";

            const video = document.createElement("video");
            video.autoplay = true;
            video.playsInline = true;
            video.muted = true;
            video.style.width = "100%";
            video.style.maxWidth = "400px";
            video.style.borderRadius = "8px";
            video.style.backgroundColor = "#000";
            video.style.display = "none";

            const btn = document.createElement("button");
            btn.textContent = "📸 Take Photo";
            btn.style.padding = "10px 20px";
            btn.style.fontSize = "16px";
            btn.style.cursor = "pointer";
            btn.style.display = "none";

            const retakeBtn = document.createElement("button");
            retakeBtn.textContent = "🔄 Retake";
            retakeBtn.style.padding = "10px 20px";
            retakeBtn.style.fontSize = "16px";
            retakeBtn.style.cursor = "pointer";
            retakeBtn.style.display = "none";

            const status = document.createElement("p");
            status.style.color = "#888";
            status.textContent = "Starting camera...";

            const canvas = document.createElement("canvas");
            let stream = null;

            async function startCamera() {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: "environment" }
                    });
                } catch (e1) {
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({
                            video: true
                        });
                    } catch (e2) {
                        try {
                            stream = await navigator.mediaDevices.getUserMedia({
                                video: { facingMode: "user" }
                            });
                        } catch (e3) {
                            status.textContent = "Camera error: " + e3.message;
                            status.style.color = "red";
                            return;
                        }
                    }
                }
                video.srcObject = stream;
                video.style.display = "block";
                btn.style.display = "inline-block";
                status.textContent = "";
            }

            btn.onclick = () => {
                if (!stream) return;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext("2d").drawImage(video, 0, 0);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
                const base64 = dataUrl.split(",")[1];
                model.set("value", base64);
                model.save_changes();
                stream.getTracks().forEach(t => t.stop());
                stream = null;
                video.style.display = "none";
                btn.style.display = "none";
                retakeBtn.style.display = "inline-block";
                status.textContent = "✅ Photo captured!";
                status.style.color = "green";
            };

            retakeBtn.onclick = () => {
                retakeBtn.style.display = "none";
                model.set("value", "");
                model.save_changes();
                status.textContent = "Starting camera...";
                status.style.color = "#888";
                startCamera();
            };

            container.appendChild(status);
            container.appendChild(video);
            container.appendChild(btn);
            container.appendChild(retakeBtn);
            el.appendChild(container);

            startCamera();

            return () => {
                if (stream) stream.getTracks().forEach(t => t.stop());
            };
        }
        export default { render };
        """
        value = traitlets.Unicode("").tag(sync=True)

    mo.md("### 📷 Camera widget ready")
    return (CameraCapture,)


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
def _(CameraCapture, mo, sample_files):
    """Image source selector — create widgets only (no .value reads here)."""
    source_radio = mo.ui.radio(
        options=["Upload Image", "Sample Images", "Camera Capture"],
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

    camera_widget = CameraCapture()
    return camera_widget, file_upload, sample_dropdown, source_radio


@app.cell
def _(camera_widget, file_upload, mo, sample_dropdown, source_radio):
    """Display image source widgets — reactive on source_radio.value."""
    if source_radio.value == "Upload Image":
        _source_widget = file_upload
    elif source_radio.value == "Camera Capture":
        _source_widget = camera_widget
    else:
        _source_widget = sample_dropdown

    mo.vstack([
        source_radio,
        _source_widget,
    ])
    return


@app.cell
def _(
    Image,
    base64,
    camera_widget,
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
    elif source_radio.value == "Camera Capture":
        _b64 = camera_widget.value
        if _b64:
            image_bytes = base64.b64decode(_b64)
            image_name = "camera_capture"
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
        else mo.md("*No image loaded yet. Upload, select, or capture one above.*")
    )
    _load_output
    return image_bytes, pil_image


@app.cell
def _(DEFAULT_GLM_RECTO_PROMPT, mo):
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
            "🤖 Auto-detect": "auto",
            "📄 Recto (Identity)": "recto",
            "📂 Verso (NIN/Validity)": "verso",
        },
        value="🤖 Auto-detect",
        label="Card Side",
    )

    show_blocks = mo.ui.checkbox(label="Show OCR block details", value=True)

    # GLM-OCR prompt — dynamically updated based on card_side
    glm_prompt = mo.ui.text_area(
        value=DEFAULT_GLM_RECTO_PROMPT,
        label="🟣 GLM-OCR Prompt (edit if needed)",
        placeholder="JSON prompt...",
        full_width=True,
    )

    run_button = mo.ui.run_button(label="🚀 Run OCR", kind="neutral")

    mo.vstack([
        mo.md("### ⚙️ OCR Engine & Options"),
        mo.hstack([engine_choice, card_side]),
        show_blocks,
        glm_prompt,
        run_button,
    ])
    return card_side, engine_choice, glm_prompt, run_button, show_blocks


@app.cell
def _(DEFAULT_GLM_RECTO_PROMPT, DEFAULT_GLM_VERSO_PROMPT, card_side, mo):
    """Show the active prompt for the selected card side (read-only info)."""
    _side_val = card_side.value
    if _side_val == "verso":
        _active_prompt = DEFAULT_GLM_VERSO_PROMPT
        _side_label = "📂 VERSO — NIN & Validity only"
    elif _side_val == "recto":
        _active_prompt = DEFAULT_GLM_RECTO_PROMPT
        _side_label = "📄 RECTO — Identity fields only"
    else:
        _active_prompt = "(auto-selected at runtime based on PaddleOCR detection)"
        _side_label = "🤖 AUTO — prompt chosen after PaddleOCR detection"
    mo.md(f"**Active prompt mode:** {_side_label}\n\n```\n{_active_prompt}\n```")
    return


@app.cell
def _(
    DEFAULT_GLM_RECTO_PROMPT,
    DEFAULT_GLM_VERSO_PROMPT,
    card_side,
    draw_ocr_boxes,
    engine_choice,
    glm_ocr_extract,
    glm_prompt,
    image_bytes,
    numpy_to_pil,
    paddle_ocr_pipeline,
    pil_image,
    run_button,
    sanitize_glm_output,
    show_blocks,
):
    """Run OCR on the loaded image."""
    paddle_result = None
    glm_result = None
    annotated_pil = None
    detected_side = "recto"

    if run_button.value and pil_image is not None:
        _engine = engine_choice.value

        # --- PaddleOCR (Run first to allow auto-detection) ---
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

        # --- Card Side Final Choice ---
        final_side = card_side.value if card_side.value != "auto" else detected_side

        # --- GLM-OCR ---
        if _engine in ("glm_ocr", "both") and image_bytes:
            # Determine prompt
            _prompt = glm_prompt.value.strip()
            if card_side.value == "auto":
                _prompt = DEFAULT_GLM_VERSO_PROMPT if final_side == "verso" else DEFAULT_GLM_RECTO_PROMPT

            try:
                glm_res = glm_ocr_extract(image_bytes, prompt=_prompt)
                # Apply sanitization to kill hallucinations
                if glm_res.get("success") and "parsed_fields" in glm_res:
                    glm_res["parsed_fields"] = sanitize_glm_output(glm_res["parsed_fields"], side=final_side)
                    glm_res["detected_side"] = final_side
                glm_result = glm_res
            except Exception as _e:
                glm_result = {"error": str(_e), "model": "glm_ocr", "success": False}
    return annotated_pil, glm_result, paddle_result


@app.cell
def _(
    CNI_FIELDS,
    annotated_pil,
    image_to_bytes,
    mo,
    paddle_result,
    show_blocks,
):
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
