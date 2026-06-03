#!/usr/bin/env python3
"""
Rename extracted _tmp_*.mmd files with semantic names (c4-{chapter}-{n}-{slug}.mmd).

Reads the master markdown path from the VERIPASS_MASTER environment variable,
then for each extracted .mmd file in the current directory, derives a chapter
number, sequence number, and slug from the nearest preceding heading in the
master document.
"""

import os
import re
import sys


def main() -> int:
    master = os.environ.get("VERIPASS_MASTER", "")
    if not master or not os.path.isfile(master):
        sys.stderr.write("master file not found: %s\n" % master)
        return 1

    with open(master, "r", encoding="utf-8") as f:
        text = f.read()

    pattern = re.compile(
        r"(##+ .*?\n[\s\S]*?)(```mermaid\n)([\s\S]*?)\n```", re.MULTILINE
    )
    matches = list(pattern.finditer(text))

    tmp_files = sorted(
        f for f in os.listdir(".") if f.startswith("_tmp_") and f.endswith(".mmd")
    )

    renamed_count = 0
    leftover = []
    for i, m in enumerate(matches):
        if i >= len(tmp_files):
            leftover.extend(tmp_files[i:])
            break
        tmp = tmp_files[i]
        heading = m.group(1)

        num_match = re.search(r"(\d+)\.(\d+)\b", heading)
        if num_match:
            chap, n = num_match.group(1), num_match.group(2)
        else:
            chap, n = "0", str(i + 1)

        slug_match = re.search(r"##+ [^\n]*?\b([A-Za-z][\w-]*)\b", heading)
        slug = (
            slug_match.group(1).lower()
            if slug_match
            else ("fig%d" % (i + 1))
        )

        new_name = "c4-%s-%s-%s.mmd" % (chap, n, slug)
        if os.path.exists(new_name):
            os.remove(tmp)
        else:
            os.rename(tmp, new_name)
            renamed_count += 1

    # Remove any _tmp_ files that weren't matched (extra extractions)
    for f in leftover:
        if os.path.exists(f):
            os.remove(f)

    # Also remove any _tmp_ files still remaining (defensive)
    for f in os.listdir("."):
        if f.startswith("_tmp_") and f.endswith(".mmd"):
            os.remove(f)

    return 0


if __name__ == "__main__":
    sys.exit(main())
