"""
Pre-process Mermaid sources before mmdc rendering.

Mermaid 11 strict mode chokes on a few patterns we use liberally in the master
document. This script normalizes the .mmd files in the current directory so
that `mmdc -i file.mmd` can render them without syntax errors.

Transformations applied:
  1. Remove the `%%{init: ... }%%` directive (theme is passed via CLI).
  2. Replace `<br/>` with ` / ` inside edge labels (between `|...|`).
  3. Strip parentheses from edge labels (they confuse the parser in some
     cases when combined with `<br/>`).
  4. Replace `→` (rightwards arrow Unicode) with `->` in edge labels.
  5. Replace `★`, `⚠`, `❌`, `✅` (and other special Unicode bullets) with
     `[!]` / `[/]` / `[x]` / `[ok]` text.
  6. Strip the leading apostrophe/single-quote in label text like
     `Notification 'Validé'` -> `Notification Valide` (apostrophes in
     mermaid labels are sometimes misparsed).
  7. Strip leading single quotes from inside string brackets.
"""

import os
import re
import sys


EDGE_LABEL_RE = re.compile(r"\|([^|]*)\|")


def normalize_edge_label(label: str) -> str:
    # Replace <br/> with " / "
    label = label.replace("<br/>", " / ").replace("<br>", " / ")
    # Replace arrow characters
    label = label.replace("→", "->")
    # Replace common bullet/check icons with text
    label = label.replace("✅", "[ok]").replace("❌", "[x]")
    label = label.replace("⚠", "[!]").replace("★", "[*]")
    # Strip single quotes (apostrophes confuse parser)
    label = label.replace("'", "")
    # Replace Unicode ellipsis and em-dashes with ASCII
    label = label.replace("…", "...").replace("—", "-").replace("–", "-")
    # Replace parentheses and brackets with hyphens (curly/square brackets
    # confuse mermaid's lexer when used inside edge labels)
    label = label.replace("(", "-").replace(")", "-")
    label = label.replace("[", "-").replace("]", "-")
    label = label.replace("{", "-").replace("}", "-")
    # Escape forward-slash followed by `*` (mermaid lexer treats it as
    # a regex-style comment opener)
    label = label.replace("/*", "-ALL-")
    # Collapse multiple whitespace
    label = re.sub(r"\s+", " ", label).strip()
    return label


def transform_line(line: str) -> str:
    # 1. Remove %%{init...}%% directive
    line = re.sub(r"%%\{.*?\}%%\s*", "", line)

    # 2-6. Normalize edge labels
    def _repl(m: re.Match) -> str:
        return "|" + normalize_edge_label(m.group(1)) + "|"

    line = EDGE_LABEL_RE.sub(_repl, line)
    return line


def main() -> int:
    files = sorted(f for f in os.listdir(".") if f.endswith(".mmd"))
    for f in files:
        with open(f, "r", encoding="utf-8") as fh:
            content = fh.read()
        new_lines = [transform_line(l) for l in content.splitlines()]
        new_content = "\n".join(new_lines) + "\n"
        if new_content != content:
            with open(f, "w", encoding="utf-8") as fh:
                fh.write(new_content)
            print(f"normalized: {f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
