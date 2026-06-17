# API Contracts

Updated: 2026-05-28

Base URL in local Docker through Nginx: `https://localhost/api/v1`

Direct backend debug URL: `http://localhost:8001/api/v1`

Interactive docs are served by FastAPI at `/api/v1/docs` and `/api/v1/redoc`.

## Contract Rules

- JSON endpoints use `/api/v1` unless noted.
- Authenticated requests use `Authorization: Bearer <access_token>`.
- Mobile requests may include `X-Device-Tag` after device registration.
- All clients should send or accept `X-Correlation-ID`; the backend generates one if missing.
- File upload endpoints use multipart form data.
- OCR and liveness calls can take longer than normal API calls; Nginx and mobile timeouts are extended for those paths.
- Downstream access to BI PAY, BICEC Mobile-Banking, or BICEC Wallet is an OS-aware app handoff, not a DGI, Sopra Amplitude, or core banking API contract.
- The static `openapi-spec.json` in the repo can lag behind the code. Regenerate or inspect runtime `/api/v1/openapi.json` when exact schemas matter.

## Authentication And Authorization

| Client | Login path | Token storage | Main dependency |
| --- | --- | --- | --- |
| Mobile user | OTP/email OTP, PIN, WebAuthn | `vp_token` in local storage | `get_current_user` |
| Backoffice agent | email/password | `veripass_access_token` in local storage | `get_current_agent` |

Backoffice roles are enforced by `require_agent_role(...)`:

- `JEAN`: KYC validation.
- `THOMAS`: AML/compliance review.
- `SYLVIE`: command center, analytics, supervisory views.
- `ADMIN_IT`: agent and system administration.

## Health

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Root health check, returns DB and Redis status |
| GET | `/api/v1/auth/health` | Auth module health |
| GET | `/api/v1/sentry-proxy/health` | Sentry proxy health |

## Auth API

Prefix: `/auth`

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/otp/send` | Send OTP to phone or email-compatible identifier |
| POST | `/otp/verify` | Verify OTP and return tokens |
| POST | `/email/send` | Send email OTP |
| POST | `/email/verify` | Verify email OTP |
| POST | `/pin/setup` | Set client PIN |
| POST | `/pin/verify` | Verify PIN and return access token |
| POST | `/webauthn/register/options` | Create passkey registration challenge |
| POST | `/webauthn/register/verify` | Verify passkey registration |
| POST | `/webauthn/auth/options` | Create passkey login challenge |
| POST | `/webauthn/auth/verify` | Verify passkey login and return token |
| POST | `/agent/login` | Agent login |
| POST | `/agent/password-change` | Agent password change |
| POST | `/refresh` | Refresh access token using refresh token |
| GET | `/user/exists` | Check if a user exists by phone/email |
| GET | `/me` | Current mobile user |
| GET | `/agent/me` | Current backoffice agent |
| DELETE | `/account` | Soft-delete current client account |

Important behavior:

- Refresh tokens include `jti` and are checked against `token_revocations`.
- Access tokens include type, role, user type, and optional HMAC session handle.
- `dev_local` OTP mode is allowed only outside production.

## KYC API

Prefix: `/kyc`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/session/current` | Return latest relevant KYC session |
| POST | `/session/start` | Create or resume editable KYC session |
| POST | `/document/upload` | Upload a generic document (supported types: `CNI_RECTO`, `CNI_VERSO`, `SELFIE`, `BILL_ENEO`, `BILL_CAMWATER`, `NIU`, `SIGNATURE_SHEET`) |
| POST | `/capture/cni` | Upload CNI recto/verso and run OCR pipeline |
| POST | `/capture/bill` | Upload/capture proof of address |
| GET | `/document/{doc_id}/ocr` | Read OCR fields for one document |
| POST | `/ocr/review` | Submit user-reviewed OCR fields |
| POST | `/ocr/confirm` | Confirm or correct OCR fields |
| POST | `/ocr/merge` | Merge OCR fields from document sides |
| POST | `/liveness/submit` | Submit landmark challenge result; server verifies MiniFASNet PAD from SELFIE |
| POST | `/capture/liveness` | Capture selfie/liveness image path |
| POST | `/address/submit` | Store address and GPS metadata |
| POST | `/consent/submit` | Store CGU/privacy/data-processing consent |
| POST | `/niu/submit` | Store NIU type and value |
| POST | `/signature/submit` | Store signature reference (document_id for paper photo, or legacy base64) |
| GET | `/readiness` | Check whether dossier can be submitted |
| POST | `/submit` | Submit dossier to backoffice review |
| GET | `/review-status` | Mobile-facing review status |
| POST | `/notifications/read` | Mark KYC notifications read |
| POST | `/notifications/{notification_id}/read` | Mark one KYC notification read |
| GET | `/geo/regions` | Cameroon region lookup |
| GET | `/geo/cities/{region_code}` | City lookup |
| GET | `/geo/quartiers/{city_code}` | Quartier lookup |
| GET | `/atms` | Client-visible ATM list filtered by access |
| GET | `/backoffice/atms` | Backoffice ATM list |
| POST | `/backoffice/atms` | Create ATM |
| PUT | `/backoffice/atms/{atm_id}` | Update ATM |
| DELETE | `/backoffice/atms/{atm_id}` | Delete ATM |

