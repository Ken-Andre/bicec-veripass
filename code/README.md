# BICEC VeriPass — Plateforme KYC Souveraine

> Transforme 14 jours d'onboarding KYC manuel en 15 minutes de parcours numérique souverain.

**Projet de Fin d'Études (PFE)** — Data/IA Engineering
**Client :** BICEC (Banque Internationale du Cameroun pour l'Épargne et le Crédit)
**Stack :** React/TypeScript PWA · FastAPI (Python 3.11) · PostgreSQL 16 · Redis · Celery · Docker Compose

---

## Architecture

```
bicec-veripass/
├── backend/          # FastAPI — API, OCR, biométrie, KYC state machine
├── frontend/         # PWA React/TypeScript — parcours onboarding mobile (Marie)
├── backoffice/       # SPA React/TypeScript — Jean, Thomas, Sylvie, Admin IT
├── infra/            # Nginx, Docker Compose, TLS, scripts infra
├── scripts/          # Utilitaires : seed, migrations, benchmarks, pruning
├── data/             # Volumes Docker (ignorés par git) : documents, modèles AI, DB
└── docs/             # Documentation, diagrammes, ADRs, DDL
```

**Personas back-office :**
- **Jean** — Validateur KYC (Validation Desk)
- **Thomas** — Superviseur AML/CFT (conformité nationale)
- **Sylvie** — Directrice opérationnelle (Command Center)
- **Admin IT** — Administrateur système (lifecycle agents, config)

---

## Démarrage rapide

### Prérequis
- Docker Desktop (WSL2 backend) · RAM ≥ 16 GB
- `.wslconfig` configuré (voir `infra/.wslconfig.template`)

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
| Service | URL |
|---------|-----|
| PWA (Marie) | https://localhost:3000 |
| Back-Office | https://localhost:3001 |
| API FastAPI | https://localhost:8000/docs |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

---

## Variables d'environnement

Copier `.env.example` → `.env` et remplir toutes les valeurs.
**Ne jamais committer `.env`** (voir `.gitignore`).

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
cd frontend && npm run test

# E2E (Playwright)
cd frontend && npx playwright test
```

---

## Conventions

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les conventions de commits, branches et revues de code.

---

## Conformité

- **COBAC R-2019/01, R-2023/01** — KYC/AML banques CEMAC
- **Loi 2024-017** — Protection des données personnelles (Cameroun)
- **Souveraineté totale** — 100% on-premise, aucun appel IA externe
