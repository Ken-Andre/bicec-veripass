#!/bin/bash
# Hook: start-dev-environment
# Description: Démarre tous les services Docker du projet
# Usage: ./start-dev-environment.sh

echo "🚀 Démarrage de l'environnement de développement BICEC VeriPass..."

cd "$(dirname "$0")/../../.." || exit 1

# Vérifier que Docker est en cours d'exécution
if ! docker info &> /dev/null; then
    echo "❌ Docker n'est pas en cours d'exécution. Démarrage de Docker..."
    # Commande pour démarrer Docker selon l'OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open -a Docker
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo systemctl start docker
    fi
    sleep 5
fi

# Démarrer les services
echo "📦 Lancement des containers..."
docker compose up -d

# Vérifier les healthchecks
echo "🔍 Vérification des services..."
sleep 10

# Backend
curl -f http://localhost:8000/health > /dev/null 2>&1 && echo "✅ Backend OK" || echo "❌ Backend échoué"

# Mobile
curl -f http://localhost:3000 > /dev/null 2>&1 && echo "✅ Mobile OK" || echo "❌ Mobile échoué"

# Backoffice
curl -f http://localhost:3001 > /dev/null 2>&1 && echo "✅ Backoffice OK" || echo "❌ Backoffice échoué"

echo "🎯 Environnement prêt!"