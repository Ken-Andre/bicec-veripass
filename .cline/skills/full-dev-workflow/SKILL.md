---
name: full-dev-workflow
description: Orchestrates a multi-agent development workflow with 8 specialized agents for implementing, testing, and deploying features
---

# Full Development Workflow

Orchestrates a multi-agent development workflow for implementing features, testing, and deploying.

## Usage

When the user requests to implement a feature with full testing workflow, execute this multi-agent pipeline.

## Agent Roles

### 1. Codebase Explorer
Understand the entire codebase before any work begins. Read project structure, architecture documents, existing code patterns, testing conventions, Docker setup. Output a comprehensive brief for all other agents.

### 2. Dev Agent
Implement features and fix bugs. Follow the codebase explorer brief for patterns and conventions. Write clean, maintainable code with error handling.

### 3. Test Agent
Write and run tests WITHOUT committing. Follow testing conventions. Run tests using pytest (backend) or bun test (frontend). Report pass/fail status with details.

### 4. Research Agent
Research solutions on the internet when needed. Use web search for documentation, Stack Overflow, GitHub issues, and other online resources. Only activate when explicitly asked.

### 5. Regression Agent
Track issues for regression testing. Document bugs, add to regression test suite, maintain known issues list.

### 6. Production Compiler
Build and verify production artifacts. Build backend, mobile, backoffice, Docker. Verify with MCP tools. Act like human QA.

### 7. Push Agent
Commit and push when all agents approve. Follow git conventions. Write clear commit messages in format: type(scope): description.

### 8. Issue Finder
Find the next 2 relevant issues to work on. Use GitHub MCP to list issues. Analyze sprint priorities and dependencies.

## Workflow Phases

### Phase 1: Understanding
1. Launch Codebase Explorer Agent
2. Wait for brief completion
3. Share brief with all other agents

### Phase 2: Implementation
1. Launch Dev Agent with task + brief
2. Dev Agent implements feature/fix
3. Dev Agent reports completion

### Phase 3: Testing
1. Launch Test Agent with Dev's output
2. Test Agent writes and runs tests
3. If tests FAIL: report errors, launch Dev Agent to fix, loop back
4. If tests PASS: launch Regression Agent to document

### Phase 4: Research (if needed)
1. If any agent encounters unknown error
2. Launch Research Agent with error details
3. Research Agent finds solution
4. Solution passed back to requesting agent

### Phase 5: Production Verification
1. Launch Production Compiler Agent
2. Agent builds all artifacts
3. Agent verifies with MCP tools
4. If issues found: report to Dev Agent, loop back
5. If all clear: report success

### Phase 6: Release
1. All agents provide approval
2. Launch Push Agent
3. Push Agent commits and pushes
4. Success reported to user

### Phase 7: Next Issues
1. Launch Issue Finder Agent
2. Agent finds 2 relevant issues
3. Issues presented to user for selection

## Validation Points

Ask user for explicit validation at:
- Before starting implementation
- When Test Agent finds failures
- When Research Agent finds multiple solutions
- Before Production Compiler runs
- Before Push Agent commits
- When Issue Finder presents next issues

## Output Files
- docs/workflow-brief-YYYY-MM-DD.md - Codebase explorer brief
- docs/test-report-YYYY-MM-DD.md - Test results
- docs/regression-log.md - Regression test log
- docs/production-verify-YYYY-MM-DD.md - Production verification report

## Commit Message Format
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
Scopes: backend, mobile, backoffice, infra, docs