---
title: "INFRA-06 - Orange SMS API Validation and Dev Fallback Strategy"
labels: "infrastructure,integration,auth,sprint-0,priority:high"
epic: 1
---
## Context
Replace all SMTP dependency with Orange SMS Cameroon as the primary OTP channel.

## Description
Update existing INFRA-06 to lock Orange SMS as the official solution and remove SMTP fallback.

## Subtasks
- [ ] Remove SMTP tasks from implementation and docs.
- [ ] Configure Orange SMS with provisioned identifiers:
  - Application ID: `pMTnm7GeS9AxgrR4`
  - Client ID: provisioned
- [ ] Add environment variables:
  - `ORANGE_APP_ID`
  - `ORANGE_CLIENT_ID`
  - `ORANGE_CLIENT_SECRET`
  - `ORANGE_BASE_URL`
- [ ] Add Orange contract test:
  - OAuth2 token acquisition
  - test SMS send
  - error handling for `401`, `429`, `5xx`
- [ ] Document validation procedure in `docs/`.

## Acceptance Criteria
- Orange OTP validated end-to-end before end of Sprint 1.
- No SMTP dependency in MVP.
- Orange error handling implemented and tested.

---
title: "AUTH-03 - OTP Send Uses Orange by Default Plus OTP_MODE"
labels: "backend,frontend,auth,sprint-1,priority:critical"
epic: 1
---
## Context
OTP flow must use Orange SMS by default for dev/prod, with strict non-prod fallback.

## Description
Update AUTH-03 so `POST /auth/otp/send` uses Orange by default and introduces `OTP_MODE=orange|dev_local`.

## Subtasks
- [ ] Default behavior:
  - `ENV=dev|prod` and `OTP_MODE=orange` => send via Orange SMS.
- [ ] Add runtime flag:
  - `OTP_MODE=orange|dev_local`.
- [ ] In `dev_local` mode:
  - generate OTP in backend
  - do not call external provider
  - log only through secure debug channel.
- [ ] Mask OTP in standard app logs.
- [ ] Add audit events:
  - `AUTH_OTP_SENT_ORANGE`
  - `AUTH_OTP_SENT_DEV_LOCAL`
- [ ] Update E2E tests to cover `orange` and `dev_local`.

## Acceptance Criteria
- Orange OTP is default path.
- `dev_local` works only in non-prod context.
- No clear OTP in standard logs.

---
title: "AUTH-06 - OTP Dev Local Fallback (DEV DEMO only)"
labels: "backend,auth,testing,sprint-1,priority:high"
epic: 1
---
## Goal
Keep tests and demo running if Orange is temporarily unavailable, without adding SMTP or a second paid provider.

## Description
Add a non-redundant issue dedicated to local OTP fallback, strictly limited to DEV/DEMO.

## Subtasks
- [ ] Implement strict guard:
  - `OTP_MODE=dev_local` forbidden in production.
- [ ] Add startup validation:
  - if `ENV=prod` and `OTP_MODE=dev_local` => fail fast.
- [ ] Add minimal debug/demo flow to read OTP in secure non-prod environment.
- [ ] Add audit trail for each OTP generated in local mode.
- [ ] Add tests:
  - local mode enabled in dev
  - rejected in prod
  - full E2E OTP path in local mode.

## Acceptance Criteria
- `dev_local` fallback is available and reliable for demo.
- Non-prod lock is enforced and tested.
- Backlog compliance: no overlap with AUTH-03.
