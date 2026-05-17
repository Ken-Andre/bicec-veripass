# Guide de Depannage - Environnement de Developpement

## Erreurs Rencontrees et Solutions

---

### Erreur 1 : Migration Alembic echoue — `UniqueViolationError` sur `kyc_sessions(user_id)`

**Symptome :**
```
sqlalchemy.exc.IntegrityError: could not create unique index "uq_kyc_session_active_per_user"
DETAIL:  Key (user_id)=(5a9f4398-20da-46a9-89a9-ef6e23ca9cc3) is duplicated.
```

Le container `vp_api` boucle en redemarrage car la migration `c529536aee7b` echoue.

**Cause :**
La migration cree un index partiel unique `uq_kyc_session_active_per_user` sur `kyc_sessions(user_id) WHERE status IN ('DRAFT', 'PENDING_INFO')`. Mais en base, un meme utilisateur a plusieurs sessions KYC actives (statut DRAFT ou PENDING_INFO), ce qui viole la contrainte d'unicite.

Ces doublons surviennent quand un utilisateur reset son parcours KYC ou abandonne en cours de route — l'ancienne session DRAFT n'est pas fermee avant d'en creer une nouvelle.

**Solution appliquee :**
Ajouter une etape de deduplication **avant** le `CREATE UNIQUE INDEX` dans la migration. Garder la session la plus recente (par `started_at`), metter les autres a `ABANDONED`.

**Fichier :** `code/backend/alembic/versions/c529536aee7b_add_unique_constraint_active_kyc_session.py`

```python
op.execute("""
    UPDATE kyc_sessions
    SET status = 'ABANDONED'
    WHERE id IN (
        SELECT id FROM (
            SELECT id,
                ROW_NUMBER() OVER (
                    PARTITION BY user_id
                    ORDER BY started_at DESC
                ) AS rn
            FROM kyc_sessions
            WHERE status IN ('DRAFT', 'PENDING_INFO')
        ) AS ranked
        WHERE rn > 1
    )
""")
op.execute("""
    CREATE UNIQUE INDEX uq_kyc_session_active_per_user 
    ON kyc_sessions (user_id) 
    WHERE status IN ('DRAFT', 'PENDING_INFO')
""")
```

**Pour re-generer la migration (si besoin de repartir de zero) :**
```bash
docker compose run --rm api alembic downgrade 022_ocr_status
docker compose run --rm api alembic upgrade c529536aee7b
```

---

### Erreur 2 : OTP email jamais recu — `OTP_MODE=email` ignore

**Symptome :**
- Dans `.env` : `OTP_MODE=email`
- Les logs Celery montrent :
  ```
  DEMO MODE: SMS Simulation to +237690000000: VeriPass : Votre code...
  OTP successfully sent to +237690000000 via SMS
  ```
- Aucun email n'arrive dans Mailpit (http://localhost:8025)
- Mailpit est bien lance, accessible sur le port 8025

**Cause :**
La fonction `_send_otp_flow()` dans `tasks.py` n'a que deux branches :
1. `OTP_MODE == "dev_local"` → log only
2. **Tout autre mode** → tente SMS d'abord (via Orange API)

Quand `OTP_MODE=email`, le code tombe dans la branche SMS. Les identifiants Orange sont vides (`ORANGE_SMS_CLIENT_ID=`), donc le client SMS active son **mode demo** et retourne `True` immediatement sans envoyer. L'email (fallback) n'est jamais atteint car le SMS a "reussi".

**Solution appliquee :**
Ajouter une branche `OTP_MODE == "email"` dediee dans `_send_otp_flow()`, placee **apres** le check `dev_local` et **avant** la tentative SMS :

**Fichier :** `code/backend/app/modules/auth/tasks.py` (vers ligne 49)

```python
# 1b. Email-only mode — skip SMS entirely
if settings.OTP_MODE == "email":
    target_email = email
    if not target_email and settings.ENVIRONMENT != "production" and settings.OTP_FALLBACK_EMAIL:
        target_email = settings.OTP_FALLBACK_EMAIL_ADDRESS or None
    if not target_email:
        logger.error(f"OTP_MODE=email but no email address provided for {phone}")
        raise RuntimeError(
            f"OTP_MODE=email but no email address available for {phone}."
        )
    email_sent = await email_client.send_email(
        to_email=target_email, subject="VeriPass Verification Code", content=message
    )
    if email_sent:
        logger.info(f"OTP successfully sent to {target_email} via email")
        return True
    raise RuntimeError(
        f"Critical: Failed to send OTP to {target_email} via email (email-only mode)."
    )
```

