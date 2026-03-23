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
├── mobile/           # PWA React/TypeScript — parcours onboarding mobile (Marie)
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
cd mobile && npm run test

# E2E (Playwright)
cd mobile && npx playwright test
```

---

## Conventions

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les conventions de commits, branches et revues de code.

---

## Conformité

- **COBAC R-2019/01, R-2023/01** — KYC/AML banques CEMAC
- **Loi 2024-017** — Protection des données personnelles (Cameroun)
- **Souveraineté totale** — 100% on-premise, aucun appel IA externe
