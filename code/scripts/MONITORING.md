# Monitoring Docker — BICEC VeriPass

Guide de surveillance et d'optimisation de l'espace disque Docker.

## Commandes de monitoring

### Espace disque global

```bash
# Vue d'ensemble
docker system df

# Vue détaillée
docker system df -v
```

### Par type de ressource

```bash
# Images
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# Conteneurs
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Size}}"

# Volumes
docker volume ls
docker volume inspect <volume_name>

# Build cache
docker builder du
```

## Métriques importantes

### Seuils recommandés

| Métrique | Seuil Warning | Seuil Critical | Action |
|----------|---------------|----------------|--------|
| Disk usage | 75% | 85% | Prune automatique |
| Images reclaimable | > 50% | > 70% | Prune images |
| Build cache | > 5 GB | > 10 GB | Prune cache |
| Stopped containers | > 10 | > 20 | Prune containers |

### Commandes de nettoyage ciblé

```bash
# Images non utilisées (pas seulement dangling)
docker image prune -a -f

# Conteneurs arrêtés depuis plus de 24h
docker container prune --filter "until=24h" -f

# Build cache de plus de 7 jours
docker builder prune --filter "until=168h" -f

# Tout nettoyer hors volumes persistants
docker system prune -a -f
```

## Logs et alertes

### Vérifier les logs du script

```bash
# Linux/macOS
tail -f /var/log/docker_prune.log

# Windows
Get-Content C:\path\to\code\logs\docker_prune.log -Tail 50 -Wait
```

### Alertes par email (Linux)

Ajouter au crontab :

```bash
0 2 * * * /path/to/docker_prune.sh --force 2>&1 | mail -s "Docker Prune Report" admin@bicec.cm
```

### Alertes Slack/Teams (webhook)

Modifier `docker_prune.sh` pour ajouter :

```bash
# Après le nettoyage
if [ "$freed" -gt 10 ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"Docker cleanup freed ${freed}% disk space\"}" \
        $SLACK_WEBHOOK_URL
fi
```

## Optimisations

### Réduire la taille des images

```dockerfile
# Utiliser Alpine au lieu de Debian
FROM python:3.11-alpine

# Multi-stage builds
FROM node:18 AS builder
# ... build steps
FROM node:18-alpine
COPY --from=builder /app/dist /app/dist

# Nettoyer les caches
RUN apt-get clean && rm -rf /var/lib/apt/lists/*
```

### Limiter le build cache

```bash
# Limiter la taille du cache
docker builder prune --keep-storage 5GB -f
```

### Volumes nommés vs bind mounts

Préférer les volumes nommés (gérés par Docker) :

```yaml
volumes:
  db_storage:  # Volume nommé (géré)
    external: true
    name: ${VP_DB_VOLUME_NAME:-code_db_storage}

services:
  postgres:
    volumes:
      - db_storage:/var/lib/postgresql/data  # ✓ Bon
      # - ./data/db:/var/lib/postgresql/data  # ✗ Bind mount
```

## Troubleshooting

### "No space left on device"

```bash
# 1. Vérifier l'espace disque
df -h

# 2. Identifier les gros consommateurs
docker system df -v | sort -k3 -h

# 3. Nettoyage d'urgence hors volumes persistants
docker system prune -a -f

# 4. Redémarrer Docker
sudo systemctl restart docker  # Linux
# ou redémarrer Docker Desktop
```

### Images "dangling" qui reviennent

Causé par des builds fréquents. Solutions :

```bash
# 1. Utiliser --rm dans docker build
docker build --rm -t myimage .

# 2. Nettoyer après chaque build
docker image prune -f

# 3. Utiliser BuildKit avec cache externe
DOCKER_BUILDKIT=1 docker build --cache-from=myimage:latest .
```

### Volumes orphelins

```bash
# Lister les volumes orphelins
docker volume ls -qf dangling=true

# Ne pas supprimer automatiquement les volumes: verifier manuellement
# chaque volume orphelin avant une suppression explicite.
docker volume ls
```

## Dashboard de monitoring (optionnel)

### Prometheus + Grafana

```yaml
# docker-compose.monitoring.yml
services:
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    ports:
      - 8080:8080

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - 9090:9090

  grafana:
    image: grafana/grafana:latest
    ports:
      - 3002:3000
```

### Métriques Docker natives

```bash
# Activer les métriques Docker
# /etc/docker/daemon.json
{
  "metrics-addr": "127.0.0.1:9323",
  "experimental": true
}

# Redémarrer Docker
sudo systemctl restart docker

# Accéder aux métriques
curl http://localhost:9323/metrics
```

## Bonnes pratiques

1. **Automatiser le nettoyage** : Cron/Task Scheduler quotidien
2. **Monitorer régulièrement** : Vérifier `docker system df` chaque semaine
3. **Limiter les layers** : Combiner les RUN dans les Dockerfiles
4. **Utiliser .dockerignore** : Éviter de copier des fichiers inutiles
5. **Nettoyer les images de dev** : Ne garder que les tags de prod
6. **Documenter les volumes** : Savoir lesquels sont critiques
7. **Tester les restaurations** : Vérifier que les backups fonctionnent

## Ressources

- [Docker System Prune](https://docs.docker.com/engine/reference/commandline/system_prune/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Dockerfile Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
