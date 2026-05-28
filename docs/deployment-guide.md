# Deployment Guide

Updated: 2026-05-28

This project is currently deployed and demonstrated through Docker Compose. Production hardening will require real secrets management, production TLS, durable backups, monitoring, and final integration decisions.

## Deployment Model

The Compose stack runs:

- Nginx TLS reverse proxy.
- Static mobile PWA.
- Static backoffice SPA.
- FastAPI backend.
- PostgreSQL.
- Redis.
- Celery OCR worker.
- Celery notifications worker.
- Celery beat scheduler.
- Mailpit for development SMTP.
- Flower for Celery monitoring.

## Required Files

| File | Purpose |
| --- | --- |
| `code/docker-compose.yml` | Main runtime stack |
| `code/.env` | Local/deployment secrets and runtime config |
| `code/.env.example` | Template for required variables |
| `code/infra/nginx/nginx.conf` | Public routing, TLS, security headers, timeouts |
| `code/infra/nginx/ssl/` | Local certificate material |
| `code/infra/models-offline/` | Offline model mount, if used |

## External Volumes

The Compose file uses external volumes for critical data:

| Volume | Default name | Purpose |
| --- | --- | --- |
| `documents_storage` | `code_documents_storage` | KYC documents, selfies, bills, support attachments |
| `db_storage` | `code_db_storage` | PostgreSQL data files |
| `db_backups` | `code_db_backups` | PostgreSQL backup dumps |

Create missing volumes:

```powershell
.\code\scripts\ensure_docker_volumes.ps1
```

Linux/WSL:

```bash
bash code/scripts/ensure_docker_volumes.sh
```

## Environment Variables

Start from:

```powershell
copy code\.env.example code\.env
```

Minimum deployment-critical values:

| Variable | Purpose |
| --- | --- |
| `DB_PASSWORD` | PostgreSQL password used by Compose and API |
| `JWT_SECRET` | JWT signing key |
| `AES_SECRET_KEY` | Encryption key for sensitive data paths |
| `ENVIRONMENT` | `development` or `production` |
| `OTP_MODE` | `dev_local`, `orange`, or email-related mode |
| `ORANGE_SMS_CLIENT_ID` / `ORANGE_SMS_CLIENT_SECRET` | Orange SMS credentials |
| `SMTP_*` | Email fallback configuration |
| `FLOWER_USER` / `FLOWER_PASSWORD` | Flower basic auth |
| `OFFLINE_MODELS_DIR` | Host directory mounted to `/opt/models-offline` |
| `SENTRY_DSN_BACKEND` | Backend Sentry DSN |
| `VITE_SENTRY_DSN_MOBILE` | Mobile frontend Sentry DSN |
| `VITE_SENTRY_DSN_BACKOFFICE` | Backoffice Sentry DSN |
| `ENABLE_BACKUPS` | Enables scheduled backup tasks |
| `BACKUP_ENCRYPTION_KEY` | Required for encrypted KYC image backups when backups are enabled |
| `OCR_ONLINE` | Enables Oracle Cloud OCR fallback when true |
| `OCR_CLOUD_URL` / `OCR_CLOUD_API_KEY` / `OCR_CLOUD_KEY` | Cloud OCR endpoint and crypto material |

Production safeguards in code:

- `OTP_MODE=dev_local` is rejected in production.
- Default `JWT_SECRET` is rejected in production.
- `BACKUP_ENCRYPTION_KEY` is required in production when `ENABLE_BACKUPS=true`.
- CORS wildcard origins are rejected in production.

## Build And Start

Build the stack:

```powershell
docker compose -f code/docker-compose.yml build
```

Start the MVP services:

```powershell
docker compose -f code/docker-compose.yml up -d api pwa backoffice postgres redis celery_ocr celery_notifications celery_beat mailpit nginx flower
```

Check status:

```powershell
docker compose -f code/docker-compose.yml ps
```

Tail logs:

