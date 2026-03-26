# PostgreSQL Backup & Restore — bicec-veripass

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CELERY BEAT (Scheduler)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 01:00 UTC → backup_postgres                          │   │
│  │ 03:00 UTC → check_disk_usage (prune if >85%)        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              CELERY WORKER (Task Execution)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ _run_pg_dump()                                       │   │
│  │   → subprocess.run(['pg_dump', ...])                 │   │
│  │   → Network connection to postgres:5432              │   │
│  │   → Writes to /backups/db/veripass_YYYYMMDD.dump    │   │
│  │                                                      │   │
│  │ _rotate_backups()                                    │   │
│  │   → Deletes .dump files older than 7 days           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  DOCKER VOLUMES (Storage)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ db_backups → /backups/db                             │   │
│  │   - veripass_20260324_010000.dump (compressed)       │   │
│  │   - veripass_20260323_010000.dump                    │   │
│  │   - ... (7 days retention)                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Dependencies Installed

The `backend` Docker image (Alpine-based) includes:

- `postgresql-client` — provides `pg_dump`, `pg_restore`, `psql`
- `docker-cli` — for `docker system prune` in disk usage task
- Docker socket mounted at `/var/run/docker.sock` (read-only)

## Automated Backups

### Schedule

| Task | Time (UTC) | Frequency | Retention |
|------|------------|-----------|-----------|
| `backup_postgres` | 01:00 | Daily | 7 days |
| `check_disk_usage` | 03:00 | Daily | N/A |

### Configuration

Environment variables (set in `docker-compose.yml`):

```yaml
environment:
  - DATABASE_URL=postgresql+asyncpg://vp_user:${DB_PASSWORD}@postgres:5432/veripass
  - DB_PASSWORD=${DB_PASSWORD}
  - BACKUP_RETENTION_DAYS=7
```

### Monitoring

Check Celery Beat logs:

```bash
docker compose logs -f celery_beat
```

Expected output:

```
[2026-03-24 01:00:00] Starting backup → /backups/db/veripass_20260324_010000.dump
[2026-03-24 01:00:15] Backup OK: /backups/db/veripass_20260324_010000.dump (12.34 MB)
[2026-03-24 01:00:15] Rotation: 1 deleted, 7 retained (max 7d)
```

## Manual Backup (Host-side)

From the `code/` directory:

```bash
# Backup with default 7-day retention
./scripts/backup_db.sh

# Custom retention (14 days)
./scripts/backup_db.sh 14
```

**Prerequisites:**
- PostgreSQL client tools installed (`pg_dump`)
- `.env` file with `DB_PASSWORD`
- PostgreSQL accessible at `localhost:15432`

## Manual Restore (Host-side)

List available backups:

```bash
./scripts/restore_db.sh
```

Restore to production database (⚠️ DESTRUCTIVE):

```bash
./scripts/restore_db.sh veripass_20260324_010000.dump
```

Restore to test database:

```bash
./scripts/restore_db.sh veripass_20260324_010000.dump veripass_test
```

**SLA:** Restore must complete in < 30 minutes. The script measures elapsed time and warns if exceeded.

## Integration Test

Run the full backup/restore cycle:

```bash
cd code
./scripts/test-backup-restore.sh
```

This test:
1. Connects to PostgreSQL
2. Inserts test data
3. Creates a backup
4. Restores to a test database
5. Verifies data integrity
6. Measures backup/restore times
7. Cleans up test database

Expected output:

```
✅ ALL TESTS PASSED
Backup time: 3s
Restore time: 5s
✓ Restore time within 30min SLA
```

## Disk Prune Logic

The `check_disk_usage` task:

1. Runs `df -h /` to check disk usage
2. If usage > 85%, triggers `docker system prune -af --volumes`
3. Logs reclaimed space

**Note:** The `db_backups` volume is NOT pruned (it's a named volume, not part of `docker system prune`).

## Troubleshooting

### Backup fails with "pg_dump: command not found"

**Cause:** `postgresql-client` not installed in Docker image.

**Fix:** Rebuild the backend image:

```bash
docker compose build api celery_beat
docker compose up -d
```

### Restore fails with "permission denied"

**Cause:** Active connections to the database.

**Fix:** The restore script automatically terminates connections. If manual restore:

```sql
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname='veripass' AND pid <> pg_backend_pid();
```

### Disk prune fails with "Cannot connect to Docker daemon"

**Cause:** Docker socket not mounted or `docker-cli` not installed.

**Fix:** Verify `docker-compose.yml`:

```yaml
celery_beat:
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
```

### Backup file is empty (0 bytes)

**Cause:** Network connection to PostgreSQL failed.

**Fix:** Check `DATABASE_URL` and `DB_PASSWORD` in `celery_beat` environment.

## Security Notes

- Backups are stored in compressed custom format (`-Fc`) — not plain SQL
- `DB_PASSWORD` is passed via environment variable (not command-line args)
- Docker socket is mounted read-only (`:ro`)
- Celery Beat runs as non-root user (`vpuser`)

## Future Enhancements (Optional)

- PostgreSQL Replication (Master/Slave) for high availability
- S3 offsite backup sync (see issue #180)
- Backup encryption with GPG
- Backup integrity verification (checksum)
