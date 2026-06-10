# Sentry Issue Audit - 2026-05-23

Generated: 2026-05-23 09:10:06Z

Scope: all Sentry issues from first capture through 2026-05-23 for the VeriPass backend, mobile, and backoffice projects.

## Project Mapping

| Surface | Sentry project ID | Sentry slug | Release hint |
| --- | --- | --- | --- |
| backend | 4511114019471440 | veripass-backend | BICEC VeriPass@0.1.0 |
| mobile | 4511114011410512 | veripass-mobile | veripass-mobile@{APP_VERSION} |
| backoffice | 4511114014949456 | veripass-backoffice | veripass-backoffice@{APP_VERSION} |

## Local Integration Context

- Mobile and backoffice initialize `@sentry/react` only when `VITE_SENTRY_DSN` is present, and `beforeSend` drops non-production events.
- Mobile and backoffice send envelopes through `/api/v1/sentry-proxy` to avoid browser blocking of Sentry ingest hosts.
- Backend FastAPI initializes `sentry_sdk` when `SENTRY_DSN` is set and `SKIP_SENTRY` is not set, with `traces_sample_rate=0.1`.
- The current proxy endpoint is hardcoded to project ID `4511114011410512`, so backoffice browser events may be forwarded into the mobile Sentry project unless the envelope target is honored or separated.

## Summary

| Surface | Total | Still relevant | Needs reproduction | Likely fixed | Noise/config |
| --- | ---: | ---: | ---: | ---: | ---: |
| backend | 70 | 28 | 42 | 0 | 0 |
| mobile | 12 | 12 | 0 | 0 | 0 |
| backoffice | 0 | 0 | 0 | 0 | 0 |

## Executive Remediation Themes

1. **Stop backend Sentry noise from expected 4xx/422 responses.** Most backend issues are development `HTTP error:` or `Validation error:` events. They are unresolved and recent, but many are expected auth, RBAC, OTP, bad JSON, or missing-document responses. The backend currently logs HTTP and validation exceptions at error level, which Sentry records as issues. Change expected 4xx/422 paths to warning/info or filter them before Sentry, while preserving real 5xx exception capture.
2. **Fix real backend defects that still map to current code.** Prioritize `AdminAgentResponse` validation, `AuditLogSchema` validation, OCR `AssertionError`, OCR `_t_align` `UnboundLocalError`, `KYCSession.created_at`, admin `MultipleResultsFound`, notifications `user_id` integrity, and `_side` `NameError`. These are not just observability noise because they include stack traces mapped to backend modules.
3. **Resolve mobile production issues.** The 12 mobile issues are all production unresolved events. Group them into service-worker deployment/MIME failures, camera permission/timeout aborts, upload 504 handling, and offline CNI hash mismatch. These should be fixed or explicitly suppressed only after reproduction.
4. **Investigate Sentry project routing.** Backoffice exported zero issues while both mobile and backoffice use the same `/api/v1/sentry-proxy`; the proxy is hardcoded to mobile project ID `4511114011410512`. Confirm whether backoffice frontend events are absent or being mixed into the mobile project, then split/derive the proxy target per DSN.
5. **Close stale development-only issues after filtering.** Once backend logging/Sentry filtering is fixed, bulk-resolve development-only expected client errors in Sentry and monitor for recurrence in production releases.

## Issues By Surface

### backend

