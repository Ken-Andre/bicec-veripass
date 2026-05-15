"""
OCR Accuracy Dashboard
=======================

Compare PaddleOCR vs GLM-OCR accuracy across a batch of images.
Track per-field metrics, confidence distributions, and error patterns.

Run:  marimo edit 03_ocr_accuracy_dashboard.py
"""

from ocr_utils import CNI_FIELDS
import marimo

__generated_with = "0.23.1"
app = marimo.App()


@app.cell
def _():
    """Imports."""
    import marimo as mo
    import os
    import sys
    import io
    import json
    from pathlib import Path
    from collections import defaultdict

    import numpy as np
    from PIL import Image

    _notebook_dir = Path(globals().get("__file__", ".")).resolve().parent
    sys.path.insert(0, str(_notebook_dir))
    from ocr_utils import (
        paddle_ocr_pipeline,
        glm_ocr_extract,
        DEFAULT_GLM_KYC_PROMPT,
        set_glm_ocr_model_path,
        find_gguf_models,
        numpy_to_pil,
        image_to_bytes,
        compute_sha256,
        CNI_FIELDS,
    )

    images_dir = _notebook_dir.parent /"notebooks"/"output"/ "images"
    return (
        DEFAULT_GLM_KYC_PROMPT,
        Image,
        Path,
        find_gguf_models,
        glm_ocr_extract,
        images_dir,
        io,
        mo,
        paddle_ocr_pipeline,
        set_glm_ocr_model_path,
    )


@app.cell
def _(mo):
    """Header."""
    mo.md("""# 📊 OCR Accuracy Dashboard

    Batch-test OCR engines and compare accuracy metrics across images.
    Load ground truth, run OCR, and see per-field analysis.
    """)
    return


@app.cell
def _(Path, find_gguf_models, mo):
    """GLM-OCR model selector."""
    _gguf_models = find_gguf_models()
    # Only show main LLM models in dropdown; mmproj is auto-detected by glm_ocr_extract()
    _main_models = [m for m in _gguf_models if m.get("role") != "mmproj"]

    if _main_models:
        _glm_options = {f"{m['name']} ({m['size_mb']:.0f} MB) — {Path(m['path']).parent.name}": m["path"] for m in _main_models}
        glm_selector = mo.ui.dropdown(options=_glm_options, label="🤖 GLM-OCR Model")
    else:
        glm_selector = mo.ui.text(
            value="", label="🤖 GLM-OCR Model Path",
            placeholder="C:\\path\\to\\GLM-OCR.i1-Q4_K_M.gguf",
        )

    mo.vstack([
        mo.md("### GLM-OCR Model"),
        glm_selector,
    ])
    return (glm_selector,)


@app.cell
def _(glm_selector, set_glm_ocr_model_path):
    """Activate GLM-OCR."""
    _val = glm_selector.value
    if _val and isinstance(_val, str) and _val.strip():
        set_glm_ocr_model_path(_val.strip())
    return


@app.cell
def _(images_dir, mo):
    """Discover images for batch test."""
    image_files = []
    if images_dir.exists():
        image_files = sorted(
            f for f in images_dir.iterdir()
            if f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")
        )

    mo.md(f"### 📸 Image Batch\nFound **{len(image_files)}** images in `{images_dir}`")
    return (image_files,)


@app.cell
def _(image_files, mo):
    """Select images for batch test."""
    _file_options = {f.name: str(f) for f in image_files} if image_files else {}
    batch_selector = mo.ui.multiselect(options=_file_options, label="Select images to test")

    batch_selector
    return (batch_selector,)


@app.cell
def ground_truth_placeholder(mo):
    """Ground truth input."""
    gt_input = mo.ui.text_area(
        value="{}",
        label="✅ Ground Truth JSON",
        rows=8,
        placeholder='{"cni_recto.png": {"nom": "TANDENT YANG", "prenom": "DANIEL CHARLES", "numero_cni": "123456789"}}',
    )

    mo.vstack([
        mo.md("""Provide ground truth as JSON for comparison. Format:
        ```json
        {"image_name.png": {"nom": "EXPECTED", "prenom": "EXPECTED", "numero_cni": "123456789"}}
        ```
        """),
        gt_input,
    ])
    return


