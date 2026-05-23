import asyncio
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
import uuid
from app.celery import celery_app
from app.core.logging import logger
from app.db.session import AsyncSessionLocal
from app.modules.audit.models import AuditLog
from app.core.config import settings


def _run_pg_dump(backup_path: str) -> bool:
    """
    Run pg_dump directly via network connection.
    Called from inside the container  no Docker socket needed.
    """
    db_url = os.getenv("DATABASE_URL", "")
    db_host = os.getenv("DB_HOST", "postgres")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "veripass")
    db_user = os.getenv("DB_USER", "vp_user")
    db_password = os.getenv("DB_PASSWORD", "")

    if db_url:
        try:
            url = db_url.replace("postgresql+asyncpg://", "").replace(
                "postgresql://", ""
            )
            userinfo, hostinfo = url.split("@", 1)
            db_user, db_password = userinfo.split(":", 1)
            host_port, db_name = hostinfo.split("/", 1)
            if ":" in host_port:
                db_host, db_port = host_port.split(":", 1)
            else:
                db_host = host_port
        except Exception as e:
            logger.warning(f"Could not parse DATABASE_URL, using env vars: {e}")

    env = {**os.environ, "PGPASSWORD": db_password}

    result = subprocess.run(
        ["pg_dump", "-h", db_host, "-p", db_port, "-U", db_user, "-Fc", db_name],
        capture_output=True,
        env=env,
        timeout=1800,
    )

    if result.returncode != 0:
        logger.error(f"pg_dump failed: {result.stderr.decode()}")
        return False

    Path(backup_path).write_bytes(result.stdout)
    return True


def _rotate_backups(backup_dir: str, retention_days: int) -> int:
    """Delete .dump files older than retention_days. Returns count deleted."""
    cutoff = datetime.now(timezone.utc).timestamp() - (retention_days * 86400)
    deleted = 0
    for f in Path(backup_dir).glob("*.dump"):
        if f.stat().st_mtime < cutoff:
            f.unlink()
            deleted += 1
            logger.info(f"Rotated old backup: {f.name}")
    return deleted


@celery_app.task(name="app.tasks.maintenance.backup_postgres", bind=True, max_retries=2)
def backup_postgres(self):
    """
    Daily PostgreSQL backup via pg_dump.
    Gated by ENABLE_BACKUPS=true. Runs at 01:00 UTC via Celery Beat.
    """
    if not settings.ENABLE_BACKUPS:
        logger.info("backup_postgres: ENABLE_BACKUPS=false  skipping.")
        return {"status": "skipped", "reason": "ENABLE_BACKUPS=false"}

    backup_dir = "/backups/db"
    retention_days = settings.BACKUP_RETENTION_DAYS

    Path(backup_dir).mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    db_name = os.getenv("DB_NAME", "veripass")
    backup_file = f"{backup_dir}/{db_name}_{timestamp}.dump"

    logger.info(f"Starting DB backup  {backup_file}")

    try:
        success = _run_pg_dump(backup_file)
        if not success:
            raise RuntimeError("pg_dump returned non-zero exit code")

        size_mb = Path(backup_file).stat().st_size / (1024 * 1024)
        logger.info(f"DB Backup OK: {backup_file} ({size_mb:.2f} MB)")

        deleted = _rotate_backups(backup_dir, retention_days)
        remaining = len(list(Path(backup_dir).glob("*.dump")))
        logger.info(
            f"Rotation: {deleted} deleted, {remaining} retained (max {retention_days}d)"
        )

        return {
            "status": "ok",
            "file": backup_file,
            "size_mb": round(size_mb, 2),
            "retained": remaining,
        }

    except Exception as e:
        logger.exception(f"DB Backup failed: {e}")
        raise self.retry(exc=e, countdown=300)


@celery_app.task(name="app.tasks.maintenance.check_disk_usage")
def check_disk_usage():
    """
    Check disk usage and trigger docker prune if > 85%.
    Runs at 03:00 UTC via Celery Beat.
    """
    try:
        result = subprocess.run(
            ["df", "-h", "/"], capture_output=True, text=True, timeout=10
        )

        if result.returncode != 0:
            logger.error(f"df command failed: {result.stderr}")
            return False

        lines = result.stdout.strip().split("\n")
        if len(lines) < 2:
            logger.error("Unexpected df output format")
            return False

        parts = lines[1].split()
        if len(parts) < 5:
            logger.error(f"Cannot parse df output: {lines[1]}")
            return False

        usage_str = parts[4].rstrip("%")
        try:
            usage_pct = int(usage_str)
        except ValueError:
            logger.error(f"Cannot parse usage percentage: {usage_str}")
            return False

        logger.info(f"Disk usage: {usage_pct}%")

        if usage_pct > 85:
            logger.warning(
                f"Disk usage {usage_pct}% exceeds threshold (85%), triggering prune..."
            )
            prune_result = subprocess.run(
                ["docker", "system", "prune", "-af", "--volumes"],
                capture_output=True,
                text=True,
                timeout=300,
            )
            if prune_result.returncode != 0:
                logger.error(f"Docker prune failed: {prune_result.stderr}")
                return False
            logger.info(f"Docker prune completed: {prune_result.stdout}")

        return True

    except subprocess.TimeoutExpired:
        logger.error("Disk check/prune timed out")
        return False
    except Exception as e:
        logger.exception(f"Disk check error: {e}")
        return False