**Verification :**
```bash
docker compose logs celery_notifications --tail 20
# Doit montrer : "OTP successfully sent to xxx@email.com via email"
```

---

### Erreur 3 : OTP expire → page blanche ou 404 "Page introuvable"

**Symptome :**
1. L'utilisateur entre un OTP expire
2. Le message d'erreur "Code invalide ou expire" s'affiche correctement
3. Puis la page se redirige vers `https://localhost/mobile/auth/login` qui affiche :
   ```
   404
   Page introuvable.
   Retour à l'accueil
   ```
4. Aucune requete reseau echouee dans la console navigateur

**Cause :**
Le backend renvoie un statut **HTTP 401** quand l'OTP est expire (`router.py` ligne 233) :
```python
raise HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="OTP has expired",
)
```

Le `handleResponse()` dans `apiClient.ts` intercepte les 401 et declenche le handler `_onSessionExpired()` qui :
1. Appelle `logout()` (supprime `vp_token`, `vp_user` du localStorage)
2. Redirige via `window.location.href = '/mobile/auth/login'`

Or la route `/auth/login` **n'existe pas** dans le routeur React (`App.tsx`). Le catch-all `*` la capture et affiche `<NotFoundPage />`.

**Solution appliquee :**
Changer la cible de redirection dans `AuthContext.tsx` :

**Fichier :** `code/mobile/src/contexts/AuthContext.tsx` ligne 97

```diff
- window.location.href = '/mobile/auth/login';
+ window.location.href = '/mobile/auth/phone';
```

`/auth/phone` est l'ecran de saisie du telephone (point d'entree du login).

