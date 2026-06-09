#!/usr/bin/env python3
"""Generate a GitHub open-issues implementation inventory.

The report is intentionally evidence-driven and conservative. It correlates
open GitHub issues with the current checkout and local git history, then marks
low-confidence matches as requiring manual validation.
"""

from __future__ import annotations

import csv
import json
import os
import re
import subprocess
import sys
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


REPO = "Ken-Andre/bicec-veripass"
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "planning"
MD_OUT = OUT_DIR / "github-open-issues-inventory.md"
CSV_OUT = OUT_DIR / "github-open-issues-inventory.csv"
JSON_OUT = OUT_DIR / "github-open-issues-inventory.json"

TEXT_EXTENSIONS = {
    ".css",
    ".env",
    ".html",
    ".ini",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".mjs",
    ".ps1",
    ".py",
    ".sh",
    ".sql",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".yml",
    ".yaml",
    ".conf",
}

SKIP_PARTS = {
    ".git",
    ".venv",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "docx-work",
    "outputs",
    "bmad-builder.hold",
    "_bmad",
    "_bmad-output",
    ".agent",
    ".cursor",
    ".qwen",
    ".opencode",
    "docs/planning",
    "docs/rapport-stage/rendered-word",
    "docs/rapport-stage/rendered-word-v2",
    "docs/rapport-stage/rendered-word-v3",
    "docs/rapport-stage/rendered-word-v4",
    "docs/rapport-stage/rendered-word-v5",
    "docs/rapport-stage/rendered-word-v6",
    "docs/rapport-stage/rendered-word-v7",
    "docs/rapport-stage/rendered-word-v8",
    "docs/marketing-presentation-bicec-2026-06-02",
    "docs/test_tmp_trash",
}

SKIP_FILES = {
    "all_issues_orange_sms_patch.md",
    "commit-plan.md",
    "Document de Cadrage Projet.md",
    "README-bmad.md",
    "scripts/inventory_open_issues.py",
}

STOPWORDS = {
    "avec",
    "after",
    "ajouter",
    "and",
    "backend",
    "button",
    "checkboxes",
    "code",
    "complete",
    "configurer",
    "dans",
    "data",
    "demo",
    "des",
    "devrait",
    "documenter",
    "dossier",
    "endpoint",
    "final",
    "frontend",
    "issue",
    "kyc",
    "label",
    "local",
    "mobile",
    "pour",
    "review",
    "script",
    "session",
    "should",
    "story",
    "table",
    "task",
    "test",
    "tests",
    "the",
    "une",
    "user",
    "using",
    "validation",
    "verifier",
    "view",
}

GENERIC_EXACT_TERMS = STOPWORDS | {
    "address",
    "ai-engine",
    "analytics",
    "backend",
    "backoffice",
    "capture",
    "ci-cd",
    "database",
    "demo",
    "devops",
    "discovery",
    "documentation",
    "frontend",
    "high",
    "infrastructure",
    "low",
    "medium",
    "mobile",
    "monitoring",
    "ocr",
    "performance",
    "priority:critical",
    "priority:high",
    "priority:low",
    "priority:medium",
    "security",
    "sprint-9",
    "sprint-10",
    "sprint-11",
    "sprint-12",
    "sprint-13",
    "testing",
}

DOMAIN_PATH_HINTS = {
    "mobile": ["code/mobile/"],
    "frontend": ["code/mobile/", "code/backoffice/src/"],
    "backoffice": ["code/backoffice/src/", "code/backend/app/modules/backoffice"],
    "backend": ["code/backend/app/", "code/backend/alembic/versions/"],
    "database": ["code/backend/alembic/versions/", "docs/schema/"],
    "security": ["code/backend/app/core/", "code/infra/", "docs/security"],
    "infrastructure": ["code/docker-compose.yml", "code/infra/", "code/scripts/"],
    "analytics": ["code/backend/app/modules/analytics", "code/backoffice/src/pages/analytics"],
    "monitoring": ["code/docs/MONITORING.md", "code/scripts/MONITORING.md", "code/infra/"],
    "documentation": ["docs/", "CHANGELOG.md", "README"],
    "testing": ["tests/", ".github/workflows/", "playwright", ".test."],
    "aml": ["code/backend/app/modules/aml", "code/backoffice/src/pages/compliance"],
    "ai-engine": ["code/backend/app/services", "code/backend/app/tasks/ocr.py", "paddleocr_test/"],
    "address": ["address", "niu", "consent", "geo"],
}