```powershell
docker compose -f code/docker-compose.yml logs --tail=120 api
docker compose -f code/docker-compose.yml logs --tail=120 celery_ocr
docker compose -f code/docker-compose.yml logs --tail=120 nginx
```

## Deploy With Prebuilt Docker Images

If `veripass-images.tar` is supplied:

```powershell
docker load -i veripass-images.tar
copy code\.env.example code\.env
notepad code\.env
.\code\scripts\ensure_docker_volumes.ps1
docker compose -f code/docker-compose.yml up -d
docker compose -f code/docker-compose.yml ps
```

Prebuilt images are useful when build time or internet access is unreliable.

## Verify Deployment

Health:

```powershell
Invoke-RestMethod http://localhost:8001/api/health
Invoke-RestMethod https://localhost/health -SkipCertificateCheck
```

Smoke test:

```powershell
.\code\scripts\smoke_mvp_docker.ps1
```

Manual browser checks:

- `https://localhost/mobile/`
- `https://localhost/back-office/`
- `https://localhost/api/v1/docs`
- `https://localhost/flower/`
- `http://localhost:8025/`

## Migrations And Seed Data

Migrations are normally run during API startup through the backend entrypoint. Verify manually:

```powershell
docker compose -f code/docker-compose.yml exec -T api alembic current
docker compose -f code/docker-compose.yml exec -T api alembic upgrade head
```

Seed data:

```powershell
docker compose -f code/docker-compose.yml exec -T api python scripts/seed_dev.py
docker compose -f code/docker-compose.yml exec -T api python scripts/seed_banking.py
```

## Offline Models

Default Compose behavior mounts:

```text
${OFFLINE_MODELS_DIR:-./infra/models-offline}:/opt/models-offline:ro
```

The API and OCR worker expect configured Paddle and GLM paths under `/opt/models-offline`.

The optional `model_init` service is behind the `online-init` profile. Use it only when intentionally downloading/bootstraping models:

```powershell
docker compose -f code/docker-compose.yml --profile online-init up model_init
```

For demos and sovereign/offline mode, keep models preloaded and `OCR_ONLINE=false`.

## Backups

Backups are disabled by default:

```text
ENABLE_BACKUPS=false
```

When enabled and configured:

- `backup_postgres` writes compressed custom-format dumps under `/backups/db`.
- `backup_kyc_images` writes encrypted document-volume archives.
- `check_and_catchup_backup` triggers an image backup if no recent archive exists.

Manual helpers:

```powershell
bash code/scripts/backup_db.sh
bash code/scripts/restore_db.sh
powershell -File code/scripts/backup-docker-images.ps1
```

Do not reuse `JWT_SECRET` as `BACKUP_ENCRYPTION_KEY`.

## Production Hardening Checklist

Before production or external pilot:

- Replace all placeholder secrets.
- Use a real secrets manager or deployment secret injection.
- Set `ENVIRONMENT=production`.
- Set strict `CORS_ORIGINS`.
- Replace local TLS material with production certificates.
- Confirm `OTP_MODE` and provider credentials.
- Confirm SMTP fallback.
- Confirm Sentry DSNs or disable Sentry intentionally.
- Confirm `OFFLINE_MODELS_DIR` contains all required models.
- Enable and test backups with restore drill.
- Remove Mailpit from production path or isolate it.
- Restrict Flower or disable it outside trusted networks.
- Review Docker socket access for `celery_beat`; it is powerful and should be restricted or redesigned for production.
- Add infrastructure monitoring beyond Flower and health checks.

## Rollback

For application-only changes:

1. Keep previous image archive or image tag.
2. Stop affected services.
3. Start previous images with the same volumes.
4. Verify health.

For database migrations:

1. Prefer forward fixes.
2. If downgrade is required, check the Alembic downgrade function and data-loss risk.
3. Take a PostgreSQL backup before downgrade.
4. Run downgrade inside `api`.
5. Verify application compatibility.

For document volume issues:

- Do not delete or recreate the volume.
- Restore from encrypted KYC image backup if available.
- Verify SHA-256 metadata against `documents.sha256_hash` where possible.
