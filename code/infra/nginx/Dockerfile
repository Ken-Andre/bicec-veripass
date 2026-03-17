FROM nginxinc/nginx-unprivileged:1.27-bookworm

# Switch to root to copy files and set permissions
USER root

# Copy entrypoint script with proper permissions
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Copy security headers config file
COPY security_headers.conf /etc/nginx/security_headers.conf

# Create SSL directory with proper permissions
RUN mkdir -p /etc/nginx/ssl && chown nginx:nginx /etc/nginx/ssl

# Switch back to nginx user
USER nginx

EXPOSE 8080 8443

ENTRYPOINT ["/entrypoint.sh"]