Key request models:

- `AddressSubmitRequest`: region, city, commune, quartier, optional lieu-dit and GPS.
- `NIUSubmitRequest`: `niu_type` of `MISSING`, `DECLARATIVE`, or `UPLOADED`, with optional value.
- `ConsentSubmitRequest`: three consent booleans plus consent method.
- `SignatureSubmitRequest`: `document_id` (opaque handle of a `SIGNATURE_SHEET` document, preferred) or `signature_data` (base64 data URL, legacy fallback). At least one is required.
- `KYCSubmitRequest`: empty body; backend computes readiness and transitions.

## OCR Utility API

Prefix: `/ocr`

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/extract` | Run OCR on a stored document reference |
| POST | `/extract/upload` | Upload file and run direct OCR |
| GET | `/config/thresholds` | Return OCR thresholds |
| GET | `/test/extract` | Test extraction using mounted test images |

These routes are useful during OCR debugging. Product KYC capture normally uses `/kyc/capture/cni` and `/kyc/capture/bill`.

## Backoffice API

Prefix: `/backoffice`

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| GET | `/agents/load` | `SYLVIE`, `ADMIN_IT` | Agent load distribution for command center |
| GET | `/queue/stats` | `JEAN`, `THOMAS`, `SYLVIE`, `ADMIN_IT` | Queue counters |
| GET | `/queue` | `JEAN`, `THOMAS`, `SYLVIE`, `ADMIN_IT` | Paginated KYC queue |
| GET | `/dossier/{session_id}` | `JEAN`, `THOMAS`, `SYLVIE` | Full dossier detail |
| GET | `/dossier/{session_id}/documents/{doc_id}/file` | backoffice roles | Download document file |
| POST | `/dossier/{session_id}/documents/{doc_id}/classify` | `JEAN`, `SYLVIE` | Classify complementary document |
| POST | `/dossier/{session_id}/review` | role-dependent | Approve, reject, request info, flag fraud |
| POST | `/dossier/{session_id}/assign` | `JEAN`, `SYLVIE`, `ADMIN_IT` | Assign dossier to agent |
| POST | `/dossier/{session_id}/auto-assign` | `JEAN`, `SYLVIE`, `ADMIN_IT` | Assign to least-loaded connected Jean |
| GET | `/audit-logs` | backoffice roles | List audit logs |
| GET | `/support/threads` | backoffice roles | List support threads |
| POST | `/support/threads` | backoffice roles | Create support thread |
| GET | `/support/threads/{thread_id}/messages` | backoffice roles | List support messages |
| POST | `/support/threads/{thread_id}/messages` | backoffice roles | Send support message |
| GET | `/support/messages/{message_id}/attachment` | backoffice roles | Download support attachment |
| PATCH | `/support/messages/{message_id}/read` | backoffice roles | Mark support message read |
| POST | `/dossier/{session_id}/ocr-correct` | backoffice roles | Correct one OCR field |

Decision rules in `submit_review_decision`:

- `JEAN`: `APPROVED`, `REJECTED`, `INFO_REQUESTED`.
- `THOMAS`: `FRAUD_SUSPECT`, `INFO_REQUESTED`; from existing `FRAUD_SUSPECT`, only `REJECTED`.
- `SYLVIE`: `APPROVED`, `REJECTED`, `INFO_REQUESTED`, `FRAUD_SUSPECT`.

## Admin API

Prefix: `/admin`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/users` | List users |
| GET | `/agents` | Paginated agent list |
| POST | `/agents` | Create agent |
| PATCH | `/agents/{agent_id}` | Update agent |
| POST | `/agents/{agent_id}/reset-password` | Reset agent password |
| DELETE | `/agents/{agent_id}` | Deactivate agent |

