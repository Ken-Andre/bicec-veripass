#!/bin/sh
set -e

# Only apply migrations if SKIP_MIGRATIONS is not set
if [ -z "$SKIP_MIGRATIONS" ]; then
    echo "Applying Alembic migrations..."
    alembic upgrade head
else
    echo "Skipping migrations (worker service)"
fi

echo "Starting application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers
