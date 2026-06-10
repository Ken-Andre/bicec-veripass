#!/usr/bin/env python3
"""Apply timeline dates to the GitHub Project v2.

Requirements:
- `gh` authenticated with the `project` scope.
- The project must be owned by `Ken-Andre` and named `Bicec-Veripass Project`.

Safety:
- Dry-run by default. Pass `--apply` to mutate GitHub.
- Does not close issues.
- By default only updates project items whose current Status is Todo or empty.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs" / "planning" / "project-timeline-updates.json"
OWNER = "Ken-Andre"
REPO = "bicec-veripass"
PROJECT_TITLE = "Bicec-Veripass Project"
FIELD_STATUS = "Status"
FIELD_START = "Debut"
FIELD_END = "Fin"
STATUS_TARGET = "In progress"
TODO_STATUSES = {"todo", "to do", ""}


def run_gh_graphql(query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
    cmd = ["gh", "api", "graphql", "-f", f"query={query}"]
    for key, value in (variables or {}).items():
        cmd.extend(["-F", f"{key}={value}"])
    last_error = ""
    for attempt in range(1, 5):
        proc = subprocess.run(
            cmd,
            cwd=ROOT,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=90,
        )
        if proc.returncode == 0:
            return json.loads(proc.stdout)
        last_error = proc.stderr.strip() or proc.stdout.strip()
        transient = any(
            marker in last_error.lower()
            for marker in (
                "tls handshake timeout",
                "connection was aborted",
                "connection was forcibly closed",
                "i/o timeout",
                "timeout awaiting response headers",
            )
        )
        if not transient or attempt == 4:
            break
        time.sleep(5 * attempt)
    raise RuntimeError(last_error)


def project_query(after_projects: str | None = None, after_items: str | None = None) -> dict[str, Any]:
    query = """
    query($owner: String!, $afterProjects: String, $afterItems: String) {
      user(login: $owner) {
        projectsV2(first: 20, after: $afterProjects) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            number
            title
            fields(first: 60) {
              nodes {
                ... on ProjectV2FieldCommon {
                  id
                  name
                  dataType
                }
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  dataType
                  options {
                    id
                    name
                  }
                }
              }
            }
            items(first: 100, after: $afterItems) {
              pageInfo { hasNextPage endCursor }
              nodes {
                id
                content {
                  ... on Issue {
                    number
                    title
                    repository { nameWithOwner }
                  }
                }
                fieldValues(first: 40) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      optionId
                      field { ... on ProjectV2FieldCommon { name } }
                    }
                    ... on ProjectV2ItemFieldDateValue {
                      date
                      field { ... on ProjectV2FieldCommon { name } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    """
    return run_gh_graphql(query, {"owner": OWNER, "afterProjects": after_projects or "", "afterItems": after_items or ""})


def load_project() -> dict[str, Any]:
    projects: list[dict[str, Any]] = []
    after_projects = None
    while True:
        data = project_query(after_projects=after_projects)
        connection = data["data"]["user"]["projectsV2"]
        projects.extend(connection["nodes"])
        page_info = connection["pageInfo"]
        if not page_info["hasNextPage"]:
            break
        after_projects = page_info["endCursor"]

    candidates = [project for project in projects if project["title"] == PROJECT_TITLE]
    if not candidates:
        titles = ", ".join(project["title"] for project in projects)
        raise RuntimeError(f"Project not found: {PROJECT_TITLE}. Available projects: {titles}")

    project = candidates[0]
    all_items = list(project["items"]["nodes"])
    after_items = project["items"]["pageInfo"]["endCursor"]
    while project["items"]["pageInfo"]["hasNextPage"]:
        data = project_query(after_items=after_items)
        reloaded = next(p for p in data["data"]["user"]["projectsV2"]["nodes"] if p["title"] == PROJECT_TITLE)
        all_items.extend(reloaded["items"]["nodes"])
        project["items"]["pageInfo"] = reloaded["items"]["pageInfo"]
        after_items = reloaded["items"]["pageInfo"]["endCursor"]

    project["items"]["nodes"] = all_items
    return project


def field_by_name(project: dict[str, Any], name: str) -> dict[str, Any]:
    for field in project["fields"]["nodes"]:
        if field and field.get("name") == name:
            return field
    available = ", ".join(field.get("name", "") for field in project["fields"]["nodes"] if field)
    raise RuntimeError(f"Field not found: {name}. Available fields: {available}")


def status_option_id(field: dict[str, Any], target: str) -> str:
    options = field.get("options") or []
    normalized = target.casefold()
    for option in options:
        if option["name"].casefold() == normalized:
            return option["id"]
    for option in options:
        if option["name"].replace("-", " ").casefold() == normalized:
            return option["id"]
    available = ", ".join(option["name"] for option in options)
    raise RuntimeError(f"Status option not found: {target}. Available options: {available}")


def current_values(item: dict[str, Any]) -> dict[str, str]:
    values: dict[str, str] = {}
    for node in item["fieldValues"]["nodes"]:
        if not node or not node.get("field"):
            continue
        field_name = node["field"]["name"]
        if "name" in node:
            values[field_name] = node.get("name") or ""
        elif "date" in node:
            values[field_name] = node.get("date") or ""
    return values


def graphql_string(value: str) -> str:
    return json.dumps(value)


def project_value_literal(value: dict[str, str]) -> str:
    if "singleSelectOptionId" in value:
        return "{singleSelectOptionId: " + graphql_string(value["singleSelectOptionId"]) + "}"
    if "date" in value:
        return "{date: " + graphql_string(value["date"]) + "}"
    raise ValueError(f"Unsupported ProjectV2FieldValue: {value}")


def update_field(project_id: str, item_id: str, field_id: str, value: dict[str, str]) -> None:
    mutation = f"""
    mutation($project: ID!, $item: ID!, $field: ID!) {{
      updateProjectV2ItemFieldValue(
        input: {{projectId: $project, itemId: $item, fieldId: $field, value: {project_value_literal(value)}}}
      ) {{
        projectV2Item {{ id }}
      }}
    }}
    """
    run_gh_graphql(mutation, {"project": project_id, "item": item_id, "field": field_id})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Mutate GitHub Project fields. Default is dry-run.")
    parser.add_argument("--all-statuses", action="store_true", help="Update even if current status is not Todo/empty.")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of manifest rows processed.")
    parser.add_argument("--issues", default="", help="Comma-separated issue numbers to process.")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    rows = manifest["updates"]
    if args.issues:
        wanted = {int(value.strip().lstrip("#")) for value in args.issues.split(",") if value.strip()}
        rows = [row for row in rows if int(row["issue"]) in wanted]
    if args.limit:
        rows = rows[: args.limit]

    project = load_project()
    status_field = field_by_name(project, FIELD_STATUS)
    start_field = field_by_name(project, FIELD_START)
    end_field = field_by_name(project, FIELD_END)
    target_option = status_option_id(status_field, STATUS_TARGET)

    item_by_issue: dict[int, dict[str, Any]] = {}
    for item in project["items"]["nodes"]:
        content = item.get("content")
        if not content or content.get("repository", {}).get("nameWithOwner") != f"{OWNER}/{REPO}":
            continue
        item_by_issue[int(content["number"])] = item

    planned = []
    skipped = []
    for row in rows:
        issue = int(row["issue"])
        item = item_by_issue.get(issue)
        if not item:
            skipped.append({"issue": issue, "reason": "project_item_not_found"})
            continue
        values = current_values(item)
        current_status = values.get(FIELD_STATUS, "")
        if not args.all_statuses and current_status.casefold() not in TODO_STATUSES:
            skipped.append({"issue": issue, "reason": f"status_is_{current_status or 'empty'}"})
            continue

        planned.append(
            {
                "issue": issue,
                "item_id": item["id"],
                "status_before": current_status or "",
                "status_after": STATUS_TARGET,
                "debut_before": values.get(FIELD_START, ""),
                "debut_after": row["debut"],
                "fin_before": values.get(FIELD_END, ""),
                "fin_after": row["fin"],
                "title": row["title"],
            }
        )

        if args.apply:
            update_field(project["id"], item["id"], status_field["id"], {"singleSelectOptionId": target_option})
            update_field(project["id"], item["id"], start_field["id"], {"date": row["debut"]})
            update_field(project["id"], item["id"], end_field["id"], {"date": row["fin"]})

    print(json.dumps({"apply": args.apply, "planned": planned, "skipped": skipped}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        if "read:project" in str(exc) or "project" in str(exc).lower():
            print("Hint: run `gh auth refresh -h github.com -s project` and complete the browser authorization.", file=sys.stderr)
        raise SystemExit(1)
