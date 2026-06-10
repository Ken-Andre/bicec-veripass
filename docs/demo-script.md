# VeriPass demo script - soutenance 10 minutes

Purpose: run a controlled, repeatable presentation of the VeriPass MVP without
claiming production integrations that are not in scope. This script is written
for a jury or BICEC audience and can also be compressed to 5 minutes.

## Demo promise

In 10 minutes, show that VeriPass can support a regulated pre-opening KYC flow:

- Marie starts or resumes a mobile KYC dossier.
- The system captures CNI documents, OCR evidence, selfie/liveness, address,
  NIU and consent.
- Jean reviews the dossier in back office with traceable evidence.
- Thomas/Sylvie surfaces prove compliance supervision, AML controls and audit.
- The final result is an explainable KYC decision path, not a core-banking
  account creation.

## Setup checklist

- Browser tabs ready:
  - Mobile PWA.
  - Back office.
  - Evidence folder if the live flow is unstable.
- Demo accounts ready for Marie, Jean, Thomas and Sylvie.
- Backup evidence ready:
  - `docs/test-evidence/latest/mobile/screens/`
  - `docs/test-evidence/latest/backoffice/screens/`
  - `docs/test-evidence/latest/kyc-compliance-demo/README.md`
- Keep Docker stopped if the machine is memory constrained. Use recorded
  evidence and screenshots instead of starting containers.
- Do not promise DGI, core banking, Sopra Amplitude or production AML
  integrations. Present them as handoff/future integration boundaries.

## 10-minute run of show

| Time | Screen | Narration | Action |
| ---: | --- | --- | --- |
| 0:00 | Title / repo context | "VeriPass addresses the first KYC bottleneck: collecting and validating a client dossier before any banking activation. The MVP focuses on a controlled, auditable pre-opening flow." | Show project or opening slide. |
| 0:45 | Mobile welcome/auth | "Marie is a new client. She authenticates with OTP/PIN and can resume her journey after interruption." | Open the mobile PWA or evidence screenshot. |
| 1:30 | CNI capture | "The first regulated evidence is the CNI. The client-side flow guides framing and quality checks before submission." | Show CNI recto/verso capture or the evidence images. |
| 2:20 | OCR review | "OCR accelerates data entry, but the MVP keeps the fields reviewable. Automation helps; it does not remove accountability." | Show extracted fields and confidence badges if available. |
| 3:00 | Selfie/liveness | "Liveness and biometric comparison add a presence check. In the demo, this evidence is visible to the agent instead of being hidden in logs." | Show liveness/selfie screen or back-office biometric evidence. |
| 3:45 | Address, NIU, consent | "The dossier becomes complete when address, NIU choice and final consent are recorded. The client must explicitly confirm correctness and sharing terms." | Show summary/consent. |
| 4:40 | Submission | "Submitting moves the dossier to agent review. Marie does not receive production banking access from the prototype itself." | Show pending review state. |
| 5:10 | Jean queue | "Jean sees a prioritized queue. The objective is to review risk and evidence, not to search manually through uploads." | Open Jean queue. |
| 5:55 | Jean dossier detail | "The agent view groups documents, OCR fields, biometrics, audit trail and decision controls. This is the operational core of the MVP." | Open a dossier detail screen. |
| 6:50 | Information request | "If evidence is incomplete, Jean can request a complement. This keeps the same dossier alive and preserves traceability." | Show pending-info or support upload evidence. |
| 7:35 | Thomas compliance | "Thomas manages AML/CFT evidence and can prove that approval is blocked when a relevant alert is open." | Show `kyc-compliance-demo` screenshots 01, 08 and 10. |
| 8:25 | Sylvie / audit / analytics | "Sylvie sees operational indicators and exports. This supports supervision, reporting and process improvement." | Show analytics or COBAC/audit proof. |
| 9:05 | Result and limits | "The MVP proves a sovereign, auditable KYC pre-opening path. Production work remains around real external integrations, hardening and pilot metrics." | Show roadmap/planning timeline. |
| 9:45 | Close | "The project moved from architecture to a demonstrable workflow with evidence, issue history and a plan for remaining scope." | End on timeline and remaining-issues plan. |

## 5-minute compressed version

| Time | Screen | Message |
| ---: | --- | --- |
| 0:00 | Opening | VeriPass reduces KYC pre-opening friction while keeping a human decision path. |
| 0:40 | Mobile Marie | Marie authenticates, captures CNI, reviews OCR, completes liveness, address, NIU and consent. |
| 1:45 | Back-office Jean | Jean reviews the dossier, evidence, OCR fields and biometric risk from one operational queue. |
| 2:45 | Compliance Thomas | AML evidence can block approval; the demo shows this control explicitly. |
| 3:35 | Audit/Sylvie | Audit and analytics provide the management proof layer. |
| 4:20 | Limits and next steps | External production integrations are scoped as future handoff; this MVP proves the controlled KYC workflow. |

## If the live app is unstable

Use the evidence-first path:

1. Show mobile screenshots from `docs/test-evidence/latest/mobile/screens/`.
2. Show Jean dossier screenshots from `docs/test-evidence/latest/backoffice/screens/`.
3. Show compliance evidence from `docs/test-evidence/latest/kyc-compliance-demo/`.
4. Use the GitHub Project roadmap to explain dates and remaining scope.

The fallback is acceptable for soutenance because it demonstrates actual product
evidence captured from the application, not mock presentation slides.

## Expected questions

**Is this production-ready?**
No. It is an MVP/pilot foundation. Production requires real secrets management,
TLS/cert automation, external integration contracts, security hardening, pilot
metrics and operational runbooks.

**Why keep Jean in the loop?**
KYC decisions must be explainable. OCR and liveness reduce effort, but an agent
must handle low-confidence, missing or risky evidence.

**Why no direct banking activation?**
That boundary belongs to BICEC core systems and downstream apps. VeriPass should
provide eligibility and handoff evidence, not bypass banking governance.

**What is the technical contribution?**
A full-stack KYC workflow: mobile PWA, FastAPI services, document/OCR pipeline,
state machine, back-office review, compliance evidence, audit and planning
traceability.

**What remains after the presentation?**
Finish the remaining critical issues in `docs/planning/remaining-issues-action-plan.md`,
then run a hardening sprint on tests, performance, deployment and production
integration decisions.
