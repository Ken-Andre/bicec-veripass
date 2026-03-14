# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy application code
COPY . .

# Build the application
RUN bun run build

# Final stage
FROM nginxinc/nginx-unprivileged:1.27-alpine

# Switch to root to install security updates
USER root
RUN apk update && apk upgrade --no-cache && apk del curl

# Switch back to the unprivileged user
USER 101

# Copy build artifacts
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
