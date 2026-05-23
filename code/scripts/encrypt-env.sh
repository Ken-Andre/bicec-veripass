#!/bin/bash
# Encrypt .env to .env.enc
# Usage: ./scripts/encrypt-env.sh

cd "$(dirname "$0")/.." || exit 1

if [ ! -f ".env" ]; then
    echo "Error: .env file not found"
    exit 1
fi

if [ ! -f ".env.pass" ]; then
    echo "Error: .env.pass file not found"
    exit 1
fi

senv encrypt .env -o .env.enc -p "$(cat .env.pass)"
echo "Encrypted .env -> .env.enc"