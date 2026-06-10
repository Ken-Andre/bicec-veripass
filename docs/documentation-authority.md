# Documentation Authority

Updated: 2026-05-28

Audience: anyone assigned to maintain, review, extend, or take responsibility for BICEC VeriPass.

## Purpose

This repository contains current handover documentation, older planning artifacts, implementation reports, generated diagrams, prototype integration notes, and test evidence. They do not all have the same authority.

Use this document to know what to trust. Some Markdown files are valuable historical context, but they are not allowed to define the current product scope or future roadmap.

## Product Scope Boundary

The current product boundary is:

- VeriPass captures, stores, verifies, and audits KYC dossiers.
- VeriPass keeps verified KYC state in its own database.
- VeriPass acts as an authentication and eligibility guardrail before sending approved users to configured BICEC mobile apps.
- BI PAY, BICEC Mobile-Banking, and BICEC Wallet access should use OS-aware app links, deep links, or store redirects.
- DGI, Sopra Amplitude, Axway-to-core-banking provisioning, and transactional core banking integration are outside the product scope and must not be treated as commitments.

## Authority Levels

| Level | Meaning | Use for future work | Examples |
| --- | --- | --- | --- |
| Canonical current docs | Current handover layer generated from the implemented codebase and corrected product scope | Yes | `maintainer-handbook.md`, `project-overview.md`, `architecture.md`, `api-contracts.md`, `data-models.md`, `source-tree-analysis.md`, `component-inventory.md`, `development-guide.md`, `deployment-guide.md`, `operations-runbook.md` |
| Implementation source of truth | Actual behavior | Yes; code wins when docs disagree | `code/backend`, `code/mobile`, `code/backoffice`, `code/docker-compose.yml`, Alembic migrations |
| Current operational references | Useful for setup, operations, retention, evidence, or troubleshooting | Yes, but verify against code | `onboarding-guide.md`, `retention-policy.md`, `setup-wsl2-windows.md`, `troubleshooting/*`, `kyc-mvp-hardening-note-2026-05-25.md` |
| Dated reports and audits | Snapshot of issues or evidence at a specific date | No roadmap authority | audit reports, review reports, issue reports, test reports, `stage-final-*`, `test-evidence/*` |
| Historical planning and prototype artifacts | Earlier ideas, PRD drafts, UX diagrams, backlog, prototype migration plans | No decision authority | `_bmad-output/planning-artifacts/*`, `docs/agents_output/*`, `docs/diagrams/*`, `docs/stitch-prompts.md`, `docs/consultant-integration-prompt.md`, `docs/integration-analysis-gatekeeper.md` |
| Temporary trash/prototype folders | Imported prototypes or scratch artifacts | Do not use | `docs/test_tmp_trash/*` |

## Canonical Reading Path

Read in this order when taking over the project:

1. `docs/documentation-authority.md`
2. `docs/maintainer-handbook.md`
3. `docs/project-overview.md`
4. `docs/architecture.md`
5. `docs/source-tree-analysis.md`
6. `docs/development-guide.md`
7. `docs/api-contracts.md`
8. `docs/data-models.md`
9. `docs/component-inventory.md`
10. `docs/deployment-guide.md`
11. `docs/operations-runbook.md`

After that, use dated reports and historical diagrams only to understand how the project evolved.

## Superseded Claims

If any old document says one of the following, treat it as superseded:

- VeriPass will integrate with DGI.
- VeriPass will integrate with Sopra Amplitude.
- VeriPass will provision bank accounts through Axway or a core banking system.
- Thomas owns an Amplitude batch monitor as a product requirement.
- The mobile app is Flutter; the implemented mobile app is React/Vite PWA.
- Old KYC states such as `READY_FOR_OPS`, `PROVISIONING`, `OPS_ERROR`, `ACCOUNT_CREATED`, or `VALIDATED_PENDING_AGENCY` define the implemented workflow.
- A historical "Phase 2" or backlog item is automatically a future roadmap decision.

The implemented backend currently defines the state/access model in `code/backend/app/modules/kyc/schemas.py`. Future decisions must come from a new explicit requirement, issue, ADR, or code change, not from historical Markdown.

## Decision Rules

When documents disagree:

1. Implemented code and migrations define current behavior.
2. Canonical current docs explain the intended handover model.
3. Current ADRs can explain decisions only if they are not contradicted by code or by a later scope note.
4. Historical planning docs can explain why an idea existed, but they cannot authorize new work.
5. Any future product or architecture change must update the canonical docs and, when architectural, add or update an ADR.

## Cleanup Candidates

These files or folders should eventually be archived, renamed, or prefixed with historical warnings if the repository is prepared for final delivery:

| Path | Why |
| --- | --- |
| `_bmad-output/planning-artifacts/*` | Contains early PRD, architecture, backlog, and research claims that no longer match implemented scope |
| `docs/diagrams/*` | Several diagrams still contain DGI/Sopra/Amplitude/core-banking flows and old state names |
| `docs/agents_output/*` | Integration analysis snapshots from earlier prototype consolidation work |
| `docs/stitch-prompts.md` | Prompt inventory for old UI generation, not current implementation guidance |
| `docs/consultant-integration-prompt.md` | Prototype integration prompt, not current architecture |
| `docs/test_tmp_trash/*` | Scratch/prototype material; should not be used for maintenance |

Do not delete these without a deliberate cleanup task. Until then, treat them as historical only.
