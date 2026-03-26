import os
from celery import Celery
from celery.schedules import crontab

# Celery application configuration
# The broker and backend URLs are taken from environment variables
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery = Celery(
    "bicec_veripass",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "app.tasks.maintenance",  # Tâches de maintenance
        "app.tasks_demo",  # Tâches de démonstration
        "app.modules.auth.tasks", # Tâches d'authentification (OTP SMS/Email)
    ]
)

# Optional configuration
celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600, # 1 hour max for any task
)

# Beat Schedule
celery.conf.beat_schedule = {
    # Prune disk every day at 03:00 AM
    "prune-disk-daily": {
        "task": "app.tasks.maintenance.check_disk_usage",
        "schedule": crontab(hour=3, minute=0),
    },
    # Backup PostgreSQL every day at 01:00 AM
    "backup-db-daily": {
        "task": "app.tasks.maintenance.backup_postgres",
        "schedule": crontab(hour=1, minute=0),
    },
    # Weekly encrypted backup of KYC images (Sunday at 02:00 AM)
    "backup-images-weekly": {
        "task": "app.tasks.maintenance.backup_kyc_images",
        "schedule": crontab(hour=2, minute=0, day_of_week="sun"),
    },
    # Daily check for missed backups (03:30 AM)
    "check-backup-catchup-daily": {
        "task": "app.tasks.maintenance.check_and_catchup_backup",
        "schedule": crontab(hour=3, minute=30),
    },
    # Other tasks from architecture (placeholders)
    # "sync-sanctions-weekly": { ... }
}