@dataclass
class Commit:
    sha: str
    date: str
    subject: str
    files: list[str]


def run(args: list[str], timeout: int = 60) -> str:
    proc = subprocess.run(
        args,
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
    )
    if proc.returncode != 0:
        print(proc.stderr, file=sys.stderr)
        raise SystemExit(f"Command failed: {' '.join(args)}")
    return proc.stdout


def norm(text: str | None) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text.lower()


def strip_md(text: str | None) -> str:
    text = text or ""
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def extract_code(title: str) -> str:
    match = re.search(r"\[([A-Z0-9]+(?:-[A-Z0-9]+)+[a-z]?)\]", title)
    return match.group(1) if match else ""


def issue_type(title: str, labels: list[str]) -> str:
    lowered = norm(" ".join([title, *labels]))
    if "epic" in labels or lowered.startswith("epic") or " epic " in f" {lowered} ":
        return "Epic"
    if "story" in labels or lowered.startswith("story") or " story " in f" {lowered} ":
        return "Story"
    return "Task"


def priority(issue: dict) -> str:
    text = norm(" ".join([issue.get("title", ""), issue.get("body", ""), *issue.get("labels", [])]))
    for level in ("critical", "high", "medium", "low"):
        if f"priority:{level}" in text or f"priority: {level}" in text:
            return level
    if "⚠️" in (issue.get("body") or "") or "livrable pfe primaire" in text:
        return "critical"
    return ""


def scope(issue: dict) -> str:
    labels = [norm(label) for label in issue.get("labels", [])]
    text = norm(issue.get("title", "") + " " + (issue.get("body") or ""))
    scopes = []
    for candidate in (
        "backend",
        "frontend",
        "mobile",
        "backoffice",
        "database",
        "security",
        "infrastructure",
        "documentation",
        "testing",
        "analytics",
        "monitoring",
        "aml",
        "ai-engine",
        "demo",
        "address",
    ):
        if candidate in labels or candidate in text:
            scopes.append(candidate)
    return ", ".join(dict.fromkeys(scopes)) or "produit"


def summarize(issue: dict) -> str:
    title = re.sub(r"^\[[^\]]+\]\s*", "", issue.get("title", ""))
    body = issue.get("body") or ""
    bullets = []
    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line.startswith("- "):
            continue
        line = re.sub(r"^- \[[ xX]\]\s*", "", line[2:]).strip()
        if not line or line.lower().startswith("labels:") or line.lower().startswith("estimate:"):
            continue
        bullets.append(strip_md(line))
        if len(bullets) == 2:
            break
    if bullets:
        return f"{title}: " + "; ".join(bullets)
    clean_body = strip_md(body)
    if clean_body:
        clean_body = re.sub(r"^(part of epic #[0-9]+|cross-cutting task|optional task)\s*", "", clean_body, flags=re.I)
        return f"{title}: {clean_body[:220].strip()}"
    return title


def extract_terms(issue: dict) -> tuple[list[str], list[str], list[str]]:
    title = issue.get("title", "")
    body = issue.get("body") or ""
    labels = issue.get("labels", [])
    code = extract_code(title)
    exact_terms = []
    if code:
        exact_terms.extend([code, code.lower(), code.replace("-", "_").lower()])
    exact_terms.extend(re.findall(r"`([^`]{3,80})`", body))
    exact_terms.extend(re.findall(r"\b(?:GET|POST|PATCH|PUT|DELETE)\s+(/[A-Za-z0-9_./{}?=&:-]+)", body))
    exact_terms.extend(re.findall(r"\b[A-Za-z0-9_./-]+\.(?:py|tsx?|jsx?|sql|ya?ml|md|ps1|sh|conf)\b", body))
    exact_terms.extend(re.findall(r"\b[a-z][a-z0-9]+(?:_[a-z0-9]+){1,}\b", body))

    story_terms = re.findall(r"\bStory\s+[0-9]+(?:\.[0-9]+)?", title + " " + body, flags=re.I)
    exact_terms.extend(story_terms)

    words = re.findall(r"[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9_-]{3,}", title + " " + " ".join(labels))
    keywords = []
    for word in words:
        clean = norm(word).strip("_-")
        if len(clean) >= 4 and clean not in STOPWORDS and not clean.isdigit():
            keywords.append(clean)

    body_keywords = []
    for raw_line in body.splitlines():
        if raw_line.strip().startswith("- "):
            body_keywords.extend(re.findall(r"[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9_-]{4,}", raw_line))
    for word in body_keywords:
        clean = norm(word).strip("_-")
        if len(clean) >= 5 and clean not in STOPWORDS and not clean.isdigit():
            keywords.append(clean)

    filtered_exact = []
    for term in dedupe(exact_terms):
        key = norm(term)
        if key in GENERIC_EXACT_TERMS:
            continue
        if key.startswith(("priority:", "sprint-", "epic-")):
            continue
        if re.fullmatch(r"[0-9]+h", key):
            continue
        filtered_exact.append(term)

    labels_norm = [norm(label) for label in labels]
    return filtered_exact[:18], dedupe(keywords)[:14], labels_norm


