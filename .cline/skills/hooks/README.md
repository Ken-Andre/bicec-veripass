# 🪝 Hooks Cline - BICEC VeriPass

Hooks pour automatiser les tâches quotidiennes du projet.

## 📁 Structure

```
.cline/skills/hooks/
├── README.md           # Ce fichier
└── hs/                 # Hooks exécutables
    ├── start-dev-environment.sh
    ├── run-tests.sh
    ├── check-issues.sh
    └── clean-docker.sh
```

## 🚀 Installation

```bash
# Rendre tous les hooks exécutables
chmod +x .cline/skills/hooks/hs/*.sh
```

## 📋 Liste des Hooks

### 1. `start-dev-environment.sh`
Démarre tous les services Docker du projet.

```bash
# Utilisation
./start-dev-environment.sh

# Fonctionnalités
# - Vérifie que Docker est en cours d'exécution
# - Lance docker compose up -d
# - Vérifie les healthchecks (backend, mobile, backoffice)
```

### 2. `run-tests.sh`
Lance les tests backend et frontend.

```bash
# Tous les tests
./run-tests.sh all

# Tests backend uniquement
./run-tests.sh backend

# Tests frontend uniquement (mobile + backoffice)
./run-tests.sh frontend
```

### 3. `check-issues.sh`
Affiche les issues GitHub ouvertes.

```bash
# Issues du sprint actuel
./check-issues.sh sprint

# Issues critiques
./check-issues.sh critical

# Toutes les issues
./check-issues.sh all
```

### 4. `clean-docker.sh`
Nettoie les ressources Docker non utilisées.

```bash
# Images dangling uniquement (défaut)
./clean-docker.sh dangling

# Tout nettoyer
./clean-docker.sh all

# Volumes uniquement
./clean-docker.sh volumes

# Cache build uniquement
./clean-docker.sh cache
```

## 🎯 Utilisation avec Cline

Dans un chat Cline, vous pouvez demander :

- "Démarre l'environnement de dev"
- "Lance les tests"
- "Montre-moi les issues critiques"
- "Nettoie Docker"

Cline détectera le contexte et exécutera le hook approprié.

## 📝 Ajouter un Hook

1. Créer un fichier `.sh` dans `.cline/skills/hooks/hs/`
2. Rendre exécutable : `chmod +x nom-du-hook.sh`
3. Ajouter la documentation dans ce README

## 🔧 Conventions

- Noms de fichiers : `kebab-case.sh`
- Toujours inclure `#!/bin/bash`
- Toujours inclure la description et usage
- Utiliser `cd "$(dirname "$0")/../../.."` pour se placer à la racine du projet