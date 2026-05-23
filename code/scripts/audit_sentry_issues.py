#!/usr/bin/env python3
"""Audit Sentry issues for the VeriPass repository.

This script is intentionally stdlib-only. It reads Sentry credentials from the
local environment, queries Sentry without mutating remote state, and writes a
Markdown audit report plus an optional JSON evidence export.
"""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import json
import os
import pathlib
import re
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from typing import Any


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = REPO_ROOT / "docs" / "sentry-issue-audit-2026-05-23.md"
DEFAULT_JSON_OUTPUT = REPO_ROOT / "docs" / "sentry-issue-audit-2026-05-23.json"
AUDIT_END = "2026-05-23T23:59:59"
AUDIT_START = "2000-01-01T00:00:00"
LATEST_SENTRY_FIX = dt.datetime.fromisoformat("2026-04-26T22:34:44+01:00")

PROJECTS = [
    {
        "name": "backend",
        "project_id": "4511114019471440",
        "release_hint": "BICEC VeriPass@0.1.0",
        "source_roots": ("code/backend",),
    },
    {
        "name": "mobile",
        "project_id": "4511114011410512",
        "release_hint": "veripass-mobile@{APP_VERSION}",
        "source_roots": ("code/mobile",),
    },
    {
        "name": "backoffice",
        "project_id": "4511114014949456",
        "release_hint": "veripass-backoffice@{APP_VERSION}",
        "source_roots": ("code/backoffice",),
    },
]

ISSUE_QUERIES = ("", "is:unresolved", "is:resolved", "is:ignored", "is:archived")
ORG_PLACEHOLDERS = {"your-org-slug", "org-slug", "my-org", "your-sentry-org"}
TEXT_EXTENSIONS = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
    ".toml",
    ".yml",
    ".yaml",
}


class SentryError(RuntimeError):
    """Raised for Sentry API failures."""


@dataclasses.dataclass(frozen=True)
class ProjectTarget:
    name: str
    project_id: str
    release_hint: str
    source_roots: tuple[str, ...]
    slug: str | None = None


@dataclasses.dataclass
class AuditIssue:
    project: ProjectTarget
    issue: dict[str, Any]
    detail: dict[str, Any] | None
    latest_event: dict[str, Any] | None
    stack_files: list[str]
    matched_paths: list[str]
    environments: list[str]
    releases: list[str]
    verdict: str
    evidence: str
    resolution: str


class SentryClient:
    def __init__(self, base_url: str, org: str, token: str, sleep_seconds: float = 0.1, retries: int = 3) -> None:
        self.base_url = base_url.rstrip("/")
        self.org = org
        self.token = token
        self.sleep_seconds = sleep_seconds
        self.retries = retries

    def get(self, path_or_url: str, params: dict[str, Any] | None = None) -> tuple[Any, str | None]:
        if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
            url = path_or_url
            if params:
                separator = "&" if "?" in url else "?"
                url = f"{url}{separator}{urllib.parse.urlencode(params, doseq=True)}"
        else:
            url = f"{self.base_url}{path_or_url}"
            if params:
                url = f"{url}?{urllib.parse.urlencode(params, doseq=True)}"

        request = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/json",
                "User-Agent": "veripass-sentry-audit/1.0",
            },
        )

        last_error: BaseException | None = None
        for attempt in range(1, self.retries + 1):
            try:
                with urllib.request.urlopen(request, timeout=60) as response:
                    body = response.read().decode("utf-8")
                    link = response.headers.get("Link")
                break
            except urllib.error.HTTPError as exc:
                body = exc.read().decode("utf-8", errors="replace")
                if exc.code in {429, 500, 502, 503, 504} and attempt < self.retries:
                    last_error = exc
                    time.sleep(2 * attempt)
                    continue
                raise SentryError(f"Sentry API HTTP {exc.code} for {url}: {body[:500]}") from exc
            except (TimeoutError, socket.timeout, urllib.error.URLError) as exc:
                last_error = exc
                if attempt < self.retries:
                    time.sleep(2 * attempt)
                    continue
                raise SentryError(f"Sentry API request failed for {url}: {exc}") from exc
        else:
            raise SentryError(f"Sentry API request failed for {url}: {last_error}")

        if self.sleep_seconds:
            time.sleep(self.sleep_seconds)
        return json.loads(body) if body else None, link

    def paginate(self, path: str, params: dict[str, Any] | None = None) -> list[Any]:
        items: list[Any] = []
        next_url: str | None = path
        next_params = dict(params or {})
        while next_url:
            payload, link = self.get(next_url, next_params)
            if isinstance(payload, list):
                items.extend(payload)
            else:
                items.append(payload)
            next_url = parse_next_link(link)
            next_params = {}
        return items


