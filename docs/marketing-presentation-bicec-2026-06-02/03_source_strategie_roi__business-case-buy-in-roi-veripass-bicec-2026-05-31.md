---
title: "VeriPass BICEC Buy-In Business Case"
project: "bicec-veripass"
date: "2026-05-31"
status: "draft"
owner: "Mary - BMad Business Analyst"
purpose: "Source pack for an internal BICEC pitch that converts the technical MVP into a business case."
---

# VeriPass BICEC Buy-In Business Case

## Executive Thesis

BICEC does not need to buy "an intern app." BICEC needs to decide whether it wants a controlled digital trust layer for onboarding clients in a market where payments are already digital, AML/CFT pressure is current, and branch-heavy KYC is the bottleneck.

The pitch should say:

> Cameroon is already digital. The weak point is not demand. The weak point is trusted, auditable onboarding. VeriPass turns KYC from a paper-heavy branch moment into a controlled digital dossier: faster for the client, clearer for the agent, and easier to defend for compliance.

The buy-in ask is not production deployment. The correct ask is a sponsored pilot:

- validate the operating model with real BICEC process owners;
- replace demo data with BICEC pilot metrics;
- let Compliance, Operations, IT/Security, and Retail jointly decide whether to scale, integrate, buy, or rebuild.

## The Story Arc

### 1. Setup: The market moved

Cameroon and CEMAC are already digital in payment behavior. BEAC reports that Cameroon represents 65.10 percent of CEMAC payment transaction volume and 56.95 percent of payment value, while electronic money represents 94.34 percent of CEMAC payment operations. In 2024, CEMAC had 51.28 million mobile money accounts, 3.74 billion mobile money transactions, and XAF 34,788 billion in mobile money transaction value.

### 2. Conflict: Banking trust has not caught up

Digital payment behavior does not automatically become banked customer relationships. KYC remains a control point where the bank must verify identity, collect documents, handle weak files, prevent fraud, screen AML risk, and prove decisions later.

World Bank ID4D reports that around 7.5 million people in Cameroon lack official proof of identity and 2.5 million adults lack a national ID. It also notes that paper receipts are legally authorized while applicants wait for official IDs, but many banks reject them because of fraud concerns. This is exactly the friction zone where a bank-controlled KYC workflow matters.

### 3. Tension: Compliance pressure is current

Cameroon remains under FATF increased monitoring as of the 13 February 2026 update. FATF says Cameroon still needs to improve risk-based supervision of financial institutions, secure FIU-related information exchange, and strengthen targeted financial sanctions implementation. This makes KYC evidence quality a strategic risk topic, not just a digital channel topic.

### 4. Resolution: VeriPass as the controlled trust layer

VeriPass is a sovereign digital KYC onboarding platform for BICEC. It captures CNI, proof of address, selfie/liveness, NIU status, consent, and signature; runs OCR and biometric checks; stores evidence; exposes the dossier to backoffice roles; blocks approval when risk remains open; and keeps human validation in the decision loop.

The key line:

> VeriPass does not replace the bank's judgment. It gives the bank cleaner evidence before judgment is made.

## What The Old Digital KYC Reference Deck Did Well

Reference: `C:\Users\yoann\Downloads\digitalkycmodules-230516103830-da936dc4.pdf`

The old Proximus/Telindus DigitalKYC deck is useful because it sells a business operating model, not a feature list. It frames KYC as a client lifecycle: identity verification, document management, screening, acceptance logic, monitoring, remediation, and compliance portal.

Borrow these patterns:

- Sell "lifecycle control" instead of "screens."
- Show modules as configurable workflow blocks.
- Tie each module to one of four outcomes: revenue conversion, productivity, security/compliance, data quality.
- Use sector examples to show that KYC is a reusable trust capability.
- End with PoC/workshop language, not a huge transformation ask.

Do not copy these parts blindly:

- global coverage claims like "150+ countries" or "11K ID document types";
- vendor scale claims that VeriPass cannot prove;
- KYB/UBO lifecycle claims unless BICEC explicitly wants corporate onboarding;
- "complete replacement" positioning. VeriPass is currently a controlled KYC MVP and pilot candidate, not a production-certified replacement for core banking or DGI/Sopra integration.

## Evidence-Based Numbers For The Pitch

