# Scripts — BICEC VeriPass

Ce dossier contient les scripts utilitaires pour la maintenance et l'administration du projet.

## docker_prune.sh / docker_prune.ps1

Scripts de gestion automatique de l'espace disque Docker.

### Fonctionnalités

- Surveillance du taux d'utilisation du disque
- Nettoyage automatique des ressources Docker inutilisées :
  - Conteneurs arrêtés
  - Images dangereuses (dangling)
  - Réseaux non utilisés
  - Volumes non utilisés
  - Cache de build
- Seuil configurable (par défaut : 85%)
- Mode dry-run pour prévisualiser les actions
- Logging détaillé

### Usage

#### Linux/macOS (bash)

```bash
# Exécution manuelle avec confirmation
./docker_prune.sh

# Exécution forcée sans confirmation
./docker_prune.sh --force

# Définir un seuil personnalisé
./docker_prune.sh --threshold=90

# Mode dry-run (prévisualisation)
./docker_prune.sh --dry-run

# Aide
./docker_prune.sh --help
```

#### Windows (PowerShell)

```powershell
# Exécution manuelle avec confirmation
.\docker_prune.ps1

# Exécution forcée sans confirmation
.\docker_prune.ps1 -Force

# Définir un seuil personnalisé
.\docker_prune.ps1 -Threshold 90

# Mode dry-run (prévisualisation)
.\docker_prune.ps1 -DryRun
```

### Configuration automatique

#### Linux/macOS — Cron Job

Ajouter au crontab (`crontab -e`) :

```bash
# Exécution quotidienne à 2h du matin
0 2 * * * /path/to/bicec-veripass/code/scripts/docker_prune.sh --force >> /var/log/docker_prune.log 2>&1
```

Ou utiliser les variables d'environnement :

```bash
# Avec seuil personnalisé
0 2 * * * DOCKER_PRUNE_THRESHOLD=90 /path/to/bicec-veripass/code/scripts/docker_prune.sh --force
```

#### Windows — Task Scheduler

1. Ouvrir le Planificateur de tâches (Task Scheduler)
2. Créer une tâche de base :
   - **Nom** : Docker Prune VeriPass
   - **Déclencheur** : Quotidien à 2h00
   - **Action** : Démarrer un programme
     - **Programme** : `powershell.exe`
     - **Arguments** : `-ExecutionPolicy Bypass -File "C:\path\to\bicec-veripass\code\scripts\docker_prune.ps1" -Force`
   - **Conditions** : Décocher "Démarrer uniquement si l'ordinateur est branché"
3. Propriétés avancées :
   - Exécuter avec les privilèges les plus élevés
   - Configurer pour : Windows 10/11

### Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DOCKER_PRUNE_THRESHOLD` | Seuil d'utilisation disque (%) | 85 |
| `DOCKER_PRUNE_LOG` | Chemin du fichier de log | `/var/log/docker_prune.log` (Linux)<br>`../logs/docker_prune.log` (Windows) |

### Logs

Les logs sont écrits dans :
- **Linux/macOS** : `/var/log/docker_prune.log` (ou chemin personnalisé)
- **Windows** : `code/logs/docker_prune.log`

Format des logs :
```
2026-03-19 02:00:01 [INFO] ========== Docker Prune Script Started ==========
2026-03-19 02:00:02 [INFO] Current disk usage: 87%
2026-03-19 02:00:02 [WARN] Disk usage (87%) exceeds threshold (85%)
2026-03-19 02:00:03 [INFO] Starting Docker cleanup (disk usage: 87%)
2026-03-19 02:00:05 [INFO] Removing stopped containers...
2026-03-19 02:00:07 [INFO] Docker cleanup completed
2026-03-19 02:00:08 [INFO] Cleanup complete. Freed 12% disk space
2026-03-19 02:00:08 [INFO] New disk usage: 75%
2026-03-19 02:00:09 [INFO] ========== Docker Prune Script Finished ==========
```

### Sécurité

⚠️ **Attention** : Le nettoyage des volumes (`docker volume prune`) peut supprimer des données persistantes non utilisées. Assurez-vous que vos volumes importants sont correctement référencés dans `docker-compose.yml`.

Les volumes suivants sont protégés (utilisés par le projet) :
- `db_storage` (PostgreSQL)
- `redis_storage` (Redis)
- `document_storage` (Documents KYC)

### Dépannage

#### "Docker is not running"
- Vérifier que Docker Desktop est démarré
- Vérifier les permissions : `sudo usermod -aG docker $USER` (Linux)

#### "Permission denied"
- Linux : `chmod +x docker_prune.sh`
- Windows : Exécuter PowerShell en tant qu'administrateur

#### Le script ne nettoie rien
- Vérifier le seuil avec `--threshold=50` pour forcer le nettoyage
- Utiliser `--dry-run` pour voir ce qui serait nettoyé
- Vérifier les logs pour les erreurs

### Monitoring

Pour surveiller l'espace disque Docker en temps réel :

```bash
# Linux/macOS
watch -n 5 docker system df

# Windows
while ($true) { Clear-Host; docker system df; Start-Sleep -Seconds 5 }
```

### Maintenance manuelle

Si le script automatique ne suffit pas :

```bash
# Nettoyage complet (⚠️ supprime TOUT ce qui n'est pas utilisé)
docker system prune -a --volumes -f

# Nettoyage sélectif
docker container prune -f  # Conteneurs arrêtés
docker image prune -a -f   # Images non utilisées
docker volume prune -f     # Volumes non utilisés
docker network prune -f    # Réseaux non utilisés
docker builder prune -a -f # Cache de build
```

## Autres scripts

_(À compléter au fur et à mesure de l'ajout de nouveaux scripts)_
