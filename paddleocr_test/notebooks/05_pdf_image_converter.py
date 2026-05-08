"""
PDF to Image Converter
======================
Upload a PDF and extract pages as images, or merge multiple images into a single PDF.
"""

import marimo

__generated_with = "0.23.1"
app = marimo.App()


@app.cell
def _():
    """Imports and setup."""
    import marimo as mo
    import io
    import os
    import re
    import zipfile
    from pathlib import Path
    from PIL import Image

    try:
        import fitz
        HAVE_FITZ = True
    except ImportError:
        HAVE_FITZ = False
        fitz = None

    _notebook_dir = Path(globals().get("__file__", ".")).resolve().parent
    default_out = _notebook_dir / "output"
    return HAVE_FITZ, Image, Path, default_out, fitz, io, mo, os, re, zipfile


@app.cell
def _(HAVE_FITZ, mo):
    """PyMuPDF status check."""
    if not HAVE_FITZ:
        _status = mo.vstack([
            mo.md(
                "## PyMuPDF is required\n\n"
                "Run `%pip install pymupdf` then restart the kernel."
            ),
        ])
    else:
        _status = mo.md("All dependencies available.")
    _status
    return


@app.cell
def _(mo):
    """Mode selector and header."""
    mode = mo.ui.radio(
        options=["PDF to Images", "Images to PDF"],
        value="PDF to Images",
        label="Choose direction",
    )

    mo.vstack([
        mo.md(
            "# PDF to Image Converter\n\n"
            "Extract pages from a PDF as individual images, "
            "or merge multiple images into a single PDF."
        ),
        mode,
    ])
    return


@app.cell
def _(mo):
    """PDF file upload."""
    pdf_file = mo.ui.file(
        filetypes=[".pdf"],
        label="Upload a PDF file",
        multiple=False,
    )

    mo.vstack([
        mo.md("## PDF to Images"),
        pdf_file,
    ])
    return (pdf_file,)


@app.cell
def _(Image, fitz, io, mo, pdf_file):
    """Render PDF pages as image previews."""
    pdf_previews = []
    pdf_page_count = 0

    if pdf_file.value and len(pdf_file.value) > 0:
        pdf_bytes = pdf_file.value[0].contents
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pdf_page_count = len(doc)

        for i in range(pdf_page_count):
            page = doc.load_page(i)
            pix = page.get_pixmap(dpi=120)
            pil_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            preview_buf = io.BytesIO()
            pil_img.save(preview_buf, format="PNG")
            pdf_previews.append({
                "page": i + 1,
                "image": pil_img,
                "preview_bytes": preview_buf.getvalue(),
            })
        doc.close()

    if pdf_previews:
        pdf_gallery = mo.hstack(
            [
                mo.vstack([
                    mo.image(src=p["preview_bytes"], width=200),
                    mo.md(f"**Page {p['page']}**"),
                ])
                for p in pdf_previews
            ],
            wrap=True,
        )
        mo.vstack([
            mo.md(f"**{pdf_page_count} page(s)**"),
            pdf_gallery,
        ])
    return (pdf_previews,)


@app.cell
def _(mo):
    """Export controls — widgets only, no value access."""
    pattern_input = mo.ui.text(
        value="page_{page:03d}",
        label='Naming pattern (use `{page}` placeholder)',
    )
    fmt_choice = mo.ui.dropdown(
        options=["PNG", "JPEG", "WebP"],
        value="PNG",
        label="Image format",
    )
    quality_slider = mo.ui.slider(
        start=1, stop=100, step=1, value=90,
        label="Quality (JPEG/WebP only)",
    )
    output_mode = mo.ui.radio(
        options=["Download as ZIP", "Save to folder"],
        value="Download as ZIP",
        label="Output mode",
    )
    folder_path = mo.ui.text(
        value="pdf_pages",
        label="Folder path (for Save to folder mode)",
    )
    export_btn = mo.ui.run_button(label="Export")

    mo.vstack([
        mo.md("### Save Pages as Images"),
        pattern_input,
        mo.hstack([fmt_choice, quality_slider]),
        output_mode,
        folder_path,
        export_btn,
    ])
    return (
        export_btn,
        fmt_choice,
        folder_path,
        output_mode,
        pattern_input,
        quality_slider,
    )


