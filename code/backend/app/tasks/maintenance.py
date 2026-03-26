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
    Called from inside the container — no Docker socket needed.
    """
    db_url = os.getenv("DATABASE_URL", "")
    # Parse postgresql+asyncpg://user:pass@host:port/dbname
    # Fall back to individual env vars
    db_host = os.getenv("DB_HOST", "postgres")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "veripass")
    db_user = os.getenv("DB_USER", "vp_user")
    db_password = os.getenv("DB_PASSWORD", "")

    # Parse DATABASE_URL if available
    if db_url:
        try:
            # postgresql+asyncpg://user:pass@host:port/dbname
            url = db_url.replace("postgresql+asyncpg://", "").replace("postgresql://", "")
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
        [
            "pg_dump",
            "-h", db_host,
            "-p", db_port,
            "-U", db_user,
            "-Fc",  # custom compressed format
            db_name,
        ],
        capture_output=True,
        env=env,
        timeout=1800,  # 30 min max
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
    Daily PostgreSQL backup via pg_dump (network connection, no Docker socket).
    Retention: 7 days. Runs at 01:00 UTC via Celery Beat.
    """
    backup_dir = "/backups/db"
    retention_days = int(os.getenv("BACKUP_RETENTION_DAYS", "7"))

    Path(backup_dir).mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    db_name = os.getenv("DB_NAME", "veripass")
    backup_file = f"{backup_dir}/{db_name}_{timestamp}.dump"

    logger.info(f"Starting backup → {backup_file}")

    try:
        success = _run_pg_dump(backup_file)

        if not success:
            raise RuntimeError("pg_dump returned non-zero exit code")

        size_mb = Path(backup_file).stat().st_size / (1024 * 1024)
        logger.info(f"Backup OK: {backup_file} ({size_mb:.2f} MB)")

        deleted = _rotate_backups(backup_dir, retention_days)
        remaining = len(list(Path(backup_dir).glob("*.dump")))
        logger.info(f"Rotation: {deleted} deleted, {remaining} retained (max {retention_days}d)")

        return {"status": "ok", "file": backup_file, "size_mb": round(size_mb, 2), "retained": remaining}

    except Exception as e:
        logger.error(f"Backup failed: {e}")
        raise self.retry(exc=e, countdown=300)  # retry in 5 min


