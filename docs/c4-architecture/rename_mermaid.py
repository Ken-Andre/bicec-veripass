#!/usr/bin/env python3
"""
Rename extracted _tmp_*.mmd files with semantic names (c4-{chapter}-{n}-{slug}.mmd).

Reads the master markdown path from the VERIPASS_MASTER environment variable,
then for each extracted .mmd file in the current directory, derives a chapter
number, sequence number, and slug from the **immediately preceding** heading
in the master document (i.e. the last `##+ ` heading line that appears before
the mermaid opening fence, with no other `##+ ` heading in between).
"""

import os
import re
import sys


# Match a heading of any level (## to ######) on its own line. We capture
# everything from that heading line up to (but not including) the next
# ` ```mermaid ` opening fence, with the constraint that NO other `##+ `
# heading appears in between. This guarantees the heading we capture is
# the IMMEDIATELY preceding one, not some earlier heading from a few
# sections above.
_HEADING_RE = re.compile(
    r"^(#{2,6})[ \t]+([^\n]*?)\n"  # heading line
    r"(?:(?!^#{2,6}[ \t]+).*\n)*?"  # any other lines, no new heading
    r"```mermaid\n",                 # until the mermaid opening
    re.MULTILINE,
)


def main() -> int:
    master = os.environ.get("VERIPASS_MASTER", "")
    if not master or not os.path.isfile(master):
        sys.stderr.write("master file not found: %s\n" % master)
        return 1

    with open(master, "r", encoding="utf-8") as f:
        text = f.read()

    # Find (heading_text, heading_line, mermaid_start_offset) for each block.
    blocks = []
    for m in _HEADING_RE.finditer(text):
        heading_text = m.group(2).strip()
        blocks.append((heading_text, m.start(2)))

    tmp_files = sorted(
        f for f in os.listdir(".") if f.startswith("_tmp_") and f.endswith(".mmd")
    )

    renamed_count = 0
    leftover = []
    for i, (heading_text, _) in enumerate(blocks):
        if i >= len(tmp_files):
            leftover.extend(tmp_files[i:])
            break
        tmp = tmp_files[i]

        num_match = re.search(r"(\d+)(?:\.(\d+))?(?:\.(\d+))?", heading_text)
        if num_match:
            chap = num_match.group(1)
            n = num_match.group(2) or "1"
        else:
            chap, n = "0", str(i + 1)

        # Slug: first ASCII letter word in the heading.
        slug_match = re.search(r"\b([A-Za-z][\w-]*)\b", heading_text)
        slug = slug_match.group(1).lower() if slug_match else ("fig%d" % (i + 1))

        new_name = "c4-%s-%s-%s.mmd" % (chap, n, slug)
        if os.path.exists(new_name):
            os.remove(tmp)
        else:
            os.rename(tmp, new_name)
            renamed_count += 1

    # Remove any _tmp_ files that weren't matched (extra extractions).
    for f in leftover:
        if os.path.exists(f):
            os.remove(f)

    # Defensive cleanup of any remaining _tmp_*.mmd files.
    for f in os.listdir("."):
        if f.startswith("_tmp_") and f.endswith(".mmd"):
            os.remove(f)

    return 0


if __name__ == "__main__":
    sys.exit(main())