def _rotate_image_archives(backup_dir: str) -> int:
    """
    Rotation: keep all archives < 28 days, then 1/month for up to 12 months.
    """
    now = datetime.now(timezone.utc)
    deleted = 0
    for f in Path(backup_dir).glob("*.tar.gz.gpg"):
        mtime = datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc)
        age_days = (now - mtime).days
        if age_days > 365:
            f.unlink()
            deleted += 1
            continue
        if age_days > 28 and mtime.day > 7:
            f.unlink()
            deleted += 1
    return deleted


async def _log_backup_result(backup_info: dict) -> None:
    """Write a KYC_IMAGES_BACKUP audit log entry."""
    async with AsyncSessionLocal() as session:
        log = AuditLog(
            id=uuid.uuid4(),
            action="KYC_IMAGES_BACKUP",
            table_name="documents",
            new_data={
                "file": backup_info.get("RESULT_FILE"),
                "sha256": backup_info.get("RESULT_SHA256"),
                "size_bytes": backup_info.get("RESULT_SIZE"),
                "status": "SUCCESS",
            },
            performed_at=datetime.now(timezone.utc),
        )
        session.add(log)
        await session.commit()


@celery_app.task(
    name="app.tasks.maintenance.backup_kyc_images", bind=True, max_retries=3
)
def backup_kyc_images(self):
    """
    Weekly encrypted backup of KYC images volume to local storage.
    Gated by ENABLE_BACKUPS=true.
    Encryption key: BACKUP_ENCRYPTION_KEY (dedicated, never JWT_SECRET).
    Compliance: Loi 2024-017 & COBAC 10-year retention.
    """
    if not settings.ENABLE_BACKUPS:
        logger.info("backup_kyc_images: ENABLE_BACKUPS=false  skipping.")
        return {"status": "skipped", "reason": "ENABLE_BACKUPS=false"}

    encryption_key = settings.BACKUP_ENCRYPTION_KEY
    if not encryption_key:
        logger.error("backup_kyc_images: BACKUP_ENCRYPTION_KEY is not set  aborting.")
        return {"status": "error", "reason": "BACKUP_ENCRYPTION_KEY not configured"}

    script_path = "/app/scripts/backup_images_local.sh"
    backup_dir = os.getenv("BACKUP_IMAGES_DIR", "/backups/images")

    if not os.path.exists(script_path):
        script_path = os.path.join(os.getcwd(), "scripts/backup_images_local.sh")
        if not os.path.exists(script_path):
            logger.error(f"Backup script not found: {script_path}")
            return {"status": "error", "reason": "backup script missing"}

    try:
        os.chmod(script_path, 0o755)

        env = {
            **os.environ,
            "STORAGE_PATH": settings.STORAGE_PATH,
            "BACKUP_IMAGES_DIR": backup_dir,
            # Use dedicated key  never reuse JWT_SECRET for backup encryption
            "BACKUP_ENCRYPTION_KEY": encryption_key,
        }

        result = subprocess.run(
            [script_path],
            capture_output=True,
            text=True,
            check=True,
            timeout=3600,
            env=env,
        )

        backup_info = {}
        for line in result.stdout.splitlines():
            if "=" in line and line.startswith("RESULT_"):
                k, v = line.split("=", 1)
                backup_info[k] = v

        # Audit log  use asyncio.run() per best practices (no get_event_loop in Celery)
        try:
            asyncio.run(_log_backup_result(backup_info))
        except Exception as log_err:
            # Non-fatal: backup succeeded even if audit log fails
            logger.exception(f"Audit log write failed (backup still OK): {log_err}")

        logger.info(f"KYC Images Backup OK: {backup_info.get('RESULT_FILE')}")

        deleted = _rotate_image_archives(backup_dir)
        logger.info(f"Image Archive Rotation: deleted {deleted} old archives.")

        return {"status": "ok", "info": backup_info, "rotated": deleted}

    except subprocess.CalledProcessError as e:
        logger.exception(f"KYC Images Backup failed (exit {e.returncode}): {e.stderr}")
        raise self.retry(exc=e, countdown=600)
    except Exception as e:
        logger.exception(f"KYC Images Backup error: {e}")
        raise self.retry(exc=e, countdown=600)


@celery_app.task(name="app.tasks.maintenance.check_and_catchup_backup")
def check_and_catchup_backup():
    """
    Daily check (03:30 AM) to ensure a backup was made in the last 7 days.
    Gated by ENABLE_BACKUPS=true.
    """
    if not settings.ENABLE_BACKUPS:
        logger.info("check_and_catchup_backup: ENABLE_BACKUPS=false  skipping.")
        return {"status": "skipped", "reason": "ENABLE_BACKUPS=false"}

    backup_dir = os.getenv("BACKUP_IMAGES_DIR", "/backups/images")
    now = datetime.now(timezone.utc)

    try:
        has_recent = False
        if os.path.exists(backup_dir):
            for f in Path(backup_dir).glob("*.tar.gz.gpg"):
                mtime = datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc)
                if (now - mtime).days < 7:
                    has_recent = True
                    break

        if not has_recent:
            logger.warning("No KYC images backup in last 7 days  triggering catch-up.")
            backup_kyc_images.delay()
            return {"status": "triggered", "reason": "no_recent_backup"}

        return {"status": "ok", "reason": "backup_exists"}

    except Exception as e:
        logger.exception(f"Catch-up check error: {e}")
        return {"status": "error", "message": str(e)}
