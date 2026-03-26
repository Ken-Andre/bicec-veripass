# Build stage
FROM python:3.11-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    build-base \
    curl \
    libffi-dev

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy dependency files only (for better layer caching)
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-dev --no-install-project && \
    uv pip install --upgrade pip>=25.3 && \
    # Clean up pip cache to reduce layer size
    find /app/.venv -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true && \
    find /app/.venv -name "wheel*" -exec rm -rf {} + 2>/dev/null || true && \
    find /app/.venv -name "*.pyc" -delete

# Final stage
FROM python:3.11-alpine

# Install runtime dependencies:
# - OCR: mesa-gl, glib, libstdc++
# - PostgreSQL client tools: postgresql-client (pg_dump, pg_restore, psql)
# - Docker CLI: docker-cli (for disk prune task)
RUN apk add --no-cache \
    mesa-gl \
    glib \
    libstdc++ \
    postgresql-client \
    docker-cli \
    gnupg && \
    # Clean apk cache to reduce image size
    rm -rf /var/cache/apk/*

# Create a non-root user
RUN addgroup -S vpgroup && adduser -S vpuser -G vpgroup

WORKDIR /app

# Copy the virtualenv from the builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code and set ownership
COPY --chown=vpuser:vpgroup . .

# Ensure storage directory exists and set entrypoint permissions
RUN mkdir -p /data/documents /backups/db && \
    chown -R vpuser:vpgroup /data/documents /backups/db && \
    chmod +x /app/entrypoint.sh

# Set environment variables
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health').read()" || exit 1

USER vpuser

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
