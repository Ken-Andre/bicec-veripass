#!/bin/sh
set -e

if [ -n "$PADDLE_CACHE_DIR" ]; then
    mkdir -p "$PADDLE_CACHE_DIR"
fi

# Only apply migrations if SKIP_MIGRATIONS is not set
if [ -z "$SKIP_MIGRATIONS" ]; then
    echo "Applying Alembic migrations..."
    alembic upgrade head
else
    echo "Skipping migrations (worker service)"
fi

echo "Starting application..."
UVICORN_WORKERS=${UVICORN_WORKERS:-1}
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --workers "$UVICORN_WORKERS"