**Routes auth valides (verifier avant d'ajouter une nouvelle route) :**

| Route | Ecran |
|---|---|
| `/auth/phone` | Saisie telephone |
| `/auth/otp` | Saisie OTP |
| `/auth/email` | Saisie email (signup) |
| `/auth/email-otp` | OTP email (signup) |
| `/auth/pin-setup` | Creation PIN |
| `/auth/pin-login` | Saisie PIN |
| `/auth/biometric` | Opt-in biometric |
| `/auth/progress` | Timeline KYC |
| `/auth/lock` | Ecran verrouillage |
| `/auth/forgot-pin` | Mot de passe oublie |

---

### Erreur 4 : Build PWA echoue — Erreurs TypeScript

#### 4a. Cle dupliquee dans les traductions

**Symptome :**
```
src/contexts/LanguageContext.translations.ts(305,5): error TS1117:
An object literal cannot have multiple properties with the same name.
```

**Cause :**
La cle `'ocr.processing.subtitle'` apparaissait deux fois dans l'objet de traductions :
- Ligne 76 : `{ fr: 'Nous avons lu votre document. Veuillez corriger si besoin.', en: 'We read your document...' }` (dans la section "KYC OCR Review")
- Ligne 305 : `{ fr: 'Extraction automatique des informations en cours...', en: 'Automatic information extraction...' }` (dans la section "OCR Processing")

**Solution :**
Supprimer la ligne 76 — la valeur de la ligne 305 est celle utilisee en production (la derniere declaration gagne dans un objet JS). L'ecran de review a deja sa propre cle `'ocr.review.subtitle'`.

**Fichier :** `code/mobile/src/contexts/LanguageContext.translations.ts` ligne 76

#### 4b. Imports inutilises

**Symptome :**
```
src/views/auth/ProgressTimelineScreen.tsx(5,10): error TS6133: 'Camera' is declared but its value is never read.
src/views/auth/ProgressTimelineScreen.tsx(5,18): error TS6133: 'MapPin' is declared but its value is never read.
src/views/auth/ProgressTimelineScreen.tsx(5,26): error TS6133: 'FileText' is declared but its value is never read.
src/views/auth/ProgressTimelineScreen.tsx(5,36): error TS6133: 'PenLine' is declared but its value is never read.
```

**Cause :**
L'import depuis `lucide-react` incluait 4 icones non utilisees. `tsc -b` (mode strict) emet une erreur pour chaque declaration inutilisee.

**Solution :**
Nettoyer l'import :

```diff
- import { Camera, MapPin, FileText, PenLine, ArrowRight, Clock } from 'lucide-react';
+ import { ArrowRight, Clock } from 'lucide-react';
```

**Fichier :** `code/mobile/src/views/auth/ProgressTimelineScreen.tsx` ligne 5

---

## Annexe : Commandes de diagnostic rapide

```powershell
# Logs Celery notification worker
docker compose logs celery_notifications --tail 50

# Logs API
docker compose logs api --tail 50

# Logs Mailpit
docker compose logs mailpit --tail 50

# Tester l'envoi d'OTP (remplacer le phone)
curl -X POST https://localhost/api/v1/auth/otp/send `
  -H "Content-Type: application/json" `
  -d '{"phone": "+237690000000", "mode": "login"}' `
  -k

# Voir les emails dans Mailpit
curl http://localhost:8025/api/v1/messages

# Rebuild + restart PWA
docker compose up --build -d pwa

# Rebuild + restart API + Celery
docker compose up --build -d api celery_notifications
```

---

### Erreur 5 : Agent Antigravity echoue silencieusement — `worktreeconfig` Git

**Symptomes :**
- L'agent demarre puis se termine immediatement sans message clair
- Erreur : `core.repositoryformatversion does not support extension: worktreeconfig`
- Erreur : `workspace infos is nil`
- Erreur : `GetAgentScripts ... worktreeconfig`
- Les prompts echouent ou l'agent ne repond pas

**Cause :**
Le depot a ete utilise avec des Git worktrees lies (`git worktree add`). Meme apres suppression des worktrees, la configuration Git locale conserve :

```ini
[extensions]
    worktreeConfig = true
```

Certains IDE et outils d'agents AI ne gerent pas cette extension et echouent silencieusement.

**Solution :**

**1. Verifier les worktrees existants :**
```powershell
git worktree list
```

Si des worktrees lies existent et ne sont plus necessaires, les supprimer :
```powershell
git worktree remove --force "C:\chemin\vers\ancien-worktree"
git worktree prune -v
git worktree list
```

**2. Supprimer la configuration `worktreeconfig` obsolete :**
```powershell
git config --local --unset-all extensions.worktreeconfig
git config --local core.repositoryformatversion 0
```

**3. Verifier la correction :**
```powershell
git config --local --get core.repositoryformatversion
git config --local --get extensions.worktreeconfig
git worktree list
```

Resultat attendu :
- `core.repositoryformatversion` retourne `0`
- `extensions.worktreeconfig` ne retourne rien
- seul le worktree principal du depot apparait

**4. Redemarrer l'agent :**
Fermer completement Antigravity, rouvrir le depot, et retester avec une invite simple.

**Fichier concerne :** Configuration Git locale (`.git/config` du depot)

**Verification alternative :**
```powershell
git rev-parse --git-dir
Get-Content .git\config
git config --local --list --show-origin
```

---

### Docker Build Cache — rebuild sans re-téléchargement

#### Principe

Docker BuildKit a **deux mécanismes de cache indépendants** :

| Mécanisme | Ce qu'il cache | Effacé par |
|---|---|---|
| **Layer cache** | Résultat de chaque instruction Dockerfile | `--no-cache`, `docker builder prune` |
| **Cache mounts** (`--mount=type=cache`) | Dossier persistant entre les builds (ex:uv, bun, apt) | `docker builder prune` uniquement |

`--no-cache` vide la layer cache mais **pas** les cache mounts. Conséquence : on peut faire un rebuild propre ("peau neuve") sans re-télécharger les gros paquets.

#### État des cache mounts dans le projet

| Service | Outil | Cache mount target | Ligne Dockerfile |
|---|---|---|---|
| api, celery_* | uv | `/root/.cache/uv` | backend/Dockerfile:27 |
| pwa | bun | `/root/.bun/install/cache` | mobile/Dockerfile:10 |
| backoffice | bun | `/root/.bun/install/cache` | backoffice/Dockerfile:10 |

#### Commandes

```bash
# Rebuild routine (code changé, pas de re-téléchargement)
docker compose build api pwa backoffice

# Rebuild peau neuve SANS re-télécharger
docker compose build --no-cache api pwa backoffice

# Rebuild + restart propre
docker compose down && docker compose up -d --build api
```

#### Prune sans vider les cache mounts

`docker builder prune` vide les cache mounts. Pour les préserver :

```bash
# Pruner tout SAUF les cache mounts
docker builder prune --filter type=exec.cachemount

# Ou conserver au moins X Go de cache
docker builder prune --keep-storage 10g
```

#### bun.lock — quel service ?

- `code/mobile/bun.lock` → service **pwa**
- `code/backoffice/bun.lock` → service **backoffice**
- `bun.lock` root → **pas utilisé par Docker**

#### uv (Python) — mise à jour des dépendances

```bash
# 1. Modifier pyproject.toml
# 2. Recalculer le lockfile
cd code/backend
uv lock            # après changements dans pyproject.toml
uv lock --upgrade  # force la montée de version de toutes les deps

# 3. Rebuild
docker compose build api celery_ocr celery_notifications celery_beat
```

#### Alembic — erreurs fréquentes au rebuild

L'entrypoint (`entrypoint.sh`) lance `alembic upgrade head` à chaque démarrage de l'API. Les workers ont `SKIP_MIGRATIONS=1`.

- **Piège** : ancien container encore vivant pendant que le nouveau lance les migrations → conflit de lock sur `alembic_version`
- **Rebuild safe** : `docker compose down && docker compose up -d --build api`
- **Diagnostic** : `docker compose logs api | grep -i alembic`

---

### Alembic — mécanisme complet de A à Z

#### Chaîne de migrations (18 fichiers, 1 merge point)

```
d6e8c2e05497 (initial — crée toutes les tables)
│
├─→ 011_address_niu → 012_aml → 013_dwh
│                       └─→ a1b2c3d4e5f6 (OTP)
│                           └─→ 014_merge_heads ◄ fusionne les deux branches
│
└─→ 015_token_revocations → 016_drop_orphan_consents
    → 017_drop_orphan_sanctions → 018_agent_lockout_fields
    → 019_aml_gatekeeper → 50a7fe83564e → 60b8fe84565f
    → 020_add_client_name → 021_banking → 022_ocr_status
    → c529536aee7b → 023_ocr_review_confirmed ← HEAD
```

#### Cycle de démarrage

```
docker compose up -d
       │
       ▼
PostgreSQL démarre
  → init.sql : CREATE EXTENSION pg_trgm, uuid-ossp, pgcrypto
  → init.sql : CREATE FUNCTION trigger_set_updated_at()
  → healthcheck: pg_isready
       │ (service_healthy)
       ▼
API démarre
  → entrypoint.sh : alembic upgrade head
    → vérifie table alembic_version
    → si DB vide : crée la table, applique les 18 migrations
    → si DB existe : applique juste les manquantes
  → uvicorn démarre
       │ (service_healthy)
       ▼
Workers démarrent
  → SKIP_MIGRATIONS=1 → pas de migration
```

#### Si la DB est effacée (volume supprimé)

1. PostgreSQL recrée la DB → `init.sql` crée extensions + triggers
2. API démarre → `alembic upgrade head` détecte DB vide
3. **Applique les 18 migrations de zéro** dans l'ordre exact
4. Schéma reconstruit à l'identique
5. **Données perdues** — les migrations reconstruisent le schéma, pas les données

#### Après reconstruction — re-seed

```bash
# Le schéma est reconstruit automatiquement
# Puis seed les données de base :
docker compose exec api python scripts/seed_dev.py
docker compose exec api python scripts/seed_banking.py
```

---

### Protection des volumes — réglementation bancaire (10 ans PII)

#### Quelles commandes détruisent les volumes

| Commande | Volumes détruits ? |
|---|---|
| `docker compose down` | **Non** (par défaut) |
| `docker compose down -v` | **Oui** (-v = --volumes) |
| `docker system prune` | **Non** (sans --volumes) |
| `docker system prune --volumes` | **Oui** |
| `docker system prune -a --volumes` | **Oui** |
| `docker volume prune` | **Oui** (tous les non-utilisés) |

#### Protections en place

**Labels** (dans `docker-compose.yml`) : les volumes critiques portent `com.bicec.retention: "10y"`.

**Prune filtré** — ne toucher qu'aux volumes sans label :
```bash
docker volume prune --filter "label!=com.bicec.retention"
```

**Règle d'or** : ne JAMAIS utiliser `docker compose down -v`, `docker system prune --volumes`, ou `docker volume prune` sans filtre.

#### Backup DB

Le service `celery_beat` a un cron quotidien qui sauvegarde la DB dans `/backups/db` (volume `db_backups`). Ce volume est séparé de `db_storage` — si la DB est corrompue, les backups restent.

---

## Notes pour la production

- Le comportement 401 pour OTP expire est correct **cote backend** — le frontend doit juste rediriger vers `/auth/phone` (pas `/auth/login`).
- En production, `OTP_MODE` sera probablement `orange` (SMS Orange Cameroun) avec des credentials valides. La branche `OTP_MODE == "email"` servira uniquement en fallback.
- Si la migration `c529536aee7b` echoue sur un environnement avec beaucoup de doublons, lancer la dedup manuellement avant la migration :
  ```sql
  UPDATE kyc_sessions SET status = 'ABANDONED'
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY user_id ORDER BY started_at DESC
      ) AS rn
      FROM kyc_sessions
      WHERE status IN ('DRAFT', 'PENDING_INFO')
    ) AS ranked WHERE rn > 1
  );
  ```