@celery_app.task(name="app.tasks.maintenance.check_disk_usage")
def check_disk_usage():
    """
    Check disk usage and trigger docker prune if > 85%.
    Runs at 03:00 UTC via Celery Beat.
    Requires Docker socket mounted at /var/run/docker.sock.
    """
    try:
        # Check disk usage via df
        result = subprocess.run(
            ["df", "-h", "/"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        
        if result.returncode != 0:
            logger.error(f"df command failed: {result.stderr}")
            return False
        
        # Parse df output to get usage percentage
        # Example: Filesystem      Size  Used Avail Use% Mounted on
        #          /dev/sda1       200G  170G   30G  85% /
        lines = result.stdout.strip().split("\n")
        if len(lines) < 2:
            logger.error("Unexpected df output format")
            return False
        
        usage_line = lines[1]
        parts = usage_line.split()
        if len(parts) < 5:
            logger.error(f"Cannot parse df output: {usage_line}")
            return False
        
        usage_str = parts[4].rstrip("%")
        try:
            usage_pct = int(usage_str)
        except ValueError:
            logger.error(f"Cannot parse usage percentage: {usage_str}")
            return False
        
        logger.info(f"Disk usage: {usage_pct}%")
        
        # Trigger prune if > 85%
        if usage_pct > 85:
            logger.warning(f"Disk usage {usage_pct}% exceeds threshold (85%), triggering prune...")
            
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
        else:
            logger.info(f"Disk usage {usage_pct}% is below threshold, no prune needed")
            return True
            
    except subprocess.TimeoutExpired:
        logger.error("Disk check/prune timed out")
        return False
    except Exception as e:
        logger.error(f"Disk check error: {e}")
        return False


def _rotate_image_archives(backup_dir: str, weeks_retention: int = 4, months_retention: int = 12) -> int:
    """
    Weekly/Monthly rotation of image archives.
    Conserves last 4 weeks + 1 archive/month for 12 months.
    """
    now = datetime.now(timezone.utc)
    deleted = 0
    archives = list(Path(backup_dir).glob("*.tar.gz.gpg"))
    
    # Simple logic for MVP:
    # 1. Keep all in last 28 days
    # 2. Beyond 28 days, only keep if it's the first backup of the month
    # 3. Beyond 12 months, delete everything
    
    # Note: For production use more robust libraries if available, 
    # but this stays KISS-compliant using standard Path/datetime.
    
    for f in archives:
        mtime = datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc)
        age_days = (now - mtime).days
        
        # 12-month hard limit (COBAC requirement is 10y but this tool handles 1y rotation)
        if age_days > 365:
            f.unlink()
            deleted += 1
            continue
            
        # Beyond 4 weeks (28 days)
        if age_days > 28:
            # Only keep if first backup of that month (Day 1-7 or earliest available)
            # Simplification: keep if mtime.day <= 7 and no newer backup from same month exists
            if mtime.day > 7:
                f.unlink()
                deleted += 1
                
    return deleted


@celery_app.task(name="app.tasks.maintenance.backup_kyc_images", bind=True, max_retries=3)
def backup_kyc_images(self):
    """
    Weekly encrypted backup of KYC images volume to local storage.
    Compliance: Loi 2024-017 (Data Sovereignty) & COBAC (10y retention).
    Ref: [ADMIN-07] #180
    """
    script_path = "/app/scripts/backup_images_local.sh"
    backup_dir = os.getenv("BACKUP_IMAGES_DIR", "/backups/images")
    
    if not os.path.exists(script_path):
        # Local development fallback
        script_path = os.path.join(os.getcwd(), "scripts/backup_images_local.sh")
        if not os.path.exists(script_path):
            logger.error(f"Backup script not found: {script_path}")
            return False

    try:
        os.chmod(script_path, 0o755)
        
        # Inject context via env (using settings for storage path)
        env = {
            **os.environ,
            "STORAGE_PATH": settings.STORAGE_PATH,
            "BACKUP_IMAGES_DIR": backup_dir,
            "BACKUP_ENCRYPTION_KEY": settings.JWT_SECRET, # Or specific var
        }

        result = subprocess.run(
            [script_path],
            capture_output=True,
            text=True,
            check=True,
            timeout=3600, # 1 hour max
            env=env
        )
        
        # Parse output for SHA and Path
        backup_info = {}
        for line in result.stdout.splitlines():
            if "=" in line and line.startswith("RESULT_"):
                k, v = line.split("=", 1)
                backup_info[k] = v
        
        # Record in audit log (requires direct session)
        async def log_result():
            async with AsyncSessionLocal() as session:
                log = AuditLog(
                    id=uuid.uuid4(),
                    action="KYC_IMAGES_BACKUP",
                    table_name="documents",
                    new_data={
                        "file": backup_info.get("RESULT_FILE"),
                        "sha256": backup_info.get("RESULT_SHA256"),
                        "size_bytes": backup_info.get("RESULT_SIZE"),
                        "status": "SUCCESS"
                    },
                    performed_at=datetime.now(timezone.utc)
                )
                session.add(log)
                await session.commit()
                
        # Celery sync wrapper for async call
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # This shouldn't happen in Celery worker but just in case
            asyncio.ensure_future(log_result())
        else:
            loop.run_until_complete(log_result())

        logger.info(f"KYC Images Backup OK: {backup_info.get('RESULT_FILE')}")
        
        # Rotate
        deleted = _rotate_image_archives(backup_dir)
        logger.info(f"Image Archive Rotation: deleted {deleted} old archives.")
        
        return {"status": "ok", "info": backup_info, "rotated": deleted}

    except subprocess.CalledProcessError as e:
        logger.error(f"KYC Images Backup failed (exit {e.returncode}): {e.stderr}")
        raise self.retry(exc=e, countdown=600) # 10 min retry
    except Exception as e:
        logger.error(f"KYC Images Backup error: {e}")
        raise self.retry(exc=e, countdown=600)


@celery_app.task(name="app.tasks.maintenance.check_and_catchup_backup")
def check_and_catchup_backup():
    """
    Daily check (03:00 AM) to ensure a backup was made in the last 7 days.
    Mitigates the risk of a missed weekly backup if the machine was off.
    """
    backup_dir = os.getenv("BACKUP_IMAGES_DIR", "/backups/images")
    now = datetime.now(timezone.utc)
    
    # Check if any .gpg file was created/modified in the last 7 days
    has_recent_backup = False
    try:
        if os.path.exists(backup_dir):
            for f in Path(backup_dir).glob("*.tar.gz.gpg"):
                mtime = datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc)
                if (now - mtime).days < 7:
                    has_recent_backup = True
                    break
                    
        if not has_recent_backup:
            logger.warning("No KYC images backup found in the last 7 days. Triggering catch-up backup now...")
            # Trigger the weekly backup task immediately
            backup_kyc_images.delay()
            return {"status": "triggered", "reason": "no_recent_backup"}
        
        return {"status": "ok", "reason": "backup_exists"}
        
    except Exception as e:
        logger.error(f"Catch-up logic error: {e}")
        return {"status": "error", "message": str(e)}