def list_accessible_orgs(client: SentryClient) -> list[dict[str, Any]]:
    orgs = client.paginate("/api/0/organizations/", {"limit": 100})
    return [org for org in orgs if isinstance(org, dict)]


def parse_next_link(link_header: str | None) -> str | None:
    if not link_header:
        return None
    for part in link_header.split(","):
        section = part.strip()
        if 'rel="next"' not in section or 'results="true"' not in section:
            continue
        match = re.search(r"<([^>]+)>", section)
        if match:
            return match.group(1)
    return None


def sentry_project_targets(projects: list[dict[str, str]]) -> list[ProjectTarget]:
    targets: list[ProjectTarget] = []
    by_id = {str(project.get("id")): project for project in projects}
    for configured in PROJECTS:
        project_id = configured["project_id"]
        api_project = by_id.get(project_id)
        targets.append(
            ProjectTarget(
                name=configured["name"],
                project_id=project_id,
                release_hint=configured["release_hint"],
                source_roots=tuple(configured["source_roots"]),
                slug=api_project.get("slug") if api_project else None,
            )
        )
    return targets


def load_source_index() -> list[pathlib.Path]:
    ignored_parts = {
        ".git",
        ".venv",
        "__pycache__",
        "node_modules",
        "dist",
        "build",
        ".next",
        ".pytest_cache",
        ".mypy_cache",
    }
    files: list[pathlib.Path] = []
    for root, dirs, names in os.walk(REPO_ROOT):
        dirs[:] = [name for name in dirs if name not in ignored_parts]
        for name in names:
            path = pathlib.Path(root, name)
            if path.suffix.lower() in TEXT_EXTENSIONS:
                files.append(path.relative_to(REPO_ROOT))
    return files


def issue_identity(issue: dict[str, Any]) -> str:
    return str(issue.get("id") or issue.get("shortId") or issue.get("permalink") or issue.get("title"))


def list_project_issues(client: SentryClient, target: ProjectTarget) -> tuple[list[dict[str, Any]], list[str]]:
    seen: dict[str, dict[str, Any]] = {}
    warnings: list[str] = []
    for query in ISSUE_QUERIES:
        params = {
            "project": target.project_id,
            "query": query,
            "sort": "date",
            "limit": 100,
            "start": AUDIT_START,
            "end": AUDIT_END,
        }
        try:
            for issue in client.paginate(f"/api/0/organizations/{client.org}/issues/", params):
                if isinstance(issue, dict):
                    seen[issue_identity(issue)] = issue
        except SentryError as exc:
            warnings.append(f"{target.name}: query {query or '<all>'} failed: {exc}")
    return list(seen.values()), warnings


def fetch_issue_detail(client: SentryClient, issue_id: str) -> dict[str, Any] | None:
    try:
        payload, _ = client.get(f"/api/0/organizations/{client.org}/issues/{issue_id}/")
        return payload if isinstance(payload, dict) else None
    except SentryError as exc:
        print(f"warning: issue detail failed for {issue_id}: {exc}", file=sys.stderr)
        return None


def fetch_latest_event(client: SentryClient, issue_id: str) -> dict[str, Any] | None:
    try:
        payload, _ = client.get(
            f"/api/0/organizations/{client.org}/issues/{issue_id}/events/",
            {"full": "true", "limit": 1},
        )
        if isinstance(payload, list):
            for event in payload:
                if isinstance(event, dict):
                    return event
    except SentryError as exc:
        print(f"warning: latest event failed for {issue_id}: {exc}", file=sys.stderr)
    return None