@app.cell
def _(gt_input, json, mo):
    """Parse ground truth."""
    _raw = None
    _gt_parse_error = ""
    if gt_input.value.strip():
        try:
            _raw = json.loads(gt_input.value)
        except json.JSONDecodeError as _e:
            _gt_parse_error = str(_e)

    _entries = 0
    ground_truth = {}
    if isinstance(_raw, dict):
        _entries = len(_raw)
        ground_truth = _raw
    elif isinstance(_raw, list):
        for _entry in _raw:
            if isinstance(_entry, dict) and "data" in _entry:
                _d = _entry["data"]
                if "recto" in _entry:
                    ground_truth[_entry["recto"]] = _d
                if "verso" in _entry:
                    ground_truth[_entry["verso"]] = _d
        _entries = len(ground_truth)

    _suffix = "" if not _gt_parse_error else f" (raw parse had issue: {_gt_parse_error})"
    _gt_output = mo.md(f"**Parsed {_entries} ground truth entries.**{_suffix}")
    _gt_output

    return (ground_truth,)


@app.cell
def _(DEFAULT_GLM_KYC_PROMPT, mo):
    """Run batch test button and GLM-OCR prompt."""
    run_batch = mo.ui.run_button(label="🚀 Run Batch OCR Test")

    # GLM-OCR prompt — two modes:
    # - KYC structured extraction (default): asks model for JSON output
    # - Native OCR transcription: type "OCR" to use the fine-tuned prompt
    glm_prompt = mo.ui.text(
        value=DEFAULT_GLM_KYC_PROMPT,
        label="🟣 GLM-OCR Prompt",
        placeholder="KYC JSON prompt (default) or 'OCR' for native transcription",
        full_width=True,
    )

    mo.vstack([
        mo.md("### Run Batch Test"),
        glm_prompt,
        run_batch,
    ])
    return glm_prompt, run_batch


@app.cell
def _(
    DEFAULT_GLM_KYC_PROMPT,
    Image,
    Path,
    batch_selector,
    glm_ocr_extract,
    glm_prompt,
    ground_truth,
    io,
    mo,
    paddle_ocr_pipeline,
    run_batch,
):
    """Execute batch OCR and collect results."""
    batch_results = []

    if run_batch.value and batch_selector.value:
        for _img_path_str in batch_selector.value:
            _img_path = Path(_img_path_str)
            _img_name = _img_path.name
            _img_bytes = _img_path.read_bytes()
            _pil_img = Image.open(io.BytesIO(_img_bytes)).convert("RGB")

            _result_entry = {"image": _img_name, "paddleocr": None, "glm_ocr": None}

            # PaddleOCR
            try:
                _p_result = paddle_ocr_pipeline(_pil_img)
                if "extraction" in _p_result:
                    _ext = _p_result["extraction"]
                    _result_entry["paddleocr"] = {}
                    for _pkey in CNI_FIELDS:
                        _pfield = _ext.get(_pkey, {})
                        if isinstance(_pfield, dict):
                            _result_entry["paddleocr"][_pkey] = {
                                "value": _pfield.get("value"),
                                "confidence": _pfield.get("conf", 0.0),
                            }
                    _result_entry["paddleocr"]["method"] = _ext.get("methode", "")
                    _result_entry["paddleocr"]["blocks_count"] = len(_p_result.get("blocks", []))
            except Exception as _e:
                _result_entry["paddleocr"] = {"error": str(_e)}

            # GLM-OCR
            try:
                _g_result = glm_ocr_extract(_img_bytes, prompt=glm_prompt.value.strip() or DEFAULT_GLM_KYC_PROMPT)
                if _g_result.get("success"):
                    _g_parsed = _g_result.get("parsed_fields", {})
                    if _g_parsed and any(v is not None for v in _g_parsed.values()):
                        _result_entry["glm_ocr"] = {}
                        for _gkey in CNI_FIELDS:
                            _result_entry["glm_ocr"][_gkey] = {
                                "value": _g_parsed.get(_gkey),
                                "confidence": None,
                            }
                    else:
                        _g_raw = _g_result.get("raw_text", "")
                        _result_entry["glm_ocr"] = {"raw": _g_raw[:200], "parsed": False}
                else:
                    _result_entry["glm_ocr"] = {"error": _g_result.get("error", "unknown")}
            except Exception as _e:
                _result_entry["glm_ocr"] = {"error": str(_e)}

            # Ground truth comparison
            if _img_name in ground_truth:
                _gt = ground_truth[_img_name]
                _result_entry["ground_truth"] = _gt
                _result_entry["paddleocr_match"] = {}
                _result_entry["glm_ocr_match"] = {}

                for _gtkey in CNI_FIELDS:
                    _gt_val = str(_gt.get(_gtkey, "")).upper().strip()
                    _p_v = str(
                        _result_entry.get("paddleocr", {}).get(_gtkey, {}).get("value", "") or ""
                    ).upper().strip()
                    _g_v = str(
                        _result_entry.get("glm_ocr", {}).get(_gtkey, {}).get("value", "") or ""
                    ).upper().strip()
                    _result_entry["paddleocr_match"][_gtkey] = _p_v == _gt_val
                    _result_entry["glm_ocr_match"][_gtkey] = _g_v == _gt_val

            batch_results.append(_result_entry)

    _batch_output = (
        mo.md(f"✅ Processed **{len(batch_results)}** image(s)")
        if batch_results
        else mo.md("*Select images and click 'Run Batch OCR Test' to see results.*")
    )
    _batch_output
    return (batch_results,)


