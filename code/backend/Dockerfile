# syntax=docker/dockerfile:1
# Build stage
FROM python:3.11-slim-bookworm AS builder

# Install build dependencies
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libffi-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*


# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy dependency files only (for better layer caching)
COPY pyproject.toml uv.lock ./



# Install all dependencies via uv (BuildKit cache avoids re-downloading on rebuilds)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project && \
    # Clean up to reduce image size
    find /app/.venv -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true && \
    find /app/.venv -name "wheel*" -exec rm -rf {} + 2>/dev/null || true && \
    find /app/.venv -name "*.pyc" -delete

# Final stage
FROM python:3.11-slim-bookworm

# Install runtime dependencies:
# - OCR: libgl1, libglib2.0-0, libstdc++
# - PostgreSQL client tools: postgresql-client
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libstdc++6 \
    postgresql-client \
    gnupg \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*


# Create a non-root user
RUN groupadd vpgroup && useradd -m vpuser -G vpgroup

WORKDIR /app

# Copy the virtualenv from the builder
COPY --from=builder --chown=vpuser:vpgroup /app/.venv /app/.venv

# Copy application code and set ownership
COPY --chown=vpuser:vpgroup . .

# Ensure storage directory exists and set entrypoint permissions
RUN mkdir -p /data/documents /data/models /backups/db /tmp/paddle-cache /home/vpuser/.paddlex && \
    chown -R vpuser:vpgroup /data/documents /data/models /backups/db /tmp/paddle-cache /home/vpuser/.paddlex && \
    chmod +x /app/entrypoint.sh

# Models are pre-downloaded into models_storage volume by the model_init service
# (docker compose service: model_init → scripts/download_models.py)
# Set env var to prevent PaddleOCR from checking the model source on each startup
ENV PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True


# Set environment variables
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health').read()" || exit 1

USER vpuser

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
