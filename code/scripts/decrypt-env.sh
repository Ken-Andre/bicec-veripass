#!/bin/bash
# Decrypt .env.enc to .env
# Usage: ./scripts/decrypt-env.sh

cd "$(dirname "$0")/.." || exit 1

if [ ! -f ".env.enc" ]; then
    echo "Error: .env.enc file not found"
    exit 1
fi

if [ ! -f ".env.pass" ]; then
    echo "Error: .env.pass file not found"
    exit 1
fi

senv decrypt .env.enc -o .env -p "$(cat .env.pass)"
echo "Decrypted .env.enc -> .env"