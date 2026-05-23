#!/bin/sh
set -e
# Nginx entrypoint — runs as root to manage cert permissions
# For mkcert certs: mounted as read-only from host, skip chmod
# For self-signed fallback: generate and chmod if needed

CERT_DIR="/etc/nginx/ssl"

# Ensure the SSL directory exists (skip chmod if read-only)
mkdir -p "$CERT_DIR" 2>/dev/null || true

# Check if mkcert certs are present (from read-only mount)
if [ -f "$CERT_DIR/cert.pem" ] && [ -f "$CERT_DIR/key.pem" ]; then
    echo "[entrypoint] mkcert certificates found in $CERT_DIR — using host certificates"
    # Try to fix permissions but don't fail if read-only
    chmod 644 "$CERT_DIR/cert.pem" 2>/dev/null || true
    chmod 600 "$CERT_DIR/key.pem" 2>/dev/null || true
elif [ -f "$CERT_DIR/nginx-selfsigned.crt" ] && [ -f "$CERT_DIR/nginx-selfsigned.key" ]; then
    echo "[entrypoint] Self-signed certificates found — using fallback certs"
    chmod 644 "$CERT_DIR/nginx-selfsigned.crt" 2>/dev/null || true
    chmod 600 "$CERT_DIR/nginx-selfsigned.key" 2>/dev/null || true
else
    echo "[entrypoint] No certificates found — generating self-signed fallback..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERT_DIR/nginx-selfsigned.key" \
        -out "$CERT_DIR/nginx-selfsigned.crt" \
        -subj "/C=CM/ST=Centre/L=Yaounde/O=BICEC/OU=VeriPass/CN=localhost" 2>/dev/null
    echo "[entrypoint] Self-signed certificates generated in $CERT_DIR"
    chmod 644 "$CERT_DIR/nginx-selfsigned.crt" 2>/dev/null || true
    chmod 600 "$CERT_DIR/nginx-selfsigned.key" 2>/dev/null || true
fi

# Start nginx (master runs as root to read TLS key, workers drop to nginx user internally)
exec nginx -g 'daemon off;'
