# BICEC VeriPass

> **KYC souverain** — Transforme 14 jours d'onboarding manuel en 15 minutes de parcours numérique.
> 100% on-premise, zéro appel cloud, conforme COBAC (R-2019/01, R-2023/01).

> Transforme 14 jours d'onboarding KYC manuel en 15 minutes de parcours numérique souverain.

**Projet de Fin d'Études (PFE)** — Data/IA Engineering
**Client :** BICEC (Banque Internationale du Cameroun pour l'Épargne et le Crédit)
**Stack :** React/TypeScript PWA · FastAPI (Python 3.11) · PostgreSQL 16 · Redis · Celery · Docker Compose
| Stack | Versions |
|-------|----------|
| Frontend mobile | React 18 + TypeScript + Vite (PWA) |
| Frontend backoffice | React 18 + TypeScript + Vite (SPA) |
| Backend | Python 3.11 + FastAPI |
| Base de données | PostgreSQL 17 |
| Cache / Broker | Redis 7 |
| OCR | PaddleOCR v3 + GLM-OCR |
| Biométrie | DeepFace + MiniFASNet |
| Conteneurisation | Docker Compose + BuildKit |

---

## Architecture

```
bicec-veripass/
├── backend/          # FastAPI — API, OCR, biométrie, KYC state machine
├── mobile/           # PWA React/TypeScript — parcours onboarding mobile (Marie)
├── backoffice/       # SPA React/TypeScript — Jean, Thomas, Sylvie, Admin IT
├── infra/            # Nginx, Docker Compose, TLS, scripts infra
├── scripts/          # Utilitaires : seed, migrations, benchmarks, pruning
├── data/             # Volumes Docker (ignorés par git) : documents, modèles AI, DB
└── docs/             # Documentation, diagrammes, ADRs, DDL
```

1. Créer `%USERPROFILE%\.wslconfig` :
   ```ini
   [wsl2]
   memory=12GB
   processors=4
   localhostForwarding=true
   ```
2. Redémarrer WSL : `wsl --shutdown` puis relancer Docker Desktop
3. Vérifier : `wsl --list --verbose` → `Running`

---

## Démarrage rapide

### Prérequis
- Docker Desktop (WSL2 backend) · RAM ≥ 16 GB
- `.wslconfig` configuré (IMPORTANT pour éviter OOM en Sprint 2+) :
  1. Copier `infra/.wslconfig.template` → `C:\Users\<USERNAME>\.wslconfig`
  2. Éditer le fichier et remplacer `<USERNAME>` par votre nom d'utilisateur Windows
  3. Ajuster `processors` selon votre CPU (2-6 cores)
  4. Redémarrer WSL : `wsl --shutdown` puis relancer Docker Desktop
  5. Vérifier : `wsl --list --verbose` (État = Running)
  
  📖 Guide complet : `docs/setup-wsl2-windows.md`

### Lancement

```bash
# 1. Cloner et configurer
git clone https://github.com/BICEC/bicec-veripass.git
cd bicec-veripass
cp .env.example .env          # Remplir les valeurs

# 2. Démarrer la stack complète
docker compose up --build

# 3. Appliquer les migrations
docker compose exec fastapi alembic upgrade head

# 4. Seeder les données de démo
docker compose exec fastapi python scripts/seed_dev.py
```

### URLs (dev)

| Service | URL | Port host |
|---------|-----|-----------|
| **PWA mobile** (Marie) | http://localhost:3000 | 3000 |
| **Backoffice** (Jean, Thomas, Sylvie, Admin) | http://localhost:3001 | 3001 |
| **API REST** | http://localhost:8001 | 8001 |
| **Documentation API** | http://localhost:8001/docs | 8001 |
| **Flower** (monitoring Celery) | http://localhost:5555 | 5555 |
| **Mailpit** (emails dev) | http://localhost:8025 | 8025 |
| **PostgreSQL** | localhost:15432 | 15432 |
| **Redis** | localhost:16379 | 16379 |

### Comptes de démonstration

| Persona | Email | Rôle | Mot de passe (par défaut) |
|---------|-------|------|--------------------------|
| Jean Dupont | jean@bicec.cm | Validateur KYC | `password123` |
| Thomas Martin | thomas@bicec.cm | Superviseur AML | `password123` |
| Sylvie Bernard | sylvie@bicec.cm | Directrice Opérations | `password123` |
| Admin IT | admin@bicec.cm | Administrateur | `admin123` |

---

## Architecture des services

```
┌─────────┐     ┌──────────┐     ┌────────────┐
│  nginx  │────▶│   api    │────▶│ postgres   │
│ (proxy) │     │ (FastAPI)│     │ (DB 17)    │
└────┬────┘     └────┬─────┘     └────────────┘
     │               │
     │         ┌─────▼──────┐     ┌────────────┐
     │         │ celery_ocr  │────▶│  redis     │
     │         │ (GLM-OCR)   │     │ (broker)   │
     │         └────────────┘     └────────────┘
     │         ┌────────────┐
     ├────────▶│  pwa       │ (React SPA statique)
     │         └────────────┘
     │         ┌────────────┐
     └────────▶│ backoffice │ (React SPA statique)
               └────────────┘

Services additionnels :
• celery_notifications — envoi SMS/email asynchrone
• celery_beat — tâches planifiées (backup, sync sanctions)
• flower — monitoring Celery
• mailpit — capture emails en dev
```

---

## Variables d'environnement

Copier `.env.example` → `.env` et remplir toutes les valeurs.
**Ne jamais committer `.env`** (voir `.gitignore`).

### Chiffrement des .env

Le projet chiffre tous les fichiers `.env` avec [senv](https://github.com/DannyBen/senv) pour pouvoir versionner les secrets de façon sécurisée.

**Fichiers et leur statut Git :**
| Fichier | Git | Description |
|---------|-----|-------------|
| `.env` | ignoré | Secrets en clair — reste local |
| `.env.enc` | versionné | Version chiffrée — safe à committer |
| `.env.pass` | ignoré | Clé de chiffrement — jamais committée |
| `new.env` | ignoré | Sortie du déchiffrement — renommer en `.env` |
**Usage quotidien :**
```bash
# Chiffrer tous les .env du repo -> .env.enc
bash code/scripts/encrypt-all-envs.sh

# Déchiffrer tous les .env.enc -> new.env (sans écraser les .env existants)
bash code/scripts/decrypt-all-envs.sh
```

Les hooks Kiro automatisent le chiffrement : dès qu'un `.env` est sauvegardé, `encrypt-all-envs.sh` se déclenche. Le hook de déchiffrement est manuel (panneau "Agent Hooks" dans Kiro).

**Note sur l'avertissement "salt stored with encrypted data" :**

Certains scanners de sécurité signalent que `senv` embarque le salt/IV dans le fichier `.env.enc`. C'est un comportement **normal et intentionnel** pour les formats chiffrés (AES) — le salt n'est pas secret, il garantit simplement l'unicité de chaque chiffrement. Ce n'est pas la clé de chiffrement.

La sécurité repose sur la séparation :
- `.env.enc` (salt + données chiffrées) → dans Git, lisible par tous les collaborateurs
- `.env.pass` (clé réelle) → hors Git, partagée hors-bande (ex: gestionnaire de mots de passe d'équipe)

Pour la **production**, remplacer `.env.pass` par une variable d'environnement `DOTENV_PASS` injectée via GitHub Actions Secrets, AWS Secrets Manager ou HashiCorp Vault.

---

## Migrations

```bash
# Appliquer toutes les migrations
alembic upgrade head

# Créer une nouvelle migration
alembic revision --autogenerate -m "description"

# Rollback
alembic downgrade -1
```

---

## Tests

```bash
# Backend (pytest)
docker compose exec fastapi pytest --cov=app tests/

# Frontend (vitest)
cd mobile ; bun run test

# E2E (Playwright)
cd mobile ; bunx playwright test
```

---

## Conventions

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les conventions de commits, branches et revues de code.

---

## Conformité

- **COBAC R-2019/01, R-2023/01** — KYC/AML banques CEMAC
- **Loi 2024-017** — Protection des données personnelles (Cameroun)
- **Souveraineté totale** — 100% on-premise, aucun appel IA externe

---

## Déploiement avec images pré-buildées

Si vous disposez de l'archive `veripass-images.tar` fournie par un membre de l'équipe (images Docker déjà buildées pour éviter de tout recompiler) :

```bash
# 1. Charger toutes les images
docker load -i veripass-images.tar

# 2. Configurer l'environnement
cp .env.example .env
# Éditer .env — changer DB_PASSWORD, JWT_SECRET, AES_SECRET_KEY...

# 3. Lancer la stack
docker compose up -d

# 4. Vérifier
docker compose ps
# Attendre que tous les services soient "healthy"
```

> **Note :** Les images pré-buildées contiennent : `code-api`, `code-pwa`, `code-backoffice`, `code-nginx`, `postgres:17-bookworm`, `redis:7-bookworm`, `mher/flower:2.0`, `axllent/mailpit:latest`, `nginxinc/nginx-unprivileged:1.27-alpine`.  
> Les migrations Alembic et les seed data s'appliquent automatiquement au démarrage.

---

## Backup mensuel des images Docker

Un script est disponible pour sauvegarder toutes les images Docker du projet :

```bash
# Linux / macOS / WSL
bash code/scripts/backup-docker-images.sh

# Windows PowerShell
powershell -File code/scripts/backup-docker-images.ps1
```

Le script :
- Sauvegarde toutes les images du `docker-compose.yml` dans `backups/docker-images/`
- Nomme le fichier avec la date : `veripass-images-2026-05-17.tar.gz`
- Supprime automatiquement les backups de plus de 90 jours

### Automatisation mensuelle

**Linux / WSL (cron) :**
```bash
crontab -e
# Ajouter (1er jour du mois à 2h du matin) :
0 2 1 * * /chemin/vers/code/scripts/backup-docker-images.sh
```

**Windows (Task Scheduler) :**
```
1. Ouvrir "Task Scheduler"
2. Créer une tâche → Déclencheur : mensuel, 1er jour
3. Action : démarrer powershell.exe
4. Argument : -File "C:\chemin\vers\code\scripts\backup-docker-images.ps1"
```
