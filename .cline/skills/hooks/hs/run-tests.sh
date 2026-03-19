#!/bin/bash
# Hook: run-tests
# Description: Lance les tests backend et frontend
# Usage: ./run-tests.sh [backend|frontend|all]

MODE="${1:-all}"

echo "🧪 Lancement des tests..."

cd "$(dirname "$0")/../../.." || exit 1

run_backend_tests() {
    echo "🐍 Tests Backend (pytest)..."
    cd code/backend
    python -m pytest tests/ -v --tb=short --color=yes 2>&1 | head -100
    BACKEND_EXIT=$?
    cd ../..
    return $BACKEND_EXIT
}

run_frontend_mobile_tests() {
    echo "📱 Tests Mobile (npm test)..."
    cd code/mobile
    npm test -- --watchAll=false 2>&1 | head -50
    MOBILE_EXIT=$?
    cd ../..
    return $MOBILE_EXIT
}

run_frontend_backoffice_tests() {
    echo "🖥️ Tests Backoffice (npm test)..."
    cd code/backoffice
    npm test -- --watchAll=false 2>&1 | head -50
    BACKOFFICE_EXIT=$?
    cd ../..
    return $BACKOFFICE_EXIT
}

case "$MODE" in
    backend)
        run_backend_tests
        ;;
    frontend)
        run_frontend_mobile_tests
        run_frontend_backoffice_tests
        ;;
    all)
        run_backend_tests
        run_frontend_mobile_tests
        run_frontend_backoffice_tests
        ;;
    *)
        echo "Usage: $0 [backend|frontend|all]"
        exit 1
        ;;
esac

echo "✅ Tests terminés!"