---
name: issue-to-merge-workflow
description: Complete development cycle from GitHub issue to merged PR - plan, implement, review, fix CI, commit, push
---

# Issue to Merge Workflow

Orchestrates the complete development cycle for a GitHub issue: from reading the issue, creating a detailed implementation plan, delegating to a dev agent, running full review workflow, fixing CI failures, and committing with proper tags.

## Usage

When the user provides a GitHub issue (number or description), execute this end-to-end workflow to deliver a production-ready PR.

## Input

The user provides either:
- A GitHub issue number (e.g., "Issue #45")
- An issue description with format: `[#XX] [LABEL] Title`

## Workflow Steps

### Step 1: Read Issue
Use GitHub MCP `issue_read` to fetch issue details:
- Title, description, labels
- Dependencies, priority
- Current status

### Step 2: Create Implementation Plan
Use `PLAN-TEMPLATE.md` to create a detailed, structured plan:
- ID, Priority, Estimate
- Description, Subtasks
- Acceptance Criteria
- Files to Modify
- Verification Commands

The plan must be:
- Complete but not overengineered
- Executable by any AI agent
- Self-contained with all context needed

### Step 3: Delegate to Dev Agent
Create a `new_task` with:
- The full implementation plan
- Context from the issue
- Instructions to implement and push

### Step 4: Run Full Dev Workflow
After dev agent completes, use `use_skill` to launch `full-dev-workflow`:
- 8 specialized agents review code
- Security audit via 3 parallel sub-agents
- Quality, tests, deployment readiness

### Step 5: Git Operations
- Stage changes with `git add`
- Find related issues with GitHub MCP `search_issues`
- Commit with format: `type(scope): description\n\nCloses #XX, Refs #YY`
- Push to feature branch

### Step 6: Monitor CI
- Check GitHub Actions status
- Identify failures (lint, tests, build)

### Step 7: Fix CI Failures
For each failure:
- Analyze error message
- Fix the issue
- Commit fix
- Push
- Verify CI passes

### Step 8: Iterate
Repeat Steps 6-7 until all CI jobs pass.

### Step 9: Confirm Completion
Present final summary:
- Commits pushed
- Issues tagged
- CI status
- PR readiness

## Output Files
- `implementation_plan.md` - Detailed plan for the issue
- Commits on feature branch with proper tags

## Commit Message Format
```
type(scope): description

Closes #XX, Refs #YY
```

Types: feat, fix, docs, style, refactor, test, chore
Scopes: backend, mobile, backoffice, infra, docs, db, test

## Validation Points
- After creating plan: confirm with user before delegating
- After dev agent completes: launch full-dev-workflow
- After each CI fix: verify fix before pushing
- Before final push: confirm with user