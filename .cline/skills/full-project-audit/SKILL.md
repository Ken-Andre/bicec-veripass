---
name: full-project-audit
description: Performs a comprehensive audit of the bicec-veripass project using parallel sub-agents to analyze Docker, backend, frontend, and documentation
---

# Full Project Audit

Performs a comprehensive audit of the bicec-veripass project using parallel sub-agents.

## Usage

When the user requests a full project audit, health check, or code review, execute this workflow.

## Steps

### Step 1: Check GitHub Issues
Use the GitHub MCP server to list all open issues:
- Server: github.com/github/github-mcp-server
- Tool: list_issues
- Owner: Ken-Andre
- Repo: bicec-veripass
- State: OPEN

### Step 2: Launch 5 Parallel Sub-Agents
Use `use_subagents` with these prompts:

**Prompt 1 - Docker Analysis:**
Analyze Docker configuration in code/docker-compose.yml, code/backend/Dockerfile, code/mobile/Dockerfile, code/backoffice/Dockerfile, code/infra/nginx/Dockerfile. Check for: configuration issues, missing healthchecks, port conflicts, volume mount issues, environment variable problems, security concerns.

**Prompt 2 - Backend Analysis:**
Analyze backend Python code in code/backend/app/ for bugs, linting issues, code quality. Check: import errors, syntax errors, PEP 8 compliance, runtime errors, security vulnerabilities, missing error handling. Focus on main.py, core/config.py, core/security.py, api/v1/router.py, modules/*/models.py.

**Prompt 3 - Frontend Analysis:**
Analyze frontend code in code/mobile/src/ and code/backoffice/src/ for bugs, linting issues, code quality. Check: TypeScript errors, missing imports, React component issues, API client configuration, state management, UI/UX problems.

**Prompt 4 - Documentation Analysis:**
Analyze documentation completeness. Check: README.md, ADR documents in docs/adr/, architecture documents in _bmad-output/planning-artifacts/, API documentation, testing documentation in code/docs/TESTING.md.

**Prompt 5 - Task Tracking:**
Create task tracking document based on open GitHub issues. Organize by: Epic (1-8), Sprint priority, dependencies, implementation status, estimated effort.

### Step 3: Generate Report
Create comprehensive audit report at docs/AUDIT-REPORT-YYYY-MM-DD.md with:
- Executive summary table (Critical/High/Medium/Low per category)
- Detailed findings for each category
- Task tracking summary
- Recommended action plan
- Context handoff notes

### Step 4: Present Results
Use attempt_completion to present results with summary and command to view full report.

## Output
- Report file: docs/AUDIT-REPORT-YYYY-MM-DD.md
- Summary of critical issues
- Recommended next steps