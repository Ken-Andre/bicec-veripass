FROM nginxinc/nginx-unprivileged:1.27-bookworm

# Copy certificates with proper permissions
USER root
COPY certs/nginx-selfsigned.crt /etc/ssl/certs/nginx-selfsigned.crt
COPY certs/nginx-selfsigned.key /etc/ssl/certs/nginx-selfsigned.key

# Set proper permissions (readable by nginx user)
RUN chmod 644 /etc/ssl/certs/nginx-selfsigned.crt && \
    chmod 644 /etc/ssl/certs/nginx-selfsigned.key && \
    chown root:root /etc/ssl/certs/nginx-selfsigned.crt /etc/ssl/certs/nginx-selfsigned.key

# Switch back to nginx user
USER nginx

EXPOSE 8080 8443

CMD ["/docker-entrypoint.sh", "nginx", "-g", "daemon off;"]