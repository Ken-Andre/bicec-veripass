# Directory Index

Updated: 2026-05-28

This index covers the top-level project documentation in `docs/`. Hidden files are skipped. Large generated evidence and temporary artifact folders are summarized instead of expanded file-by-file.

## Primary Maintainer Documentation

Read this set first for project handover and maintenance:

- **[maintainer-handbook.md](./maintainer-handbook.md)** - End-to-end handover guide and source-of-truth map
- **[project-overview.md](./project-overview.md)** - Product, users, runtime system, and core workflows
- **[architecture.md](./architecture.md)** - Current implemented architecture for backend, frontends, infrastructure, async jobs, and security boundaries
- **[source-tree-analysis.md](./source-tree-analysis.md)** - Annotated repository map and where-to-change guide
- **[development-guide.md](./development-guide.md)** - Local setup, commands, tests, change recipes, and safety rules
- **[api-contracts.md](./api-contracts.md)** - API namespaces, contracts, roles, and endpoint map
- **[data-models.md](./data-models.md)** - PostgreSQL model map, relationships, migrations, storage, retention, and backups
- **[component-inventory.md](./component-inventory.md)** - Mobile and backoffice routes, components, services, and ownership map
- **[deployment-guide.md](./deployment-guide.md)** - Docker Compose deployment, environment, volumes, verification, and production-hardening checklist
- **[operations-runbook.md](./operations-runbook.md)** - Troubleshooting procedures for API, OCR, Celery, frontend routing, auth, backups, and evidence

Scope correction: VeriPass is the KYC onboarding, verified identity storage, and auth/eligibility guardrail for downstream BICEC mobile apps. It is not a DGI, Sopra Amplitude, or core banking integration layer, now or as a planned future path. Older planning artifacts or diagrams that say otherwise are historical and obsolete on this point.

## Files

### Maintainer Documentation

- **[api-contracts.md](./api-contracts.md)** - API namespaces, roles, and endpoint map
- **[architecture.md](./architecture.md)** - Implemented runtime and software architecture
- **[component-inventory.md](./component-inventory.md)** - Mobile and backoffice UI inventory
- **[data-models.md](./data-models.md)** - Database model and storage guide
- **[deployment-guide.md](./deployment-guide.md)** - Docker Compose deployment guide
- **[development-guide.md](./development-guide.md)** - Local development and test guide
- **[maintainer-handbook.md](./maintainer-handbook.md)** - Primary handover handbook
- **[operations-runbook.md](./operations-runbook.md)** - Operations and incident response runbook
- **[project-overview.md](./project-overview.md)** - Project overview and workflow summary
- **[source-tree-analysis.md](./source-tree-analysis.md)** - Annotated source tree and change map

### Audit, Review, And Investigation

- **[AUDIT-REPORT-2026-03-19.md](./AUDIT-REPORT-2026-03-19.md)** - Project audit and handoff report
- **[investigation-502-error-report.md](./investigation-502-error-report.md)** - Pin verification 502 investigation
- **[REVIEW-REPORT-2026-03-21.md](./REVIEW-REPORT-2026-03-21.md)** - Authentication module code review
- **[sentry-issue-audit-2026-05-23.md](./sentry-issue-audit-2026-05-23.md)** - Sentry issue remediation audit

### Delivery And Tracking

- **[demo-scenario-mvp-2026-05-20.md](./demo-scenario-mvp-2026-05-20.md)** - MVP demo scenario script
- **[kyc-mvp-hardening-note-2026-05-25.md](./kyc-mvp-hardening-note-2026-05-25.md)** - KYC MVP hardening notes
- **[mvp-delivery-runbook-2026-05-20.md](./mvp-delivery-runbook-2026-05-20.md)** - MVP delivery runbook
- **[stage-final-delivery-tracker.md](./stage-final-delivery-tracker.md)** - Final stage proof tracker
- **[stage-final-truth-audit-2026-05-23.md](./stage-final-truth-audit-2026-05-23.md)** - Final delivery truth audit

### Integration Planning

- **[consultant-integration-prompt.md](./consultant-integration-prompt.md)** - Consultant integration prompt
- **[integration-analysis](./integration-analysis)** - Integration progress report
- **[integration-analysis-gatekeeper.md](./integration-analysis-gatekeeper.md)** - Gatekeeper integration analysis
- **[stitch-prompts.md](./stitch-prompts.md)** - Stitch prompt collection

### Issue And Test Reports