Use these as source-backed context. Keep BICEC-specific ROI separate until BICEC gives internal metrics.

| Number | How To Use It In The Pitch | Source |
| --- | --- | --- |
| Cameroon holds 65.10 percent of CEMAC payment transaction volume and 56.95 percent of payment value. | "BICEC is operating in the region's largest digital payment market." | BEAC 2024 payment services report |
| Electronic money is 94.34 percent of CEMAC payment operations. | "Customers are already trained to expect digital financial access." | BEAC 2024 payment services report |
| CEMAC had 51.28 million mobile money accounts in 2024, up 28.09 percent year over year. | "The addressable mobile-first population is growing fast." | BEAC 2024 payment services report |
| CEMAC mobile money transaction value reached XAF 34,788 billion in 2024, up 20.33 percent. | "Digital finance is already moving serious value." | BEAC 2024 payment services report |
| Cameroon had 30.99 million mobile money accounts and XAF 26,773 billion in mobile money value in 2024. | "Cameroon is not a small side market in this story." | BEAC 2024 payment services report |
| Around 7.5 million Cameroonians lack official proof of identity; 2.5 million adults lack a national ID. | "Identity friction is a direct onboarding blocker." | World Bank ID4D Cameroon |
| FATF still lists Cameroon under increased monitoring as of 13 February 2026. | "The compliance environment rewards stronger, auditable KYC controls." | FATF increased monitoring update |
| DataReportal estimates 25.5 million mobile connections in Cameroon in January 2025, equal to 86.3 percent of population. | "Mobile-first onboarding is plausible, but it must be controlled." | DataReportal Digital 2025 Cameroon |
| Fenergo's 2025 vendor survey reports 70 percent of financial institutions lost clients due to slow onboarding and average abandonment around 10 percent. | Use only as a global benchmark, not a BICEC fact. "Slow onboarding is a recognized industry loss driver." | Fenergo 2025 survey |
| Grand View Research estimates identity verification as an USD 11.5B market in 2023, projected to USD 33.93B by 2030. | "The global market is moving toward identity verification infrastructure." | Grand View Research |

## BICEC-Specific Proof From The Repo

The pitch should combine external data with local evidence from the project. These points are defensible because they come from current docs and test evidence.

| Proof Point | What It Proves | Evidence |
| --- | --- | --- |
| Mobile KYC path exists. | Client can authenticate, start KYC, upload documents, confirm OCR, do liveness, consent, sign, and submit. | `docs/project-overview.md`, `docs/test-evidence/latest/kyc-happy-path/README.md` |
| Human validation is preserved. | The system supports speed without removing bank control. | `docs/project-overview.md` |
| Backoffice roles map to bank reality. | Jean validates, Thomas handles AML/CFT, Sylvie sees operations, Admin IT manages system roles. | `docs/project-overview.md`, `docs/component-inventory.md` |
| AML blocks are demonstrated. | Approval can remain blocked while an AML alert is open. | `docs/test-evidence/latest/kyc-compliance-demo/README.md` |
| The happy path is API-proven. | OTP, device registration, CNI upload, OCR correction, liveness, readiness, submit, info request, support upload, document classification, approval, and final approved status all returned success. | `docs/test-evidence/latest/kyc-happy-path/README.md` |
| Latest mobile and backoffice evidence status is passed. | Demo surfaces are not only theoretical. | `docs/test-evidence/latest/mobile/.last-run.json`, `docs/test-evidence/latest/backoffice/.last-run.json` |
| Architecture is production-shaped. | Docker, FastAPI, PostgreSQL, Redis, Celery, Nginx TLS, mobile PWA, backoffice SPA, and audit/analytics modules exist. | `docs/architecture.md`, `code/docker-compose.yml` |
| Scope is honest. | VeriPass is not DGI, Sopra Amplitude, Axway provisioning, core banking, or transactional banking integration. | `docs/project-overview.md`, `_bmad-output/project-context.md` |

## The Buyer Map

Do not pitch one generic "BICEC." Pitch five buyers in one room.