def tags_from_event(event: dict[str, Any] | None) -> dict[str, set[str]]:
    tags: dict[str, set[str]] = defaultdict(set)
    if not event:
        return tags
    raw_tags = event.get("tags") or []
    if isinstance(raw_tags, dict):
        raw_tags = [{"key": key, "value": value} for key, value in raw_tags.items()]
    for tag in raw_tags:
        if not isinstance(tag, dict):
            continue
        key = str(tag.get("key") or tag.get("name") or "").strip()
        value = str(tag.get("value") or "").strip()
        if key and value:
            tags[key].add(value)
    return tags


def collect_releases(issue: dict[str, Any], detail: dict[str, Any] | None, event: dict[str, Any] | None) -> list[str]:
    releases: set[str] = set()
    for payload in (issue, detail or {}, event or {}):
        for key in ("firstRelease", "lastRelease", "release"):
            value = payload.get(key)
            if isinstance(value, dict):
                value = value.get("version") or value.get("shortVersion")
            if value:
                releases.add(str(value))
    releases.update(tags_from_event(event).get("release", set()))
    return sorted(releases)


def collect_environments(issue: dict[str, Any], detail: dict[str, Any] | None, event: dict[str, Any] | None) -> list[str]:
    envs: set[str] = set()
    for payload in (issue, detail or {}, event or {}):
        value = payload.get("environment")
        if value:
            envs.add(str(value))
        for key in ("environments", "seenIn"):
            values = payload.get(key) or []
            if isinstance(values, list):
                for item in values:
                    if isinstance(item, dict):
                        candidate = item.get("name") or item.get("environment")
                    else:
                        candidate = item
                    if candidate:
                        envs.add(str(candidate))
    envs.update(tags_from_event(event).get("environment", set()))
    return sorted(envs)


def extract_stack_files(event: dict[str, Any] | None) -> list[str]:
    if not event:
        return []
    frames: list[dict[str, Any]] = []
    for entry in event.get("entries") or []:
        if not isinstance(entry, dict):
            continue
        entry_type = entry.get("type")
        data = entry.get("data") or {}
        if entry_type == "exception":
            for value in data.get("values") or []:
                stacktrace = value.get("stacktrace") or {}
                frames.extend(stacktrace.get("frames") or [])
        elif entry_type in {"stacktrace", "threads"}:
            if "frames" in data:
                frames.extend(data.get("frames") or [])
            for value in data.get("values") or []:
                stacktrace = value.get("stacktrace") or {}
                frames.extend(stacktrace.get("frames") or [])

    names: list[str] = []
    for frame in frames:
        if not isinstance(frame, dict):
            continue
        candidate = frame.get("filename") or frame.get("absPath") or frame.get("module") or frame.get("package")
        if candidate:
            names.append(str(candidate))
    return dedupe(names)


def normalize_stack_path(value: str) -> str:
    value = value.replace("\\", "/")
    value = re.sub(r"^webpack:///?", "", value)
    value = re.sub(r"^app:///?", "", value)
    value = value.split("?", 1)[0].split("#", 1)[0]
    value = value.lstrip("/")
    if value.startswith("./"):
        value = value[2:]
    return value


def match_source_paths(stack_files: list[str], source_index: list[pathlib.Path]) -> list[str]:
    matches: set[str] = set()
    index_strings = [path.as_posix() for path in source_index]
    for stack_file in stack_files:
        normalized = normalize_stack_path(stack_file)
        if not normalized:
            continue
        normalized_lower = normalized.lower()
        basename = pathlib.PurePosixPath(normalized).name.lower()
        for repo_path in index_strings:
            repo_lower = repo_path.lower()
            if repo_lower.endswith(normalized_lower) or (basename and repo_lower.endswith("/" + basename)):
                matches.add(repo_path)
    return sorted(matches)


def parse_sentry_datetime(value: Any) -> dt.datetime | None:
    if not value:
        return None
    text = str(value).replace("Z", "+00:00")
    try:
        parsed = dt.datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed


def issue_status(issue: dict[str, Any], detail: dict[str, Any] | None) -> str:
    return str((detail or {}).get("status") or issue.get("status") or "unknown")


def issue_level(issue: dict[str, Any], detail: dict[str, Any] | None, event: dict[str, Any] | None) -> str:
    return str((event or {}).get("level") or (detail or {}).get("level") or issue.get("level") or "unknown")


def is_production_environment(environments: list[str]) -> bool:
    return any(env.lower() in {"prod", "production"} for env in environments)


def classify_issue(
    target: ProjectTarget,
    issue: dict[str, Any],
    detail: dict[str, Any] | None,
    event: dict[str, Any] | None,
    stack_files: list[str],
    matched_paths: list[str],
    environments: list[str],
    releases: list[str],
) -> tuple[str, str, str]:
    status = issue_status(issue, detail).lower()
    last_seen = parse_sentry_datetime((detail or {}).get("lastSeen") or issue.get("lastSeen"))
    title = str((detail or {}).get("title") or issue.get("title") or "")
    culprit = str((detail or {}).get("culprit") or issue.get("culprit") or "")
    combined = " ".join([title, culprit, " ".join(environments), " ".join(stack_files)]).lower()
    production = is_production_environment(environments)

    if any(token in combined for token in ("adblock", "blocked by client", "ingest.de.sentry.io", "dsn")):
        return (
            "Noise/config",
            "Looks related to Sentry ingest, DSN, or browser-blocking configuration already covered by the proxy path.",
            "Verify the event did not recur after proxy deployment; close or ignore if no production recurrence remains.",
        )

    if environments and not production and status not in {"unresolved", "unknown"}:
        return (
            "Noise/config",
            f"Only non-production environments observed: {', '.join(environments)}.",
            "Ignore or close unless the same stack appears in production.",
        )

    if status in {"unresolved", "unknown"} and production:
        return (
            "Still relevant",
            "Unresolved production issue.",
            "Reproduce the latest event path, patch the mapped source, add a regression test, deploy, then resolve in Sentry after no recurrence.",
        )

    if status in {"unresolved", "unknown"} and last_seen and last_seen >= LATEST_SENTRY_FIX:
        return (
            "Still relevant",
            f"Unresolved and last seen after latest Sentry stabilization commit ({LATEST_SENTRY_FIX.date()}).",
            "Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.",
        )

    if status in {"resolved", "muted", "ignored", "archived"} and last_seen and last_seen < LATEST_SENTRY_FIX:
        return (
            "Likely fixed",
            f"Status is {status} and lastSeen is before latest Sentry stabilization commit.",
            "Keep closed; reopen only if Sentry reports recurrence in a newer release.",
        )

    if stack_files and not matched_paths:
        return (
            "Needs reproduction",
            "Sentry has stack frames, but none map cleanly to current repository paths.",
            "Use sourcemaps/backend frame context to reproduce; improve release/source-map wiring if frames remain minified or external.",
        )

    if not stack_files:
        return (
            "Needs reproduction",
            "Latest event has no usable stack trace in the API response.",
            "Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.",
        )

    if matched_paths and status in {"unresolved", "unknown"}:
        return (
            "Needs reproduction",
            "Unresolved issue maps to current source but does not show production evidence in the exported metadata.",
            "Reproduce the mapped path locally or in staging, then decide whether to fix or close as stale.",
        )

    return (
        "Likely fixed",
        f"Status is {status}; no current production recurrence evidence was exported.",
        "Keep closed or monitor for recurrence in the next production release.",
    )


def dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            result.append(value)
    return result