- **[analysis-issue-9-ports-wsl2.md](./analysis-issue-9-ports-wsl2.md)** - Issue 9 port analysis
- **[CHANGELOG-issue-9.md](./CHANGELOG-issue-9.md)** - Issue 9 implementation changelog
- **[issue-183-implementation-report.md](./issue-183-implementation-report.md)** - PostgreSQL backup implementation report
- **[test-report-2026-03-18.md](./test-report-2026-03-18.md)** - March 2026 test report
- **[test-results-issue-9-real.md](./test-results-issue-9-real.md)** - Issue 9 real test results

### Operations And Infrastructure

- **[git-workflow-notes.md](./git-workflow-notes.md)** - Pull request workflow notes
- **[onboarding-guide.md](./onboarding-guide.md)** - Project onboarding guide
- **[oracle-cloud-plan.md](./oracle-cloud-plan.md)** - GLM-OCR Oracle Cloud plan
- **[retention-policy.md](./retention-policy.md)** - KYC data retention policy
- **[setup-wsl2-windows.md](./setup-wsl2-windows.md)** - Windows WSL2 setup guide

### Product, UX, And Reference

- **[Fonctionnalité_Interaction_Erreurs.csv](./Fonctionnalité_Interaction_Erreurs.csv)** - UX interactions source table
- **[Fonctionnalité_Interaction_Erreurs.md](./Fonctionnalité_Interaction_Erreurs.md)** - UX interactions specification
- **[notes.md](./notes.md)** - Working notes and references
- **[progress-tracker-M0-M1.md](./progress-tracker-M0-M1.md)** - M0 and M1 progress tracker
- **[ressources_bureautique_gratuites.md](./ressources_bureautique_gratuites.md)** - Free office learning plan
- **[ressources_bureautique_gratuites.pdf](./ressources_bureautique_gratuites.pdf)** - Free office learning PDF

### Supporting Artifacts

- **[Bicec_logo.jpg](./Bicec_logo.jpg)** - BICEC logo image asset
- **[index.md](./index.md)** - This directory index
- **[Screenshot_References.csv](./Screenshot_References.csv)** - Screenshot reference index
- **[sentry-issue-audit-2026-05-23.json](./sentry-issue-audit-2026-05-23.json)** - Raw Sentry audit export

## Subdirectories

### adr/

- **[ADR-001-etats-acces-transitions.md](./adr/ADR-001-etats-acces-transitions.md)** - Access state transition decision
- **[ADR-015-tls-security-headers.md](./adr/ADR-015-tls-security-headers.md)** - TLS and security headers decision
- **[ADR-016-redis-namespaces-data-model.md](./adr/ADR-016-redis-namespaces-data-model.md)** - Redis namespace data model
- **[ADR-017-gestion-dynamique-gab-admin.md](./adr/ADR-017-gestion-dynamique-gab-admin.md)** - Dynamic ATM administration decision

### agents_output/

- **[00_INTEGRATION_MASTER_PLAN.md](./agents_output/00_INTEGRATION_MASTER_PLAN.md)** - Prototype migration master plan
- **[01_mobile_gap_analysis.md](./agents_output/01_mobile_gap_analysis.md)** - Mobile prototype gap analysis
- **[02_backoffice_gap_analysis.md](./agents_output/02_backoffice_gap_analysis.md)** - Backoffice prototype gap analysis
- **[03_issue_traceability_matrix.md](./agents_output/03_issue_traceability_matrix.md)** - Milestone issue traceability matrix
- **[04_documentation_audit.md](./agents_output/04_documentation_audit.md)** - Documentation audit and priorities
- **[05_M2_milestone3_deep_analysis_2026-04-12.md](./agents_output/05_M2_milestone3_deep_analysis_2026-04-12.md)** - M2 milestone gap analysis
- **[06_M2_delegation_checklists_agent_prompts_2026-04-12.md](./agents_output/06_M2_delegation_checklists_agent_prompts_2026-04-12.md)** - M2 delegation task cards
- **[07_M2_quality_gate_evidence_2026-04-15.md](./agents_output/07_M2_quality_gate_evidence_2026-04-15.md)** - M2 quality gate evidence
- **[08_M2_kyc_marie_end_to_end_flow_diagram_2026-04-19.md](./agents_output/08_M2_kyc_marie_end_to_end_flow_diagram_2026-04-19.md)** - Marie KYC flow diagram
- **[INTEGRATION_MASTER_PLAN.md](./agents_output/INTEGRATION_MASTER_PLAN.md)** - Current integration master plan
- **[agent1_biveripass_analysis.md](./agents_output/agent1_biveripass_analysis.md)** - Mobile prototype inventory report
- **[agent2_gatekeeper_analysis.md](./agents_output/agent2_gatekeeper_analysis.md)** - Gatekeeper backoffice analysis
- **[agent3_integration_plan.md](./agents_output/agent3_integration_plan.md)** - Cross-analysis integration plan
- **[agent4_docs_audit.md](./agents_output/agent4_docs_audit.md)** - Full documentation audit

