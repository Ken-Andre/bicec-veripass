# Stage Final Truth Audit - 2026-05-23

This document answers one question only: are all internship requirements proven functional end to end?

Short answer: no.

The current evidence proves several Day 1-3 stabilization items and now includes a live API KYC happy path from client onboarding to final approval. It still does not prove the full browser/mobile camera journey, all compliance/analytics/security/offline-ATM requirements, or real biometric device interaction.

## Evidence Boundary

Current visual/API evidence under `docs/test-evidence/latest/` covers:

- Mobile auth entry and protected-route redirect.
- Mobile support chat UI with attachment selection/sending using mocked Playwright routes.
- Mobile notifications/settings preference screens using mocked Playwright routes.
- Backoffice login and first dashboard render.
- Backoffice final approved dossier detail screenshot for the live KYC happy-path session.
- Live API proof for support upload, notification preferences, device registration, push subscription lifecycle, device-tag enforcement, and removal of the stale support compatibility endpoint.
- Live API proof for KYC happy path using notebook CNI images plus generated one-page bill/support PDFs: OTP signup, device tag, CNI recto/verso upload, OCR correction, liveness, address, consent, NIU, signature, readiness, submission, JEAN queue/open/auto-assign/info request, client support file upload, JEAN classification/approval, client final `APPROVED` status.

Current evidence does not cover:

- A full KYC A-to-Z browser journey.
- Real mobile camera capture screenshots for CNI/liveness.
- Full OCR extraction quality validation on every notebook CNI; the live happy-path proof records OCR status `PARTIAL` and then proves manual correction/review.
- Browser screenshots for the mobile client KYC screens. Backoffice now has a visual screenshot of the final approved dossier, but not step-by-step screenshots for request-info/classification/approval button clicks.
- Role-by-role backoffice proof beyond basic navigation/login.
- Analytics/dashboard metrics with non-static operational values.
- DAB/ATM offline locator.

## Requirement Truth Matrix

| Requirement area | Current status | Reason |
| --- | --- | --- |
| Client creates/resumes session | PARTIAL | Auth and persisted KYC state exist, but no full visual/API proof across logout/reload/device resume. |
| Continue where left off | PARTIAL | IndexedDB/offline KYC persistence exists with unit tests, but no end-to-end visual proof. |
| Return to any KYC step before submission | PARTIAL | Review/step guard code exists; not visually proven across all steps. |
| Upload CNI | DONE for live API | `run_kyc_happy_path_acceptance.py` uploaded `cni_0_recto.jpg` and `cni_0_verso.jpg` through `https://localhost/api/v1/kyc/capture/cni`; evidence stores copied input images and hashes. Browser/camera proof still separate. |
| OCR extraction + correction/review | LIVE_READY | Live proof records OCR status `PARTIAL` on notebook images and then posts manual OCR correction/review successfully. Full OCR quality/extraction benchmark across all CNI images remains open. |
| Background document authenticity verification | PARTIAL | Client quality checks and OCR metadata exist; no proven server-side authenticity/tamper/security-feature verification. |
| Client passes liveness | DONE for live API | Acceptance proof posts deterministic landmark frames and receives `is_alive=True`, `anti_spoofing_score=0.9354`. Browser/camera proof still separate. |
| Liveness authenticity / anti-spoof | PARTIAL | Landmark heuristic is proven by API; replay/photo/depth proof and real camera evidence remain open. |
| Client submits dossier | DONE for live API | Readiness returned `can_submit=True`; submit returned `PENDING_AGENT_REVIEW`. Browser proof still separate. |
| Backoffice opens dossier | DONE | JEAN opened the submitted dossier by raw session id through the API; rebuilt backoffice evidence captures the final approved dossier detail page. |
| Backoffice requests complementary file | DONE for live API | JEAN posted `INFO_REQUESTED`; client review status returned `PENDING_INFO` with unread notification. |
| Push + in-app notifications after authorization | PARTIAL | In-app and push subscription lifecycle are proven; actual background push delivery is not proven. |
| Client sends requested file by chat with visible/enforced limits | DONE for support upload | UI/backend limits and live multipart upload are proven. |
| Backoffice assigns complementary file to categories | DONE for live API / EVIDENCE_READY final view | Support attachment created a `Document` id and JEAN classified it as `ADDRESS_PROOF`; final backoffice screenshot shows the support attachment and approval trail. Step-click browser proof remains open. |
| Backoffice validates dossier | DONE for live API / EVIDENCE_READY final view | JEAN approval returned `APPROVED` and `LIMITED_ACCESS`; final backoffice screenshot shows `APPROVED` and the audit timeline. Step-click browser proof remains open. |
| Client sees final approved status | DONE for live API | Final `/kyc/review-status` returned `APPROVED` and unread `KYC_APPROVED` notification. Browser proof still open. |
| Expiry/policy/sanctions/suspicious/global notifications | PARTIAL/TODO | Model/task pieces exist, sanctions sync exists, but broadcast/policy/expiry workflows are not proven end to end. |
| Access by client status | PARTIAL | Access-tier mapping and some banking enforcement exist; no full role/status matrix evidence. |
| Device tag / metadata identity | DONE for current enforcement slice | Device registration, tag storage, and high-risk route enforcement are proven live. |
| PII protected in transit | PARTIAL | HTTPS local/nginx and JWT exist; no full HSTS/CSP/TLS policy proof. |
| PII protected at rest | PARTIAL | Mobile offline payloads are AES-GCM encrypted; backend document/support files are still stored as regular files under storage paths, not proven encrypted at rest. |
| Auth separated from normal routes | PARTIAL | `/auth` entry and protected redirects proven; auth back-button behavior is not audited/proven. |
| PIN lock never stuck after correct PIN | PARTIAL | Tests exist around lock/PIN; no latest visual/live proof. |
| Lock screen only after inactivity/app return | PARTIAL | AuthContext logic exists; no latest visual proof. |
| Biometric login and passcode replacement | PARTIAL | WebAuthn backend/client code and mocked tests exist; manual real biometric proof still outstanding. |
| Biometric toggle in settings | PARTIAL | UI exists; persistence/backend behavior needs focused proof. |
| Client personal information view/update request via support | TODO/PARTIAL | Support exists; no dedicated mobile profile/request update flow proven. |
| Reset passcode via phone/email | SOURCE_READY | Route/screen exists; no full visual/API proof. |
| Official message channel preference SMS/email | DONE for current slice | Backend preferences, UI, tests, and live proof exist. |
| Product/marketing/QA/compliance/adoption/fraud/regulatory metrics | PARTIAL | Analytics endpoint exists but SLA values are static; several metrics are not implemented/proven. |
| Backoffice stats by role | PARTIAL | Routes/guards exist; only basic backoffice login/dashboard proof. |
| Executive operational dashboards | PARTIAL | Dashboard/command/analytics pages exist; no full live metrics/export proof. |
| Auth back button does not return to stale pre-auth screen | NOT PROVEN | Needs dedicated Playwright test and screenshot. |
| Offline nearby DAB/ATM locator | TODO | No implemented/proven mobile DAB locator data/cache/maps flow found. |

