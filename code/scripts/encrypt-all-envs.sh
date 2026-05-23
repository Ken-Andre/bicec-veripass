#!/bin/bash
# Encrypt all .env files in the repo to .env.enc
# Usage: ./scripts/encrypt-all-envs.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PASS_FILE="$REPO_ROOT/.env.pass"

if [ ! -f "$PASS_FILE" ]; then
    echo "Error: .env.pass not found at $PASS_FILE"
    echo "Create it with: openssl rand -base64 32 > $PASS_FILE"
    exit 1
fi

PASS="$(cat "$PASS_FILE")"
ENCRYPTED=0
ERRORS=0

# Find all .env files, excluding node_modules and .venv
while IFS= read -r -d '' env_file; do
    enc_file="${env_file}.enc"
    rel_path="${env_file#$REPO_ROOT/}"

    if senv encrypt "$env_file" -o "$enc_file" -p "$PASS" 2>/dev/null; then
        echo "  ✓ $rel_path -> ${rel_path}.enc"
        ENCRYPTED=$((ENCRYPTED + 1))
    else
        echo "  ✗ Failed: $rel_path"
        ERRORS=$((ERRORS + 1))
    fi
done < <(find "$REPO_ROOT" -name ".env" -not -path "*/node_modules/*" -not -path "*/.venv/*" -print0)

echo ""
echo "Done: $ENCRYPTED encrypted, $ERRORS errors"
[ $ERRORS -gt 0 ] && exit 1
exit 0
