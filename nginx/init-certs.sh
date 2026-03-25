#!/bin/sh
# Auto-generate self-signed SSL certificates if they don't exist

CERT_DIR="/etc/nginx/certs"
CERT_FILE="$CERT_DIR/shiftpilot.lab.sr.bnc.ch.crt"
KEY_FILE="$CERT_DIR/shiftpilot.lab.sr.bnc.ch.key"

if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
  echo "=== SSL certificates not found, generating self-signed certs ==="
  apk add --no-cache openssl > /dev/null 2>&1
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -subj "/CN=shiftpilot.lab.sr.bnc.ch" \
    -addext "subjectAltName=DNS:shiftpilot.lab.sr.bnc.ch"
  echo "=== SSL certificates generated ==="
else
  echo "=== SSL certificates found, skipping generation ==="
fi

exec nginx -g "daemon off;"
