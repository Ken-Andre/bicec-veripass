# Guide de Développement — Local → Docker

Ce document explique la stratégie de développement choisie et comment passer du développement local à la production Docker le moment venu.

## Pourquoi on développe en local d'abord

**Principe : avancer vite, sans friction de connexion réseau.**

Sur une connexion limitée, télécharger les images Docker (PostgreSQL, Redis, Nginx...) peut prendre 30 à 60 minutes. Et chaque modification de code nécessiterait un redémarrage de container. En développant en local, les changements sont instantanés.

**Docker arrive uniquement pour INFRA-05**, quand tout le code de base fonctionne.

---

## Configuration actuelle (Local)

| Service | Configuration locale |
|---|---|
| **PostgreSQL** | Installé sur Windows via pgAdmin4 |
| **Base de données** | `veripass` (créée localement) |
| **Utilisateur DB** | `postgres` (utilisateur par défaut Windows) |
| **Redis** | Mocké via `fakeredis` dans les tests — pas installé |
| **Fichier de config** | `code/backend/.env` |

### Fichier `.env` local
```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/veripass
REDIS_URL=redis://localhost:6379/0
```

---

## Configuration Docker (INFRA-05 — futur)

Conformément à l'architecture (§9), la configuration Docker utilisera :

| Service | Configuration Docker |
|---|---|
| **PostgreSQL** | Container `vp_postgres`, image `postgres:16-alpine` |
| **Base de données** | `veripass` (identique au local) |
| **Utilisateur DB** | `vp_user` (différent du local — créé via `init.sql`) |
| **Redis** | Container `vp_redis`, image `redis:7-alpine`, 256MB max |
| **Fichier de config** | `.env.docker` (à créer en INFRA-05) |

### Fichier `.env` Docker (à créer en INFRA-05)
```
DATABASE_URL=postgresql+asyncpg://vp_user:${DB_PASSWORD}@postgres:5432/veripass
REDIS_URL=redis://redis:6379/0
```

---

## Ce qu'il faudra faire lors de la migration (INFRA-05)

1. Créer le fichier `docker-compose.yml` (déjà défini dans l'architecture §9)
2. Créer `db/init.sql` pour créer l'utilisateur `vp_user` au démarrage
3. Créer `.env.docker` (ne jamais committer les mots de passe réels)
4. Tester avec `docker-compose up` que tout démarre
5. Vérifier que `alembic upgrade head` fonctionne dans le container

**Le code FastAPI ne change pas du tout** — seul l'environnement change.

---

## Commandes utiles

```bash
# Développement local (depuis code/backend/)
python -m uv run pytest tests/ -v      # Lancer les tests
python -m uv run alembic current       # Vérifier les migrations

# Futur Docker (INFRA-05)
docker-compose up -d                   # Démarrer tous les services
docker-compose logs -f api             # Voir les logs du serveur
```