@app.cell
def _(
    Path,
    default_out,
    export_btn,
    fmt_choice,
    folder_path,
    io,
    mo,
    os,
    output_mode,
    pattern_input,
    pdf_previews,
    quality_slider,
    re,
    zipfile,
):
    """Export action — ZIP download or save to folder."""
    zip_download = None
    saved_files = None

    if export_btn.value and pdf_previews:
        fmt = fmt_choice.value.lower()
        pages_output = []

        for p in pdf_previews:
            page_num = p["page"]
            raw_pattern = pattern_input.value

            def _replace_page(m):
                spec = m.group(2) or ""
                return format(page_num, spec) if spec else str(page_num)

            fname = re.sub(r"\{(\w+)(?::([^}]*))?\}", _replace_page, raw_pattern)
            if fname == raw_pattern:
                fname = f"{fname}_{page_num:03d}"
            fname = f"{fname}.{fmt}"

            export_img = p["image"]
            if fmt != "png":
                export_img = export_img.convert("RGB")

            img_buf = io.BytesIO()
            save_kwargs = {"quality": quality_slider.value} if fmt in ("jpeg", "webp") else {}
            export_img.save(img_buf, format=fmt.upper(), **save_kwargs)
            pages_output.append({"filename": fname, "data": img_buf.getvalue()})

        if output_mode.value == "Download as ZIP":
            zip_buf = io.BytesIO()
            with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
                for po in pages_output:
                    zf.writestr(po["filename"], po["data"])
            zip_buf.seek(0)
            zip_download = mo.download(
                data=zip_buf.getvalue(),
                filename="pdf_pages.zip",
                mimetype="application/zip",
                label="Download ZIP",
            )
        else:
            out_path = Path(folder_path.value or "pdf_pages")
            if not out_path.is_absolute():
                out_path = default_out / out_path
            os.makedirs(out_path, exist_ok=True)
            written = []
            for po in pages_output:
                fp = out_path / po["filename"]
                with open(fp, "wb") as out_file:
                    out_file.write(po["data"])
                written.append(str(fp.resolve()))
            saved_files = mo.md(
                "Saved " + str(len(written)) + " file(s) to:\n" +
                "\n".join("  - `" + w + "`" for w in written)
            )

    zip_download or saved_files or mo.md("")
    return


@app.cell
def _(mo):
    """Image files upload."""
    image_files = mo.ui.file(
        filetypes=[".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"],
        label="Upload images (order will be preserved)",
        multiple=True,
    )

    mo.vstack([
        mo.md("## Images to PDF"),
        mo.md("Upload multiple images to merge into a single PDF."),
        image_files,
    ])
    return (image_files,)


@app.cell
def _(Image, image_files, io, mo):
    """Preview uploaded images."""
    uploaded_images = []

    if image_files.value:
        for f in image_files.value:
            img_data = Image.open(io.BytesIO(f.contents))
            uploaded_images.append({
                "name": f.name,
                "image": img_data,
            })

    if uploaded_images:
        thumb_items = []
        for item in uploaded_images:
            thumb = item["image"].copy()
            thumb.thumbnail((200, 200))
            thumb_buf = io.BytesIO()
            thumb.save(thumb_buf, format="PNG")
            thumb_items.append(
                mo.vstack([
                    mo.image(src=thumb_buf.getvalue(), width=200),
                    mo.md(f"**{item['name']}**"),
                ])
            )

        thumb_gallery = mo.hstack(thumb_items, wrap=True)
        mo.vstack([
            mo.md(f"**{len(uploaded_images)} image(s)**"),
            thumb_gallery,
        ])
    return (uploaded_images,)


@app.cell
def _(mo):
    """Merge PDF controls — widgets only, no value access."""
    pdf_name = mo.ui.text(
        value="merged_output",
        label="Output PDF name (without extension)",
    )
    merge_btn = mo.ui.run_button(label="Merge to PDF")

    mo.vstack([
        mo.md("### Merge to PDF"),
        pdf_name,
        merge_btn,
    ])
    return merge_btn, pdf_name


@app.cell
def _(io, merge_btn, mo, pdf_name, uploaded_images):
    """Merge action — triggered by merge button."""
    pdf_download = None

    if merge_btn.value and uploaded_images:
        merge_images_rgb = [item["image"].convert("RGB") for item in uploaded_images]
        merge_pdf_buf = io.BytesIO()
        merge_images_rgb[0].save(
            merge_pdf_buf,
            format="PDF",
            save_all=True,
            append_images=merge_images_rgb[1:],
        )
        merge_pdf_buf.seek(0)
        pdf_download = mo.download(
            data=merge_pdf_buf.getvalue(),
            filename=f"{pdf_name.value or 'merged_output'}.pdf",
            mimetype="application/pdf",
            label="Download PDF",
        )

    pdf_download or mo.md("")
    return


if __name__ == "__main__":
    app.run()
