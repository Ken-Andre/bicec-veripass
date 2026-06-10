# Operations Runbook

Updated: 2026-05-28

Use this document when the stack is running but something is broken, slow, or unclear.

## Fast Status Check

```powershell
docker compose -f code/docker-compose.yml ps
Invoke-RestMethod http://localhost:8001/api/health
.\code\scripts\smoke_mvp_docker.ps1
```

Important URLs:

- `https://localhost/health`
- `https://localhost/api/v1/docs`
- `https://localhost/mobile/`
- `https://localhost/back-office/`
- `https://localhost/flower/`
- `http://localhost:8025/`

## Logs

```powershell
docker compose -f code/docker-compose.yml logs --tail=120 api
docker compose -f code/docker-compose.yml logs --tail=120 nginx
docker compose -f code/docker-compose.yml logs --tail=120 celery_ocr
docker compose -f code/docker-compose.yml logs --tail=120 celery_notifications
docker compose -f code/docker-compose.yml logs --tail=120 celery_beat
docker compose -f code/docker-compose.yml logs --tail=120 postgres
docker compose -f code/docker-compose.yml logs --tail=120 redis
```

For longer debugging:

```powershell
docker compose -f code/docker-compose.yml logs -f api
```

## Incident: API Health Is Degraded

Symptoms:

- `/api/health` returns `degraded`.
- Frontends load but API calls fail.

Check:

```powershell
docker compose -f code/docker-compose.yml ps postgres redis api
docker compose -f code/docker-compose.yml logs --tail=120 api
docker compose -f code/docker-compose.yml logs --tail=120 postgres
docker compose -f code/docker-compose.yml logs --tail=120 redis
```

Likely causes:

- PostgreSQL not healthy.
- Redis not healthy.
- Wrong `DB_PASSWORD` or `DATABASE_URL`.
- Migrations failed during API startup.

Recovery:

```powershell
docker compose -f code/docker-compose.yml up -d postgres redis
docker compose -f code/docker-compose.yml up -d api
docker compose -f code/docker-compose.yml exec -T api alembic current
docker compose -f code/docker-compose.yml exec -T api alembic upgrade head
```

Do not delete database volumes to fix a migration error.

## Incident: Frontend 404 Or Blank Page On Deep Link

Symptoms:

- `https://localhost/back-office/validation` or `/mobile/...` fails after refresh.
- Static chunks return 404.

Check:

```powershell
docker compose -f code/docker-compose.yml logs --tail=120 nginx
docker compose -f code/docker-compose.yml logs --tail=120 pwa
docker compose -f code/docker-compose.yml logs --tail=120 backoffice
```

Likely areas:

- `code/infra/nginx/nginx.conf`
- `code/mobile/nginx.conf`
- `code/backoffice/nginx.conf`
- Vite base path configuration.

Recovery:

```powershell
docker compose -f code/docker-compose.yml build pwa backoffice nginx
docker compose -f code/docker-compose.yml up -d pwa backoffice nginx
```

## Incident: OCR Is Slow Or First Extraction Is Wrong

Symptoms:

- CNI capture waits too long.
- First OCR request returns poor fields.
- `celery_ocr` is unhealthy.

Check:

```powershell
docker compose -f code/docker-compose.yml ps api celery_ocr
docker compose -f code/docker-compose.yml logs --tail=200 api
docker compose -f code/docker-compose.yml logs --tail=200 celery_ocr
```

Likely causes:

- Offline models missing from `OFFLINE_MODELS_DIR`.
- PaddleOCR warmup failed.
- WSL2 memory is too low.
- `celery_ocr` cannot load GLM model.
- `OCR_ONLINE=true` but Oracle Cloud OCR config is incomplete.

Recovery:

1. Verify WSL2 memory settings.
2. Verify model mount paths under `/opt/models-offline`.
3. Keep `OCR_ONLINE=false` unless cloud OCR is intentionally configured.
4. Restart API and OCR worker:

```powershell
docker compose -f code/docker-compose.yml up -d api celery_ocr
```

## Incident: OTP Does Not Arrive

Symptoms:

- Client cannot authenticate.
- No SMS/email is received.

Check:

```powershell
docker compose -f code/docker-compose.yml logs --tail=120 api
docker compose -f code/docker-compose.yml logs --tail=120 celery_notifications
```

For local development:

- Use `OTP_MODE=dev_local`.
- Check API logs for generated OTP.
- If email fallback is enabled, check Mailpit at `http://localhost:8025/`.

For provider testing:

- Verify Orange credentials and `ORANGE_BASE_URL`.
- Verify SMTP settings.
- Check `OTP_FALLBACK_EMAIL` and fallback address.

## Incident: Backoffice Login Fails

Symptoms:

- Agent login returns 401.
- Seed accounts missing.

Check:

```powershell
docker compose -f code/docker-compose.yml logs --tail=120 api
docker compose -f code/docker-compose.yml exec -T api python scripts/seed_dev.py
```

Then try:

- `jean@bicec.cm` / `password123`
- `thomas@bicec.cm` / `password123`
- `sylvie@bicec.cm` / `password123`
- `admin@bicec.cm` / `password123`

