#!/usr/bin/env python3
"""Build a focused plan for open issues that are not clearly finished."""

from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "planning" / "github-open-issues-inventory.json"
OUT_MD = ROOT / "docs" / "planning" / "remaining-issues-action-plan.md"
OUT_CSV = ROOT / "docs" / "planning" / "remaining-issues-action-plan.csv"

STATE_ORDER = {
    "Non terminé localement": 0,
    "Non terminé / non trouvé": 1,
    "Trace faible / à vérifier": 2,
    "Partiellement terminé": 3,
}
PRIORITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "": 4}


def action_for(row: dict) -> str:
    issue = row["issue"]
    title = row["titre"]
    state = row["etat_code"]
    priority = row.get("priorite") or ""

    if issue == 60:
        return (
            "Review CNI quality gate manually. Current code has blur/glare/brightness gating in "
            "`CniCaptureScreen.tsx`, but MediaPipe WASM is not clearly part of the document gate."
        )
    if "Rapport" in title or "Script de démo" in title or "Vidéo" in title:
        return "Finish or explicitly scope the presentation/report deliverable before soutenance."
    if state == "Trace faible / à vérifier":
        return "Inspect detected files and either finish the implementation or mark as future scope."
    if state.startswith("Non terminé"):
        return "Keep out of completed timeline; plan only if needed for the demo."
    if priority in {"critical", "high"}:
        return "Validate missing acceptance criteria manually and schedule remaining work this week."
    return "Backlog candidate after presentation unless it blocks the demo narrative."


def main() -> None:
    rows = json.loads(SOURCE.read_text(encoding="utf-8"))["rows"]
    remaining = [
        row
        for row in rows
        if row["etat_code"] != "Terminé probable"
    ]
    remaining.sort(
        key=lambda row: (
            PRIORITY_ORDER.get(row.get("priorite") or "", 4),
            STATE_ORDER.get(row["etat_code"], 9),
            -int(row["issue"]),
        )
    )

    for row in remaining:
        row["recommended_action"] = action_for(row)

    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "issue",
                "titre",
                "url",
                "priorite",
                "milestone",
                "etat_code",
                "confiance_etat",
                "resume",
                "preuve_locale",
                "recommended_action",
            ],
            extrasaction="ignore",
        )
        writer.writeheader()
        writer.writerows(remaining)

    counts = Counter(row["etat_code"] for row in remaining)
    priority_counts = Counter(row.get("priorite") or "non taguée" for row in remaining)
    top = [
        row
        for row in remaining
        if row.get("priorite") in {"critical", "high"} or row["issue"] == 60
    ]

    lines = [
        "# Remaining open issues action plan",
        "",
        f"- Source: `{SOURCE.relative_to(ROOT)}`",
        f"- Remaining issues not classified as `Terminé probable`: {len(remaining)}",
        "- Docker was not started.",
        "",
        "## Counts",
        "",
        "| State | Count |",
        "| --- | ---: |",
    ]
    for key, value in counts.most_common():
        lines.append(f"| {key} | {value} |")
    lines.extend(["", "| Priority | Count |", "| --- | ---: |"])
    for key, value in priority_counts.most_common():
        lines.append(f"| {key} | {value} |")

    lines.extend(
        [
            "",
            "## Priority review list",
            "",
            "| Issue | Priority | State | Milestone | Why it matters / next action |",
            "| --- | --- | --- | --- | --- |",
        ]
    )
    for row in top:
        lines.append(
            f"| [#{row['issue']}]({row['url']}) {row['titre']} | "
            f"{row.get('priorite') or ''} | {row['etat_code']} | {row.get('milestone') or ''} | "
            f"{row['recommended_action']} |"
        )

    lines.extend(
        [
            "",
            "## Full remaining list",
            "",
            "| Issue | Priority | State | Summary | Recommended action |",
            "| --- | --- | --- | --- | --- |",
        ]
    )
    for row in remaining:
        summary = (row.get("resume") or "").replace("|", "\\|")
        action = row["recommended_action"].replace("|", "\\|")
        lines.append(
            f"| [#{row['issue']}]({row['url']}) | {row.get('priorite') or ''} | "
            f"{row['etat_code']} | {summary} | {action} |"
        )

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"remaining={len(remaining)}")
    print(OUT_MD.relative_to(ROOT))
    print(OUT_CSV.relative_to(ROOT))


if __name__ == "__main__":
    main()
