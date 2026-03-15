FROM nginxinc/nginx-unprivileged:1.27-bookworm

# Copy entrypoint script with proper permissions
USER root
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Switch back to nginx user
USER nginx

EXPOSE 8080 8443

ENTRYPOINT ["/entrypoint.sh"]