def audit_issues(client: SentryClient, dry_run: bool = False) -> tuple[list[AuditIssue], list[str], list[ProjectTarget]]:
    projects = client.paginate(f"/api/0/organizations/{client.org}/projects/", {"limit": 100})
    project_dicts = [project for project in projects if isinstance(project, dict)]
    targets = sentry_project_targets(project_dicts)
    warnings: list[str] = []
    source_index = load_source_index()
    audited: list[AuditIssue] = []

    for target in targets:
        if not target.slug:
            warnings.append(f"{target.name}: project ID {target.project_id} was not found in Sentry org {client.org}")
        issues, query_warnings = list_project_issues(client, target)
        warnings.extend(query_warnings)
        if dry_run:
            for issue in issues:
                audited.append(
                    AuditIssue(
                        project=target,
                        issue=issue,
                        detail=None,
                        latest_event=None,
                        stack_files=[],
                        matched_paths=[],
                        environments=[],
                        releases=[],
                        verdict="Dry run",
                        evidence="Count-only dry run.",
                        resolution="Run without --dry-run for full audit metadata.",
                    )
                )
            continue

        for issue in issues:
            issue_id = str(issue.get("id") or "")
            detail = fetch_issue_detail(client, issue_id) if issue_id else None
            latest_event = fetch_latest_event(client, issue_id) if issue_id else None
            stack_files = extract_stack_files(latest_event)
            matched_paths = match_source_paths(stack_files, source_index)
            environments = collect_environments(issue, detail, latest_event)
            releases = collect_releases(issue, detail, latest_event)
            verdict, evidence, resolution = classify_issue(
                target,
                issue,
                detail,
                latest_event,
                stack_files,
                matched_paths,
                environments,
                releases,
            )
            audited.append(
                AuditIssue(
                    project=target,
                    issue=issue,
                    detail=detail,
                    latest_event=latest_event,
                    stack_files=stack_files,
                    matched_paths=matched_paths,
                    environments=environments,
                    releases=releases,
                    verdict=verdict,
                    evidence=evidence,
                    resolution=resolution,
                )
            )
    return audited, warnings, targets


def issue_count(issue: dict[str, Any], detail: dict[str, Any] | None) -> str:
    value = (detail or {}).get("count") or issue.get("count") or issue.get("timesSeen")
    return str(value if value is not None else "unknown")


def user_count(issue: dict[str, Any], detail: dict[str, Any] | None) -> str:
    value = (detail or {}).get("userCount") or issue.get("userCount") or issue.get("numUsers")
    return str(value if value is not None else "unknown")


def issue_permalink(issue: dict[str, Any], detail: dict[str, Any] | None) -> str:
    return str((detail or {}).get("permalink") or issue.get("permalink") or "")


def issue_title(issue: dict[str, Any], detail: dict[str, Any] | None) -> str:
    return str((detail or {}).get("title") or issue.get("title") or issue.get("metadata", {}).get("title") or "Untitled")


def priority_key(item: AuditIssue) -> tuple[int, int, str]:
    verdict_rank = {"Still relevant": 0, "Needs reproduction": 1, "Noise/config": 2, "Likely fixed": 3}
    level_rank = {"fatal": 0, "error": 1, "warning": 2, "info": 3, "debug": 4, "unknown": 5}
    level = issue_level(item.issue, item.detail, item.latest_event).lower()
    return (verdict_rank.get(item.verdict, 9), level_rank.get(level, 6), item.project.name)


def md_escape(value: Any) -> str:
    text = str(value if value is not None else "")
    return text.replace("|", "\\|").replace("\n", " ").strip()


