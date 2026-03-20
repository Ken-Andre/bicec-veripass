# Guide de Monitoring — BICEC VeriPass

Ce document explique comment surveiller et déboguer les services de la plateforme VeriPass en développement et production.

---

## Flower — Monitoring Celery

### Accès

Flower est un dashboard web temps réel pour surveiller les workers Celery, les tâches, et les queues.

**Accès direct :**
```
http://localhost:5555
```

**Via nginx (production) :**
```
https://localhost/flower/
```

**Authentification :**
- Username : `admin` (configurable via `FLOWER_USER` dans `.env`)
- Password : `admin` (configurable via `FLOWER_PASSWORD` dans `.env`)

### Fonctionnalités

- **Workers** : État des workers (actifs, inactifs), charge CPU/RAM
- **Tasks** : Liste des tâches en cours, réussies, échouées avec détails
- **Queues** : Nombre de tâches en attente par queue (`glm_ocr_jobs`, `notifications`, etc.)
- **Broker** : Stats Redis (connexions, mémoire)
- **Monitor** : Graphiques temps réel de throughput et latence

### Commandes utiles

Redémarrer Flower :
```bash
docker compose restart flower
```

Voir les logs Flower :
```bash
docker logs vp_flower --tail 50 -f
```

---

## RedisInsight — GUI Redis

### Installation

RedisInsight est l'outil officiel de Redis Labs pour inspecter et gérer Redis.

**Téléchargement :**
- Windows : [redis.io/insight](https://redis.io/insight/)
- Ou via Chocolatey : `choco install redis-insight`

### Configuration

1. Lancer RedisInsight
2. Ajouter une connexion :
   - **Host** : `localhost`
   - **Port** : `16379` (port mappé dans docker-compose)
   - **Name** : `VeriPass Redis`
   - **Username** : (laisser vide)
   - **Password** : (laisser vide)

### Fonctionnalités

- **Browser** : Naviguer dans les clés Redis (Hash, List, Set, Stream, JSON)
- **Workbench** : Exécuter des commandes Redis manuellement
- **Profiler** : Analyser les commandes lentes
- **Memory Analysis** : Voir la consommation mémoire par type de clé

### Clés importantes VeriPass

```
celery-task-meta-*          # Résultats des tâches Celery
_kombu.binding.*            # Queues Celery
session:*                   # Sessions utilisateurs
otp:*                       # Codes OTP temporaires
rate_limit:*                # Rate limiting API
```

---

## Alternative : ARDM (Another Redis Desktop Manager)

Si RedisInsight est trop lourd, ARDM est une alternative légère et open source.

**Installation :**
- GitHub : [github.com/qishibo/AnotherRedisDesktopManager](https://github.com/qishibo/AnotherRedisDesktopManager)
- Télécharger le `.exe` Windows depuis les releases

**Configuration :** Identique à RedisInsight (`localhost:16379`)

---

## Logs Docker

Tous les services utilisent le driver `json-file` avec rotation automatique (10MB max, 5 fichiers).

### Voir les logs d'un service

```bash
# API FastAPI
docker logs vp_api --tail 100 -f

# Celery OCR worker
docker logs vp_celery_ocr --tail 100 -f

# Celery notifications worker
docker logs vp_celery_notif --tail 100 -f

# Celery beat scheduler
docker logs vp_celery_beat --tail 100 -f

# Nginx (format JSON)
docker logs vp_nginx --tail 50 -f

# PostgreSQL
docker logs vp_postgres --tail 50 -f

# Redis
docker logs vp_redis --tail 50 -f
```

### Logs Nginx JSON

Les logs Nginx sont au format JSON structuré pour faciliter le parsing :

```json
{
  "time": "2026-03-19T14:30:45+00:00",
  "remote_addr": "172.18.0.1",
  "method": "POST",
  "uri": "/api/v1/kyc/upload",
  "status": 200,
  "bytes_sent": 1234,
  "request_time": 0.523,
  "upstream_addr": "172.18.0.5:8000"
}
```

---

## Healthchecks

Tous les services ont des healthchecks configurés. Vérifier l'état :

```bash
docker compose ps
```

Sortie attendue :
```
NAME              STATUS                    HEALTH
vp_api            Up 2 minutes              healthy
vp_celery_ocr     Up 2 minutes              healthy
vp_celery_notif   Up 2 minutes              healthy
vp_celery_beat    Up 2 minutes              healthy
vp_flower         Up 2 minutes              healthy
vp_nginx          Up 2 minutes              healthy
vp_postgres       Up 2 minutes              healthy
vp_redis          Up 2 minutes              healthy
vp_pwa            Up 2 minutes              healthy
vp_backoffice     Up 2 minutes              healthy
```

---

## Troubleshooting

### Flower ne démarre pas

Vérifier que `flower>=2.0` est dans `pyproject.toml` et rebuilder :
```bash
docker compose build flower
docker compose up -d flower
```

### RedisInsight ne se connecte pas

Vérifier que Redis est accessible depuis l'hôte :
```bash
redis-cli -h localhost -p 16379 ping
# Doit retourner : PONG
```

### 502 Bad Gateway après rebuild/recreate d'un service

**Cause :** Nginx résout le DNS de ses upstreams au démarrage et garde les IPs en cache. Quand un container est recréé (`docker compose build` + `up`), Docker lui assigne une nouvelle IP interne. Nginx continue de router vers l'ancienne IP → `Connection refused` → 502.

Tous les services proxiés par nginx sont concernés : `api`, `pwa`, `backoffice`, `flower`.

**Symptôme dans les logs nginx :**
```bash
docker logs vp_nginx --tail 20
```
```json
{"uri":"/api/v1/docs","status":502,"upstream_addr":"172.18.0.7:8000"}
```
L'IP `172.18.0.7` n'existe plus, la nouvelle est par exemple `172.18.0.9`.

**Fix :**
```bash
docker compose restart nginx
```

**Règle :** après chaque `docker compose up -d <service>` pour un service proxié par nginx, toujours redémarrer nginx pour re-résoudre le DNS.

---

### Celery worker bloqué

Inspecter les tâches actives via Flower ou CLI :
```bash
docker exec vp_celery_ocr celery -A app.celery inspect active
```

Redémarrer le worker :
```bash
docker compose restart celery_ocr
```

---

## Production

En production, remplacer Flower par une stack Prometheus + Grafana pour du monitoring long terme avec alerting.

**Ressources :**
- [Celery Prometheus Exporter](https://github.com/danihodovic/celery-exporter)
- [Grafana Dashboard Celery](https://grafana.com/grafana/dashboards/10026)
