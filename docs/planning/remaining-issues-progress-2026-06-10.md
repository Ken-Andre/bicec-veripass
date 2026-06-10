# Remaining issues progress - 2026-06-10

Source plan: `docs/planning/remaining-issues-action-plan.md`

Constraints respected:

- No GitHub issue was closed.
- No Docker container was launched.
- Existing dirty Word/report artifacts were not modified.

## Completed or materially advanced in this pass

| Issue | Result | Evidence | Timeline decision |
| --- | --- | --- | --- |
| #192 `[ADDRESS-06] Frontend - Final Consent checkboxes and Summary` | Completed in the mobile final review screen. Submission now requires three final confirmations: information accuracy, BICEC sharing authorization, and CGU/privacy acceptance. | `code/mobile/src/views/kyc/ReviewScreen.tsx`, `code/mobile/src/views/kyc/ReviewScreen.test.tsx` | Can be dated from the commit that adds the final confirmation gate. |
| #167 `[DEMO-03] Script de demo - Walkthrough 10 minutes` | Completed as a repo artifact. The requested line-by-line 10-minute script and 5-minute compressed version now exist. | `docs/demo-script.md` | Can be dated from the commit that adds `docs/demo-script.md`. |
| #173 `[DEMO-09] Rapport PFE - Resume Executif & Abstract` | Completed as insertion-ready report content. The English abstract and French executive summary now exist. | `docs/rapport-stage/executive-summary-and-abstract.md` | Can be dated from the commit that adds the report insert. |
| #165 `[DEMO-01] Rapport PFE - Sections techniques finales` | Materially advanced, but not fully closed as "done". The technical sections are ready to insert, but the final `.docx` was already dirty and was not modified in this pass. | `docs/rapport-stage/technical-sections-final.md` | Keep as partial until the Word/PDF report is regenerated or manually updated. |

## Why #165 remains partial

The issue asks for final PFE report sections. The new Markdown gives the
technical content needed for the report, but the authoritative final report file
is a Word/PDF artifact under `docs/rapport-stage/`. Because those files already
had unrelated working-tree changes, this pass avoided editing them directly.

Recommended next action:

1. Insert `docs/rapport-stage/executive-summary-and-abstract.md` into the report.
2. Insert `docs/rapport-stage/technical-sections-final.md` into the technical chapters.
3. Regenerate/export the final `.docx` and `.pdf`.
4. Then date #165 from that report-generation commit.

## Still urgent after this pass

| Issue | Why it remains urgent | Suggested next action |
| --- | --- | --- |
| #162 Golden dataset | The demo needs deterministic personas and dossiers. | Inspect existing seed scripts and add a lightweight deterministic seed/export without starting Docker. |
| #154 E2E Marie flow | The demo needs one reliable proof path. | Reuse existing Playwright evidence scripts; avoid Docker today unless explicitly allowed later. |
| #153 Integration coverage | Broad and risky before soutenance. | Scope to one or two high-value backend tests instead of chasing 70% globally today. |
| #8 Banking discovery epic | Large frontend-only scope. | Treat as post-soutenance unless needed for the story ending. |
| #60 MediaPipe WASM CNI quality gate | Still partial: CNI blur/glare/brightness gate exists, but MediaPipe WASM is not clearly part of the document gate. | Keep out of completed timeline until the actual document gate is implemented or intentionally descoped. |