### articles/

- **[guide-complet-ocr-systeme-production-cni-cameroun.md](./articles/guide-complet-ocr-systeme-production-cni-cameroun.md)** - Cameroon CNI OCR guide

### diagrams/

- **[adr-state-mapping.md](./diagrams/adr-state-mapping.md)** - Lifecycle to access mapping
- **[empathy-maps.md](./diagrams/empathy-maps.md)** - User empathy maps
- **[er-application-mermaid.md](./diagrams/er-application-mermaid.md)** - Application entity relationship diagram
- **[information-architecture.md](./diagrams/information-architecture.md)** - Platform information architecture
- **[sequence-capture-upload-mermaid.md](./diagrams/sequence-capture-upload-mermaid.md)** - Capture upload sequence diagram
- **[state-machine-kyc-v3-updated.md](./diagrams/state-machine-kyc-v3-updated.md)** - Updated KYC state machine
- **[statechart-access-mermaid.md](./diagrams/statechart-access-mermaid.md)** - Access statechart diagram
- **[use-case-diagrams.md](./diagrams/use-case-diagrams.md)** - Actor use case diagrams
- **[user-journey-maps.md](./diagrams/user-journey-maps.md)** - Role-based journey maps
- **[user-personas.md](./diagrams/user-personas.md)** - Core user personas

#### diagrams/architecture/

- **[information-architecture.md](./diagrams/architecture/information-architecture.md)** - Detailed role information architecture
- **[sitemap-diagram.md](./diagrams/architecture/sitemap-diagram.md)** - Complete platform sitemap

#### diagrams/flows/

- **[cni-capture-task-flow.md](./diagrams/flows/cni-capture-task-flow.md)** - CNI capture task flow
- **[end-to-end-user-flow.md](./diagrams/flows/end-to-end-user-flow.md)** - End-to-end onboarding flow
- **[liveness-verification-task-flow.md](./diagrams/flows/liveness-verification-task-flow.md)** - Liveness verification task flow
- **[ocr-review-task-flow.md](./diagrams/flows/ocr-review-task-flow.md)** - OCR review task flow
- **[secure-upload-task-flow.md](./diagrams/flows/secure-upload-task-flow.md)** - Secure upload task flow

### schema/

- **[ddl-complete.sql](./schema/ddl-complete.sql)** - PostgreSQL schema reference DDL

### test-evidence/

- **[latest/api/day1-live-api-proof-2026-05-22.md](./test-evidence/latest/api/day1-live-api-proof-2026-05-22.md)** - Day 1 API proof
- **[latest/api/day3-device-enforcement-proof-2026-05-23.md](./test-evidence/latest/api/day3-device-enforcement-proof-2026-05-23.md)** - Device enforcement API proof
- **[latest/api/day3-live-api-proof-2026-05-22.md](./test-evidence/latest/api/day3-live-api-proof-2026-05-22.md)** - Day 3 API proof
- **[latest/api/day3-support-compat-retirement-proof-2026-05-23.md](./test-evidence/latest/api/day3-support-compat-retirement-proof-2026-05-23.md)** - Support compatibility retirement proof
- **[latest/backoffice/](./test-evidence/latest/backoffice/)** - Backoffice screenshots and reports
- **[latest/kyc-happy-path/README.md](./test-evidence/latest/kyc-happy-path/README.md)** - KYC happy path evidence
- **[latest/mobile/](./test-evidence/latest/mobile/)** - Mobile screenshots and reports
- **[ocr-beta-loop/report.md](./test-evidence/ocr-beta-loop/report.md)** - CNI OCR beta evidence

### test_tmp_trash/

- **[completion_certificate.pdf](./test_tmp_trash/completion_certificate.pdf)** - Temporary completion certificate artifact
- **[onboarding-system-design-wireframe/README.md](./test_tmp_trash/onboarding-system-design-wireframe/README.md)** - Temporary onboarding wireframe project

### troubleshooting/

- **[dev-environment-bugs.md](./troubleshooting/dev-environment-bugs.md)** - Development environment bug guide
- **[nginx-tls-errors.md](./troubleshooting/nginx-tls-errors.md)** - Nginx TLS troubleshooting guide
