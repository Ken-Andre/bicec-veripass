# Issue to Merge Workflow - Detailed Script

This document contains the detailed execution script for the complete issue-to-merge cycle.

---

## Pre-requisites
- GitHub MCP server connected
- Feature branch checked out
- All changes committed and pushed before starting

---

## Step 1: Read GitHub Issue

**Tool**: `use_mcp_tool` with GitHub MCP `issue_read`

```json
{
  "server_name": "github.com/github/github-mcp-server",
  "tool_name": "issue_read",
  "arguments": {
    "method": "get",
    "owner": "Ken-Andre",
    "repo": "bicec-veripass",
    "issue_number": <ISSUE_NUMBER>
  }
}
```

**Extract**:
- Title, description, labels
- Dependencies (other issues)
- Current status

---

## Step 2: Create Implementation Plan

1. Read `PLAN-TEMPLATE.md` from this skill directory
2. Fill in all fields based on issue details
3. Save as `implementation_plan.md` in project root
4. Present plan to user for confirmation

**Validation**: Plan must include:
- [ ] All subtasks with checkboxes
- [ ] Acceptance criteria (testable)
- [ ] Files to modify table
- [ ] Verification commands
- [ ] Technical notes

---

## Step 3: Delegate to Dev Agent

**Tool**: `new_task`

```
<context>
1. Current Work:
   [Issue description and context]

2. Key Technical Concepts:
   [Relevant tech stack, patterns]

3. Relevant Files and Code:
   [Files that need modification]

4. Problem Solving:
   [Implementation approach]

5. Pending Tasks and Next Steps:
   [From the implementation plan]
</context>

<task_progress>
[Checklist from implementation plan]
</task_progress>
```

**Instructions for dev agent**:
- Follow the plan exactly
- Commit with format: `type(scope): description`
- Push to feature branch when done
- Report completion

---

## Step 4: Launch Full Dev Workflow

**Tool**: `use_skill`

```json
{
  "skill_name": "full-dev-workflow"
}
```

**This triggers 8 agents**:
1. Codebase Explorer
2. Dev Agent
3. Test Agent
4. Research Agent
5. Regression Agent
6. Production Compiler
7. Push Agent
8. Issue Finder

---

## Step 5: Security Audit

**Tool**: `use_subagents` (3 parallel agents)

```
Agent 1: "Audit all changed files for hardcoded secrets (API keys, passwords, tokens). Report any findings."
Agent 2: "Audit all changed files for SQL injection risks (string interpolation in queries, missing parameterization). Report any findings."
Agent 3: "Audit all changed files for command injection risks (os.system, subprocess with shell=True). Report any findings."
```

**Result**: All 3 must PASS before proceeding

---

## Step 6: Git Operations

### 6.1: Stage Changes
```bash
cd code
git add -A
git status
```

### 6.2: Find Related Issues
**Tool**: `use_mcp_tool` with GitHub MCP `search_issues`

```json
{
  "server_name": "github.com/github/github-mcp-server",
  "tool_name": "search_issues",
  "arguments": {
    "query": "repo:Ken-Andre/bicec-veripass is:issue state:open",
    "owner": "Ken-Andre",
    "repo": "bicec-veripass"
  }
}
```

**Match** changed files to issue labels/descriptions

### 6.3: Commit
```bash
git commit -m "type(scope): description

Closes #XX, Refs #YY"
```

### 6.4: Push
```bash
git push origin <branch-name>
```

---

## Step 7: Monitor CI

**Check GitHub Actions**:
1. Go to repo Actions tab
2. Find latest workflow run for the branch
3. Check each job status (lint-backend, test-backend, build-mobile)

**Common CI failures**:
- Lint errors (ruff, eslint)
- Test failures (connection errors, missing env vars)
- Build failures (missing dependencies)

---

## Step 8: Fix CI Failures

For each failure:

### 8.1: Analyze Error
- Read the error message
- Identify the file and line number
- Understand the root cause

### 8.2: Fix the Issue
- Read the problematic file
- Apply the fix
- Test locally if possible

### 8.3: Commit Fix
```bash
git add <fixed-files>
git commit -m "fix(ci): description of fix"
git push origin <branch-name>
```

### 8.4: Verify
- Wait for new CI run
- Confirm fix resolves the error

---

## Step 9: Iterate

Repeat Steps 7-8 until:
- [ ] lint-backend: ✅ PASS
- [ ] test-backend: ✅ PASS
- [ ] build-mobile: ✅ PASS

---

## Step 10: Final Summary

Present to user:
```
## ✅ Complete — [Issue Title]

### Commits
- SHA: `xxxxxxx` — message
- SHA: `xxxxxxx` — message

### Issues Tagged
- #XX — Closes
- #YY — Refs

### CI Status
- lint-backend: ✅
- test-backend: ✅
- build-mobile: ✅

### Security Review: ✅ PASS

### Next Steps
Ready for PR review and merge.
```

---

## Troubleshooting

### CI Fails with DB Connection Error
- Check `conftest.py` uses correct env vars
- Verify CI workflow sets `DATABASE_URL` correctly
- Ensure PostgreSQL service container is configured

### CI Fails with Lint Error
- Run `ruff check .` locally first
- Fix all errors before pushing
- Check for unused imports (F401)
- Check for f-string without placeholders (F541)

### CI Fails with Test Error
- Check if test needs real external services
- Mock external services in tests
- Set `OTP_MODE=dev_local` for SMS tests
- Use `pytest.skip()` for unavailable services