def render_report(audited: list[AuditIssue], warnings: list[str], targets: list[ProjectTarget], dry_run: bool) -> str:
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")
    lines: list[str] = [
        "# Sentry Issue Audit - 2026-05-23",
        "",
        f"Generated: {now}",
        "",
        "Scope: all Sentry issues from first capture through 2026-05-23 for the VeriPass backend, mobile, and backoffice projects.",
        "",
        "## Project Mapping",
        "",
        "| Surface | Sentry project ID | Sentry slug | Release hint |",
        "| --- | --- | --- | --- |",
    ]
    for target in targets:
        lines.append(
            f"| {target.name} | {target.project_id} | {target.slug or 'not resolved'} | {md_escape(target.release_hint)} |"
        )
    lines.extend(
        [
            "",
            "## Local Integration Context",
            "",
            "- Mobile and backoffice initialize `@sentry/react` only when `VITE_SENTRY_DSN` is present, and `beforeSend` drops non-production events.",
            "- Mobile and backoffice send envelopes through `/api/v1/sentry-proxy` to avoid browser blocking of Sentry ingest hosts.",
            "- Backend FastAPI initializes `sentry_sdk` when `SENTRY_DSN` is set and `SKIP_SENTRY` is not set, with `traces_sample_rate=0.1`.",
            "- The current proxy endpoint is hardcoded to project ID `4511114011410512`, so backoffice browser events may be forwarded into the mobile Sentry project unless the envelope target is honored or separated.",
            "",
        ]
    )

    if dry_run:
        lines.extend(
            [
                "## Dry Run Counts",
                "",
                "This report was generated with `--dry-run`; it validates extraction and pagination counts only.",
                "",
            ]
        )
    else:
        lines.extend(["## Summary", ""])

    by_project = defaultdict(list)
    for item in audited:
        by_project[item.project.name].append(item)

    lines.extend(["| Surface | Total | Still relevant | Needs reproduction | Likely fixed | Noise/config |", "| --- | ---: | ---: | ---: | ---: | ---: |"])
    for target in targets:
        items = by_project.get(target.name, [])
        counts = Counter(item.verdict for item in items)
        lines.append(
            f"| {target.name} | {len(items)} | {counts['Still relevant']} | {counts['Needs reproduction']} | {counts['Likely fixed']} | {counts['Noise/config']} |"
        )
    lines.append("")

    lines.extend(
        [
            "## Executive Remediation Themes",
            "",
            "1. **Stop backend Sentry noise from expected 4xx/422 responses.** Most backend issues are development `HTTP error:` or `Validation error:` events. They are unresolved and recent, but many are expected auth, RBAC, OTP, bad JSON, or missing-document responses. Change expected 4xx/422 paths to warning/info or filter them before Sentry, while preserving real 5xx exception capture.",
            "2. **Fix real backend defects that still map to current code.** Prioritize schema validation failures, OCR runtime errors, missing model attributes, duplicate-row query failures, notification integrity errors, and undefined-name crashes. These are not just observability noise when Sentry exports current backend stack traces.",
            "3. **Resolve mobile production issues.** Group mobile production issues into service-worker deployment/MIME failures, camera permission/timeout aborts, upload 504 handling, and offline CNI hash mismatch. Fix or suppress only after reproduction.",
            "4. **Investigate Sentry project routing.** Backoffice exported zero issues while both mobile and backoffice use `/api/v1/sentry-proxy`; the proxy is hardcoded to mobile project ID `4511114011410512`. Confirm whether backoffice frontend events are absent or being mixed into the mobile project, then split or derive the proxy target per DSN.",
            "5. **Close stale development-only issues after filtering.** Once backend logging/Sentry filtering is fixed, bulk-resolve development-only expected client errors in Sentry and monitor for recurrence in production releases.",
            "",
        ]
    )

    if warnings:
        lines.extend(["## Extraction Warnings", ""])
        for warning in warnings:
            lines.append(f"- {md_escape(warning)}")
        lines.append("")

    if not audited:
        lines.extend(
            [
                "## Audit Result",
                "",
                "No Sentry issues were exported. Verify `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and project access, then rerun the script.",
                "",
            ]
        )
        return "\n".join(lines).rstrip() + "\n"

    lines.extend(["## Issues By Surface", ""])
    for target in targets:
        items = sorted(by_project.get(target.name, []), key=priority_key)
        lines.extend([f"### {target.name}", ""])
        if not items:
            lines.extend(["No issues exported for this surface.", ""])
            continue
        lines.extend(
            [
                "| Verdict | Level | Status | Last seen | Count | Users | Issue | Environments | Releases | Matched source |",
                "| --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |",
            ]
        )
        for item in items:
            detail = item.detail
            issue = item.issue
            title = issue_title(issue, detail)
            permalink = issue_permalink(issue, detail)
            issue_cell = f"[{md_escape(title)}]({permalink})" if permalink else md_escape(title)
            matched = ", ".join(item.matched_paths[:5]) if item.matched_paths else "none"
            releases = ", ".join(item.releases[:5]) if item.releases else "unknown"
            environments = ", ".join(item.environments[:5]) if item.environments else "unknown"
            lines.append(
                "| "
                + " | ".join(
                    [
                        md_escape(item.verdict),
                        md_escape(issue_level(issue, detail, item.latest_event)),
                        md_escape(issue_status(issue, detail)),
                        md_escape((detail or {}).get("lastSeen") or issue.get("lastSeen") or "unknown"),
                        md_escape(issue_count(issue, detail)),
                        md_escape(user_count(issue, detail)),
                        issue_cell,
                        md_escape(environments),
                        md_escape(releases),
                        md_escape(matched),
                    ]
                )
                + " |"
            )
        lines.append("")

    lines.extend(["## Resolution Plan", ""])
    actionable = [item for item in sorted(audited, key=priority_key) if item.verdict in {"Still relevant", "Needs reproduction"}]
    if not actionable:
        lines.append("No still-relevant or reproduction-needed issues were exported. Keep Sentry monitored after the next production deployment.")
    else:
        for index, item in enumerate(actionable, start=1):
            detail = item.detail
            issue = item.issue
            title = issue_title(issue, detail)
            permalink = issue_permalink(issue, detail)
            matched = ", ".join(item.matched_paths[:5]) if item.matched_paths else "none"
            stack = ", ".join(item.stack_files[:5]) if item.stack_files else "none"
            lines.extend(
                [
                    f"{index}. **{item.project.name}: {md_escape(title)}**",
                    f"   - Link: {permalink or 'not exported'}",
                    f"   - Verdict: {item.verdict}",
                    f"   - Evidence: {item.evidence}",
                    f"   - Current source match: {matched}",
                    f"   - Stack files: {md_escape(stack)}",
                    f"   - Plan: {item.resolution}",
                ]
            )
    lines.extend(
        [
            "",
            "## Verification Checklist",
            "",
            "- Compare the exported issue totals with the Sentry UI totals for each project.",
            "- Spot-check at least five permalinks per project against the Sentry UI.",
            "- For each code fix, run the nearest backend unit/API tests or frontend Vitest suite.",
            "- Confirm production builds upload sourcemaps when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are configured.",
            "- Confirm whether backoffice frontend events are arriving in the backoffice project or being mixed into the mobile project by the hardcoded proxy target.",
            "",
        ]
    )
    return "\n".join(lines).rstrip() + "\n"


