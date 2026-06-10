#!/usr/bin/env python3
"""Build a conservative GitHub Project timeline update manifest.

This does not call GitHub and does not close issues. It derives the intended
Project v2 field updates from docs/planning/github-open-issues-inventory.json:

- only issues marked "Terminé probable"
- only issues with a first commit date
- Status target is "In progress" because the user explicitly asked to move
  completed-but-open issues from Todo to In progress for timeline planning
- Debut is the first candidate commit date
- Fin is the last candidate commit date when available, otherwise Debut
"""

from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "planning" / "github-open-issues-inventory.json"
OUT_JSON = ROOT / "docs" / "planning" / "project-timeline-updates.json"
OUT_CSV = ROOT / "docs" / "planning" / "project-timeline-updates.csv"


def main() -> None:
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    rows = data["rows"]

    updates = []
    skipped = []
    for row in rows:
        issue = int(row["issue"])
        state = row["etat_code"]
        first_date = row.get("date_premier_commit") or ""
        last_date = row.get("date_dernier_commit") or first_date

        if state != "Terminé probable" or not first_date:
            skipped.append(
                {
                    "issue": issue,
                    "title": row["titre"],
                    "reason": "not_terminated_probable" if state != "Terminé probable" else "missing_first_commit_date",
                    "state": state,
                }
            )
            continue

        updates.append(
            {
                "issue": issue,
                "title": row["titre"],
                "url": row["url"],
                "milestone": row.get("milestone") or "",
                "priority": row.get("priorite") or "",
                "status_target": "In progress",
                "debut": first_date,
                "fin": last_date,
                "first_commit": row.get("premier_commit") or "",
                "first_commit_subject": row.get("sujet_premier_commit") or "",
                "first_commit_confidence": row.get("confiance_premier_commit") or "",
                "last_commit": row.get("dernier_commit") or "",
                "last_commit_subject": row.get("sujet_dernier_commit") or "",
                "last_commit_confidence": row.get("confiance_dernier_commit") or "",
                "evidence": row.get("preuve_locale") or "",
            }
        )

    OUT_JSON.write_text(
        json.dumps(
            {
                "source": str(SOURCE.relative_to(ROOT)),
                "project": "Bicec-Veripass Project",
                "fields": {"status": "Status", "start": "Debut", "end": "Fin"},
                "updates_count": len(updates),
                "skipped_count": len(skipped),
                "updates": updates,
                "skipped": skipped,
                "state_counts": Counter(row["etat_code"] for row in rows),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "issue",
                "title",
                "url",
                "milestone",
                "priority",
                "status_target",
                "debut",
                "fin",
                "first_commit",
                "first_commit_subject",
                "first_commit_confidence",
                "last_commit",
                "last_commit_subject",
                "last_commit_confidence",
                "evidence",
            ],
        )
        writer.writeheader()
        writer.writerows(updates)

    print(f"updates={len(updates)} skipped={len(skipped)}")
    print(OUT_JSON.relative_to(ROOT))
    print(OUT_CSV.relative_to(ROOT))


if __name__ == "__main__":
    main()
