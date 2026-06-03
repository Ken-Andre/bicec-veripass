#!/usr/bin/env python3
"""
Build a printable PDF from the master C4 document.

Pipeline:
  1. Read the master markdown.
  2. Replace each ```mermaid block with an <img> referencing the matching SVG.
  3. Run pandoc (master.md -> master.html) with the rendering-pipeline
     output (cover, ToC, headers, page breaks, etc.).
  4. Print the HTML to PDF via chrome-headless-shell --headless --print-to-pdf.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
MASTER = PROJECT_DIR / "BICEC-VERIPASS-VUE-ENSEMBLE.md"
OUT_DIR = PROJECT_DIR / "c4-architecture"
SVG_DIR = OUT_DIR / "diagrams"
HTML_OUT = OUT_DIR / "BICEC-VERIPASS-VUE-ENSEMBLE.html"
PDF_OUT = OUT_DIR / "BICEC-VERIPASS-VUE-ENSEMBLE.pdf"


def _resolve_chrome() -> Path:
    """Locate a chrome-headless-shell binary, cross-platform.

    Search order:
      1. $VERIPASS_CHROME env var (explicit override).
      2. The puppeteer cache for the current OS.
      3. Well-known Linux locations as a fallback.
    """
    override = os.environ.get("VERIPASS_CHROME")
    if override:
        p = Path(override)
        if p.exists():
            return p

    if os.name == "nt":
        # Windows: %USERPROFILE%\.cache\puppeteer\...
        profile = os.environ.get("USERPROFILE", str(Path.home()))
        candidates = [
            Path(profile)
            / ".cache/puppeteer/chrome-headless-shell/win64-149.0.7827.22/"
            "chrome-headless-shell-win64/chrome-headless-shell.exe",
            Path(profile)
            / ".cache/puppeteer/chrome-headless-shell/win64-148.0.7778.97/"
            "chrome-headless-shell-win64/chrome-headless-shell.exe",
        ]
    else:
        # Linux/WSL: puppeteer cache lives at $HOME/.cache/puppeteer/...
        home = Path(os.environ.get("HOME", str(Path.home())))
        # WSL also exposes the Windows puppeteer cache at /mnt/c/Users/<user>/...
        win_home = (
            Path("/mnt/c/Users") / os.environ.get("USER", "yoann")
            if os.environ.get("USER") else None
        )
        candidates = []
        if win_home is not None:
            candidates += [
                win_home
                / ".cache/puppeteer/chrome-headless-shell/win64-149.0.7827.22/"
                "chrome-headless-shell-win64/chrome-headless-shell.exe",
                win_home
                / ".cache/puppeteer/chrome-headless-shell/win64-148.0.7778.97/"
                "chrome-headless-shell-win64/chrome-headless-shell.exe",
            ]
        candidates += [
            home
            / ".cache/puppeteer/chrome-headless-shell/linux64-149.0.7827.22/"
            "chrome-headless-shell-linux64/chrome-headless-shell",
            Path("/usr/bin/google-chrome"),
            Path("/usr/bin/chromium-browser"),
            Path("/usr/bin/chromium"),
        ]

    for c in candidates:
        if c.exists():
            return c

    searched = "\n  ".join(str(c) for c in candidates)
    raise FileNotFoundError(
        "chrome-headless-shell not found. Tried:\n  " + searched
        + "\nSet $VERIPASS_CHROME to override."
    )


CHROME = _resolve_chrome()


def resolve_svg_for_index(idx: int) -> Path | None:
    """Map 1-based mermaid-block index to a rendered SVG file in diagrams/."""
    candidates = sorted(SVG_DIR.glob("c4-*-*.svg"))
    if 1 <= idx <= len(candidates):
        return candidates[idx - 1]
    return None


def inject_svgs(md_text: str) -> str:
    """Replace ```mermaid blocks with inline SVG content (data URI).

    We inline the SVG to avoid the renderer (chrome/weasyprint) trying to
    fetch a file:// URL that pandoc already touched, which fails on paths
    containing URL-encoded characters (e.g. ``séquence`` -> ``s%C3%A9quence``).
    """
    import base64

    pattern = re.compile(r"```mermaid\r?\n(.*?)\r?\n```", re.DOTALL)
    counter = {"i": 0}

    def repl(_m: re.Match[str]) -> str:
        counter["i"] += 1
        svg = resolve_svg_for_index(counter["i"])
        if svg is None:
            return f"\n*[Diagramme {counter['i']} non rendu]*\n"
        try:
            raw = svg.read_bytes()
        except OSError as e:
            return f"\n*[Diagramme {counter['i']} illisible: {e}]*\n"
        b64 = base64.b64encode(raw).decode("ascii")
        data_uri = f"data:image/svg+xml;base64,{b64}"
        return (
            f"\n"
            f"**Figure {counter['i']} — {svg.stem}**\n\n"
            f'<img src="{data_uri}" alt="{svg.stem}" '
            f'style="display:block;margin:1.5em auto;max-width:100%;height:auto;" />\n\n'
            f"<div style=\"page-break-after: always;\"></div>\n"
        )

    return pattern.sub(repl, md_text)


def run_pandoc(md_path: Path, html_path: Path) -> None:
    cmd = [
        "pandoc",
        str(md_path),
        "-f", "markdown+yaml_metadata_block+pipe_tables+task_lists",
        "-t", "html5",
        "-s",                       # standalone (with <head>, <body>, etc.)
        "--toc",
        "--toc-depth=3",
        "--resource-path", str(PROJECT_DIR),  # so ./Bicec_logo.jpg resolves
        "-V", "lang=fr",
        "--metadata", "title=BICEC VeriPass — Vue d'ensemble",
        "-V", "author=Stage Xp-X5",
        "-V", "geometry:margin=2.2cm",
        "-V", "mainfont=DejaVu Sans",
        "-V", "monofont=DejaVu Sans Mono",
        "-V", "colorlinks=true",
        "-V", "linkcolor=NavyBlue",
        "-V", "urlcolor=NavyBlue",
        "-V", "toccolor=NavyBlue",
        "--css=data:text/css,body{font-size:11pt;line-height:1.45}",
        "--embed-resources",         # inline images
        "-o", str(html_path),
    ]
    print(">>> pandoc ->", " ".join(cmd[:6]), "...")
    res = subprocess.run(cmd, check=False)
    if res.returncode != 0:
        sys.exit(res.returncode)


def _is_wsl() -> bool:
    return (
        os.name != "nt"
        and Path("/proc/version").exists()
        and "microsoft" in Path("/proc/version").read_text(errors="ignore").lower()
    )


def run_chrome(html_path: Path, pdf_path: Path) -> None:
    if not CHROME.exists():
        sys.exit(f"chrome-headless-shell not found at {CHROME}")
    # Under WSL, the snap-installed chromium-browser has known bugs with
    # --print-to-pdf (it can't write the output file in some configs).
    # When we detect that the user is on WSL with chromium-browser AND
    # weasyprint is available, we fall back to weasyprint (which uses
    # native Linux libraries and just works).
    if _is_wsl() and "chromium-browser" in str(CHROME):
        try:
            import weasyprint  # type: ignore

            print(">>> weasyprint (WSL fallback for chromium-browser PDF)")
            weasyprint.HTML(filename=str(html_path)).write_pdf(str(pdf_path))
            return
        except ImportError:
            print(
                "    (info) weasyprint not available; falling back to "
                "chromium-browser --print-to-pdf."
            )
    # When run from WSL bash, --print-to-pdf=<abs-path> is sometimes rejected
    # by the chrome-headless-shell wrapper ("The system cannot find the path
    # specified"). The workaround is to pass a relative filename and let
    # chrome write into its CWD, then move the file to the expected location.
    use_rel = _is_wsl()
    if use_rel:
        rel = pdf_path.name
        cmd = [
            str(CHROME),
            "--headless=new",
            "--no-sandbox",
            "--disable-gpu",
            "--no-pdf-header-footer",
            "--print-to-pdf-no-header",
            f"--print-to-pdf={rel}",
            f"file:///{html_path.as_posix().lstrip('/')}",
        ]
        print(f">>> chrome --print-to-pdf ({CHROME.name}) -> {rel}")
        res = subprocess.run(cmd, check=False, cwd=str(pdf_path.parent))
        produced = pdf_path.parent / rel
        if produced != pdf_path:
            if pdf_path.exists():
                pdf_path.unlink()
            produced.rename(pdf_path)
    else:
        cmd = [
            str(CHROME),
            "--headless=new",
            "--no-sandbox",
            "--disable-gpu",
            "--no-pdf-header-footer",
            "--print-to-pdf-no-header",
            f"--print-to-pdf={pdf_path}",
            f"file:///{html_path.as_posix().lstrip('/')}",
        ]
        print(f">>> chrome --print-to-pdf ({CHROME.name})")
        res = subprocess.run(cmd, check=False)

    if res.returncode != 0:
        sys.exit(f"chrome exited with {res.returncode}")


def main() -> None:
    if not MASTER.exists():
        sys.exit(f"Master document not found: {MASTER}")
    if not SVG_DIR.exists():
        sys.exit(f"SVG directory not found: {SVG_DIR} (run render.ps1 first)")

    # 1. Read master, swap mermaid for <img>.
    md = MASTER.read_text(encoding="utf-8")
    rendered_md = inject_svgs(md)

    # When running under WSL with /mnt/c paths, chrome-headless-shell can
    # sometimes fail to write the PDF to a Windows-side path. We work around
    # that by writing the intermediate files to a tmp dir on the native
    # filesystem and copying them back at the end.
    is_wsl = _is_wsl()
    if is_wsl:
        import tempfile
        import shutil

        tmp_root = Path(tempfile.mkdtemp(prefix="veripass-pdf-"))
        tmp_md = tmp_root / "_printable.md"
        tmp_html = tmp_root / HTML_OUT.name
        tmp_pdf = tmp_root / PDF_OUT.name
    else:
        tmp_root = None
        tmp_md = OUT_DIR / "_printable.md"
        tmp_html = HTML_OUT
        tmp_pdf = PDF_OUT

    tmp_md.write_text(rendered_md, encoding="utf-8")
    print(f"[print_pdf] wrote {tmp_md.name} ({len(rendered_md):,} chars)")

    # 2. Pandoc: MD -> HTML.
    run_pandoc(tmp_md, tmp_html)
    print(f"[print_pdf] wrote {tmp_html.name} ({tmp_html.stat().st_size:,} B)")

    # 3. Chrome: HTML -> PDF.
    run_chrome(tmp_html, tmp_pdf)
    print(f"[print_pdf] wrote {tmp_pdf.name} ({tmp_pdf.stat().st_size:,} B)")

    # 4. Copy PDF + HTML back to the project dir.
    if tmp_root is not None:
        if PDF_OUT.exists():
            PDF_OUT.unlink()
        shutil.copy2(tmp_pdf, PDF_OUT)
        if HTML_OUT.exists():
            HTML_OUT.unlink()
        shutil.copy2(tmp_html, HTML_OUT)
        shutil.rmtree(tmp_root, ignore_errors=True)
        print(f"[print_pdf] copied outputs to {OUT_DIR}")

    # 5. Cleanup intermediate.
    if (OUT_DIR / "_printable.md").exists():
        try:
            (OUT_DIR / "_printable.md").unlink()
        except OSError:
            pass


if __name__ == "__main__":
    main()
