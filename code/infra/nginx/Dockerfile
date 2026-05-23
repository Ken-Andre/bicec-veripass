FROM nginxinc/nginx-unprivileged:1.27-bookworm

# Switch to root to copy files, install tools, and set permissions
USER root

# Copy entrypoint script with proper permissions
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Copy security headers config file
COPY security_headers.conf /etc/nginx/security_headers.conf

# Pre-create SSL directory with proper permissions (fallback if no volume mount)
RUN mkdir -p /etc/nginx/ssl && chmod 755 /etc/nginx/ssl

# Create an empty default.conf that overrides the base image's default
# This prevents nginx from trying to serve the root web directory
RUN touch /etc/nginx/conf.d/default.conf && chmod 644 /etc/nginx/conf.d/default.conf

# Add health check for the reverse proxy
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

# Keep root so entrypoint can fix permissions on mounted volume
USER root

EXPOSE 8080 8443

ENTRYPOINT ["/entrypoint.sh"]
