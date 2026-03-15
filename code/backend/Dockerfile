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

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-dev --no-install-project && \
    uv pip install --upgrade pip>=25.3 && \
    find /app/.venv -name "wheel*" -exec rm -rf {} +

# Final stage
FROM python:3.11-alpine

# Install runtime dependencies for OCR (Alpine equivalents)
RUN apk add --no-cache \
    mesa-gl \
    glib \
    libstdc++

# Create a non-root user
RUN addgroup -S vpgroup && adduser -S vpuser -G vpgroup

WORKDIR /app

# Copy the virtualenv from the builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code and set ownership
COPY --chown=vpuser:vpgroup . .

# Ensure storage directory exists
RUN mkdir -p /data/documents && chown -R vpuser:vpgroup /data/documents

# Set environment variables
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

USER vpuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