@app.cell
def _(batch_results, mo):
    """Display results table."""
    _table_output = mo.md("")

    if batch_results:
        _table_rows = []
        for _r in batch_results:
            _img = _r["image"]

            def _get_val(engine, key, r=_r):
                _d = r.get(engine, {})
                if not isinstance(_d, dict) or not _d:
                    return "—"
                _f = _d.get(key, {})
                if isinstance(_f, dict):
                    return _f.get("value", "—") or "—"
                return "—"

            _p_nom = _get_val("paddleocr", "nom")
            _p_pre = _get_val("paddleocr", "prenom")
            _p_cni = _get_val("paddleocr", "numero_cni")
            _p_pere = _get_val("paddleocr", "pere")
            _p_mere = _get_val("paddleocr", "mere")
            
            _g_nom = _get_val("glm_ocr", "nom")
            _g_pre = _get_val("glm_ocr", "prenom")
            _g_cni = _get_val("glm_ocr", "numero_cni")
            _g_pere = _get_val("glm_ocr", "pere")
            _g_mere = _get_val("glm_ocr", "mere")

            _p_nom_ok = "✅" if _r.get("paddleocr_match", {}).get("nom") else ("❌" if "paddleocr_match" in _r else "")
            _p_pre_ok = "✅" if _r.get("paddleocr_match", {}).get("prenom") else ("❌" if "paddleocr_match" in _r else "")
            _g_nom_ok = "✅" if _r.get("glm_ocr_match", {}).get("nom") else ("❌" if "glm_ocr_match" in _r else "")

            _table_rows.append(
                f"| `{_img}` | {_p_nom} {_p_nom_ok} | {_p_pre} {_p_pre_ok} | {_p_cni} | {_p_pere} | {_p_mere} | "
                f"{_g_nom} {_g_nom_ok} | {_g_pre} | {_g_cni} | {_g_pere} | {_g_mere} |"
            )

        _table_output = mo.md(
            "### 📋 Batch Results\n\n"
            "| Image | P‑Nom | P‑Prénom | P‑CNI | P-Père | P-Mère | G‑Nom | G‑Prénom | G‑CNI | G-Père | G-Mère |\n"
            "|-------|-------|---------|-------|--------|--------|-------|---------|-------|--------|--------|\n"
            + "\n".join(_table_rows)
        )

    _table_output
    return