These routes are intended for `ADMIN_IT`.

## AML API

Prefix: `/aml`

| Method | Path | Purpose |
| --- | --- |
| GET | `/alerts` | List AML alerts |
| GET | `/alerts/{alert_id}` | Alert detail |
| POST | `/alerts/{alert_id}/clear` | Clear false positive |
| POST | `/alerts/{alert_id}/confirm` | Confirm AML alert |
| POST | `/alerts/{alert_id}/escalate` | Escalate AML alert |
| GET | `/niu-conflicts` | List duplicate/NIU conflicts |
| POST | `/niu-conflicts/{conflict_id}/resolve` | Resolve duplicate/NIU conflict |
| GET | `/document-expiry` | Expiring document report |
| GET | `/lists` | List AML sources and latest import/sync status |
| GET | `/lists/template` | Download BICEC internal list CSV template |
| POST | `/lists/import/dry-run` | Validate an internal AML CSV without writing |
| POST | `/lists/import` | Import a validated internal AML CSV |
| POST | `/notify-global` | Send regulatory/global notification |
| GET | `/agencies` | List agencies |
| POST | `/agencies` | Create agency |
| PUT | `/agencies/{agency_id}` | Update agency |
| DELETE | `/agencies/{agency_id}` | Delete agency |
| GET | `/batch-jobs` | List AML/internal batch jobs |
| POST | `/batch-jobs/trigger` | Trigger batch job |

`/lists` is visible to `THOMAS`, `SYLVIE`, and `ADMIN_IT`. CSV import and template download are limited to `THOMAS` and `ADMIN_IT`.

## Analytics API

Prefix: `/analytics`

| Method | Path | Purpose |
| --- | --- |
| GET | `/dashboard` | Role-aware dashboard metrics |
| GET | `/funnel` | Funnel/drop-off metrics |
| GET | `/documents/performance` | OCR/document performance metrics |
| GET | `/fraud` | Fraud and liveness/AML metrics |
| GET | `/compliance` | Compliance metrics |
| GET | `/operations` | Queue/SLA/agent operations metrics |
| GET | `/marketing` | Acquisition/engagement metrics |
| GET | `/qa` | QA metrics |
| GET | `/technical` | Technical/observability metrics |
| GET | `/export` | Analytics export payload |

Common filters are date range, role, agency, and segment filters implemented in `modules/analytics/router.py`.

## Audit API

Prefix: `/audit`

| Method | Path | Purpose |
| --- | --- |
| GET | `/audit-log` | List audit entries |
| POST | `/audit-log/export-cobac` | Generate COBAC audit export |

## Banking API

Prefix: `/banking`

