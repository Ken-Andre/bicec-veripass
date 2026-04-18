# Build stage
FROM python:3.11-slim-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
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

# Install dependencies
RUN uv sync --frozen --no-dev --no-install-project && \
    uv pip install --upgrade pip>=25.3 && \
    # Clean up pip cache to reduce layer size
    find /app/.venv -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true && \
    find /app/.venv -name "wheel*" -exec rm -rf {} + 2>/dev/null || true && \
    find /app/.venv -name "*.pyc" -delete

# Final stage
FROM python:3.11-slim-bookworm

# Install runtime dependencies:
# - OCR: libgl1, libglib2.0-0, libstdc++
# - PostgreSQL client tools: postgresql-client
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libstdc++6 \
    postgresql-client \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN groupadd vpgroup && useradd -m vpuser -G vpgroup

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