def dedupe(values: Iterable[str]) -> list[str]:
    seen = set()
    result = []
    for value in values:
        clean = str(value).strip()
        if not clean:
            continue
        key = norm(clean)
        if key in seen:
            continue
        seen.add(key)
        result.append(clean)
    return result


def fetch_issues() -> list[dict]:
    try:
        output = run(
            [
                "gh",
                "api",
                "--paginate",
                f"repos/{REPO}/issues?state=open&per_page=100",
                "--jq",
                ".[] | select(.pull_request|not) | {number,title,body,labels:[.labels[].name],milestone:(.milestone.title // null),created_at,updated_at,html_url}",
            ],
            timeout=90,
        )
        issues = [json.loads(line) for line in output.splitlines() if line.strip()]
    except SystemExit:
        if not JSON_OUT.exists():
            raise
        cached = json.loads(JSON_OUT.read_text(encoding="utf-8"))
        print("GitHub API unavailable; using cached issue rows from previous JSON.", file=sys.stderr)
        issues = []
        for row in cached.get("rows", []):
            issues.append(
                {
                    "number": row["issue"],
                    "title": row.get("titre", ""),
                    "body": row.get("resume", ""),
                    "labels": row.get("labels", []),
                    "milestone": row.get("milestone") or None,
                    "created_at": row.get("github_created_at", ""),
                    "updated_at": row.get("github_updated_at", ""),
                    "html_url": row.get("url", ""),
                }
            )
    return sorted(issues, key=lambda item: item["number"], reverse=True)


def repo_files() -> list[Path]:
    files = []
    for line in run(["rg", "--files"], timeout=60).splitlines():
        rel = Path(line)
        rel_posix = rel.as_posix()
        if rel_posix in SKIP_FILES:
            continue
        if any(part in SKIP_PARTS for part in rel.parts):
            continue
        if any(rel_posix.startswith(prefix + "/") for prefix in SKIP_PARTS if "/" in prefix):
            continue
        if rel_posix.startswith("docs/planning/github-open-issues-inventory"):
            continue
        if rel.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        path = ROOT / rel
        try:
            if path.stat().st_size > 350_000:
                continue
        except OSError:
            continue
        files.append(path)
    return files


def build_corpus(files: list[Path]) -> tuple[str, dict[str, str]]:
    per_file = {}
    all_chunks = []
    for path in files:
        rel = path.relative_to(ROOT).as_posix()
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        normalized = norm(rel + "\n" + text)
        per_file[rel] = normalized
        all_chunks.append(normalized)
    return "\n".join(all_chunks), per_file


def parse_commits() -> list[Commit]:
    output = run(["git", "log", "--all", "--reverse", "--date=short", "--format=%H%x09%ad%x09%s", "--name-only"], timeout=90)
    commits: list[Commit] = []
    current: Commit | None = None
    for line in output.splitlines():
        if "\t" in line and re.match(r"^[0-9a-f]{40}\t", line):
            if current:
                commits.append(current)
            sha, date, subject = line.split("\t", 2)
            current = Commit(sha=sha, date=date, subject=subject, files=[])
        elif current and line.strip():
            current.files.append(line.strip().replace("\\", "/").strip('"'))
    if current:
        commits.append(current)
    return commits


def is_implementation_file(rel: str) -> bool:
    rel = rel.replace("\\", "/")
    if rel.startswith(("code/", ".github/", "paddleocr_test/")):
        if rel.startswith(("code/docs/", "code/mobile/journal.md")):
            return False
        return True
    return rel in {"CHANGELOG.md", "README.md"}


def is_documentation_issue(issue: dict, labels: list[str]) -> bool:
    text = norm(issue.get("title", "") + " " + (issue.get("body") or "") + " " + " ".join(labels))
    return any(term in text for term in ("documentation", "rapport", "abstract", "diagram", "adr", "script de demo", "vidéo", "video"))


