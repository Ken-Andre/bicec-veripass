# Changelog — Scripts

## [1.0.0] - 2026-03-19

### Added

#### Docker Disk Space Management
- `docker_prune.sh` — Script bash pour Linux/macOS avec :
  - Surveillance du taux d'utilisation disque
  - Seuil configurable (défaut : 85%)
  - Nettoyage automatique des ressources Docker
  - Mode dry-run pour prévisualisation
  - Logging détaillé avec timestamps
  - Support des variables d'environnement
  
- `docker_prune.ps1` — Script PowerShell pour Windows avec :
  - Fonctionnalités identiques au script bash
  - Gestion native des chemins Windows
  - Logs dans `../logs/docker_prune.log`
  
- `setup-cron.sh` — Installation automatique du cron job (Linux/macOS)
- `setup-task-scheduler.ps1` — Installation automatique de la tâche planifiée (Windows)

#### Documentation
- `README.md` — Documentation complète d'utilisation
- `MONITORING.md` — Guide de monitoring et optimisation Docker
- `.env.example` — Configuration exemple
- `.gitignore` — Exclusion des logs et .env

#### Tests
- `test-docker-prune.sh` — Suite de tests bash
- `test-docker-prune.ps1` — Suite de tests PowerShell

### Features

- ✅ Nettoyage automatique basé sur seuil
- ✅ Support multi-plateforme (Linux/macOS/Windows)
- ✅ Mode dry-run pour prévisualisation
- ✅ Logging avec rotation automatique
- ✅ Configuration via variables d'environnement
- ✅ Installation automatique des tâches planifiées
- ✅ Tests automatisés
- ✅ Documentation complète

### Configuration

| Variable | Défaut | Description |
|----------|--------|-------------|
| `DOCKER_PRUNE_THRESHOLD` | 85 | Seuil d'utilisation disque (%) |
| `DOCKER_PRUNE_LOG` | `/var/log/docker_prune.log` | Chemin du fichier de log |

### Usage

```bash
# Linux/macOS
./docker_prune.sh --dry-run
./docker_prune.sh --force --threshold=90

# Windows
.\docker_prune.ps1 -DryRun
.\docker_prune.ps1 -Force -Threshold 90
```

### Automation

- **Linux/macOS** : Cron job quotidien à 2h00
- **Windows** : Task Scheduler quotidien à 2h00

### Metrics

Le script nettoie :
- Conteneurs arrêtés
- Images dangereuses (dangling)
- Réseaux non utilisés
- Volumes non utilisés
- Cache de build

Gain d'espace typique : 5-15% du disque Docker