If a seeded password has changed, use Admin IT reset flow or reseed in a disposable environment.

## Incident: Role Cannot Access Page

Symptoms:

- Backoffice redirects to unauthorized.
- API returns 403.

Check both layers:

- Frontend route roles in `code/backoffice/src/App.tsx`.
- Backend role dependencies in the owning router.

Common examples:

- `/validation` is for `JEAN`.
- `/compliance` is for `THOMAS`.
- `/command-center` is for `SYLVIE`.
- `/admin` is for `ADMIN_IT`.
- `/analytics` is shared by `SYLVIE`, `THOMAS`, `ADMIN_IT`.

## Incident: Banking Action Fails With Device Error

Symptoms:

- API returns 428 precondition or 403 for banking write actions.

Reason:

- Once a user has active device registrations, sensitive routes require matching `X-Device-Tag`.

Check:

- Mobile `deviceRegistrationService.ts`.
- Backend `devices/dependencies.py`.
- Browser local storage for `vp_device_tag`.

Recovery:

- Re-register device through mobile flow.
- Clear stale local storage only in development and only for the affected test user.

## Incident: KYC Submit Is Blocked

Symptoms:

- Mobile review screen says dossier cannot be submitted.
- `/kyc/readiness` returns `can_submit=false`.

Check response fields:

- `blocking_reasons`
- `required_missing_documents`
- `has_ocr_review`
- `has_ocr_review_confirmed`
- `has_consent`
- `has_biometric_result`
- `has_bill_document`

Likely causes:

- Offline queue still has pending items.
- OCR review was not confirmed.
- Missing CNI side, bill, liveness, consent, or signature.
- Session is no longer editable.

Recovery:

- Run mobile sync from the app.
- Check `kycSyncService.ts` behavior.
- Inspect session via `/kyc/session/current`.

## Incident: Celery Worker Is Unhealthy

Check:

```powershell
docker compose -f code/docker-compose.yml ps celery_ocr celery_notifications celery_beat redis
docker compose -f code/docker-compose.yml logs --tail=200 celery_ocr
docker compose -f code/docker-compose.yml logs --tail=200 celery_notifications
docker compose -f code/docker-compose.yml logs --tail=200 celery_beat
```

Common causes:

- Redis unavailable.
- Missing model files for OCR worker.
- Import error after backend code change.
- Memory pressure.
- Docker socket access issue for disk-prune tasks in `celery_beat`.

Recovery:

```powershell
docker compose -f code/docker-compose.yml up -d redis
docker compose -f code/docker-compose.yml up -d celery_ocr celery_notifications celery_beat
```

If imports changed, rebuild:

```powershell
docker compose -f code/docker-compose.yml build api celery_ocr celery_notifications celery_beat
docker compose -f code/docker-compose.yml up -d api celery_ocr celery_notifications celery_beat
```

## Incident: Disk Space Is Low

Safe cleanup:

```powershell
.\code\scripts\docker_prune.ps1 -DryRun
.\code\scripts\docker_prune.ps1
```

The project cleanup scripts must not remove Docker volumes.

Unsafe unless explicitly requested:

- `docker compose down -v`
- `docker volume rm code_db_storage`
- `docker volume rm code_documents_storage`
- `docker volume rm code_db_backups`
- `docker system prune --volumes`

## Incident: Backup Fails

Check:

```powershell
docker compose -f code/docker-compose.yml logs --tail=200 celery_beat
docker compose -f code/docker-compose.yml logs --tail=200 api
```

Verify:

- `ENABLE_BACKUPS=true`
- `BACKUP_ENCRYPTION_KEY` is set and not equal to JWT secret.
- `/backups/db` is mounted.
- KYC image backup script exists and is executable inside container.
- There is enough disk space.

## Incident: Sentry Proxy Fails

Symptoms:

- Frontend error reporting fails.
- Browser shows Sentry network errors.

Check:

- `/api/v1/sentry-proxy/health`
- `code/backend/app/api/v1/sentry_proxy.py`
- `code/mobile/src/services/sentry.ts`
- `code/backoffice/src/services/sentry.ts`
- `SENTRY_DSN_BACKEND`, `VITE_SENTRY_DSN_MOBILE`, `VITE_SENTRY_DSN_BACKOFFICE`

The proxy is designed to keep browser requests same-origin while forwarding envelopes server-side.

## Evidence And Final Delivery

Evidence artifacts live under:

- `docs/test-evidence/latest/mobile/`
- `docs/test-evidence/latest/backoffice/`
- `docs/test-evidence/latest/api/`
- `docs/test-evidence/ocr-beta-loop/`

Treat them as generated proof. If evidence is stale, rerun the relevant Playwright or API evidence command rather than editing proof files by hand.

## Escalation Checklist

When handing an unresolved issue to another maintainer, include:

- Exact command that failed.
- Exact URL and user role.
- Current `docker compose ps`.
- Relevant logs with timestamps.
- Whether volumes were touched.
- Whether migrations were run.
- Last successful smoke/evidence command.