| Verdict | Level | Status | Last seen | Count | Users | Issue | Environments | Releases | Matched source |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| Still relevant | error | unresolved | 2026-05-23T05:31:42Z | 51 | 2 | [HTTP error: Not Found](https://2026ucac-icamcom.sentry.io/issues/107671858/) | development | BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-22T23:34:49Z | 3 | 1 | [HTTP error: Device tag is not registered for this user.](https://2026ucac-icamcom.sentry.io/issues/122022023/) | development | BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-22T23:34:49Z | 3 | 1 | [HTTP error: Device tag required. Register this device before continuing.](https://2026ucac-icamcom.sentry.io/issues/122022021/) | development | BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-22T23:34:18Z | 10 | 1 | [Validation error: [{'type': 'json_invalid', 'loc': ('body', 1), 'msg': 'JSON decode error', 'input': {}, 'ctx': {'error': 'Expecting property name enclosed in double quotes'}}]](https://2026ucac-icamcom.sentry.io/issues/109706351/) | development | BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-22T15:11:02Z | 1 | 1 | [HTTP error: Ajoutez et verifiez un email avant de choisir le canal email.](https://2026ucac-icamcom.sentry.io/issues/121945905/) | development | BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-22T14:38:20Z | 3316 | 2 | [HTTP error: Not authenticated](https://2026ucac-icamcom.sentry.io/issues/107611566/) | development | 3bf4664b721d1bbe0816497e155946e179838607, BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-22T13:18:33Z | 26 | 1 | [HTTP error: Invalid or revoked refresh token](https://2026ucac-icamcom.sentry.io/issues/121793030/) | development | BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-22T13:18:33Z | 783 | 1 | [HTTP error: Invalid or expired token](https://2026ucac-icamcom.sentry.io/issues/109567687/) | development | BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-22T13:18:25Z | 20 | 1 | [HTTP error: Invalid email or password. Attempt 1/5.](https://2026ucac-icamcom.sentry.io/issues/114941277/) | development | BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-22T13:18:21Z | 34 | 1 | [ValidationError: 2 validation errors for AdminAgentResponse](https://2026ucac-icamcom.sentry.io/issues/121786067/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/core/pagination.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py |
| Still relevant | error | unresolved | 2026-05-22T09:42:58Z | 9 | 1 | [HTTP error: Role 'SYLVIE' not authorized. Required: ['ADMIN_IT']](https://2026ucac-icamcom.sentry.io/issues/121786059/) | development | BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-22T08:04:38Z | 3 | 1 | [HTTP error: No passkey registered for this account.](https://2026ucac-icamcom.sentry.io/issues/121826527/) | development | BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-22T05:36:57Z | 9 | 1 | [HTTP error: Account locked for 15 minutes due to multiple failed attempts.](https://2026ucac-icamcom.sentry.io/issues/116092475/) | development | BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-18T02:56:18Z | 1 | 1 | [AssertionError: 6 != 1 for key class_ids!](https://2026ucac-icamcom.sentry.io/issues/120578398/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/api/v1/ocr.py, bicec-veripass-boss/code/app/services/ocr_service.py, bicec-veripass-boss/code/app/tasks/ocr.py, code/backend/app/api/v1/ocr.py, code/backend/app/services/ocr_service.py |
| Still relevant | error | unresolved | 2026-05-15T18:58:34Z | 2 | 1 | [HTTP error: PIN révoqué. Veuillez vous reconnecter via OTP.](https://2026ucac-icamcom.sentry.io/issues/120200067/) | development | BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-08T11:34:18Z | 24 | 1 | [HTTP error: Invalid or expired OTP. 2 attempt(s) remaining.](https://2026ucac-icamcom.sentry.io/issues/107646719/) | development | BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-05T02:58:11Z | 2 | 1 | [UnboundLocalError: cannot access local variable '_t_align' where it is not associated with a value](https://2026ucac-icamcom.sentry.io/issues/117500934/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/services/ocr_service.py, code/backend/app/services/ocr_service.py |
| Still relevant | error | unresolved | 2026-05-05T02:56:53Z | 1 | 1 | [HTTP error: {'code': 'DUPLICATE_DOCUMENT', 'message': 'Un document CNI_RECTO identique existe déjà dans ce dossier.', 'retryable': False}](https://2026ucac-icamcom.sentry.io/issues/117503952/) | development | BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-03T05:57:39Z | 2 | 1 | [AttributeError: type object 'KYCSession' has no attribute 'created_at'](https://2026ucac-icamcom.sentry.io/issues/117089582/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py, bicec-veripass-boss/code/app/modules/admin/router.py |
| Still relevant | error | unresolved | 2026-05-02T13:57:48Z | 4 | 1 | [HTTP error: OTP has expired](https://2026ucac-icamcom.sentry.io/issues/109285485/) | development | BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-02T06:11:38Z | 3 | 1 | [MultipleResultsFound: Multiple rows were found when one or none was required](https://2026ucac-icamcom.sentry.io/issues/116803344/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py, bicec-veripass-boss/code/app/modules/admin/router.py |
| Still relevant | error | unresolved | 2026-05-01T06:02:45Z | 14 | 1 | [ValidationError: 1 validation error for AuditLogSchema](https://2026ucac-icamcom.sentry.io/issues/116760153/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/core/pagination.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py |
| Still relevant | error | unresolved | 2026-05-01T05:30:06Z | 9 | 2 | [HTTP error: Role 'JEAN' not authorized. Required: ['SYLVIE', 'ADMIN_IT']](https://2026ucac-icamcom.sentry.io/issues/115026648/) | development | BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-01T00:16:26Z | 2 | 1 | [MultipleResultsFound: Multiple rows were found when one or none was required](https://2026ucac-icamcom.sentry.io/issues/116705829/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py, bicec-veripass-boss/code/app/modules/admin/router.py |
| Still relevant | error | unresolved | 2026-04-30T20:01:21Z | 1 | 1 | [MultipleResultsFound: Multiple rows were found when one or none was required](https://2026ucac-icamcom.sentry.io/issues/116705597/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py, bicec-veripass-boss/code/app/modules/admin/router.py |
| Still relevant | error | unresolved | 2026-04-30T17:48:42Z | 183 | 2 | [HTTP error: Role 'JEAN' not authorized. Required: ['THOMAS', 'SYLVIE', 'ADMIN_IT']](https://2026ucac-icamcom.sentry.io/issues/109707749/) | development | BICEC VeriPass@0.1.0 | none |
| Still relevant | error | unresolved | 2026-04-30T17:47:50Z | 3 | 1 | [IntegrityError: (sqlalchemy.dialects.postgresql.asyncpg.IntegrityError) <class 'asyncpg.exceptions.NotNullViolationError'>: null value in column "user_id" of relation "notifications" violates not-null constraint](https://2026ucac-icamcom.sentry.io/issues/116259482/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/db/session.py, bicec-veripass-boss/code/app/main.py |
| Still relevant | error | unresolved | 2026-04-29T17:01:47Z | 3 | 1 | [NameError: name '_side' is not defined](https://2026ucac-icamcom.sentry.io/issues/115233893/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/modules/admin/service.py, bicec-veripass-boss/code/app/modules/aml/service.py, bicec-veripass-boss/code/app/modules/analytics/service.py, bicec-veripass-boss/code/app/modules/audit/service.py, bicec-veripass-boss/code/app/modules/auth/service.py |
| Needs reproduction | error | unresolved | 2026-04-26T19:34:14Z | 5 | 1 | [Sentry proxy: timeout forwarding event](https://2026ucac-icamcom.sentry.io/issues/115380328/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-26T06:19:24Z | 3 | 1 | [HTTP error: Method Not Allowed](https://2026ucac-icamcom.sentry.io/issues/109442984/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-26T05:08:14Z | 4 | 1 | [ProgrammingError: (sqlalchemy.dialects.postgresql.asyncpg.ProgrammingError) <class 'asyncpg.exceptions.UndefinedTableError'>: relation "users" does not exist](https://2026ucac-icamcom.sentry.io/issues/115216919/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/db/session.py, bicec-veripass-boss/code/app/main.py |
| Needs reproduction | error | unresolved | 2026-04-25T06:34:22Z | 1 | 1 | [HTTP error: Ce compte a été supprimé. Veuillez créer un nouveau compte.](https://2026ucac-icamcom.sentry.io/issues/115040959/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-25T06:16:09Z | 2 | 1 | [HTTP error: Numéro non reconnu. Créez d'abord un compte.](https://2026ucac-icamcom.sentry.io/issues/115038844/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-25T04:14:40Z | 1 | 1 | [HTTP error: Role 'THOMAS' not authorized. Required: ['ADMIN_IT']](https://2026ucac-icamcom.sentry.io/issues/115026647/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-25T04:14:40Z | 2 | 1 | [TypeError: '>' not supported between instances of 'MagicMock' and 'int'](https://2026ucac-icamcom.sentry.io/issues/115026643/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py, bicec-veripass-boss/code/app/modules/admin/router.py |
| Needs reproduction | error | unresolved | 2026-04-25T04:14:40Z | 1 | 1 | [HTTP error: Role 'JEAN' not authorized. Required: ['ADMIN_IT']](https://2026ucac-icamcom.sentry.io/issues/115026642/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-25T04:14:40Z | 11 | 1 | [ResponseValidationError: 2 validation errors:](https://2026ucac-icamcom.sentry.io/issues/107646296/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py, code/backend/app/core/exceptions.py, code/backend/app/db/base.py |
| Needs reproduction | error | unresolved | 2026-04-25T04:14:39Z | 3 | unknown | [Exception: connection refused](https://2026ucac-icamcom.sentry.io/issues/107646290/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/core/utils.py, bicec-veripass-boss/code/app/modules/auth/utils.py, code/backend/app/core/utils.py, code/backend/app/modules/auth/utils.py, paddleocr_test/.venv_ocr/Lib/site-packages/Cython/Compiler/Tests/Utils.py |
| Needs reproduction | error | unresolved | 2026-04-25T04:14:39Z | 7 | unknown | [Disk check/prune timed out](https://2026ucac-icamcom.sentry.io/issues/107608192/) | development | BICEC VeriPass@0.1.0, d6f23be973160e20364120da85bb3a84e1106844 | none |
| Needs reproduction | error | unresolved | 2026-04-25T04:14:39Z | 7 | unknown | [Unexpected df output format](https://2026ucac-icamcom.sentry.io/issues/107608191/) | development | BICEC VeriPass@0.1.0, d6f23be973160e20364120da85bb3a84e1106844 | none |
| Needs reproduction | error | unresolved | 2026-04-25T04:14:39Z | 7 | unknown | [Docker prune failed: Cannot connect to Docker daemon](https://2026ucac-icamcom.sentry.io/issues/107608190/) | development | BICEC VeriPass@0.1.0, d6f23be973160e20364120da85bb3a84e1106844 | none |
| Needs reproduction | error | unresolved | 2026-04-25T04:14:39Z | 7 | unknown | [df command failed: df: cannot access '/': No such file](https://2026ucac-icamcom.sentry.io/issues/107608189/) | development | BICEC VeriPass@0.1.0, d6f23be973160e20364120da85bb3a84e1106844 | none |
| Needs reproduction | error | unresolved | 2026-04-25T04:14:39Z | 7 | unknown | [pg_dump failed: connection refused](https://2026ucac-icamcom.sentry.io/issues/107608184/) | development | BICEC VeriPass@0.1.0, d6f23be973160e20364120da85bb3a84e1106844 | none |
| Needs reproduction | error | unresolved | 2026-04-24T16:39:21Z | 1 | 1 | [HTTP error: Role 'THOMAS' cannot make decision 'APPROVED'. Allowed: ['FRAUD_SUSPECT', 'INFO_REQUESTED']](https://2026ucac-icamcom.sentry.io/issues/114942838/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-24T16:35:46Z | 3 | 1 | [AttributeError: 'PageParams' object has no attribute 'size'](https://2026ucac-icamcom.sentry.io/issues/114941456/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py, bicec-veripass-boss/code/app/modules/admin/router.py |
| Needs reproduction | error | unresolved | 2026-04-24T16:29:23Z | 1 | 1 | [HTTP error: Missing required documents: CNI_RECTO, CNI_VERSO, SELFIE](https://2026ucac-icamcom.sentry.io/issues/114941148/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-24T16:27:13Z | 1 | 1 | [Validation error: [{'type': 'missing', 'loc': ('body', 'otp'), 'msg': 'Field required', 'input': {'phone': '+237691234570', 'code': '735214'}}]](https://2026ucac-icamcom.sentry.io/issues/114940751/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-24T15:37:56Z | 1 | 1 | [Failed to read image: /data/documents/836557f6-9651-4e96-80fb-22b2668b497c/BILL_ENEO/20260424_153756_f85c8807_test_cni.png](https://2026ucac-icamcom.sentry.io/issues/114931319/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-24T15:37:50Z | 1 | 1 | [Failed to read image: /data/documents/836557f6-9651-4e96-80fb-22b2668b497c/CNI_RECTO/20260424_153750_d20f6ffd_20260327_132447_d20f6ffd_cni_recto.jpg](https://2026ucac-icamcom.sentry.io/issues/114931299/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-24T15:37:50Z | 1 | 1 | [Failed to read image: /data/documents/836557f6-9651-4e96-80fb-22b2668b497c/CNI_VERSO/20260424_153750_f85c8807_test_cni.png](https://2026ucac-icamcom.sentry.io/issues/114931296/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-24T15:35:58Z | 1 | 1 | [Failed to read image: /data/documents/5bcbb566-bc3c-4151-87a1-4a12406647b0/BILL_ENEO/20260424_153558_f85c8807_test_cni.png](https://2026ucac-icamcom.sentry.io/issues/114930866/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-24T15:35:52Z | 1 | 1 | [Failed to read image: /data/documents/5bcbb566-bc3c-4151-87a1-4a12406647b0/CNI_VERSO/20260424_153552_f85c8807_test_cni.png](https://2026ucac-icamcom.sentry.io/issues/114930844/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-24T15:35:51Z | 1 | 1 | [Failed to read image: /data/documents/5bcbb566-bc3c-4151-87a1-4a12406647b0/CNI_RECTO/20260424_153551_d20f6ffd_20260327_132447_d20f6ffd_cni_recto.jpg](https://2026ucac-icamcom.sentry.io/issues/114930838/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-24T15:24:04Z | 1 | 1 | [HTTP error: Missing required documents: SELFIE](https://2026ucac-icamcom.sentry.io/issues/114928110/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-24T15:23:35Z | 1 | 1 | [Failed to read image: /data/documents/ef974633-a81c-45a3-8ddf-868998c0ab36/BILL_ENEO/20260424_152335_f85c8807_test_cni.png](https://2026ucac-icamcom.sentry.io/issues/114927976/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-24T15:23:28Z | 1 | 1 | [Failed to read image: /data/documents/ef974633-a81c-45a3-8ddf-868998c0ab36/CNI_VERSO/20260424_152328_f85c8807_test_cni.png](https://2026ucac-icamcom.sentry.io/issues/114927941/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-24T15:22:53Z | 1 | 1 | [Failed to read image: /data/documents/ef974633-a81c-45a3-8ddf-868998c0ab36/CNI_RECTO/20260424_152253_d20f6ffd_20260327_132447_d20f6ffd_cni_recto.jpg](https://2026ucac-icamcom.sentry.io/issues/114927843/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-24T13:55:11Z | 20 | 1 | [HTTP error: User not found](https://2026ucac-icamcom.sentry.io/issues/107611557/) | development | 3bf4664b721d1bbe0816497e155946e179838607, BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-24T00:22:25Z | 7 | 1 | [HTTP error: Test image not found on server](https://2026ucac-icamcom.sentry.io/issues/113412361/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-23T23:29:09Z | 3 | 1 | [HTTP error: File too small to be a valid image](https://2026ucac-icamcom.sentry.io/issues/113284401/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-23T22:53:38Z | 3 | 1 | [TypeError: PaddleOCR.predict() got an unexpected keyword argument 'cls'](https://2026ucac-icamcom.sentry.io/issues/114681486/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/api/v1/ocr.py, bicec-veripass-boss/code/app/services/ocr_service.py, bicec-veripass-boss/code/app/tasks/ocr.py, code/backend/app/api/v1/ocr.py, code/backend/app/services/ocr_service.py |
| Needs reproduction | error | unresolved | 2026-04-23T18:45:06Z | 5 | 1 | [TypeError: PaddleOCR.predict() got an unexpected keyword argument 'cls'](https://2026ucac-icamcom.sentry.io/issues/114584324/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/api/v1/ocr.py, bicec-veripass-boss/code/app/services/ocr_service.py, bicec-veripass-boss/code/app/tasks/ocr.py, code/backend/app/api/v1/ocr.py, code/backend/app/services/ocr_service.py |
| Needs reproduction | error | unresolved | 2026-04-23T16:43:57Z | 1 | 1 | [Document upload failed: Failed to save document: [Errno 13] Permission denied: '/data/documents/3e3673a8-64e6-44be-836e-61fe79fdabd4/CNI_RECTO/20260423_164357_e36a835e_cni_recto.jpg.tmp'](https://2026ucac-icamcom.sentry.io/issues/114655022/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-23T16:43:57Z | 1 | 1 | [Failed to save document: [Errno 13] Permission denied: '/data/documents/3e3673a8-64e6-44be-836e-61fe79fdabd4/CNI_RECTO/20260423_164357_e36a835e_cni_recto.jpg.tmp'](https://2026ucac-icamcom.sentry.io/issues/114655017/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-23T16:43:57Z | 1 | 1 | [Document upload failed: Failed to save document: [Errno 13] Permission denied: '/data/documents/3e3673a8-64e6-44be-836e-61fe79fdabd4/CNI_RECTO/20260423_164356_4f55c38e_cni_recto.jpg.tmp'](https://2026ucac-icamcom.sentry.io/issues/114655003/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-23T16:43:57Z | 4 | 1 | [HTTPException: Failed to save document](https://2026ucac-icamcom.sentry.io/issues/114481434/) | development | BICEC VeriPass@0.1.0 | bicec-veripass-boss/code/app/__init__.py, bicec-veripass-boss/code/app/api/__init__.py, bicec-veripass-boss/code/app/api/v1/__init__.py, bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/__init__.py |
| Needs reproduction | error | unresolved | 2026-04-23T16:43:57Z | 4 | 1 | [HTTP error: Failed to save document](https://2026ucac-icamcom.sentry.io/issues/114481433/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-23T16:43:56Z | 1 | 1 | [Failed to save document: [Errno 13] Permission denied: '/data/documents/3e3673a8-64e6-44be-836e-61fe79fdabd4/CNI_RECTO/20260423_164356_4f55c38e_cni_recto.jpg.tmp'](https://2026ucac-icamcom.sentry.io/issues/114654993/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-23T15:54:41Z | 1 | 1 | [Document upload failed: Failed to save document: [Errno 13] Permission denied: '/data/documents/3e3673a8-64e6-44be-836e-61fe79fdabd4/CNI_RECTO/20260423_155441_e36a835e_cni_recto.jpg.tmp'](https://2026ucac-icamcom.sentry.io/issues/114643360/) | development | BICEC VeriPass@0.1.0 | none |
| Needs reproduction | error | unresolved | 2026-04-23T15:54:41Z | 1 | 1 | [Failed to save document: [Errno 13] Permission denied: '/data/documents/3e3673a8-64e6-44be-836e-61fe79fdabd4/CNI_RECTO/20260423_155441_e36a835e_cni_recto.jpg.tmp'](https://2026ucac-icamcom.sentry.io/issues/114643338/) | development | BICEC VeriPass@0.1.0 | none |

### mobile

| Verdict | Level | Status | Last seen | Count | Users | Issue | Environments | Releases | Matched source |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| Still relevant | error | unresolved | 2026-05-09T08:35:08Z | 1 | unknown | [TypeError: Failed to update a ServiceWorker for scope ('https://localhost/mobile/') with script ('https://localhost/mobile/sw.js'): An unknown error occurred when fetching the script.](https://2026ucac-icamcom.sentry.io/issues/118687524/) | production | veripass-mobile@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-05T23:18:40Z | 1 | unknown | [Error: SecurityError: Failed to update a ServiceWorker for scope ('https://localhost/mobile/') with script ('https://localhost/mobile/sw.js'): The script has an unsupported MIME type ('text/html').](https://2026ucac-icamcom.sentry.io/issues/117794934/) | production | veripass-mobile@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-05T02:56:53Z | 1 | unknown | [SyncError: capture_cni_hash_mismatch](https://2026ucac-icamcom.sentry.io/issues/117503955/) | production | veripass-mobile@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-05T02:19:41Z | 1 | unknown | [AbortError: signal is aborted without reason](https://2026ucac-icamcom.sentry.io/issues/117500937/) | production | veripass-mobile@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-03T18:10:14Z | 3 | unknown | [Error: SecurityError: Failed to update a ServiceWorker for scope ('https://localhost/mobile/') with script ('https://localhost/mobile/sw.js'): The script has an unsupported MIME type ('text/html').](https://2026ucac-icamcom.sentry.io/issues/117089420/) | production | veripass-mobile@0.1.0 | none |
| Still relevant | error | unresolved | 2026-05-03T15:37:03Z | 1 | unknown | [TypeError: Failed to update a ServiceWorker for scope ('https://localhost/mobile/') with script ('https://localhost/mobile/sw.js'): An unknown error occurred when fetching the script.](https://2026ucac-icamcom.sentry.io/issues/117156527/) | production | veripass-mobile@0.1.0 | none |
| Still relevant | error | unresolved | 2026-04-30T16:28:03Z | 1 | unknown | [Error: upload_bill_failed_504](https://2026ucac-icamcom.sentry.io/issues/116664690/) | production | veripass-mobile@0.1.0 | none |
| Still relevant | error | unresolved | 2026-04-30T09:52:43Z | 1 | unknown | [AbortError: signal is aborted without reason](https://2026ucac-icamcom.sentry.io/issues/116548585/) | production | veripass-mobile@0.1.0 | none |
| Still relevant | error | unresolved | 2026-04-30T09:49:39Z | 1 | unknown | [Error: AbortError: Timeout starting video source](https://2026ucac-icamcom.sentry.io/issues/116547440/) | production | veripass-mobile@0.1.0 | none |
| Still relevant | error | unresolved | 2026-04-29T18:55:35Z | 1 | unknown | [AbortError: signal is aborted without reason](https://2026ucac-icamcom.sentry.io/issues/116389658/) | production | veripass-mobile@0.1.0 | none |
| Still relevant | error | unresolved | 2026-04-29T15:04:21Z | 1 | unknown | [AbortError: signal is aborted without reason](https://2026ucac-icamcom.sentry.io/issues/116336070/) | production | veripass-mobile@0.1.0 | none |
| Still relevant | error | unresolved | 2026-04-26T06:12:14Z | 2 | unknown | [Error: NotAllowedError: Permission denied](https://2026ucac-icamcom.sentry.io/issues/115232239/) | production | veripass-mobile@0.1.0 | none |

### backoffice

No issues exported for this surface.

## Resolution Plan

1. **backend: HTTP error: Not Found**
   - Link: https://2026ucac-icamcom.sentry.io/issues/107671858/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
2. **backend: HTTP error: Device tag is not registered for this user.**
   - Link: https://2026ucac-icamcom.sentry.io/issues/122022023/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
3. **backend: HTTP error: Device tag required. Register this device before continuing.**
   - Link: https://2026ucac-icamcom.sentry.io/issues/122022021/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
4. **backend: Validation error: [{'type': 'json_invalid', 'loc': ('body', 1), 'msg': 'JSON decode error', 'input': {}, 'ctx': {'error': 'Expecting property name enclosed in double quotes'}}]**
   - Link: https://2026ucac-icamcom.sentry.io/issues/109706351/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
5. **backend: HTTP error: Ajoutez et verifiez un email avant de choisir le canal email.**
   - Link: https://2026ucac-icamcom.sentry.io/issues/121945905/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
6. **backend: HTTP error: Not authenticated**
   - Link: https://2026ucac-icamcom.sentry.io/issues/107611566/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
7. **backend: HTTP error: Invalid or revoked refresh token**
   - Link: https://2026ucac-icamcom.sentry.io/issues/121793030/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
8. **backend: HTTP error: Invalid or expired token**
   - Link: https://2026ucac-icamcom.sentry.io/issues/109567687/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
9. **backend: HTTP error: Invalid email or password. Attempt 1/5.**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114941277/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
10. **backend: ValidationError: 2 validation errors for AdminAgentResponse**
   - Link: https://2026ucac-icamcom.sentry.io/issues/121786067/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/core/pagination.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py
   - Stack files: starlette/middleware/errors.py, starlette/middleware/base.py, contextlib.py, starlette/_utils.py, app/main.py
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
11. **backend: HTTP error: Role 'SYLVIE' not authorized. Required: ['ADMIN_IT']**
   - Link: https://2026ucac-icamcom.sentry.io/issues/121786059/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
12. **backend: HTTP error: No passkey registered for this account.**
   - Link: https://2026ucac-icamcom.sentry.io/issues/121826527/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
13. **backend: HTTP error: Account locked for 15 minutes due to multiple failed attempts.**
   - Link: https://2026ucac-icamcom.sentry.io/issues/116092475/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
14. **backend: AssertionError: 6 != 1 for key class_ids!**
   - Link: https://2026ucac-icamcom.sentry.io/issues/120578398/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: bicec-veripass-boss/code/app/api/v1/ocr.py, bicec-veripass-boss/code/app/services/ocr_service.py, bicec-veripass-boss/code/app/tasks/ocr.py, code/backend/app/api/v1/ocr.py, code/backend/app/services/ocr_service.py
   - Stack files: app/services/ocr_service.py, paddleocr/_pipelines/ocr.py, paddlex/inference/pipelines/_parallel.py, paddlex/inference/pipelines/ocr/pipeline.py, paddlex/inference/models/base/predictor/base_predictor.py
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
15. **backend: HTTP error: PIN révoqué. Veuillez vous reconnecter via OTP.**
   - Link: https://2026ucac-icamcom.sentry.io/issues/120200067/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
16. **backend: HTTP error: Invalid or expired OTP. 2 attempt(s) remaining.**
   - Link: https://2026ucac-icamcom.sentry.io/issues/107646719/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
17. **backend: UnboundLocalError: cannot access local variable '_t_align' where it is not associated with a value**
   - Link: https://2026ucac-icamcom.sentry.io/issues/117500934/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: bicec-veripass-boss/code/app/services/ocr_service.py, code/backend/app/services/ocr_service.py
   - Stack files: app/services/ocr_service.py
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
18. **backend: HTTP error: {'code': 'DUPLICATE_DOCUMENT', 'message': 'Un document CNI_RECTO identique existe déjà dans ce dossier.', 'retryable': False}**
   - Link: https://2026ucac-icamcom.sentry.io/issues/117503952/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
19. **backend: AttributeError: type object 'KYCSession' has no attribute 'created_at'**
   - Link: https://2026ucac-icamcom.sentry.io/issues/117089582/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py, bicec-veripass-boss/code/app/modules/admin/router.py
   - Stack files: starlette/middleware/errors.py, starlette/middleware/base.py, contextlib.py, starlette/_utils.py, app/main.py
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
20. **backend: HTTP error: OTP has expired**
   - Link: https://2026ucac-icamcom.sentry.io/issues/109285485/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
21. **backend: MultipleResultsFound: Multiple rows were found when one or none was required**
   - Link: https://2026ucac-icamcom.sentry.io/issues/116803344/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py, bicec-veripass-boss/code/app/modules/admin/router.py
   - Stack files: starlette/middleware/errors.py, starlette/middleware/base.py, contextlib.py, starlette/_utils.py, app/main.py
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
22. **backend: ValidationError: 1 validation error for AuditLogSchema**
   - Link: https://2026ucac-icamcom.sentry.io/issues/116760153/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/core/pagination.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py
   - Stack files: starlette/middleware/errors.py, starlette/middleware/base.py, contextlib.py, starlette/_utils.py, app/main.py
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
23. **backend: HTTP error: Role 'JEAN' not authorized. Required: ['SYLVIE', 'ADMIN_IT']**
   - Link: https://2026ucac-icamcom.sentry.io/issues/115026648/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
24. **backend: MultipleResultsFound: Multiple rows were found when one or none was required**
   - Link: https://2026ucac-icamcom.sentry.io/issues/116705829/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py, bicec-veripass-boss/code/app/modules/admin/router.py
   - Stack files: starlette/middleware/errors.py, starlette/middleware/base.py, contextlib.py, starlette/_utils.py, app/main.py
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
25. **backend: MultipleResultsFound: Multiple rows were found when one or none was required**
   - Link: https://2026ucac-icamcom.sentry.io/issues/116705597/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py, bicec-veripass-boss/code/app/modules/admin/router.py
   - Stack files: starlette/middleware/errors.py, starlette/middleware/base.py, contextlib.py, starlette/_utils.py, app/main.py
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
26. **backend: HTTP error: Role 'JEAN' not authorized. Required: ['THOMAS', 'SYLVIE', 'ADMIN_IT']**
   - Link: https://2026ucac-icamcom.sentry.io/issues/109707749/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: none
   - Stack files: none
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
27. **backend: IntegrityError: (sqlalchemy.dialects.postgresql.asyncpg.IntegrityError) <class 'asyncpg.exceptions.NotNullViolationError'>: null value in column "user_id" of relation "notifications" violates not-null constraint**
   - Link: https://2026ucac-icamcom.sentry.io/issues/116259482/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/db/session.py, bicec-veripass-boss/code/app/main.py
   - Stack files: sqlalchemy/dialects/postgresql/asyncpg.py, asyncpg/prepared_stmt.py, asyncpg/protocol/protocol.pyx, sqlalchemy/engine/base.py, sqlalchemy/engine/default.py
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
28. **backend: NameError: name '_side' is not defined**
   - Link: https://2026ucac-icamcom.sentry.io/issues/115233893/
   - Verdict: Still relevant
   - Evidence: Unresolved and last seen after latest Sentry stabilization commit (2026-04-26).
   - Current source match: bicec-veripass-boss/code/app/modules/admin/service.py, bicec-veripass-boss/code/app/modules/aml/service.py, bicec-veripass-boss/code/app/modules/analytics/service.py, bicec-veripass-boss/code/app/modules/audit/service.py, bicec-veripass-boss/code/app/modules/auth/service.py
   - Stack files: app/modules/kyc/service.py, app/services/ocr_service.py
   - Plan: Prioritize by event/user count; fix the current stack path or add instrumentation if the stack is not actionable.
29. **mobile: TypeError: Failed to update a ServiceWorker for scope ('https://localhost/mobile/') with script ('https://localhost/mobile/sw.js'): An unknown error occurred when fetching the script.**
   - Link: https://2026ucac-icamcom.sentry.io/issues/118687524/
   - Verdict: Still relevant
   - Evidence: Unresolved production issue.
   - Current source match: none
   - Stack files: none
   - Plan: Reproduce the latest event path, patch the mapped source, add a regression test, deploy, then resolve in Sentry after no recurrence.
30. **mobile: Error: SecurityError: Failed to update a ServiceWorker for scope ('https://localhost/mobile/') with script ('https://localhost/mobile/sw.js'): The script has an unsupported MIME type ('text/html').**
   - Link: https://2026ucac-icamcom.sentry.io/issues/117794934/
   - Verdict: Still relevant
   - Evidence: Unresolved production issue.
   - Current source match: none
   - Stack files: none
   - Plan: Reproduce the latest event path, patch the mapped source, add a regression test, deploy, then resolve in Sentry after no recurrence.
31. **mobile: SyncError: capture_cni_hash_mismatch**
   - Link: https://2026ucac-icamcom.sentry.io/issues/117503955/
   - Verdict: Still relevant
   - Evidence: Unresolved production issue.
   - Current source match: none
   - Stack files: /mobile/assets/index-DvrA0YEt.js
   - Plan: Reproduce the latest event path, patch the mapped source, add a regression test, deploy, then resolve in Sentry after no recurrence.
32. **mobile: AbortError: signal is aborted without reason**
   - Link: https://2026ucac-icamcom.sentry.io/issues/117500937/
   - Verdict: Still relevant
   - Evidence: Unresolved production issue.
   - Current source match: none
   - Stack files: /mobile/assets/vendor-DDxQB-mS.js, /mobile/assets/CniCaptureScreen-DHBDkOH2.js
   - Plan: Reproduce the latest event path, patch the mapped source, add a regression test, deploy, then resolve in Sentry after no recurrence.
33. **mobile: Error: SecurityError: Failed to update a ServiceWorker for scope ('https://localhost/mobile/') with script ('https://localhost/mobile/sw.js'): The script has an unsupported MIME type ('text/html').**
   - Link: https://2026ucac-icamcom.sentry.io/issues/117089420/
   - Verdict: Still relevant
   - Evidence: Unresolved production issue.
   - Current source match: none
   - Stack files: none
   - Plan: Reproduce the latest event path, patch the mapped source, add a regression test, deploy, then resolve in Sentry after no recurrence.
34. **mobile: TypeError: Failed to update a ServiceWorker for scope ('https://localhost/mobile/') with script ('https://localhost/mobile/sw.js'): An unknown error occurred when fetching the script.**
   - Link: https://2026ucac-icamcom.sentry.io/issues/117156527/
   - Verdict: Still relevant
   - Evidence: Unresolved production issue.
   - Current source match: none
   - Stack files: none
   - Plan: Reproduce the latest event path, patch the mapped source, add a regression test, deploy, then resolve in Sentry after no recurrence.
35. **mobile: Error: upload_bill_failed_504**
   - Link: https://2026ucac-icamcom.sentry.io/issues/116664690/
   - Verdict: Still relevant
   - Evidence: Unresolved production issue.
   - Current source match: none
   - Stack files: /mobile/assets/index-CuEcT_V9.js
   - Plan: Reproduce the latest event path, patch the mapped source, add a regression test, deploy, then resolve in Sentry after no recurrence.
36. **mobile: AbortError: signal is aborted without reason**
   - Link: https://2026ucac-icamcom.sentry.io/issues/116548585/
   - Verdict: Still relevant
   - Evidence: Unresolved production issue.
   - Current source match: none
   - Stack files: /mobile/assets/index-UoYW_tpo.js
   - Plan: Reproduce the latest event path, patch the mapped source, add a regression test, deploy, then resolve in Sentry after no recurrence.
37. **mobile: Error: AbortError: Timeout starting video source**
   - Link: https://2026ucac-icamcom.sentry.io/issues/116547440/
   - Verdict: Still relevant
   - Evidence: Unresolved production issue.
   - Current source match: none
   - Stack files: none
   - Plan: Reproduce the latest event path, patch the mapped source, add a regression test, deploy, then resolve in Sentry after no recurrence.
38. **mobile: AbortError: signal is aborted without reason**
   - Link: https://2026ucac-icamcom.sentry.io/issues/116389658/
   - Verdict: Still relevant
   - Evidence: Unresolved production issue.
   - Current source match: none
   - Stack files: /mobile/assets/index-Bl2uB5He.js
   - Plan: Reproduce the latest event path, patch the mapped source, add a regression test, deploy, then resolve in Sentry after no recurrence.
39. **mobile: AbortError: signal is aborted without reason**
   - Link: https://2026ucac-icamcom.sentry.io/issues/116336070/
   - Verdict: Still relevant
   - Evidence: Unresolved production issue.
   - Current source match: none
   - Stack files: /mobile/assets/index-D5kG1bHT.js
   - Plan: Reproduce the latest event path, patch the mapped source, add a regression test, deploy, then resolve in Sentry after no recurrence.
40. **mobile: Error: NotAllowedError: Permission denied**
   - Link: https://2026ucac-icamcom.sentry.io/issues/115232239/
   - Verdict: Still relevant
   - Evidence: Unresolved production issue.
   - Current source match: none
   - Stack files: none
   - Plan: Reproduce the latest event path, patch the mapped source, add a regression test, deploy, then resolve in Sentry after no recurrence.
41. **backend: Sentry proxy: timeout forwarding event**
   - Link: https://2026ucac-icamcom.sentry.io/issues/115380328/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
42. **backend: HTTP error: Method Not Allowed**
   - Link: https://2026ucac-icamcom.sentry.io/issues/109442984/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
43. **backend: ProgrammingError: (sqlalchemy.dialects.postgresql.asyncpg.ProgrammingError) <class 'asyncpg.exceptions.UndefinedTableError'>: relation "users" does not exist**
   - Link: https://2026ucac-icamcom.sentry.io/issues/115216919/
   - Verdict: Needs reproduction
   - Evidence: Unresolved issue maps to current source but does not show production evidence in the exported metadata.
   - Current source match: bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/db/session.py, bicec-veripass-boss/code/app/main.py
   - Stack files: sqlalchemy/dialects/postgresql/asyncpg.py, asyncpg/connection.py, asyncpg/protocol/protocol.pyx, sqlalchemy/engine/base.py, sqlalchemy/engine/default.py
   - Plan: Reproduce the mapped path locally or in staging, then decide whether to fix or close as stale.
44. **backend: HTTP error: Ce compte a été supprimé. Veuillez créer un nouveau compte.**
   - Link: https://2026ucac-icamcom.sentry.io/issues/115040959/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
45. **backend: HTTP error: Numéro non reconnu. Créez d'abord un compte.**
   - Link: https://2026ucac-icamcom.sentry.io/issues/115038844/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
46. **backend: HTTP error: Role 'THOMAS' not authorized. Required: ['ADMIN_IT']**
   - Link: https://2026ucac-icamcom.sentry.io/issues/115026647/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
47. **backend: TypeError: '>' not supported between instances of 'MagicMock' and 'int'**
   - Link: https://2026ucac-icamcom.sentry.io/issues/115026643/
   - Verdict: Needs reproduction
   - Evidence: Unresolved issue maps to current source but does not show production evidence in the exported metadata.
   - Current source match: bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py, bicec-veripass-boss/code/app/modules/admin/router.py
   - Stack files: starlette\middleware\errors.py, starlette\middleware\base.py, contextlib.py, starlette\_utils.py, app\main.py
   - Plan: Reproduce the mapped path locally or in staging, then decide whether to fix or close as stale.
48. **backend: HTTP error: Role 'JEAN' not authorized. Required: ['ADMIN_IT']**
   - Link: https://2026ucac-icamcom.sentry.io/issues/115026642/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
49. **backend: ResponseValidationError: 2 validation errors:**
   - Link: https://2026ucac-icamcom.sentry.io/issues/107646296/
   - Verdict: Needs reproduction
   - Evidence: Unresolved issue maps to current source but does not show production evidence in the exported metadata.
   - Current source match: bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py, code/backend/app/core/exceptions.py, code/backend/app/db/base.py
   - Stack files: starlette\middleware\errors.py, starlette\middleware\base.py, contextlib.py, starlette\_utils.py, app\main.py
   - Plan: Reproduce the mapped path locally or in staging, then decide whether to fix or close as stale.
50. **backend: Exception: connection refused**
   - Link: https://2026ucac-icamcom.sentry.io/issues/107646290/
   - Verdict: Needs reproduction
   - Evidence: Unresolved issue maps to current source but does not show production evidence in the exported metadata.
   - Current source match: bicec-veripass-boss/code/app/core/utils.py, bicec-veripass-boss/code/app/modules/auth/utils.py, code/backend/app/core/utils.py, code/backend/app/modules/auth/utils.py, paddleocr_test/.venv_ocr/Lib/site-packages/Cython/Compiler/Tests/Utils.py
   - Stack files: app\modules\auth\utils.py, unittest\mock.py
   - Plan: Reproduce the mapped path locally or in staging, then decide whether to fix or close as stale.
51. **backend: Disk check/prune timed out**
   - Link: https://2026ucac-icamcom.sentry.io/issues/107608192/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
52. **backend: Unexpected df output format**
   - Link: https://2026ucac-icamcom.sentry.io/issues/107608191/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
53. **backend: Docker prune failed: Cannot connect to Docker daemon**
   - Link: https://2026ucac-icamcom.sentry.io/issues/107608190/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
54. **backend: df command failed: df: cannot access '/': No such file**
   - Link: https://2026ucac-icamcom.sentry.io/issues/107608189/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
55. **backend: pg_dump failed: connection refused**
   - Link: https://2026ucac-icamcom.sentry.io/issues/107608184/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
56. **backend: HTTP error: Role 'THOMAS' cannot make decision 'APPROVED'. Allowed: ['FRAUD_SUSPECT', 'INFO_REQUESTED']**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114942838/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
57. **backend: AttributeError: 'PageParams' object has no attribute 'size'**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114941456/
   - Verdict: Needs reproduction
   - Evidence: Unresolved issue maps to current source but does not show production evidence in the exported metadata.
   - Current source match: bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/exceptions.py, bicec-veripass-boss/code/app/db/base.py, bicec-veripass-boss/code/app/main.py, bicec-veripass-boss/code/app/modules/admin/router.py
   - Stack files: starlette/middleware/errors.py, starlette/middleware/base.py, contextlib.py, starlette/_utils.py, app/main.py
   - Plan: Reproduce the mapped path locally or in staging, then decide whether to fix or close as stale.
58. **backend: HTTP error: Missing required documents: CNI_RECTO, CNI_VERSO, SELFIE**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114941148/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
59. **backend: Validation error: [{'type': 'missing', 'loc': ('body', 'otp'), 'msg': 'Field required', 'input': {'phone': '+237691234570', 'code': '735214'}}]**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114940751/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
60. **backend: Failed to read image: /data/documents/836557f6-9651-4e96-80fb-22b2668b497c/BILL_ENEO/20260424_153756_f85c8807_test_cni.png**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114931319/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
61. **backend: Failed to read image: /data/documents/836557f6-9651-4e96-80fb-22b2668b497c/CNI_RECTO/20260424_153750_d20f6ffd_20260327_132447_d20f6ffd_cni_recto.jpg**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114931299/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
62. **backend: Failed to read image: /data/documents/836557f6-9651-4e96-80fb-22b2668b497c/CNI_VERSO/20260424_153750_f85c8807_test_cni.png**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114931296/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
63. **backend: Failed to read image: /data/documents/5bcbb566-bc3c-4151-87a1-4a12406647b0/BILL_ENEO/20260424_153558_f85c8807_test_cni.png**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114930866/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
64. **backend: Failed to read image: /data/documents/5bcbb566-bc3c-4151-87a1-4a12406647b0/CNI_VERSO/20260424_153552_f85c8807_test_cni.png**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114930844/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
65. **backend: Failed to read image: /data/documents/5bcbb566-bc3c-4151-87a1-4a12406647b0/CNI_RECTO/20260424_153551_d20f6ffd_20260327_132447_d20f6ffd_cni_recto.jpg**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114930838/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
66. **backend: HTTP error: Missing required documents: SELFIE**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114928110/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
67. **backend: Failed to read image: /data/documents/ef974633-a81c-45a3-8ddf-868998c0ab36/BILL_ENEO/20260424_152335_f85c8807_test_cni.png**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114927976/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
68. **backend: Failed to read image: /data/documents/ef974633-a81c-45a3-8ddf-868998c0ab36/CNI_VERSO/20260424_152328_f85c8807_test_cni.png**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114927941/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
69. **backend: Failed to read image: /data/documents/ef974633-a81c-45a3-8ddf-868998c0ab36/CNI_RECTO/20260424_152253_d20f6ffd_20260327_132447_d20f6ffd_cni_recto.jpg**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114927843/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
70. **backend: HTTP error: User not found**
   - Link: https://2026ucac-icamcom.sentry.io/issues/107611557/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
71. **backend: HTTP error: Test image not found on server**
   - Link: https://2026ucac-icamcom.sentry.io/issues/113412361/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
72. **backend: HTTP error: File too small to be a valid image**
   - Link: https://2026ucac-icamcom.sentry.io/issues/113284401/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
73. **backend: TypeError: PaddleOCR.predict() got an unexpected keyword argument 'cls'**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114681486/
   - Verdict: Needs reproduction
   - Evidence: Unresolved issue maps to current source but does not show production evidence in the exported metadata.
   - Current source match: bicec-veripass-boss/code/app/api/v1/ocr.py, bicec-veripass-boss/code/app/services/ocr_service.py, bicec-veripass-boss/code/app/tasks/ocr.py, code/backend/app/api/v1/ocr.py, code/backend/app/services/ocr_service.py
   - Stack files: app/services/ocr_service.py, typing_extensions.py, paddleocr/_pipelines/ocr.py
   - Plan: Reproduce the mapped path locally or in staging, then decide whether to fix or close as stale.
74. **backend: TypeError: PaddleOCR.predict() got an unexpected keyword argument 'cls'**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114584324/
   - Verdict: Needs reproduction
   - Evidence: Unresolved issue maps to current source but does not show production evidence in the exported metadata.
   - Current source match: bicec-veripass-boss/code/app/api/v1/ocr.py, bicec-veripass-boss/code/app/services/ocr_service.py, bicec-veripass-boss/code/app/tasks/ocr.py, code/backend/app/api/v1/ocr.py, code/backend/app/services/ocr_service.py
   - Stack files: app/services/ocr_service.py, typing_extensions.py, paddleocr/_pipelines/ocr.py
   - Plan: Reproduce the mapped path locally or in staging, then decide whether to fix or close as stale.
75. **backend: Document upload failed: Failed to save document: [Errno 13] Permission denied: '/data/documents/3e3673a8-64e6-44be-836e-61fe79fdabd4/CNI_RECTO/20260423_164357_e36a835e_cni_recto.jpg.tmp'**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114655022/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
76. **backend: Failed to save document: [Errno 13] Permission denied: '/data/documents/3e3673a8-64e6-44be-836e-61fe79fdabd4/CNI_RECTO/20260423_164357_e36a835e_cni_recto.jpg.tmp'**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114655017/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
77. **backend: Document upload failed: Failed to save document: [Errno 13] Permission denied: '/data/documents/3e3673a8-64e6-44be-836e-61fe79fdabd4/CNI_RECTO/20260423_164356_4f55c38e_cni_recto.jpg.tmp'**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114655003/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
78. **backend: HTTPException: Failed to save document**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114481434/
   - Verdict: Needs reproduction
   - Evidence: Unresolved issue maps to current source but does not show production evidence in the exported metadata.
   - Current source match: bicec-veripass-boss/code/app/__init__.py, bicec-veripass-boss/code/app/api/__init__.py, bicec-veripass-boss/code/app/api/v1/__init__.py, bicec-veripass-boss/code/app/api/v1/router.py, bicec-veripass-boss/code/app/core/__init__.py
   - Stack files: app/modules/kyc/storage.py, aiofiles/base.py, aiofiles/threadpool/__init__.py, concurrent/futures/thread.py, app/modules/kyc/router.py
   - Plan: Reproduce the mapped path locally or in staging, then decide whether to fix or close as stale.
79. **backend: HTTP error: Failed to save document**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114481433/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
80. **backend: Failed to save document: [Errno 13] Permission denied: '/data/documents/3e3673a8-64e6-44be-836e-61fe79fdabd4/CNI_RECTO/20260423_164356_4f55c38e_cni_recto.jpg.tmp'**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114654993/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
81. **backend: Document upload failed: Failed to save document: [Errno 13] Permission denied: '/data/documents/3e3673a8-64e6-44be-836e-61fe79fdabd4/CNI_RECTO/20260423_155441_e36a835e_cni_recto.jpg.tmp'**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114643360/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.
82. **backend: Failed to save document: [Errno 13] Permission denied: '/data/documents/3e3673a8-64e6-44be-836e-61fe79fdabd4/CNI_RECTO/20260423_155441_e36a835e_cni_recto.jpg.tmp'**
   - Link: https://2026ucac-icamcom.sentry.io/issues/114643338/
   - Verdict: Needs reproduction
   - Evidence: Latest event has no usable stack trace in the API response.
   - Current source match: none
   - Stack files: none
   - Plan: Open the permalink, inspect breadcrumbs/request context, and reproduce manually before coding a fix.

## Verification Checklist

- Compare the exported issue totals with the Sentry UI totals for each project.
- Spot-check at least five permalinks per project against the Sentry UI.
- For each code fix, run the nearest backend unit/API tests or frontend Vitest suite.
- Confirm production builds upload sourcemaps when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are configured.
- Confirm whether backoffice frontend events are arriving in the backoffice project or being mixed into the mobile project by the hardcoded proxy target.