| Method | Path | Purpose |
| --- | --- |
| GET | `/account` | Derived account info |
| GET | `/cards` | Client cards |
| POST | `/cards/{card_id}/freeze` | Freeze/unfreeze card |
| POST | `/transfers/send` | Create transfer and ISO 20022 preview |
| GET | `/transfers` | Transfer history |
| GET | `/transactions` | Transaction history, optional category filter |
| GET | `/savings/pockets` | Savings pockets summary |
| POST | `/savings/pockets` | Create savings pocket |
| PUT | `/savings/pockets/{pocket_id}` | Update savings pocket |

Money-moving routes require a registered device and a KYC session with `LIMITED_ACCESS` or `FULL_ACCESS`.

These routes operate against local VeriPass data and product-shell records. Do not document or extend them as DGI, Sopra Amplitude, or core banking integration points.

## Downstream App Handoff

The expected handoff to BI PAY, BICEC Mobile-Banking, or BICEC Wallet belongs in the mobile client after KYC approval. It should be implemented as link routing:

| Value | Purpose |
| --- | --- |
| `BIPAY_IOS_STORE_URL` | App Store fallback for BI PAY |
| `BIPAY_ANDROID_STORE_URL` | Google Play fallback for BI PAY |
| `BIPAY_APP_LINK` | Optional universal/app/deep link opened before store fallback |
| `BICEC_WALLET_IOS_STORE_URL` | App Store fallback for BICEC Wallet or BICEC Mobile-Banking |
| `BICEC_WALLET_ANDROID_STORE_URL` | Google Play fallback for BICEC Wallet or BICEC Mobile-Banking |
| `BICEC_WALLET_APP_LINK` | Optional universal/app/deep link opened before store fallback |

Known public store references at the time of this documentation:

| Destination | Public reference |
| --- | --- |
| BI PAY iOS | `https://apps.apple.com/us/app/bipay-bicec-mobile-wallet/id1532756992` |
| BI PAY Android | `https://play.google.com/store/apps/details?id=com.bicec.bipay` |
| BICEC Mobile-Banking iOS | `https://apps.apple.com/us/app/bicec-mobile-banking/id1011209991` |

Confirm the final BICEC Wallet Android package or any private enterprise links with BICEC before release. Do not guess package IDs.

## Devices API

Prefix: `/devices`

| Method | Path | Purpose |
| --- | --- |
| POST | `/register` | Register active device fingerprint and receive device tag |

After a user has active device registrations, sensitive mobile routes can require a valid `X-Device-Tag`.

## Notifications API

Prefix: `/notifications`

| Method | Path | Purpose |
| --- | --- |
| GET | `/` or empty path | Notification inbox and unread count |
| POST | `/read` | Mark notifications read |
| GET | `/preferences` | Notification preferences |
| PUT | `/preferences` | Update notification preferences |
| GET | `/subscriptions` | Push subscriptions |
| POST | `/subscriptions` | Create/update push subscription |
| DELETE | `/subscriptions/{subscription_id}` | Deactivate push subscription |

## Support API

Prefix: `/support`

| Method | Path | Purpose |
| --- | --- |
| GET | `/attachment-limits` | Attachment policy for UI validation |
| GET | `/threads/current` | Get or create current support thread |
| GET | `/threads/{thread_id}/messages` | List messages |
| POST | `/threads/{thread_id}/messages` | Send text message |
| POST | `/threads/{thread_id}/attachments` | Send attachment as support message |
| POST | `/attachments` | Upload standalone support attachment |

Support attachment validation enforces type/size/page limits and stores SHA-256 metadata.

## Demo Celery API

Prefix: `/demo`

These endpoints are for demo/evidence task triggering:

- `/ocr/extract-cni`
- `/ocr/verify-liveness`
- `/notif/send-otp`
- `/notif/send-kyc-result`
- `/notif/batch-provision`
- `/cron/cleanup-otps`
- `/workflow/complete-kyc`
- `/populate/bulk-kyc`
- `/task/{task_id}`
- `/info`

Do not treat demo endpoints as production business contracts.