## KYC Happy Path Verdict

The KYC happy path is now closed with live API proof, but not yet with full browser/visual proof.

Evidence:

- `docs/test-evidence/latest/kyc-happy-path/README.md`
- `docs/test-evidence/latest/kyc-happy-path/kyc-happy-path-live-api-proof.json`
- `docs/test-evidence/latest/kyc-happy-path/input-images/cni_recto.jpg`
- `docs/test-evidence/latest/kyc-happy-path/input-images/cni_verso.jpg`

What remains:

1. Add mobile Playwright/browser screenshots around the live accepted dossier, not mocked routes.
2. Add backoffice Playwright screenshots for the intermediate button-click states: info request, classification, and approval modals.
3. Add OCR benchmark evidence across more notebook CNIs if the goal is to prove extraction quality, not only correction/review.
4. Add real camera/liveness visual proof; real biometric proof remains manual.

## Backoffice And Dispatch Verdict

JEAN role is partially proven.

Evidence now proves JEAN's full operational API workflow on one dossier: queue lookup, dossier open, auto-assign, info request, classification, approval. It also includes one rebuilt backoffice screenshot of the final approved dossier detail page. It still does not prove every intermediate visual click state.

Auto-assign exists, but it is not yet a certified load-balancing system:

- It selects available JEAN agents, preferably same agency, ordered by `active_dossier_count`.
- Complexity is delegated to the database sort over available agents. Conceptually this is `O(a log a)` for `a` candidate agents unless backed by an index and optimized by the DB planner. It is not a constant-time dispatch queue.
- It increments `active_dossier_count`, but needs concurrency proof/race-condition tests before it can be called reliable under simultaneous assignments.
- It is cheap enough for small agent counts, but not yet proven for scale/load.

## Engineering Taste Verdict

The codebase has good pieces and weak pieces.

Good:

- Clear API separation for auth/KYC/support/notifications/devices/backoffice.
- Good recent contract tests for support attachments, notification preferences, device tags.
- Evidence discipline has improved: real artifact files are now created for some slices.

Weak:

- Several “DONE” areas historically meant “code exists”, not end-to-end proof.
- Evidence tests still mock key mobile APIs, so screenshots prove UI states more than full integration.
- Analytics contains static SLA values.
- Backend document files are not proven encrypted at rest.
- The full KYC/backoffice happy path now has a reproducible live API acceptance suite, but still needs visual browser evidence.
- Some docs/files still contain encoding artifacts or stale assumptions.

## Immediate Next Work

The next correct work item is not more cleanup. It is the acceptance proof suite:

1. Add mobile/backoffice Playwright evidence around the live accepted flow.
2. Add backoffice JEAN visual evidence for dossier open, info request, classification, approval.
3. Add analytics proof or downgrade analytics claims until real metrics are implemented.
4. Add DAB/ATM offline locator implementation and evidence.
5. Add real biometric manual video once the product owner records it.