@app.cell
def _(batch_results, mo):
    """Confidence distribution analysis."""
    _conf_output = mo.md("")

    if batch_results:
        _confidences = []
        for _r in batch_results:
            _p = _r.get("paddleocr", {})
            if isinstance(_p, dict):
                for _ckey in CNI_FIELDS:
                    _cfield = _p.get(_ckey, {})
                    if isinstance(_cfield, dict) and _cfield.get("confidence") is not None:
                        _confidences.append({"field": _ckey, "confidence": _cfield["confidence"], "image": _r["image"]})

        if _confidences:
            _all_confs = [c["confidence"] for c in _confidences]
            _mean_conf = sum(_all_confs) / len(_all_confs)

            _bins = {"0.0-0.4": 0, "0.4-0.6": 0, "0.6-0.85": 0, "0.85-1.0": 0}
            for _c in _all_confs:
                if _c < 0.4:
                    _bins["0.0-0.4"] += 1
                elif _c < 0.6:
                    _bins["0.4-0.6"] += 1
                elif _c < 0.85:
                    _bins["0.6-0.85"] += 1
                else:
                    _bins["0.85-1.0"] += 1

            _bar_chart = "\n".join(
                f"`{_rng}`: {'█' * int(_cnt / max(_bins.values()) * 30)} ({_cnt})"
                for _rng, _cnt in _bins.items()
            )

            _field_avgs = {}
            for _fname in CNI_FIELDS:
                _field_confs = [c["confidence"] for c in _confidences if c["field"] == _fname]
                if _field_confs:
                    _field_avgs[_fname] = sum(_field_confs) / len(_field_confs)

            _field_md = "\n".join(f"- **{_k}**: {_v:.2f}" for _k, _v in _field_avgs.items())

            _conf_output = mo.md(
                f"### 📈 Confidence Analysis\n\n"
                f"**Overall mean:** {_mean_conf:.2f} ({len(_all_confs)} fields)\n\n"
                f"#### Distribution\n{_bar_chart}\n\n"
                f"#### Per-Field Average\n{_field_md}"
            )
        else:
            _conf_output = mo.md("No confidence data available from PaddleOCR results.")

    _conf_output
    return


@app.cell
def _(batch_results, mo):
    """Accuracy summary when ground truth is available."""
    _acc_output = mo.md("*Provide ground truth JSON above to see accuracy metrics.*")

    _has_gt = any("ground_truth" in _r for _r in batch_results)

    if _has_gt:
        _paddle_correct = {f: 0 for f in CNI_FIELDS}
        _glm_correct = {f: 0 for f in CNI_FIELDS}
        _total_gt = 0

        for _r in batch_results:
            if "ground_truth" not in _r:
                continue
            _total_gt += 1
            for _akey in CNI_FIELDS:
                if _r.get("paddleocr_match", {}).get(_akey):
                    _paddle_correct[_akey] += 1
                if _r.get("glm_ocr_match", {}).get(_akey):
                    _glm_correct[_akey] += 1

        if _total_gt > 0:
            _p_rows = "\n".join(f"| {_k} | {_v}/{_total_gt} | {_v/_total_gt*100:.0f}%" for _k, _v in _paddle_correct.items())
            _g_rows = "\n".join(f"| {_k} | {_v}/{_total_gt} | {_v/_total_gt*100:.0f}%" for _k, _v in _glm_correct.items())

            _p_total = sum(_paddle_correct.values())
            _g_total = sum(_glm_correct.values())
            _p_fields = len(_paddle_correct) * _total_gt
            _g_fields = len(_glm_correct) * _total_gt

            _acc_output = mo.md(
                f"### 🎯 Accuracy vs Ground Truth\n\n"
                f"**Tested on {_total_gt} image(s)**\n\n"
                f"#### PaddleOCR\n"
                f"| Field | Correct | Accuracy |\n|-------|---------|----------|\n{_p_rows}\n\n"
                f"**Overall:** {_p_total}/{_p_fields} = {_p_total/_p_fields*100:.0f}%\n\n"
                f"#### GLM-OCR\n"
                f"| Field | Correct | Accuracy |\n|-------|---------|----------|\n{_g_rows}\n\n"
                f"**Overall:** {_g_total}/{_g_fields} = {_g_total/_g_fields*100:.0f}%"
            )

    _acc_output
    return


if __name__ == "__main__":
    app.run()
