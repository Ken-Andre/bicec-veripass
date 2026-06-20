# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files first (better layer caching)
COPY package.json bun.lock ./

# Install dependencies
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

# Copy application code
COPY . .

# Pass Sentry DSN and Version as build-time arguments for Vite injection
ARG VITE_SENTRY_DSN
ARG VITE_APP_VERSION
ARG VITE_VAPID_PUBLIC_KEY
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_APP_VERSION=$VITE_APP_VERSION
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY

# Build the application
RUN bun run build && \
    # Clean up unnecessary files to reduce layer size
    rm -rf node_modules .next .bun

# Final stage
FROM nginxinc/nginx-unprivileged:1.27-alpine

# Switch to root
USER root
# Skip apk update/upgrade to avoid network issues in CI - base image already has updates
RUN rm -rf /var/cache/apk/*

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
