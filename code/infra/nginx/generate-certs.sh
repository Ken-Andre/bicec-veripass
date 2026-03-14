#!/bin/bash
# Génère des certificats auto-signés pour le développement
# Utilisable via Git Bash sur Windows ou tout shell Linux/Mac

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/certs"

echo "🔐 Génération des certificats TLS auto-signés..."

mkdir -p "$CERTS_DIR"

# Générer clé privée + certificat auto-signé (365 jours)
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout "$CERTS_DIR/nginx-selfsigned.key" \
  -out "$CERTS_DIR/nginx-selfsigned.crt" \
  -subj "/C=CM/ST=Centre/L=Yaounde/O=BICEC/OU=VeriPass/CN=localhost" \
  2>/dev/null

echo "✅ Certificats générés dans $CERTS_DIR"
echo "   - nginx-selfsigned.crt (certificat public)"
echo "   - nginx-selfsigned.key (clé privée)"
echo ""
echo "⚠️  Avertissement navigateur : normal pour un certificat auto-signé"