def score_current_state(issue: dict, corpus: str, per_file: dict[str, str]) -> tuple[str, str, str, int, str]:
    exact_terms, keywords, labels = extract_terms(issue)
    title = issue.get("title", "")
    body = issue.get("body") or ""
    text = norm(title + " " + body + " " + " ".join(labels))

    if "production uniquement" in text or "domaine public" in text or "certbot" in text:
        production_status = True
    else:
        production_status = False

    is_doc_issue = is_documentation_issue(issue, labels)
    score = 0
    exact_score = 0
    exact_impl_score = 0
    exact_terms_found: set[str] = set()
    exact_impl_terms_found: set[str] = set()
    evidence: list[str] = []
    matched_files: Counter[str] = Counter()

    for term in exact_terms:
        needle = norm(term)
        if len(needle) < 3:
            continue
        impl_hit = None
        doc_hit = None
        for rel, file_text in per_file.items():
            if needle in file_text:
                if is_implementation_file(rel):
                    impl_hit = rel
                    break
                if doc_hit is None:
                    doc_hit = rel
        if impl_hit:
            matched_files[impl_hit] += 5
            score += 5
            exact_score += 5
            exact_impl_score += 5
            exact_terms_found.add(norm(term))
            exact_impl_terms_found.add(norm(term))
            evidence.append(f"`{term}` dans `{impl_hit}`")
        elif doc_hit and is_doc_issue:
            matched_files[doc_hit] += 4
            score += 4
            exact_score += 4
            exact_terms_found.add(norm(term))
            evidence.append(f"`{term}` dans `{doc_hit}`")
        elif doc_hit:
            matched_files[doc_hit] += 1
            score += 1
            exact_score += 1
            exact_terms_found.add(norm(term))

    for kw in keywords:
        if len(kw) < 4:
            continue
        for rel, file_text in per_file.items():
            if not is_doc_issue and not is_implementation_file(rel):
                continue
            if is_doc_issue and not (rel.startswith("docs/") or rel == "CHANGELOG.md" or is_implementation_file(rel)):
                continue
            if re.search(rf"\b{re.escape(kw)}\b", file_text):
                matched_files[rel] += 1
                score += 1
                break

    for label in labels:
        for hint in DOMAIN_PATH_HINTS.get(label, []):
            h = norm(hint)
            for rel, file_text in per_file.items():
                if h in norm(rel):
                    matched_files[rel] += 1
                    break

    top_files = [path for path, _ in matched_files.most_common(3)]
    evidence = dedupe(evidence)[:3]
    if top_files:
        evidence.append("fichiers proches: " + ", ".join(f"`{path}`" for path in top_files))

    if production_status and ("certbot" in text and "certbot" not in exact_impl_terms_found):
        return "Non terminé localement", "production/devops", "; ".join(evidence) or "Issue explicitement hors périmètre développement local.", score, "moyenne"
    if production_status and exact_impl_score < 5:
        return "Non terminé localement", "production/devops", "; ".join(evidence) or "Issue explicitement hors périmètre développement local.", score, "moyenne"
    if is_doc_issue or "demo" in labels or "pfe" in text or "rapport" in text:
        if exact_score >= 8:
            return "Terminé probable", "documentaire", "; ".join(evidence), score, "moyenne"
        if exact_score >= 3 or score >= 6:
            return "Partiellement terminé", "documentaire", "; ".join(evidence), score, "faible"
        return "Non terminé / non trouvé", "documentaire", "; ".join(evidence), score, "faible"
    if exact_impl_score >= 10 or (exact_impl_score >= 5 and score >= 12):
        return "Terminé probable", "code", "; ".join(evidence), score, "haute"
    if exact_impl_score >= 5 or score >= 10:
        return "Partiellement terminé", "code", "; ".join(evidence), score, "moyenne"
    if score >= 4:
        return "Trace faible / à vérifier", "code", "; ".join(evidence), score, "faible"
    return "Non terminé / non trouvé", "code", "; ".join(evidence) or "Aucune trace locale forte détectée.", score, "faible"