| Stakeholder | What They Personally Buy | What To Say |
| --- | --- | --- |
| Compliance / AML | Defensible evidence, risk blocks, audit traceability, cleaner regulator conversations. | "This makes KYC decisions explainable: who reviewed, what evidence existed, what risk was open, and why the decision happened." |
| Operations | Less rework, clearer queues, fewer weak files circulating between branch, client, and backoffice. | "Clean cases can move faster. Exceptions become visible instead of hidden in email, paper, or branch follow-up." |
| Retail / Digital Banking | Higher conversion from mobile-first prospects into banked relationships. | "Mobile money proves demand. VeriPass helps BICEC convert that behavior into owned customer relationships." |
| IT / Security | A contained, reviewable architecture instead of uncontrolled shadow process. | "This is a bounded pilot stack with explicit services, data flows, RBAC, and known hardening gaps." |
| Executive Sponsor | Compliance-led growth with a limited pilot risk. | "We are not asking for a blind deployment. We are asking for measured sponsorship to see whether the model deserves scale." |

## The Positioning

### Bad positioning

"I built a digital KYC app during my internship."

Why it fails: it makes the buyer evaluate you, not the business problem.

### Strong positioning

"BICEC has an opportunity to convert digital payment behavior into banked customer relationships while strengthening KYC evidence quality. VeriPass is the pilotable trust layer that proves this operating model."

Why it works: it moves from "my project" to "their problem."

### Best one-line thesis

> VeriPass is not an app. It is BICEC's controlled digital trust gate between customer intent and banking access.

## Before / After Story

### Before VeriPass

A customer wants access. The bank needs KYC. The file is built across branch interactions, document checks, manual corrections, and follow-up. Weak evidence can slow the client, overload agents, and create audit risk later.

### After VeriPass

The customer starts digitally or branch-assisted. Documents are captured. OCR prepares data but remains correctable. Liveness and identity checks add evidence. Risk alerts stop unsafe approval. A human validates. The final state becomes traceable and reusable as an eligibility guardrail for other BICEC services.

### Speaker line

> Today, the bank often discovers the weakness of a KYC file late. VeriPass makes weaknesses visible before approval.

## ROI Model Without Inventing BICEC Numbers

Do not fabricate ROI. Put a model in front of executives and ask for pilot data.

### Value lever 1: Completion uplift

Formula:

```text
Monthly value from completion uplift =
monthly KYC starts
* improvement in completion rate
* average first-year gross margin per activated customer
```

Pilot data needed:

- KYC starts per month;
- current completion rate;
- current abandonment reasons;
- gross margin per new active account;
- activation rate into BI PAY, cards, savings, or mobile banking.

### Value lever 2: Rework reduction

Formula:

```text
Monthly staff time saved =
monthly dossiers
* reduction in manual handling minutes per dossier
* fully loaded cost per staff minute
```

Pilot data needed:

- average minutes spent by branch staff per file;
- average minutes spent by backoffice reviewer per file;
- number of files requiring a second customer visit;
- number of files missing documents or with unreadable copies.

### Value lever 3: Compliance evidence quality

Formula:

```text
Audit effort saved =
audit / control requests per period
* hours to assemble evidence today
- hours to export evidence with VeriPass
```

Pilot data needed:

- number of compliance/audit sample requests;
- average preparation time per sample;
- missing evidence rate;
- remediation findings linked to weak KYC documentation.

### Value lever 4: Fraud and risk prevention

Formula:

```text
Expected risk reduction =
high-risk cases detected earlier
* estimated loss / exposure per undetected case
```

Pilot data needed:

- duplicate/false identity rate;
- AML hit rate;
- liveness override rate;
- fraud investigation cases linked to onboarding.

### Pilot KPI dashboard

Use these KPIs instead of pretending to know ROI today:

| KPI | Why It Matters |
| --- | --- |
| KYC start-to-submit completion rate | Measures whether the customer journey improves conversion. |
| Median clean-case processing time | Measures operational speed. |
| Percent of dossiers needing customer complement | Measures first-time-right quality. |
| OCR field correction rate | Measures automation quality and data reliability. |
| AML/biometric block count | Measures risk controls actually firing. |
| Approval blocked with open risk | Measures compliance guardrail strength. |
| Audit export preparation time | Measures evidence readiness. |
| Activation after approval into BI PAY/mobile banking/cards/savings | Measures commercial value after KYC. |

## Recommended Pitch Deck Structure

### Slide 1: The decision

Headline: "BICEC can turn KYC from a branch bottleneck into a digital trust gate."

