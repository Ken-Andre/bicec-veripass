# Stage Final Truth Audit - 2026-05-23

This document answers one question only: are all internship requirements proven functional end to end?

Short answer: no.

The current evidence proves several Day 1-3 stabilization items, but it does not yet prove the full banking/KYC/backoffice happy path from client onboarding to final approval, nor all compliance/analytics/security/offline-ATM requirements.

## Evidence Boundary

Current visual/API evidence under `docs/test-evidence/latest/` covers:

- Mobile auth entry and protected-route redirect.
- Mobile support chat UI with attachment selection/sending using mocked Playwright routes.
- Mobile notifications/settings preference screens using mocked Playwright routes.
- Backoffice login and first dashboard render.
- Live API proof for support upload, notification preferences, device registration, push subscription lifecycle, device-tag enforcement, and removal of the stale support compatibility endpoint.

Current evidence does not cover:

- A full KYC A-to-Z browser journey.
- Uploading real CNI images from `paddleocr_test/notebooks/output/images`.
- Real OCR extraction screenshots/results tied to those images.
- Liveness capture evidence.
- Client submission -> JEAN opens dossier -> JEAN requests info -> client sends file -> JEAN classifies file -> JEAN approves -> client sees final status.
- Role-by-role backoffice proof beyond basic navigation/login.
- Analytics/dashboard metrics with non-static operational values.
- DAB/ATM offline locator.

## Requirement Truth Matrix

| Requirement area | Current status | Reason |
| --- | --- | --- |
| Client creates/resumes session | PARTIAL | Auth and persisted KYC state exist, but no full visual/API proof across logout/reload/device resume. |
| Continue where left off | PARTIAL | IndexedDB/offline KYC persistence exists with unit tests, but no end-to-end visual proof. |
| Return to any KYC step before submission | PARTIAL | Review/step guard code exists; not visually proven across all steps. |
| Upload CNI | SOURCE_READY | Mobile/backend routes exist; no live proof using notebook CNI images yet. |
| OCR extraction + correction/review | SOURCE_READY | OCR service/routes/UI exist; no live proof on real `paddleocr_test` CNI images in `docs/test-evidence/latest/`. |
| Background document authenticity verification | PARTIAL | Client quality checks and OCR metadata exist; no proven server-side authenticity/tamper/security-feature verification. |
| Client passes liveness | SOURCE_READY | UI/backend routes exist; no visual or live API happy-path evidence in latest artifacts. |
| Liveness authenticity / anti-spoof | PARTIAL | Landmark heuristic and score logic exist; no replay/photo/depth proof and no final evidence. |
| Client submits dossier | SOURCE_READY | Readiness/submit routes exist; no full live A-to-Z proof. |
| Backoffice opens dossier | PARTIAL | Routes and EvidenceViewer exist; latest backoffice proof only shows dashboard, not dossier detail. |
| Backoffice requests complementary file | SOURCE_READY | Review decision route supports `INFO_REQUESTED`; not visually/API-proven in latest artifacts. |
| Push + in-app notifications after authorization | PARTIAL | In-app and push subscription lifecycle are proven; actual background push delivery is not proven. |
| Client sends requested file by chat with visible/enforced limits | DONE for support upload | UI/backend limits and live multipart upload are proven. |
| Backoffice assigns complementary file to categories | SOURCE_READY | Classification route exists; no live/visual proof. |
| Backoffice validates dossier | SOURCE_READY | Review decision route exists; no complete JEAN visual/API proof. |
| Client sees final approved status | SOURCE_READY | Status/notification paths exist; no full proof after JEAN approval. |
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

The KYC happy path is not yet closed with proof.

The backend has the pieces: session, document capture, OCR review, liveness, address, NIU, consent, signature, readiness, submit. The mobile has screens for those steps. But there is no latest artifact that drives one client through all of them using real sample images and then proves the backoffice side.

Minimum proof still required:

1. Seed or create one live client with phone/email/PIN/device tag.
2. Upload `cni_0_recto.jpg` and `cni_0_verso.jpg` from `paddleocr_test/notebooks/output/images`.
3. Capture/store OCR response and correction/review.
4. Complete liveness using deterministic test payload.
5. Upload bill/address/NIU/consent/signature.
6. Submit dossier and prove status `PENDING_AGENT_REVIEW`.
7. Login as JEAN, open dossier, request complementary file.
8. Client receives notification and sends file by support chat.
9. JEAN classifies the complementary file.
10. JEAN approves.
11. Client sees final approved status.
12. Produce screenshots/video/trace and API proof for each step.

## Backoffice And Dispatch Verdict

JEAN role is not fully proven.

Evidence currently proves JEAN can log in and see a dashboard. It does not prove JEAN's full operational workflow in latest artifacts.

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
- The full KYC/backoffice happy path is not covered by a reproducible acceptance suite.
- Some docs/files still contain encoding artifacts or stale assumptions.

## Immediate Next Work

The next correct work item is not more cleanup. It is the acceptance proof suite:

1. Build `kyc-happy-path.acceptance` API script using real notebook CNI images.
2. Add mobile/backoffice Playwright evidence around that seeded/proven flow.
3. Add backoffice JEAN evidence for dossier open, info request, classification, approval.
4. Add analytics proof or downgrade analytics claims until real metrics are implemented.
5. Add DAB/ATM offline locator implementation and evidence.
