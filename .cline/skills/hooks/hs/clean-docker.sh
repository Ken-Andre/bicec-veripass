#!/bin/bash
# Hook: clean-docker
# Description: Nettoie les ressources Docker non utilisées
# Usage: ./clean-docker.sh [all|dangling|volumes|cache]

MODE="${1:-dangling}"

echo "🧹 Nettoyage Docker..."

cd "$(dirname "$0")/../../.." || exit 1

case "$MODE" in
    dangling)
        echo "🗑️ Suppression des images dangling..."
        docker image prune -f
        ;;
    all)
        echo "🗑️ Suppression complète des ressources non utilisées..."
        docker system prune -a --volumes -f
        ;;
    volumes)
        echo "🗑️ Suppression des volumes non utilisés..."
        docker volume prune -f
        ;;
    cache)
        echo "🗑️ Nettoyage du cache Docker..."
        docker builder prune --all -f
        ;;
    *)
        echo "Usage: $0 [all|dangling|volumes|cache]"
        exit 1
        ;;
esac

echo "✅ Nettoyage terminé!"
echo "📊 Espace disque Docker:"
docker system df