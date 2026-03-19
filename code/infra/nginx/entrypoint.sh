#!/bin/sh
set -e
# Nginx entrypoint — runs as root to manage cert permissions
# nginx master process (root) reads TLS certs; workers drop to nginx user via nginx internals

CERT_DIR="/etc/nginx/ssl"

# Ensure the SSL directory exists and is accessible
mkdir -p "$CERT_DIR"
chmod 755 "$CERT_DIR"

# Generate self-signed fallback certificates ONLY if no certificates are present
# (i.e., no mkcert certs were mounted from the host)
if [ ! -f "$CERT_DIR/nginx-selfsigned.crt" ] || [ ! -f "$CERT_DIR/nginx-selfsigned.key" ]; then
    echo "[entrypoint] No certificates found — generating self-signed fallback..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERT_DIR/nginx-selfsigned.key" \
        -out "$CERT_DIR/nginx-selfsigned.crt" \
        -subj "/C=CM/ST=Centre/L=Yaounde/O=BICEC/OU=VeriPass/CN=localhost" 2>/dev/null
    echo "[entrypoint] Fallback self-signed certificates generated in $CERT_DIR"
else
    echo "[entrypoint] Certificates found in $CERT_DIR — using host mkcert certs"
fi

# Fix permissions on certs (needed when mounted from Windows/WSL2 host)
chmod 644 "$CERT_DIR/nginx-selfsigned.crt"
chmod 600 "$CERT_DIR/nginx-selfsigned.key"

# Start nginx (master runs as root to read TLS key, workers drop to nginx user internally)
exec nginx -g 'daemon off;'
