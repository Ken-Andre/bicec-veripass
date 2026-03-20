#!/bin/sh
set -e

# No migrations for worker services
echo "Starting worker/flower service..."
exec "$@"
