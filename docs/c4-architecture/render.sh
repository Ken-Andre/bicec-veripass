#!/usr/bin/env bash
# Render Mermaid diagrams from the master document to SVG/PNG (and optional PDF).
#
# Usage:
#   ./render.sh            # SVG + PNG
#   ./render.sh --pdf      # SVG + PNG + PDF
#   ./render.sh --clean    # remove generated SVGs, PNGs and PDF
#
# Pre-requisites:
#   - Node.js 18+
#   - npm i -g @mermaid-js/mermaid-cli   (binary: mmdc)
#   - For --pdf: pandoc + lualatex/tectonic (or weasyprint)
#
# Inputs:
#   ../BICEC-VERIPASS-VUE-ENSEMBLE.md
#
# Outputs:
#   diagrams/c4-*.svg                      (one SVG per Mermaid block)
#   diagrams/c4-*.png                      (one Word-friendly PNG per Mermaid block)
#   mermaid/c4-*.mmd                       (extracted Mermaid sources)
#   BICEC-VERIPASS-VUE-ENSEMBLE.pdf        (only with --pdf)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Absolute paths (so helpers can cd into subdirs without breaking the refs).
MASTER="$(cd .. && pwd)/BICEC-VERIPASS-VUE-ENSEMBLE.md"
OUT_DIR="$SCRIPT_DIR/diagrams"
SRC_DIR="$SCRIPT_DIR/mermaid"
CONFIG="$SCRIPT_DIR/mermaid-elk.config.json"
PDF="$SCRIPT_DIR/BICEC-VERIPASS-VUE-ENSEMBLE.pdf"

# --- helpers ----------------------------------------------------------------

die() { echo "ERROR: $*" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

log()  { echo "[render.sh] $*"; }

clean() {
    log "Cleaning generated artifacts..."
    rm -rf "$OUT_DIR" "$SRC_DIR" "$PDF"
    log "Done."
}

extract_mermaid() {
    log "Extracting Mermaid blocks from $MASTER..."
    mkdir -p "$SRC_DIR"

    # Extract fenced mermaid blocks into numbered .mmd files.
    # Naming will be assigned semantically below.
    awk '
        BEGIN { in_block=0; idx=0 }
        /^```mermaid/ {
            in_block=1
            idx++
            outfile = sprintf("mermaid/_tmp_%03d.mmd", idx)
            current_out = outfile
            next
        }
        /^```$/ {
            if (in_block) {
                in_block=0
                current_out = ""
                next
            }
        }
        {
            if (in_block && current_out != "") {
                print > current_out
            }
        }
    ' "$MASTER"

    # Rename _tmp_*.mmd to semantic names via the shared Python script.
    # rename_mermaid.py uses CWD ("."), so we must run it from $SRC_DIR.
    if have python3 || have python; then
        local py
        if have python3; then py=python3; else py=python; fi
        log "Renaming extracted files with semantic names..."
        if ! (cd "$SRC_DIR" && VERIPASS_MASTER="$MASTER" "$py" ../rename_mermaid.py); then
            log "(warning) rename_mermaid.py failed; files will keep _tmp_ names."
        fi
        # Normalize sources for mmdc (Mermaid 11 is strict about edge labels
        # containing parens, brackets, /*, Unicode, etc.).
        log "Normalizing sources for mmdc..."
        (cd "$SRC_DIR" && "$py" ../normalize_mermaid.py) >/dev/null || \
            log "(warning) normalize_mermaid.py failed."
    else
        log "python3 not found; leaving _tmp_*.mmd names as-is."
    fi
}

render_diagrams() {
    if ! have mmdc; then
        die "mmdc (mermaid-cli) is not installed. Install with: npm i -g @mermaid-js/mermaid-cli"
    fi
    if [[ ! -f "$CONFIG" ]]; then
        die "Mermaid config not found at $CONFIG"
    fi
    log "Rendering SVG and PNG files via mmdc..."
    mkdir -p "$OUT_DIR"
    shopt -s nullglob
    for src in "$SRC_DIR"/*.mmd; do
        base="$(basename "$src" .mmd)"
        svg_out="$OUT_DIR/$base.svg"
        png_out="$OUT_DIR/$base.png"
        log "  - $base"
        mmdc -i "$src" -o "$svg_out" \
             -c "$CONFIG" \
             -t default \
             -b transparent \
             --quiet 2>/dev/null \
             || log "    (warning) mmdc SVG failed for $base"
        mmdc -i "$src" -o "$png_out" \
             -c "$CONFIG" \
             -t default \
             -b white \
             -w 2400 \
             -H 1600 \
             -s 2 \
             --quiet 2>/dev/null \
             || log "    (warning) mmdc PNG failed for $base"
    done
    log "Diagram rendering complete: $OUT_DIR/"
}

render_pdf() {
    if ! have pandoc; then
        die "pandoc is not installed. Install pandoc to render the PDF."
    fi
    if ! have python3 && ! have python; then
        die "python3 or python is required for the PDF build (print_pdf.py)."
    fi
    log "Rendering PDF via pandoc + chrome-headless-shell..."
    local py
    if have python3; then py=python3; else py=python; fi
    ( cd "$SCRIPT_DIR" && "$py" print_pdf.py ) \
        || die "print_pdf.py exited non-zero"
    log "PDF rendered: $PDF"
}

# --- main -------------------------------------------------------------------

case "${1:-}" in
    --clean) clean ;;
    --pdf)
        extract_mermaid
        render_diagrams
        render_pdf
        ;;
    "")
        extract_mermaid
        render_diagrams
        ;;
    *)
        echo "Usage: $0 [--pdf] [--clean]" >&2
        exit 1
        ;;
esac

log "Done."