Message: This is a decision about a controlled pilot, not a demo appreciation session.

### Slide 2: Why now

Use BEAC and FATF data:

- Cameroon is the largest CEMAC payment market by transaction volume.
- Electronic money dominates transaction count.
- Cameroon remains under FATF increased monitoring.

Speaker line:

> The market is already digital. The regulator is asking for stronger proof. KYC is where those two forces meet.

### Slide 3: The current friction

Show the human problem:

- client has intent;
- bank needs evidence;
- weak files cause rework;
- compliance needs proof later.

### Slide 4: The VeriPass answer

Show the system map:

- mobile capture;
- OCR and liveness;
- agent review;
- AML/compliance block;
- audit/analytics;
- app handoff after approval.

### Slide 5: Buyer value map

Show Compliance, Operations, Retail, IT, Executive Sponsor. Each gets a reason to say yes.

### Slide 6: Client proof

Use local mobile screenshot evidence. Message: the client can start and complete a KYC journey.

### Slide 7: Agent proof

Use Jean queue/dossier evidence. Message: the agent sees a prepared dossier, not a pile of fragments.

### Slide 8: Compliance proof

Use AML block evidence. Message: the system can stop approval when open risk remains.

### Slide 9: Architecture credibility

Use a simple diagram. Message: sovereign local stack, separate services, explicit RBAC, auditable state model.

### Slide 10: The business case model

Show four value levers:

- conversion uplift;
- rework reduction;
- audit effort reduction;
- fraud/risk detection.

Do not show a fake ROI number. Show the formula and pilot data request.

### Slide 11: Pilot plan

Propose an 8 to 12 week pilot:

- sponsor: Compliance + Operations + IT;
- scope: one controlled segment or branch-assisted onboarding flow;
- data: baseline current KYC metrics before launch;
- output: go/no-go with measured KPI deltas and security/compliance gap list.

### Slide 12: The ask

Ask for:

- one executive sponsor;
- one Compliance/AML owner;
- one Operations owner;
- one IT/Security reviewer;
- permission to run a measured pilot with real process data.

Speaker line:

> I am not asking you to accept a student project as production. I am asking you to test whether this operating model can save time, strengthen compliance, and convert more digital intent into BICEC customers.

## PRFAQ Draft

### Press Release Headline

BICEC pilots VeriPass to turn digital KYC into a faster, safer path from customer intent to banking access.

### Subheadline

The pilot uses mobile document capture, OCR, liveness, human validation, AML controls, and audit-ready evidence to test whether BICEC can reduce KYC friction while strengthening compliance.

### Press Release Draft

Douala, Cameroon - BICEC is piloting VeriPass, a controlled digital KYC workflow designed to help customers prepare identity evidence digitally while preserving human validation and compliance oversight.

The pilot responds to a clear market shift: Cameroon is already a major digital payment market in CEMAC, but banking access still depends on trusted onboarding. VeriPass addresses that gap by turning KYC into a structured dossier: identity documents are captured, OCR prepares the data, liveness adds presence evidence, AML and biometric risks are surfaced, and BICEC agents retain final approval authority.

For clients, the value is a clearer path through onboarding. For agents, the value is a prepared file instead of scattered evidence. For Compliance, the value is traceability: the bank can see what was reviewed, what risk was open, and why a decision happened.

The pilot will measure completion, rework, review time, risk blocks, and audit evidence readiness before any production decision is made.

### Hard FAQs

**Is this ready for production?**

No. It is production-shaped, but the right next step is a controlled pilot with BICEC data, security review, legal review, and process-owner validation.

**Does VeriPass replace BICEC staff?**

No. It prepares the dossier and exposes risk. Human agents keep decision authority.

**Does this integrate with core banking?**

Not today. Current scope is KYC onboarding, verification, audit, and eligibility guardrail. Post-approval handoff can route users to BICEC apps, but core banking integration is outside current scope.

**What makes it different from buying a vendor platform?**

The pilot clarifies BICEC's operating model. It can inform build, buy, partner, or hybrid decisions. Even if BICEC later buys a vendor, VeriPass defines the requirements and evidence journey BICEC actually needs.

**What about regulatory acceptance of remote KYC?**