def matching_commits(issue: dict, commits: list[Commit]) -> tuple[tuple[str, str, str, str], tuple[str, str, str, str]]:
    exact_terms, keywords, labels = extract_terms(issue)
    number = str(issue["number"])
    exact_needles = [norm(term) for term in exact_terms if len(norm(term)) >= 3]
    keyword_needles = [norm(term) for term in keywords if len(norm(term)) >= 4]

    high_matches: list[tuple[int, Commit, str]] = []
    fallback_matches: list[tuple[int, Commit, str]] = []
    for commit in commits:
        hay_msg = norm(commit.subject)
        hay_files = norm(" ".join(commit.files))
        hay = hay_msg + " " + hay_files
        score = 0
        reasons = []
        if f"#{number}" in commit.subject or f"issue {number}" in hay_msg:
            score += 20
            reasons.append(f"référence issue #{number}")
        for term in exact_needles:
            if term in hay:
                score += 8 if term in hay_msg else 5
                reasons.append(term)
        for kw in keyword_needles:
            if re.search(rf"\b{re.escape(kw)}\b", hay_msg):
                score += 1
                if len(reasons) < 3:
                    reasons.append(kw)
            elif re.search(rf"\b{re.escape(kw)}\b", hay_files):
                score += 0.5
                if len(reasons) < 3:
                    reasons.append(kw)
        if score >= 10:
            high_matches.append((score, commit, "haute: " + ", ".join(dedupe(reasons)[:4])))
        elif score >= 6:
            fallback_matches.append((score, commit, "moyenne/faible: " + ", ".join(dedupe(reasons)[:4])))

    matches = high_matches or fallback_matches
    if not matches:
        empty = ("", "", "", "")
        return empty, empty

    first_score, first, first_reason = matches[0]
    last_score, last, last_reason = matches[-1]
    first_tuple = (first.sha[:12], first.date, first.subject, first_reason)
    last_tuple = (last.sha[:12], last.date, last.subject, last_reason)
    return first_tuple, last_tuple


def markdown_escape(text: str | None) -> str:
    text = str(text or "")
    text = text.replace("\n", " ").replace("|", "\\|")
    return text


