# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files first (better layer caching)
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy application code
COPY . .

# Pass Sentry DSN as build-time argument for Vite injection
ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN

# Build the application
RUN bun run build && \
    # Clean up unnecessary files to reduce layer size
    rm -rf node_modules .next .bun

# Final stage
FROM nginxinc/nginx-unprivileged:1.27-alpine

# Switch to root to install security updates and clean
USER root
RUN apk update && apk upgrade --no-cache && \
    # Clean apk cache to reduce final image size
    rm -rf /var/cache/apk/*

# Add health check — wget BusyBox (Alpine) ne supporte pas --spider
# Utiliser 127.0.0.1 au lieu de localhost (résolution DNS Alpine)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

# Switch back to the unprivileged user
USER 101

# Copy build artifacts
COPY --from=builder /app/dist /usr/share/nginx/html
# Copy Nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
