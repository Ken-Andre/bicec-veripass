#!/bin/sh
# Nginx entrypoint with automatic TLS certificate generation
# Certs are stored in /etc/nginx/ssl (outside the read-only mount)

CERT_DIR="/etc/nginx/ssl"

# Create cert directory if it doesn't exist (with proper permissions)
mkdir -p "$CERT_DIR"
chmod 755 "$CERT_DIR"

# Generate self-signed certificates if they don't exist
if [ ! -f "$CERT_DIR/nginx-selfsigned.crt" ] || [ ! -f "$CERT_DIR/nginx-selfsigned.key" ]; then
    echo "Generating self-signed certificates..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERT_DIR/nginx-selfsigned.key" \
        -out "$CERT_DIR/nginx-selfsigned.crt" \
        -subj "/C=CM/ST=Centre/L=Yaounde/O=BICEC/OU=VeriPass/CN=localhost" 2>/dev/null
    
    # Set proper permissions for certificate files
    chmod 644 "$CERT_DIR/nginx-selfsigned.crt"
    chmod 600 "$CERT_DIR/nginx-selfsigned.key"
    
    echo "Certificates generated in $CERT_DIR"
fi

# Start nginx
exec nginx -g 'daemon off;'