def write_outputs(rows: list[dict]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    counts = Counter(row["etat_code"] for row in rows)
    confidence = Counter(row["confiance_etat"] for row in rows)
    priority_counts = Counter(row["priorite"] or "non taguée" for row in rows)

    with JSON_OUT.open("w", encoding="utf-8") as f:
        json.dump({"generated_at": generated_at, "repo": REPO, "rows": rows}, f, ensure_ascii=False, indent=2)

    csv_fields = [
        "issue",
        "titre",
        "url",
        "type",
        "scope",
        "priorite",
        "milestone",
        "resume",
        "etat_code",
        "confiance_etat",
        "preuve_locale",
        "score_detection",
        "premier_commit",
        "date_premier_commit",
        "sujet_premier_commit",
        "confiance_premier_commit",
        "dernier_commit",
        "date_dernier_commit",
        "sujet_dernier_commit",
        "confiance_dernier_commit",
        "prochaine_action",
    ]
    with CSV_OUT.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=csv_fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    lines = [
        "# Inventaire des issues GitHub ouvertes",
        "",
        f"- Dépôt: `{REPO}`",
        f"- Généré le: {generated_at}",
        f"- Issues ouvertes analysées: {len(rows)}",
        "",
        "## Lecture rapide",
        "",
        "Ce fichier croise les issues ouvertes GitHub avec l'état du checkout local et l'historique git. "
        "Les colonnes de confiance signalent quand la correspondance est heuristique et doit être validée manuellement. "
        "Aucune issue GitHub n'est modifiée ou fermée par ce rapport.",
        "",
        "### Synthèse par état",
        "",
        "| État | Nombre |",
        "| --- | ---: |",
    ]
    for key, value in counts.most_common():
        lines.append(f"| {markdown_escape(key)} | {value} |")
    lines.extend(["", "### Synthèse par priorité", "", "| Priorité | Nombre |", "| --- | ---: |"])
    for key, value in priority_counts.most_common():
        lines.append(f"| {markdown_escape(key)} | {value} |")
    lines.extend(["", "### Confiance de détection", "", "| Confiance | Nombre |", "| --- | ---: |"])
    for key, value in confidence.most_common():
        lines.append(f"| {markdown_escape(key)} | {value} |")

    critical_open = [
        row
        for row in rows
        if row["priorite"] in {"critical", "high"} and row["etat_code"] in {"Non terminé / non trouvé", "Trace faible / à vérifier", "Partiellement terminé"}
    ]
    lines.extend(
        [
            "",
            "## À prioriser cette semaine",
            "",
            "| Issue | Priorité | État | Résumé | Décision planning |",
            "| --- | --- | --- | --- | --- |",
        ]
    )
    for row in critical_open[:40]:
        lines.append(
            f"| [#{row['issue']}]({row['url']}) | {markdown_escape(row['priorite'])} | {markdown_escape(row['etat_code'])} | "
            f"{markdown_escape(row['resume'][:180])} | {markdown_escape(row['prochaine_action'])} |"
        )

    lines.extend(
        [
            "",
            "## Tableau complet",
            "",
            "| Issue | Type | Scope | Priorité | Milestone | Résumé | État | Confiance | Premier commit candidat | Dernier commit candidat | Preuve locale | Décision planning |",
            "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        ]
    )
    for row in rows:
        first_commit = ""
        if row["premier_commit"]:
            first_commit = f"`{row['premier_commit']}` ({row['date_premier_commit']}) {row['sujet_premier_commit']}"
        last_commit = ""
        if row["dernier_commit"]:
            last_commit = f"`{row['dernier_commit']}` ({row['date_dernier_commit']}) {row['sujet_dernier_commit']}"
        lines.append(
            f"| [#{row['issue']}]({row['url']}) {markdown_escape(row['titre'])} | "
            f"{markdown_escape(row['type'])} | {markdown_escape(row['scope'])} | {markdown_escape(row['priorite'])} | "
            f"{markdown_escape(row['milestone'])} | {markdown_escape(row['resume'])} | {markdown_escape(row['etat_code'])} | "
            f"{markdown_escape(row['confiance_etat'])} | {markdown_escape(first_commit)} | {markdown_escape(last_commit)} | {markdown_escape(row['preuve_locale'])} | "
            f"{markdown_escape(row['prochaine_action'])} |"
        )

    MD_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def next_action(status: str, confidence: str, issue: dict) -> str:
    pri = priority(issue)
    text = norm(issue.get("title", "") + " " + (issue.get("body") or ""))
    if status == "Terminé probable" and confidence in {"haute", "moyenne"}:
        return "Utiliser les commits candidats pour dater le jalon; validation manuelle recommandée."
    if status == "Partiellement terminé":
        return "Planifier le reste à faire ou expliciter le périmètre réellement livré."
    if status == "Trace faible / à vérifier":
        return "Vérifier manuellement les fichiers détectés avant de dater le jalon."
    if "production uniquement" in text:
        return "Garder pour post-soutenance/production sauf besoin infra réel."
    if pri in {"critical", "high"}:
        return "Planifier cette semaine ou réduire le périmètre pour la soutenance."
    return "Backlog: arbitrer après les livrables critiques."


def main() -> None:
    issues = fetch_issues()
    files = repo_files()
    corpus, per_file = build_corpus(files)
    commits = parse_commits()

    rows = []
    for issue in issues:
        status, status_scope, evidence, score, confidence = score_current_state(issue, corpus, per_file)
        first_match, last_match = matching_commits(issue, commits)
        first_sha, first_date, first_subject, first_commit_confidence = first_match
        last_sha, last_date, last_subject, last_commit_confidence = last_match
        row = {
            "issue": issue["number"],
            "titre": issue.get("title", ""),
            "url": issue.get("html_url", ""),
            "type": issue_type(issue.get("title", ""), issue.get("labels", [])),
            "scope": scope(issue),
            "priorite": priority(issue),
            "milestone": issue.get("milestone") or "",
            "resume": summarize(issue),
            "etat_code": status,
            "confiance_etat": confidence,
            "preuve_locale": evidence,
            "score_detection": score,
            "premier_commit": first_sha,
            "date_premier_commit": first_date,
            "sujet_premier_commit": first_subject,
            "confiance_premier_commit": first_commit_confidence,
            "dernier_commit": last_sha,
            "date_dernier_commit": last_date,
            "sujet_dernier_commit": last_subject,
            "confiance_dernier_commit": last_commit_confidence,
            "prochaine_action": next_action(status, confidence, issue),
            "github_created_at": issue.get("created_at", ""),
            "github_updated_at": issue.get("updated_at", ""),
            "labels": issue.get("labels", []),
            "detection_scope": status_scope,
        }
        rows.append(row)

    write_outputs(rows)
    print(f"Generated {len(rows)} rows")
    print(MD_OUT.relative_to(ROOT))
    print(CSV_OUT.relative_to(ROOT))
    print(JSON_OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
