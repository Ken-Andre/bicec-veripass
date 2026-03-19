#!/bin/bash
# ============================================================
# Test script for docker_prune.sh
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_PRUNE="${SCRIPT_DIR}/docker_prune.sh"

echo "Testing docker_prune.sh..."
echo ""

# Test 1: Help
echo "Test 1: Help message"
bash "$DOCKER_PRUNE" --help
echo "✓ Help test passed"
echo ""

# Test 2: Dry run with default threshold
echo "Test 2: Dry run with default threshold (85%)"
bash "$DOCKER_PRUNE" --dry-run
echo "✓ Dry run test passed"
echo ""

# Test 3: Dry run with low threshold
echo "Test 3: Dry run with low threshold (10%)"
bash "$DOCKER_PRUNE" --dry-run --threshold=10
echo "✓ Low threshold test passed"
echo ""

# Test 4: Check if script is executable
if [ -x "$DOCKER_PRUNE" ]; then
    echo "✓ Script is executable"
else
    echo "✗ Script is not executable"
    echo "  Run: chmod +x $DOCKER_PRUNE"
    exit 1
fi

echo ""
echo "All tests passed! ✓"
