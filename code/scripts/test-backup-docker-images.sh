#!/usr/bin/env bash
# Focused tests for backup-docker-images.sh without requiring Docker.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_SCRIPT="$SCRIPT_DIR/backup-docker-images.sh"

run_case() {
    local mode="$1"
    local workdir
    workdir="$(mktemp -d)"

    mkdir -p "$workdir/code/scripts" "$workdir/bin"
    cp "$SOURCE_SCRIPT" "$workdir/code/scripts/backup-docker-images.sh"
    touch "$workdir/code/docker-compose.yml"

    cat > "$workdir/bin/docker" <<'DOCKER_STUB'
#!/usr/bin/env bash
set -euo pipefail

log="${DOCKER_STUB_LOG:?}"
mode="${DOCKER_STUB_MODE:?}"

printf '%s\n' "$*" >> "$log"

if [ "$1" = "compose" ] && [ "${*: -2}" = "config --images" ]; then
    if [ "$mode" = "compose-images" ]; then
        printf '%s\n' "code-api" "postgres:17-bookworm" "missing-image:latest" "code-api"
    fi
    exit 0
fi

if [ "$1" = "image" ] && [ "$2" = "inspect" ]; then
    case "$3" in
        code-api|postgres:17-bookworm|redis:7-bookworm)
            exit 0
            ;;
        *)
            exit 1
            ;;
    esac
fi

if [ "$1" = "save" ]; then
    shift
    printf 'saved:%s\n' "$*"
    exit 0
fi

echo "Unexpected docker call: $*" >&2
exit 2
DOCKER_STUB
    chmod +x "$workdir/bin/docker"

    local output="$workdir/output.txt"
    DOCKER_STUB_MODE="$mode" DOCKER_STUB_LOG="$workdir/docker.log" \
        PATH="$workdir/bin:$PATH" bash "$workdir/code/scripts/backup-docker-images.sh" > "$output"

    local archive
    archive="$(find "$workdir/code/backups/docker-images" -name 'veripass-images-*.tar.gz' -type f | head -1)"
    test -n "$archive"
    gzip -dc "$archive" > "$workdir/archive.txt"

    case "$mode" in
        compose-images)
            grep -q "  \[OK\] code-api" "$output"
            grep -q "  \[OK\] postgres:17-bookworm" "$output"
            grep -q "  \[--\] missing-image:latest - introuvable, ignoree" "$output"
            grep -q "saved:code-api postgres:17-bookworm" "$workdir/archive.txt"
            ;;
        fallback)
            grep -q "fallback statique" "$output"
            grep -q "  \[OK\] redis:7-bookworm" "$output"
            grep -q "saved:postgres:17-bookworm redis:7-bookworm" "$workdir/archive.txt"
            ;;
        *)
            echo "Unknown mode: $mode" >&2
            return 2
            ;;
    esac

    rm -rf "$workdir"
}

run_case compose-images
run_case fallback

echo "backup-docker-images.sh tests passed"
