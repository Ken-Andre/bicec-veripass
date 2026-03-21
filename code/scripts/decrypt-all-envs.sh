#!/bin/bash
# Decrypt all .env.enc files in the repo to new.env (safe, no overwrite)
# Usage: ./scripts/decrypt-all-envs.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PASS_FILE="$REPO_ROOT/.env.pass"

if [ ! -f "$PASS_FILE" ]; then
    echo "Error: .env.pass not found at $PASS_FILE"
    exit 1
fi

PASS="$(cat "$PASS_FILE")"
DECRYPTED=0
ERRORS=0

# Find all .env.enc files, excluding node_modules and .venv
while IFS= read -r -d '' enc_file; do
    dir="$(dirname "$enc_file")"
    out_file="$dir/new.env"
    rel_enc="${enc_file#$REPO_ROOT/}"
    rel_out="${out_file#$REPO_ROOT/}"

    if senv decrypt "$enc_file" -o "$out_file" -p "$PASS" 2>/dev/null; then
        echo "  ✓ $rel_enc -> $rel_out"
        DECRYPTED=$((DECRYPTED + 1))
    else
        echo "  ✗ Failed: $rel_enc"
        ERRORS=$((ERRORS + 1))
    fi
done < <(find "$REPO_ROOT" -name ".env.enc" -not -path "*/node_modules/*" -not -path "*/.venv/*" -print0)

echo ""
echo "Done: $DECRYPTED decrypted, $ERRORS errors"
echo "Files written as 'new.env' — rename to '.env' when ready."
[ $ERRORS -gt 0 ] && exit 1
exit 0
