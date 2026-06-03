# Docker handoff runbook

This runbook is for giving a runnable VeriPass Docker environment to another machine.

Do not use `backup-docker-images.ps1` for a full handoff. That script only saves images. A working VeriPass environment also needs Docker volumes, Compose metadata, environment configuration, and bind-mounted runtime files.

## What went wrong with `docker load`

`docker load -i xyz.tar.gz` restores image layers only.

It does not restore:

- PostgreSQL data in `code_db_storage`
- KYC documents in `code_documents_storage`
- PostgreSQL backup files in `code_db_backups`
- Redis data in `code_redis_data`
- OCR/model caches in `code_models_storage` and `code_models_paddlex_storage`
- the Docker Compose project grouping shown as `code` in Docker Desktop
- service dependency order, networks, ports, healthchecks, or container names
- bind-mounted files such as nginx config, offline models, migrations, and `db/init.sql`

Starting each image manually from Docker Desktop also will not work. Manual `Run` creates isolated containers with different names, no Compose network, missing volumes, missing environment variables, and no `depends_on` order.

## Export from the source machine

From the repository root on the machine that already runs the project:

```powershell
powershell -ExecutionPolicy Bypass -File code\scripts\export-docker-stack.ps1 -IncludeEnv
```

The script creates:

```text
code/backups/docker-stack/veripass-stack-YYYYMMDD-HHMMSS/
code/backups/docker-stack/veripass-stack-YYYYMMDD-HHMMSS.tar.gz
```

Use `-IncludeEnv` only for a trusted demo handoff because it copies `code\.env` into the bundle. Without it, the recipient must create `code\.env` from `code\.env.example` before startup.

By default the script stops the local Compose stack while exporting volumes, then starts it again. This avoids copying PostgreSQL and Redis while they are actively writing. Use `-KeepRunning` only if downtime is impossible and you accept an inconsistent snapshot risk.

## Restore on the recipient machine

Copy the generated `veripass-stack-YYYYMMDD-HHMMSS.tar.gz` to the recipient machine.

Extract it:

```powershell
tar -xzf .\veripass-stack-YYYYMMDD-HHMMSS.tar.gz
cd .\veripass-stack-YYYYMMDD-HHMMSS
```

Restore and start:

```powershell
powershell -ExecutionPolicy Bypass -File .\import-docker-stack.ps1
```

The restore script does three things in order:

1. Loads Docker images from `images\veripass-images.tar`.
2. Restores Docker volumes from `volumes\*.tar.gz`.
3. Starts the stack with `docker compose --project-name code up --no-build -d`.

Using `--project-name code` is important because it recreates the same Docker Desktop project grouping and the same Compose-managed volume names.

## If the recipient already has volumes

The restore script refuses to overwrite existing volumes by default.

For a clean lab machine, there should be no conflict. If the machine already has old VeriPass volumes and you intentionally want to replace them:

```powershell
powershell -ExecutionPolicy Bypass -File .\import-docker-stack.ps1 -ReplaceVolumes
```

This is destructive for the recipient machine's existing VeriPass data.

## Verification

After restore:

```powershell
cd code
docker compose -f docker-compose.yml --project-name code ps
```

Expected result:

- `vp_postgres`, `vp_redis`, `vp_api`, `vp_pwa`, `vp_backoffice`, `vp_nginx`, workers, Flower, and Mailpit are created by Compose.
- Docker Desktop shows a Compose project named `code`.
- The app is opened through nginx at `https://localhost`.

If a service is not healthy:

```powershell
docker compose -f docker-compose.yml --project-name code logs --tail=120 api
docker compose -f docker-compose.yml --project-name code logs --tail=120 celery_ocr
docker compose -f docker-compose.yml --project-name code logs --tail=120 nginx
```

## Common failure modes

### Only images were loaded

Symptom: images appear in Docker Desktop, but no working app exists.

Fix: run `import-docker-stack.ps1`, not only `docker load`.

### Images are started manually

Symptom: containers have random names, services cannot reach each other, API cannot connect to `postgres` or `redis`.

Fix: stop/remove those manual containers, then start with Compose:

```powershell
cd code
docker compose -f docker-compose.yml --project-name code up --no-build -d
```

### `code\.env` is missing

Symptom: Compose starts with blank secrets or fails configuration.

Fix: create `code\.env` from `code\.env.example`, or re-export from the source machine using `-IncludeEnv` for a trusted demo package.

### Offline OCR models are missing

Symptom: OCR services start but fail when loading model paths under `/opt/models-offline`.

Fix: ensure the bundle contains `code\infra\models-offline`. The export script copies it when it exists on the source machine.

### Existing volumes block restore

Symptom: restore stops with `Docker volume already exists`.

Fix: use a clean machine, or run with `-ReplaceVolumes` only when overwriting existing VeriPass data is acceptable.
