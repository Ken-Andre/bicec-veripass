# Final technical sections - VeriPass internship report

This document is insertion-ready material for issue #165. It consolidates the
technical contribution, architecture and AI/data sections without editing the
current Word document in the working tree.

## 1. Technical contribution

The internship contribution is the design and implementation of a demonstrable
KYC pre-opening platform for BICEC. The delivered system connects four concerns
that are often treated separately in prototypes:

- client-side onboarding through a mobile PWA;
- backend orchestration of KYC sessions, documents, statuses and decisions;
- AI-assisted evidence extraction through OCR and biometric/liveness checks;
- back-office review, compliance supervision and audit evidence.

The project therefore proves more than a screen flow. It proves that a KYC
dossier can move through a regulated lifecycle while preserving evidence,
human accountability and operational visibility.

## 2. Architecture summary

The system follows a modular full-stack architecture:

- Mobile PWA: used by Marie to authenticate, capture documents, complete
  liveness/address/NIU/consent and submit a dossier.
- FastAPI backend: central API surface for authentication, KYC state, document
  metadata, OCR results, back-office review and compliance modules.
- PostgreSQL: durable storage for users, sessions, documents, OCR fields,
  audit events and operational entities.
- Redis/Celery: asynchronous execution layer for OCR, notifications and
  scheduled jobs.
- Back-office SPA: operational interface for Jean, Thomas, Sylvie and Admin IT.
- Nginx/Docker Compose: local demo topology and reverse-proxy layer.

The architecture intentionally separates KYC approval from downstream banking
activation. The MVP prepares and validates evidence; it does not replace core
banking, DGI or production AML services.

## 3. KYC state model

The KYC state machine is the backbone of the product. The important statuses are:

- `DRAFT`: the client is still building the dossier.
- `PENDING_AGENT_REVIEW`: the dossier has been submitted and awaits review.
- `PENDING_INFO`: an agent requested additional information.
- `APPROVED`: the dossier has been accepted by back office.
- `REJECTED`: the dossier has been rejected.
- `FRAUD_SUSPECT`: the dossier is blocked by a fraud/compliance concern.

The key design decision is that status and access level are different concepts.
A dossier can be reviewed or approved without implying immediate access to all
banking services. This is essential in a regulated banking context.

## 4. Data and AI contribution

The AI/data contribution is positioned as assisted decision support, not
autonomous banking decisioning.

OCR is used to reduce manual entry by extracting fields from CNI evidence. The
system keeps these fields visible and correctable because OCR confidence can be
imperfect, especially on low-quality captures. Biometric and liveness checks add
presence evidence and help agents identify risk signals. The back-office view
then exposes the relevant evidence to the human reviewer.

This design avoids the main risk of black-box automation: a client should not be
accepted or rejected only because an OCR or biometric component returned a score.
The score must be accompanied by document evidence, confidence values, audit
history and an explicit agent decision.

## 5. Observability and evidence

The project uses evidence artifacts to support delivery claims:

- Playwright/evidence screenshots for mobile and back-office flows.
- KYC compliance demo screenshots showing AML import, role restrictions and
  approval blocking.
- Planning exports from GitHub issues and commits.
- Architecture diagrams and maintainer documentation.

For the final report, these artifacts should be used as proof of implementation
rather than decorative screenshots. Each screenshot should support a specific
claim: mobile capture, agent review, compliance blocking, audit/export or
project planning traceability.

## 6. Testing and remaining gaps

The current project contains several types of tests and evidence scripts:

- mobile end-to-end evidence flows;
- back-office visual and role-based evidence flows;
- API acceptance scripts for happy-path KYC;
- code-level tests for selected backend/frontend modules.

The main remaining gap is not the absence of tests, but coverage consolidation.
Before production or pilot, the project should enforce a smaller set of
repeatable gates:

- backend unit/integration tests for authentication, KYC state transitions,
  document upload, OCR routing and decision rules;
- frontend tests for the Marie and Jean critical paths;
- Playwright smoke tests for one full happy path and one blocked compliance path;
- performance checks for OCR/liveness on target hardware;
- security checks for secrets, TLS, storage and role access.

## 7. Production boundaries

The MVP must be presented with clear boundaries:

- no direct production DGI integration;
- no production core-banking account creation;
- no claim that demo AML data is a real sanctions provider;
- no guarantee of production OCR/liveness accuracy without pilot metrics;
- no production deployment without secrets management, TLS automation, backups
  and monitoring.

These boundaries make the project stronger. They show that VeriPass is a
credible pilot foundation, not an overclaimed prototype.

## 8. Suggested figures

Recommended figures for the final report:

| Figure | Source |
| --- | --- |
| Logical architecture | `docs/rapport-stage/figures/word-ready/figure_01_architecture_logique_veripass.png` |
| KYC data model | `docs/rapport-stage/figures/word-ready/figure_06_modele_logique_donnees_kyc.png` |
| C4 overview | `docs/c4-architecture/BICEC-VERIPASS-VUE-ENSEMBLE.pdf` |
| Mobile evidence | `docs/test-evidence/latest/mobile/screens/` |
| Back-office evidence | `docs/test-evidence/latest/backoffice/screens/` |
| Compliance evidence | `docs/test-evidence/latest/kyc-compliance-demo/README.md` |
| Planning evidence | `docs/planning/github-open-issues-inventory.md` |

## 9. Final wording for the report

The final report should describe VeriPass as:

> a demonstrable MVP for auditable KYC pre-opening, combining mobile client
> onboarding, AI-assisted evidence extraction, human back-office review and
> compliance supervision.

Avoid describing it as:

> a production-ready account-opening system fully integrated with all external
> banking systems.

The first wording is supported by the current code and evidence. The second
would require a future integration and hardening phase.