Do not overclaim remote onboarding legality. Frame the pilot as bank-controlled digital pre-KYC or branch-assisted digital KYC until Legal/Compliance validates the approved operating model.

**What about data privacy?**

The pilot needs a privacy-by-design review: consent wording, retention, role access, encryption posture, biometric handling, audit logs, and deletion rules must be validated under BICEC policy and Cameroon personal-data law.

**What if OCR is imperfect?**

That is expected. VeriPass uses OCR to accelerate preparation, not to make blind decisions. Low-confidence fields remain correctable and human review stays in the loop.

**What must be true before scale?**

Security hardening, privacy/legal validation, performance testing, real OCR accuracy measurement on local documents, branch/process fit, support model, integration decisions, and clear ownership.

## Objection Handling

| Objection | Best Response |
| --- | --- |
| "This was built by an intern." | "That is why the ask is a pilot, not production. The value is the operating model and evidence already proven locally; BICEC decides scale only after measured validation." |
| "We can buy a vendor." | "Yes, and this work still helps. It tells BICEC what to demand from a vendor and which local process constraints matter." |
| "Compliance will never accept this." | "Compliance should be the sponsor. The system keeps human validation, risk blocks, audit trail, and evidence visibility. It is designed to make compliance stronger, not bypass it." |
| "We do not have internal ROI numbers." | "Correct. That is why the pilot measures completion, rework, review time, risk blocks, and audit effort instead of inventing ROI." |
| "OCR is not perfect." | "The workflow assumes imperfect OCR. It uses confidence, correction, and human approval. The claim is less manual typing and better evidence, not full automation." |
| "This is not integrated with DGI/core banking." | "Correct by design. The current pilot tests KYC control before integration. Integration should happen only after the control model is validated." |

## Memorable Lines

- "VeriPass is not asking the bank to trust automation. It asks the bank to trust better evidence."
- "The market is digital. The question is whether BICEC's onboarding trust layer is ready."
- "A regulator does not only ask who the customer is. They ask how the bank knows."
- "The pilot is the bridge between a convincing demo and a responsible production decision."
- "If BICEC later buys a vendor, this still becomes the blueprint for what BICEC should buy."

## Action Plan Before The Pitch

1. Replace demo-only screenshots with the strongest local evidence screenshots already available in `docs/test-evidence/latest`.
2. Prepare a one-page pilot KPI sheet with blank fields for BICEC baseline data.
3. Ask for three internal numbers before or during the meeting:
   - average time to open/validate a KYC file today;
   - percentage of files requiring rework or missing documents;
   - monthly KYC starts and completed account activations.
4. Do not claim production readiness. Claim "production-shaped MVP with live acceptance evidence."
5. End with a decision, not applause:
   - approve a controlled pilot;
   - assign sponsors;
   - authorize baseline data collection;
   - schedule security/compliance review.

## Source Links

- BEAC, 2024 CEMAC payment services report: https://www.beac.int/wp-content/uploads/2026/04/RAPPORT-SUR-LES-SERVICES-DE-PAIEMENT-DANS-LA-CEMAC-2024-.pdf
- FATF, Cameroon country page: https://www.fatf-gafi.org/en/countries/detail/Cameroon.html
- FATF, jurisdictions under increased monitoring, 13 February 2026: https://www.fatf-gafi.org/en/publications/High-risk-and-other-monitored-jurisdictions/increased-monitoring-february-2026.html
- FATF, Digital ID guidance: https://www.fatf-gafi.org/en/publications/Financialinclusionandnpoissues/Digital-identity-guidance.html
- World Bank ID4D Cameroon report: https://openknowledge.worldbank.org/entities/publication/f5e9a8a2-0ede-463b-bf77-c02b92243c3a
- World Bank Global Findex report: https://www.worldbank.org/en/publication/globalfindex/report
- DataReportal Digital 2025 Cameroon: https://datareportal.com/reports/digital-2025-cameroon
- Fenergo 2025 financial-crime industry trends: https://resources.fenergo.com/newsroom/global-financial-institutions-struggle-with-rising-client-losses-and-compliance-costs-as-ai-adoption-increases-fenergo
- Grand View Research identity verification market: https://www.grandviewresearch.com/industry-analysis/identity-verification-market-report
- NIST SP 800-63A identity proofing: https://pages.nist.gov/800-63-4/sp800-63a.html
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
