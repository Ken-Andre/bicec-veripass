import os

from celery import Celery
from celery.schedules import crontab

# CRITICAL: Import all database models FIRST before creating Celery app.
import app.db  # noqa: F401


REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery = Celery(
    "bicec_veripass",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "app.tasks.maintenance",
        "app.tasks_demo",
        "app.modules.auth.tasks",
        "app.tasks.sanctions",
        "app.tasks.kyc",
        "app.tasks.ocr",
    ],
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
)

celery.conf.beat_schedule = {
    "prune-disk-daily": {
        "task": "app.tasks.maintenance.check_disk_usage",
        "schedule": crontab(hour=3, minute=0),
    },
    "backup-db-daily": {
        "task": "app.tasks.maintenance.backup_postgres",
        "schedule": crontab(hour=1, minute=0),
    },
    "backup-images-weekly": {
        "task": "app.tasks.maintenance.backup_kyc_images",
        "schedule": crontab(hour=2, minute=0, day_of_week="sun"),
    },
    "check-backup-catchup-daily": {
        "task": "app.tasks.maintenance.check_and_catchup_backup",
        "schedule": crontab(hour=3, minute=30),
    },
    "sync-sanctions-weekly": {
        "task": "app.tasks.sanctions.sync_pep_sanctions",
        "schedule": crontab(hour=2, minute=0, day_of_week=1),
    },
    "detect-abandoned-sessions": {
        "task": "app.tasks.kyc.detect_abandoned_sessions",
        "schedule": crontab(hour=3, minute=0),
    },
    "check-document-expiry-daily": {
        "task": "app.tasks.kyc.check_document_expiry",
        "schedule": crontab(hour=3, minute=20),
    },
    "check-sanctions-staleness": {
        "task": "app.tasks.sanctions.check_staleness",
        "schedule": crontab(hour=4, minute=0),
    },
    "screen-active-clients-daily": {
        "task": "app.tasks.kyc.screen_active_clients_against_sanctions",
        "schedule": crontab(hour=4, minute=30),
    },
}
