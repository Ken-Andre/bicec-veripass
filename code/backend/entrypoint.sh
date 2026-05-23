#!/bin/sh
set -e

# Explicitly use .venv/bin/python for all commands
PYTHON="/app/.venv/bin/python"
export PATH="/app/.venv/bin:$PATH"

if [ -n "$PADDLE_CACHE_DIR" ]; then
    mkdir -p "$PADDLE_CACHE_DIR"
fi

# Only apply migrations if SKIP_MIGRATIONS is not set
if [ -z "$SKIP_MIGRATIONS" ]; then
    echo "Applying Alembic migrations..."
    $PYTHON -c "from alembic.config import Config; from alembic import command; cfg = Config('/app/alembic.ini'); command.upgrade(cfg, 'head')" || true
else
    echo "Skipping migrations (worker service)"
fi

echo "Starting application..."
UVICORN_WORKERS=${UVICORN_WORKERS:-1}
exec $PYTHON -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --workers "$UVICORN_WORKERS"
