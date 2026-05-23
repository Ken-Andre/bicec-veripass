# Implementation Plan Template

Use this template to create a detailed implementation plan for any GitHub issue.

---

# [#XX] [LABEL] Title of Issue

**ID**: LABEL-XX

**Priority**: Critical / High / Medium / Low

**Estimate**: X SP (~Y hours)

**Status**: 🟡 Ready

**Assignee**: TBD (AI Agent)

**Epic**: Epic N - Name

**Labels**: `label1`, `label2`, `label3`

**Dependencies**: Issue #YY (if any)

---

## Description

[Detailed description of what needs to be implemented. Explain the current state, what's missing, and what the end result should look like.]

**Current state**: [What exists today]

**Goal**: [What should exist after implementation]

---

## Subtasks

#### S1: [Subtask Title]
- [ ] Action item 1
- [ ] Action item 2

#### S2: [Subtask Title]
- [ ] Action item 1
- [ ] Action item 2

#### S3: [Subtask Title]
- [ ] Action item 1
- [ ] Action item 2

---

## Acceptance Criteria

1. [Criterion 1 - testable and specific]
2. [Criterion 2 - testable and specific]
3. [Criterion 3 - testable and specific]

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `path/to/file1.py` | Create | What this file does |
| `path/to/file2.py` | Modify | What changes are needed |
| `path/to/file3.yml` | Delete | Why it's being removed |

---

## Verification Commands

```bash
# 1. [Step description]
command here

# 2. [Step description]
command here

# 3. [Step description]
command here

# 4. Run tests
pytest tests/ -v

# 5. Check linting
ruff check .
```

---

## Technical Notes

[Any additional technical context, gotchas, or considerations that the implementing agent needs to know.]

---

## References

- Requirements: [Link or reference to requirements]
- Design: [Link to design docs if any]
- Related Issues: #YY, #ZZ