def to_jsonable(item: AuditIssue) -> dict[str, Any]:
    return {
        "project": dataclasses.asdict(item.project),
        "issue": item.issue,
        "detail": item.detail,
        "latest_event": item.latest_event,
        "stack_files": item.stack_files,
        "matched_paths": item.matched_paths,
        "environments": item.environments,
        "releases": item.releases,
        "verdict": item.verdict,
        "evidence": item.evidence,
        "resolution": item.resolution,
    }


def render_credentials_missing(output: pathlib.Path) -> str:
    return "\n".join(
        [
            "# Sentry Issue Audit - 2026-05-23",
            "",
            "Status: pending Sentry API credentials.",
            "",
            "This repository now includes `code/scripts/audit_sentry_issues.py`, a stdlib-only read-only audit script that exports all Sentry issues for the configured backend, mobile, and backoffice project IDs.",
            "",
            "## Required Local Environment",
            "",
            "- `SENTRY_AUTH_TOKEN`: Sentry API token with read access to org/project issues and events.",
            "- `SENTRY_ORG`: Sentry organization slug.",
            "- `SENTRY_BASE_URL`: optional, defaults to `https://sentry.io`.",
            "",
            "## Run",
            "",
            "```powershell",
            "python code\\scripts\\audit_sentry_issues.py --dry-run",
            f"python code\\scripts\\audit_sentry_issues.py --output {output}",
            "```",
            "",
            "## Audit Scope",
            "",
            "| Surface | Sentry project ID | Release hint |",
            "| --- | --- | --- |",
            "| backend | 4511114019471440 | `BICEC VeriPass@0.1.0` |",
            "| mobile | 4511114011410512 | `veripass-mobile@{APP_VERSION}` |",
            "| backoffice | 4511114014949456 | `veripass-backoffice@{APP_VERSION}` |",
            "",
            "## Local Integration Finding",
            "",
            "The backend Sentry proxy is currently hardcoded to forward envelopes to project ID `4511114011410512`. Because both mobile and backoffice frontends use `/api/v1/sentry-proxy`, the credentialed audit must verify whether backoffice browser issues are being mixed into the mobile Sentry project.",
            "",
        ]
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=pathlib.Path, default=DEFAULT_OUTPUT, help="Markdown report path.")
    parser.add_argument("--json-output", type=pathlib.Path, default=DEFAULT_JSON_OUTPUT, help="JSON evidence path.")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and print issue counts only.")
    parser.add_argument("--list-orgs", action="store_true", help="List Sentry organizations visible to SENTRY_AUTH_TOKEN.")
    parser.add_argument(
        "--write-missing-credentials-report",
        action="store_true",
        help="Write a pending-credentials report instead of failing when credentials are absent.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    token = os.getenv("SENTRY_AUTH_TOKEN")
    org = os.getenv("SENTRY_ORG")
    base_url = os.getenv("SENTRY_BASE_URL", "https://sentry.io")

    if not token or (not org and not args.list_orgs):
        message = "SENTRY_AUTH_TOKEN and SENTRY_ORG must be set in the local environment."
        if args.write_missing_credentials_report:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(render_credentials_missing(args.output), encoding="utf-8")
            print(message)
            print(f"Wrote pending-credentials report to {args.output}")
            return 2
        print(message, file=sys.stderr)
        return 2

    if not token or token.strip() in {"sntrys_...", "..."} or "..." in token:
        print("SENTRY_AUTH_TOKEN still looks like a placeholder. Set it to the full token value from Sentry.", file=sys.stderr)
        return 2

    if args.list_orgs:
        client = SentryClient(base_url=base_url, org=org or "", token=token)
        try:
            orgs = list_accessible_orgs(client)
        except SentryError as exc:
            print(str(exc), file=sys.stderr)
            return 1
        if not orgs:
            print("No Sentry organizations were visible to this token.")
            return 0
        for visible_org in orgs:
            slug = visible_org.get("slug") or visible_org.get("id") or "unknown"
            name = visible_org.get("name") or ""
            print(f"{slug}\t{name}")
        return 0

    if org and org.strip().lower() in ORG_PLACEHOLDERS:
        print(
            "SENTRY_ORG is still the example placeholder. Run `python code\\scripts\\audit_sentry_issues.py --list-orgs` "
            "with your real token, then set SENTRY_ORG to one of the printed slugs.",
            file=sys.stderr,
        )
        return 2

    client = SentryClient(base_url=base_url, org=org, token=token)
    try:
        audited, warnings, targets = audit_issues(client, dry_run=args.dry_run)
    except SentryError as exc:
        print(str(exc), file=sys.stderr)
        try:
            orgs = list_accessible_orgs(client)
        except SentryError:
            orgs = []
        if orgs:
            choices = ", ".join(str(item.get("slug") or item.get("id")) for item in orgs)
            print(f"Visible Sentry org slugs for this token: {choices}", file=sys.stderr)
        return 1

    if args.dry_run:
        by_project = defaultdict(list)
        for item in audited:
            by_project[item.project.name].append(item)
        for target in targets:
            statuses = Counter(issue_status(item.issue, None) for item in by_project.get(target.name, []))
            status_text = ", ".join(f"{status}={count}" for status, count in sorted(statuses.items())) or "none"
            print(f"{target.name} project_id={target.project_id} slug={target.slug or 'not-resolved'} total={len(by_project.get(target.name, []))} {status_text}")
        for warning in warnings:
            print(f"warning: {warning}", file=sys.stderr)
        return 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render_report(audited, warnings, targets, dry_run=False), encoding="utf-8")
    args.json_output.write_text(
        json.dumps([to_jsonable(item) for item in audited], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {args.output}")
    print(f"Wrote {args.json_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
