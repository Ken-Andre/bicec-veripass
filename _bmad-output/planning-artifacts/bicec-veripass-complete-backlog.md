# BICEC VeriPass - Backlog Complet (154 Issues)

## Sprint 0 - Infrastructure Foundation

### [INFRA-01] Initialiser le monorepo et la structure de projet

**Labels:** `infrastructure`, `sprint-0`, `priority:critical`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 4h  
**Sprint:** Sprint 0  
**Milestone:** 1

**Sous-tâches :**
- [ ] Créer repo GitHub `bicec-veripass` (privé)
- [ ] Initialiser structure : `backend/`, `frontend/`, `backoffice/`, `infra/`, `docs/`, `scripts/`, `data/`
- [ ] Créer `.gitignore` adapté (Python, Node, Docker secrets)
- [ ] Créer `README.md` avec architecture overview et instructions de démarrage
- [ ] Configurer branch protection (`main` = production, `develop` = intégration, `feature/*` = dev)
- [ ] Créer `.env.example` avec toutes les variables d'environnement nécessaires
- [ ] Ajouter `CONTRIBUTING.md` avec conventions Conventional Commits

**Critères de succès :** `git clone` + `cp .env.example .env` = point de départ clair pour n'importe quel dev.

---

### [INFRA-02] Docker Compose — Stack complète opérationnelle

**Labels:** `infrastructure`, `sprint-0`, `priority:critical`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 6h  
**Sprint:** Sprint 0  
**Milestone:** 1

**Sous-tâches :**
- [ ] Écrire `docker-compose.yml` : services `nginx`, `fastapi`, `pwa`, `backoffice`, `postgres`, `redis`, `celery-worker`, `celery-beat`
- [ ] Configurer Nginx `nginx.conf` : reverse proxy HTTPS self-signed vers FastAPI (:8000), PWA (:3000), BackOffice (:3001)
- [ ] Générer certificat TLS auto-signé `scripts/gen_dev_cert.sh` (openssl)
- [ ] Créer `Dockerfile` FastAPI (python:3.11-slim, ONNX Runtime, PaddleOCR)
- [ ] Créer `Dockerfile` PWA (node:20-alpine, vite build)
- [ ] Créer `Dockerfile` BackOffice (node:20-alpine, vite build)
- [ ] Configurer volumes Docker : `/data/documents`, `/data/models`, `/data/db`
- [ ] Créer `.wslconfig` template avec `memory=8GB` et `processors=4`
- [ ] Créer `scripts/docker_prune.sh` (prune si disk > 85%)
- [ ] Health checks : postgres `pg_isready`, redis `redis-cli ping`, fastapi `/health`
- [ ] Documenter les ports dans README

**Critères de succès :** `docker compose up` → tous healthchecks verts en < 90 secondes.

---
### [INFRA-03] Alembic — Migrations PostgreSQL initiales

**Labels:** `infrastructure`, `database`, `sprint-0`, `priority:critical`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 5h  
**Sprint:** Sprint 0  
**Milestone:** 1

**Sous-tâches :**
- [ ] Initialiser Alembic dans `backend/`
- [ ] Migration `001_initial` : tables `users`, `kyc_sessions`, `documents`
- [ ] Migration `002_auth` : tables `agents`, `roles`, `sessions`
- [ ] Migration `003_audit` : table `audit_logs` (append-only, no DELETE grant)
- [ ] Migration `004_notifications` : table `notifications`
- [ ] Contrainte CHECK sur `kyc_sessions.status` (enum des 18 états)
- [ ] Index sur `kyc_sessions.status`, `users.phone`, `audit_logs.created_at`
- [ ] Script `scripts/seed_dev.py` : agents démo (Jean, Thomas, Sylvie, Admin IT) + 2 sessions KYC test
- [ ] Script `scripts/seed_admin_it.sql` : compte Admin IT initial pour bootstrapper le système (1er déploiement)
- [ ] Vérifier idempotence : `alembic upgrade head` deux fois = pas d'erreur

**Critères de succès :** `alembic upgrade head` depuis zéro en < 30s. `\dt` dans psql montre toutes les tables.

---

### [INFRA-04] Télécharger et valider les modèles AI en local

**Labels:** `infrastructure`, `ai-engine`, `sprint-0`, `priority:critical`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 3h  
**Sprint:** Sprint 0  
**Milestone:** 1

⚠️ GLM-OCR = 2.5GB. Si problème de compatibilité ONNX découvert en semaine 4 = 2 jours perdus.

**Sous-tâches :**
- [ ] Télécharger PaddleOCR PP-OCRv5 (detection + recognition) dans `/data/models/paddleocr/`
- [ ] Télécharger GLM-OCR 0.9B ONNX quantized (int4/int8) dans `/data/models/glm-ocr/` — vérifier checksum SHA256
- [ ] Télécharger MiniFASNet (anti-spoofing) dans `/data/models/minifasnet/`
- [ ] Télécharger FaceNet-512 (DeepFace) dans `/data/models/deepface/`
- [ ] Écrire `scripts/validate_models.py` : test inference sur image dummy, mesurer temps
- [ ] Benchmarker sur i3 ET Ryzen 7 — noter temps réels
- [ ] Documenter dans `docs/ai-benchmarks.md`

**Critères de succès :** `python validate_models.py` → 4/4 modèles validés avec temps mesurés.

---

### [INFRA-05] Stratégie Dataset CNI — Collecte & Synthèse

**Labels:** `infrastructure`, `ai-engine`, `data`, `sprint-0`, `priority:critical`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 4h  
**Sprint:** Sprint 0  
**Milestone:** 1

À traiter JOUR 1.

**Sous-tâches :**
- [ ] Rencontrer l'encadrant BICEC — accord formel pour 15-30 images CNI anonymisées
- [ ] Créer `data/cni_samples/` : `real/`, `synthetic/`, `annotated/`
- [ ] Écrire `scripts/generate_synthetic_cni.py` : 20 images CNI synthétiques (template MINREX + Faker)
- [ ] Écrire `scripts/annotate_cni.py` : annotation JSON (bounding boxes + valeurs attendues)
- [ ] Format : `{"image": "...", "fields": {"nom": "MBALLA", "prenom": "...", "ddn": "...", "lieu_naissance": "...", "numero_cni": "...", "date_expiration": "..."}}`
- [ ] Créer `data/glm_ocr_prompts/` : 3 prompts few-shot CNI annotés JSON
- [ ] Créer `scripts/eval_ocr.py` : mesure FER (Field Extraction Rate) sur 20 images test
- [ ] Target démo : FER ≥ 80% sur 6 champs CNI Recto

**Critères de succès :** 20 images annotées + baseline FER mesurée.

---

### [INFRA-06] Orange SMS API — Validation accès et fallback SMTP

**Labels:** `infrastructure`, `integration`, `sprint-0`, `priority:high`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 2h  
**Sprint:** Sprint 0  
**Milestone:** 1

**Sous-tâches :**
- [ ] Contacter encadrant BICEC pour clé API Orange sandbox
- [ ] Si disponible : tester envoi SMS via `curl` avant d'écrire du code
- [ ] Si non disponible : implémenter `notifications/sms_provider.py` interface abstraite + SMTP fallback
- [ ] Documenter la décision dans ADR-011 : "SMS OTP Strategy"

---

### [INFRA-07] GitHub Repository — Labels, Milestones et Branch Protection

**Labels:** `infrastructure`, `sprint-0`, `priority:high`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 2h  
**Sprint:** Sprint 0  
**Milestone:** 1

**Sous-tâches :**
- [ ] Créer les 50+ labels GitHub (couleurs définies dans le roadmap)
- [ ] Créer les 8 milestones (M0 à M7 avec dates cibles)
- [ ] Configurer branch protection sur `main` : require PR review, require CI passing, no force push
- [ ] Configurer branch protection sur `develop` : require CI passing
- [ ] Créer GitHub Project board "VeriPass — Sprint Board" avec colonnes Backlog / In Progress / Review / Done
- [ ] Activer GitHub Issues avec templates (bug report, feature request, user story)

---

### [INFRA-08] WSL2 + Docker Desktop — Configuration environnement dev

**Labels:** `infrastructure`, `sprint-0`, `priority:medium`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 1h  
**Sprint:** Sprint 0  
**Milestone:** 1

**Sous-tâches :**
- [ ] Créer `.wslconfig` : `memory=8GB`, `processors=4`, `swap=2GB`
- [ ] Créer `scripts/setup_dev.ps1` : vérifier prérequis (Docker, Node, Python, Git)
- [ ] Documenter dans README : "Getting Started" en 5 étapes
- [ ] Tester depuis zéro sur machine vierge (simuler premier checkout)

---

### [INFRA-09] DB — Migration AI et Analytics tables (Sprint 3+)

**Labels:** `infrastructure`, `database`, `sprint-0`, `priority:medium`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 1h  
**Sprint:** Sprint 0  
**Milestone:** 1

**Sous-tâches :**
- [ ] Planifier et documenter les migrations futures dans `docs/db-migration-plan.md`
- [ ] Créer squelettes de migrations vides : `005_ocr`, `006_biometrics`, `007_aml`, `008_analytics`, `009_dwh`
- [ ] Vérifier que chaque migration peut être run indépendamment (pas de dépendances croisées hardcodées)

---

### [INFRA-10] DB Backup — Script sauvegarde volumes Docker

**Labels:** `infrastructure`, `database`, `sprint-0`, `priority:medium`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 1h  
**Sprint:** Sprint 0  
**Milestone:** 1

**Sous-tâches :**
- [ ] Créer `scripts/backup_dev.sh` : `pg_dump` + `tar` des volumes `/data/documents`
- [ ] Créer `scripts/restore_dev.sh` : restaurer depuis backup
- [ ] Documenter procédure dans README section "Disaster Recovery"
- [ ] Mettre en place git hook `pre-push` : rappel "Have you backed up your data?"

---

## Sprint 1 - Authentication & Foundation

### [AUTH-01] FastAPI — Structure modulaire et endpoint /health

**Labels:** `backend`, `sprint-1`, `priority:critical`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 4h  
**Sprint:** Sprint 1  
**Milestone:** 2

**Sous-tâches :**
- [ ] Créer structure `backend/app/` : `main.py`, `core/`, `api/v1/`, `models/`, `schemas/`, `services/`, `workers/`
- [ ] Configurer FastAPI avec `APIRouter` par module : `auth`, `kyc`, `backoffice`, `aml`, `analytics`, `admin`, `notifications`
- [ ] Implémenter `GET /health` → `{"status": "ok", "db": "ok", "redis": "ok", "version": "0.1.0"}`
- [ ] Configurer logging JSON structuré (python-json-logger) avec `correlation_id`
- [ ] Configurer CORS (Origins: localhost:3000, localhost:3001)
- [ ] Implémenter middleware `correlation_id` (UUID injecté sur chaque requête)
- [ ] Générer OpenAPI docs sur `/docs` (Swagger UI)
- [ ] Écrire 3 tests pytest : health OK, health DB down, health Redis down

---
### [AUTH-02] JWT Service — Access & Refresh Tokens

**Labels:** `backend`, `auth`, `sprint-1`, `priority:critical`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 3h  
**Sprint:** Sprint 1  
**Milestone:** 2

**Sous-tâches :**
- [ ] Implémenter `services/auth/jwt_service.py` : `create_access_token(sub, role, expires=15min)`, `create_refresh_token(sub, expires=7d)`
- [ ] Implémenter `verify_token(token)` → payload ou HTTPException 401
- [ ] Stocker refresh tokens dans Redis (TTL = 7j) avec pattern `refresh:{user_id}:{jti}`
- [ ] Implémenter `POST /auth/refresh` → nouveau access token si refresh valide
- [ ] Implémenter `POST /auth/logout` → invalider refresh token dans Redis
- [ ] Tests : token valide, expiré, falsifié, refresh valide, refresh révoqué

---

### [AUTH-03] OTP Authentication — Marie (SMS + Fallback Email)

**Labels:** `backend`, `frontend`, `auth`, `sprint-1`, `priority:critical`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 6h  
**Sprint:** Sprint 1  
**Milestone:** 2

**Sous-tâches :**
- [ ] Backend `POST /auth/otp/send` : valider format (+237XXXXXXXXX), générer OTP 6 chiffres, stocker Redis `otp:{phone}` TTL=5min (hash bcrypt), appeler SMS provider
- [ ] Backend `POST /auth/otp/verify` : comparer hash, créer `users` record si nouveau, créer `kyc_session` status=DRAFT, retourner JWT
- [ ] Rate limiting : 3 tentatives max / 5 minutes par IP + par téléphone (Redis counter)
- [ ] Anti-replay : supprimer OTP Redis immédiatement après usage réussi
- [ ] Backend `POST /auth/pin/setup` : stocker PIN hashé Argon2 dans `users.pin_hash`
- [ ] Backend `POST /auth/pin/verify` : vérifier PIN, retourner JWT
- [ ] PWA React : écran "Numéro" + écran "Code OTP 6 chiffres" + écran "Créer PIN 4 chiffres"
- [ ] PWA : gérer erreurs (code invalide, expiré, compte bloqué)
- [ ] Audit log : `AUTH_OTP_SENT`, `AUTH_OTP_VERIFIED`, `AUTH_OTP_FAILED`, `AUTH_PIN_SET`
- [ ] Tests E2E Playwright : flow complet OTP → PIN setup

---

### [AUTH-04] Back-Office Authentication — Jean, Thomas, Sylvie, Admin IT

**Labels:** `backend`, `backoffice`, `auth`, `sprint-1`, `priority:critical`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 4h  
**Sprint:** Sprint 1  
**Milestone:** 2

**Sous-tâches :**
- [ ] Backend `POST /auth/bo/login` : Email + Password → bcrypt verify → JWT avec `role` claim
- [ ] RBAC middleware : décorateur `@require_role(["AGENT", "SUPERVISOR", "MANAGER", "ADMIN_IT"])` sur chaque endpoint back-office (isolation stricte par rôle)
- [ ] Lockout : 5 tentatives échouées → `agents.locked_until = now() + 15min`
- [ ] Back-office React : page login email/password, redirect par rôle, gestion token expiry
- [ ] Seed data : Jean (AGENT), Thomas (SUPERVISOR/AML), Sylvie (MANAGER), Admin IT (ADMIN_IT) — mots de passe hachés bcrypt
- [ ] Back-office React : route `/admin` pour Admin IT, isolation complète des routes par rôle
- [ ] Tests : login valide, mauvais password, compte bloqué, accès interdit par rôle

---

### [AUTH-05] RBAC — Modèle de permissions complet

**Labels:** `backend`, `auth`, `security`, `sprint-1`, `priority:high`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 3h  
**Sprint:** Sprint 1  
**Milestone:** 2

**Sous-tâches :**
- [ ] Définir matrice de permissions dans `core/permissions.py`
- [ ] Rôles : `CLIENT`, `AGENT_KYC`, `SUPERVISOR_AML`, `OPERATIONS_MANAGER`, `ADMIN`
- [ ] Documenter permissions par endpoint dans `docs/rbac-matrix.md`
- [ ] Tests : chaque rôle ne peut pas accéder aux endpoints d'un autre rôle

---

### [AUTH-06] Redis — Configuration session store + santé

**Labels:** `backend`, `infrastructure`, `sprint-1`, `priority:high`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 2h  
**Sprint:** Sprint 1  
**Milestone:** 2

**Sous-tâches :**
- [ ] Configurer `core/redis.py` : pool de connexions async (aioredis), retry on connect
- [ ] Définir les namespaces Redis : `otp:`, `refresh:`, `session:`, `agent_active:`, `rate_limit:`
- [ ] Configurer TTL par défaut par namespace dans `core/config.py`
- [ ] Test : connexion Redis down → health check retourne `{"redis": "error"}`

---

### [AUTH-07] Celery — Configuration worker initial + queues

**Labels:** `backend`, `celery`, `sprint-1`, `priority:high`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 2h  
**Sprint:** Sprint 1  
**Milestone:** 2

**Sous-tâches :**
- [ ] Configurer Celery dans `workers/celery_app.py` : broker Redis, backend Redis
- [ ] Définir queues nommées : `default`, `ocr_paddle`, `ocr_glm`, `biometrics`, `notifications`, `sync`
- [ ] Configurer Celery Beat pour tâches périodiques
- [ ] Créer tâche de test `tasks/test_task.py` : `add(x, y)` → vérifier pipeline worker fonctionnel
- [ ] Documenter dans README : `celery -A workers.celery_app worker --loglevel=info`

---

### [AUTH-08] DB — Migration `agents` + `sessions` + `audit_logs`

**Labels:** `database`, `sprint-1`, `priority:high`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 2h  
**Sprint:** Sprint 1  
**Milestone:** 2

**Sous-tâches :**
- [ ] Vérifier migration `002_auth` : tables `agents` (id, email, password_hash, role, locked_until, capacity_weight)
- [ ] Vérifier migration `003_audit` : `audit_logs` (id, session_id, agent_id, event_type, payload JSONB, sha256_hash, created_at)
- [ ] Ajouter trigger PostgreSQL : `audit_logs` → interdit UPDATE et DELETE (append-only enforcement)
- [ ] Index sur `audit_logs.session_id`, `audit_logs.event_type`, `audit_logs.created_at`

---

### [AUTH-09] ADR Review — ADR-001 à ADR-010

**Labels:** `documentation`, `sprint-1`, `priority:medium`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 1h  
**Sprint:** Sprint 1  
**Milestone:** 2

**Sous-tâches :**
- [ ] Créer `docs/adr/` si inexistant
- [ ] Vérifier cohérence entre ADRs existants et stack retenue (FastAPI, PaddleOCR, GLM-OCR, DeepFace, MiniFASNet)
- [ ] Créer ADR-011 : "SMS OTP Strategy — Orange API ou SMTP fallback"
- [ ] Créer ADR-012 : "Amplitude Mock — Pourquoi mock en MVP et comment migrer Phase 2"

---

### [AUTH-10] OpenAPI Spec — Documentation contrats API

**Labels:** `backend`, `documentation`, `sprint-1`, `priority:medium`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 1h  
**Sprint:** Sprint 1  
**Milestone:** 2

**Sous-tâches :**
- [ ] Vérifier que `/docs` (Swagger UI) expose tous les endpoints avec descriptions
- [ ] Ajouter `summary` et `description` sur chaque endpoint FastAPI
- [ ] Configurer tags OpenAPI par module (auth, kyc, backoffice, aml, analytics)
- [ ] Exporter `openapi.json` dans `docs/api/` à chaque sprint

---
## Sprint 2 - Capture Journey

### [CAPTURE-01] PWA — Infrastructure caméra & MediaPipe WASM

**Labels:** `frontend`, `pwa`, `capture`, `sprint-2`, `priority:critical`  
**Epic:** Epic 2 — Capture Journey  
**Estimate:** 6h  
**Sprint:** Sprint 2  
**Milestone:** 3

**Sous-tâches :**
- [ ] Implémenter `hooks/useCamera.ts` : `getUserMedia({video: {facingMode: "environment"}})`, gestion permissions refusées, fallback caméra frontale
- [ ] Intégrer MediaPipe WASM (Face Detection) via CDN/npm — tester chargement < 4s
- [ ] Implémenter `hooks/useFrameQuality.ts` : score flou (variance Laplacien via canvas), détection reflet (luminosité max pixel), retourner `{blur, glare, aligned}`
- [ ] Composant `<CameraCapture />` : flux vidéo live + overlay rectangle guide + indicateurs qualité (vert/rouge)
- [ ] Quality check ne bloque pas à >15 FPS sur mid-range Android (web worker si nécessaire)
- [ ] Auto-capture : déclencher quand quality score > threshold pendant 500ms continus

---

### [CAPTURE-02] PWA — Flow CNI Recto + Verso

**Labels:** `frontend`, `backend`, `capture`, `sprint-2`, `priority:critical`  
**Epic:** Epic 2 — Capture Journey  
**Estimate:** 5h  
**Sprint:** Sprint 2  
**Milestone:** 3

**Sous-tâches :**
- [ ] Page `CNICaptureScreen` : étapes Recto → confirmation → Verso → confirmation
- [ ] Compression image client avant upload (max 1.5MB, qualité 85%, résolution max 1920px)
- [ ] Stockage temporaire IndexedDB : `kyc_capture_cache` avec clés `cni_recto`, `cni_verso` (AES-GCM, clé dérivée du PIN via PBKDF2)
- [ ] Backend `POST /kyc/capture/cni` : multipart/form-data, validate Content-Type image/jpeg, stocker dans `/data/documents/{session_id}/cni_{side}.jpg`
- [ ] Calculer SHA-256 côté backend, stocker dans `documents.sha256`
- [ ] Réponse : `{document_id, sha256, upload_status: "UPLOADED"}` → mettre à jour `kyc_sessions.last_step`
- [ ] Gestion reprise : si `cni_recto` déjà en IndexedDB → "Continuer là où vous étiez"
- [ ] Tests : upload valide, format invalide (PDF rejeté), fichier trop grand, session expirée

---

### [CAPTURE-03] PWA — Session Persistence (Service Worker + IndexedDB)

**Labels:** `frontend`, `pwa`, `offline`, `sprint-2`, `priority:high`  
**Epic:** Epic 2 — Capture Journey  
**Estimate:** 6h  
**Sprint:** Sprint 2  
**Milestone:** 3

⚠️ NFR8 : reprise en < 2 secondes après retour signal.

**Sous-tâches :**
- [ ] Enregistrer Service Worker (`sw.ts` via Workbox ou vanilla)
- [ ] App Shell Cache : mettre en cache HTML/CSS/JS bundle au premier load
- [ ] Offline Detection : `navigator.onLine` + events `online`/`offline` → banner "Hors ligne — vos données sont sauvegardées"
- [ ] Stratégie sync : à la reconnexion, `sync` event → re-tenter uploads en attente depuis IndexedDB
- [ ] `SessionStore` (IndexedDB via `idb`) : clés `session_metadata`, `capture_queue`, `step_progress`
- [ ] Chiffrement AES-GCM de toutes les données sensibles dans IndexedDB
- [ ] Test : couper WiFi pendant upload → reconnecter → vérifier reprise sans perte
- [ ] Test : `localStorage` n'est PAS utilisé (restriction explicite)

---

### [CAPTURE-04] PWA — Progress Indicator & Navigation KYC

**Labels:** `frontend`, `pwa`, `ux`, `sprint-2`, `priority:medium`  
**Epic:** Epic 2 — Capture Journey  
**Estimate:** 3h  
**Sprint:** Sprint 2  
**Milestone:** 3

**Sous-tâches :**
- [ ] Composant `<KYCProgressBar />` : 7 étapes (Inscription → CNI → Selfie → Adresse → NIU → Consentement → Soumis)
- [ ] `useKYCRouter` hook : navigation basée sur `kyc_session.last_step` (empêcher saut d'étape)
- [ ] "Physical Branch" button : visible à chaque étape → `POST /kyc/session/switch-to-branch` → status=BRANCH_REDIRECT

---

### [CAPTURE-05] Backend — Service de stockage documents sécurisé

**Labels:** `backend`, `security`, `sprint-2`, `priority:high`  
**Epic:** Epic 2 — Capture Journey  
**Estimate:** 3h  
**Sprint:** Sprint 2  
**Milestone:** 3

**Sous-tâches :**
- [ ] Créer `services/storage/document_service.py` : gestion des chemins, validation MIME, quota par session
- [ ] Endpoint `GET /kyc/documents/{document_id}/file` : servir image via streaming (pas d'URL publique directe)
- [ ] Vérification JWT + ownership avant chaque accès fichier (client ne peut accéder qu'à ses propres documents)
- [ ] Nommer fichiers avec UUID (pas de noms révélateurs en filesystem)
- [ ] Log `DOCUMENT_ACCESSED` dans audit_logs à chaque consultation

---
### [CAPTURE-06] Backend — SHA-256 Deduplication & Validation

**Labels:** `backend`, `sprint-2`, `priority:medium`  
**Epic:** Epic 2 — Capture Journey  
**Estimate:** 2h  
**Sprint:** Sprint 2  
**Milestone:** 3

**Sous-tâches :**
- [ ] `POST /kyc/capture/verify-checksum` : vérifier si SHA-256 déjà en DB → retourner `{already_uploaded: bool, document_id}`
- [ ] Appeler avant re-upload pour éviter doublons après reconnexion réseau
- [ ] Rejeter tout upload dont SHA-256 appartient à une autre session (sécurité)

---

### [CAPTURE-07] PWA — États d'erreur & UX retry

**Labels:** `frontend`, `pwa`, `ux`, `sprint-2`, `priority:medium`  
**Epic:** Epic 2 — Capture Journey  
**Estimate:** 2h  
**Sprint:** Sprint 2  
**Milestone:** 3

**Sous-tâches :**
- [ ] Écran erreur générique : message + bouton "Réessayer" + bouton "Contacter le support"
- [ ] Toast notifications : succès upload (vert), erreur réseau (rouge), avertissement qualité (orange)
- [ ] Gestionnaire d'erreurs global React : `ErrorBoundary` wrapper sur chaque route KYC
- [ ] Tests Playwright : upload fail → toast affiché → retry → succès

---

### [CAPTURE-08] PWA — Optimisation mobile & accessibilité

**Labels:** `frontend`, `pwa`, `sprint-2`, `priority:low`  
**Epic:** Epic 2 — Capture Journey  
**Estimate:** 2h  
**Sprint:** Sprint 2  
**Milestone:** 3

**Sous-tâches :**
- [ ] Viewport meta `<meta name="viewport" content="width=device-width, initial-scale=1">`
- [ ] Tester sur Samsung Galaxy A-series (Android 9+) — résolution 360px minimum
- [ ] Contraste AA WCAG 2.1 pour textes principaux
- [ ] `<html lang="fr">` + attributs `aria-label` sur éléments interactifs caméra
- [ ] Désactiver zoom sur champs PIN (éviter UX bizarre sur iOS)

---

### [CAPTURE-09] PWA — Onboarding Tutorial Première Visite

**Labels:** `frontend`, `pwa`, `ux`, `sprint-2`, `priority:low`  
**Epic:** Epic 2 — Capture Journey  
**Estimate:** 2h  
**Sprint:** Sprint 2  
**Milestone:** 3

**Sous-tâches :**
- [ ] Overlay tutorial au premier login : 3 slides (Préparez vos documents, Selfie dans bonne lumière, Processus ~5 minutes)
- [ ] Stocker `onboarding_shown=true` dans localStorage (cette donnée non-sensible, pas IndexedDB)
- [ ] Bouton "Passer" disponible dès la slide 1
- [ ] Redesafficher via "?" button dans header KYC

---

## Sprint 3 - OCR Engine

### [OCR-01] Backend — PaddleOCR Service (synchrone)

**Labels:** `backend`, `ai-engine`, `ocr`, `sprint-3`, `priority:critical`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 6h  
**Sprint:** Sprint 3  
**Milestone:** 3

**Sous-tâches :**
- [ ] Créer `services/ocr/paddleocr_service.py` : wrapper PaddleOCR PP-OCRv5 CPU-only avec ONNX Runtime
- [ ] Fonction `extract_text(image_path) -> List[{text, confidence, bbox}]`
- [ ] Fonction `parse_cni_recto(raw_detections) -> CNIRectoFields` : mapping zones/champs géométrique
- [ ] Fonction `parse_cni_verso(raw_detections) -> CNIVersoFields`
- [ ] Schéma `CNIRectoFields` : `nom, prenom, date_naissance, lieu_naissance, numero_cni, date_expiration, confidence_per_field`
- [ ] Calcul `confidence_per_field` : moyenne confiance PaddleOCR des tokens du champ
- [ ] Mesurer FER sur 20 images annotées (INFRA-05) → documenter dans `docs/ocr-benchmarks.md`
- [ ] Endpoint `POST /ocr/cni/sync` (internal) : trigger OCR synchrone
- [ ] Tests pytest : 5 images CNI synthétiques → vérifier que champs présents

---

### [OCR-02] Backend — GLM-OCR Service (asynchrone via Celery)

**Labels:** `backend`, `ai-engine`, `celery`, `ocr`, `sprint-3`, `priority:critical`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 7h  
**Sprint:** Sprint 3  
**Milestone:** 3

⚠️ C'est le cœur technique différenciateur. Le jury Data/IA évaluera ça.

**Sous-tâches :**
- [ ] Créer `services/ocr/glm_ocr_service.py` : wrapper GLM-OCR 0.9B via ONNX Runtime
- [ ] Implémenter few-shot prompting : 3 exemples annotés CNI (depuis `data/glm_ocr_prompts/`)
- [ ] Prompt : `"Extrais les champs de cette CNI camerounaise en JSON. Exemples: [few-shot]. Image: [image_b64]"`
- [ ] Parser réponse JSON → `GLMOCRResult` (fallback si JSON malformé → regex)
- [ ] Celery task `tasks/ocr_tasks.py` : `run_glm_ocr_async(document_id, session_id)`
- [ ] Queue : `glm_ocr_jobs` (Redis broker)
- [ ] Après completion : mettre à jour `ocr_fields`, calculer delta vs PaddleOCR, envoyer event polling
- [ ] Benchmark i3 : mesurer latence réelle → documenter pour rapport PFE
- [ ] Endpoint `GET /kyc/session/{id}/ocr-status` : `{paddle_status, glm_status, fields, confidence}`
- [ ] Tests : task enqueued, completed, timeout (>60s), malformed JSON

---
### [OCR-03] Backend — OCR Observability & Métriques

**Labels:** `backend`, `ai-engine`, `analytics`, `sprint-3`, `priority:high`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 3h  
**Sprint:** Sprint 3  
**Milestone:** 3

⚠️ Livrable PFE primaire.

**Sous-tâches :**
- [ ] Table `ocr_metrics` : `document_id`, `engine` (PADDLE/GLM), `processing_time_ms`, `field_name`, `confidence`, `correction_made`, `correction_by_agent_id`
- [ ] Insérer métriques à chaque extraction via `services/ocr/metrics_recorder.py`
- [ ] View SQL `ocr_observability_dashboard` : FER par engine, temps moyen, taux correction, top champs faible confidence
- [ ] Endpoint `GET /analytics/ocr/metrics` (rôle Sylvie)
- [ ] Migration Alembic pour `ocr_metrics`

---

### [OCR-04] PWA — Écran Review OCR (confirmation champs extraits)

**Labels:** `frontend`, `pwa`, `ocr`, `sprint-3`, `priority:high`  
**Epic:** Epic 2 — Capture Journey  
**Estimate:** 4h  
**Sprint:** Sprint 3  
**Milestone:** 3

**Sous-tâches :**
- [ ] Composant `<OCRReviewScreen />` : champs extraits avec indicateur confiance (vert ≥ 0.85, jaune 0.6-0.85, rouge < 0.6)
- [ ] Champ éditable pour chaque valeur (Marie peut corriger)
- [ ] Spinner "Analyse en cours..." pendant GLM-OCR async
- [ ] Polling `GET /kyc/session/{id}/ocr-status` toutes les 3s jusqu'à `glm_status: COMPLETED`
- [ ] `PATCH /kyc/session/{id}/ocr-corrections` : sauvegarder corrections manuelles
- [ ] Bouton "Confirmer" → next step

---

### [OCR-05] DB — Migration table `ocr_fields`

**Labels:** `database`, `sprint-3`, `priority:high`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 1h  
**Sprint:** Sprint 3  
**Milestone:** 3

**Sous-tâches :**
- [ ] Migration `005_ocr_fields` : table `ocr_fields` (session_id, engine, field_name, value, confidence, bbox JSONB, source_document_id)
- [ ] Index sur `ocr_fields.session_id`, `ocr_fields.engine`
- [ ] Contrainte UNIQUE sur `(session_id, engine, field_name)`

---

### [OCR-06] DB — Migration table `ocr_metrics` et vues analytiques

**Labels:** `database`, `analytics`, `sprint-3`, `priority:medium`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 1h  
**Sprint:** Sprint 3  
**Milestone:** 3

**Sous-tâches :**
- [ ] Migration `006_ocr_metrics` : table `ocr_metrics` (tous champs définis dans OCR-03)
- [ ] Créer extension `pg_trgm` si non présente : `CREATE EXTENSION IF NOT EXISTS pg_trgm`
- [ ] Créer view `v_ocr_daily_stats` : FER par jour et par engine

---

### [OCR-07] GLM-OCR — Prompt Engineering & Few-Shot Calibration

**Labels:** `ai-engine`, `ocr`, `sprint-3`, `priority:high`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 3h  
**Sprint:** Sprint 3  
**Milestone:** 3

**Sous-tâches :**
- [ ] Créer 3 prompts few-shot dans `data/glm_ocr_prompts/prompt_v1.json` à `prompt_v3.json`
- [ ] Tester les 3 variantes sur 10 images CNI annotées → choisir la meilleure
- [ ] Documenter les résultats dans `docs/glm-prompt-engineering.md` (contenu PFE)
- [ ] Créer prompt spécialisé pour CNI Verso (champ adresse, mentions complémentaires)

---

### [OCR-08] Backend — OCR REST API endpoints complets

**Labels:** `backend`, `ocr`, `sprint-3`, `priority:medium`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 2h  
**Sprint:** Sprint 3  
**Milestone:** 3

**Sous-tâches :**
- [ ] `POST /kyc/session/{id}/ocr/trigger` : déclencher OCR manuel (re-traitement si nécessaire)
- [ ] `GET /kyc/session/{id}/ocr-status` : statut détaillé (paddle_status, glm_status, fields[], confidence_per_field)
- [ ] `PATCH /kyc/session/{id}/ocr-corrections` : corrections manuelles Marie
- [ ] Rate limit : max 3 triggers OCR par session (éviter abus)

---

## Sprint 4 - Biometric Engine

### [BIO-01] Backend — DeepFace Face Matching Service

**Labels:** `backend`, `ai-engine`, `biometrics`, `sprint-4`, `priority:critical`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 5h  
**Sprint:** Sprint 4  
**Milestone:** 4

**Sous-tâches :**
- [ ] Créer `services/biometrics/face_match_service.py` : wrapper DeepFace avec FaceNet-512
- [ ] Fonction `compare_faces(selfie_path, cni_face_path) -> FaceMatchResult{score, verified, distance}`
- [ ] Extraire photo CNI depuis image Recto (crop zone portrait — bounding box fixe ou MediaPipe)
- [ ] Stocker résultat dans `biometric_results` : `session_id`, `match_score`, `verified`, `processing_time_ms`
- [ ] Seuil configurable : `FACE_MATCH_THRESHOLD=0.40` (distance FaceNet)
- [ ] Benchmark FaceNet vs ArcFace sur images CNI camerounaises — documenter pour PFE
- [ ] Tests : même personne, deux personnes différentes, image floue

---

### [BIO-02] Backend — MiniFASNet Liveness / Anti-Spoofing

**Labels:** `backend`, `ai-engine`, `biometrics`, `sprint-4`, `priority:critical`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 5h  
**Sprint:** Sprint 4  
**Milestone:** 4

**Sous-tâches :**
- [ ] Créer `services/biometrics/liveness_service.py` : wrapper MiniFASNet via ONNX Runtime
- [ ] Fonction `check_liveness(frames) -> LivenessResult{score, is_real, processing_time_ms}`
- [ ] Seuil configurable `LIVENESS_THRESHOLD=0.85`
- [ ] Counter Redis `liveness_attempts:{session_id}` → bloquer à 3 tentatives
- [ ] `POST /kyc/capture/liveness` : recevoir frames JPEG, déclencher task Celery
- [ ] Celery task : MiniFASNet → stocker résultats → mettre à jour session status
- [ ] Tests : vidéo live (passer), photo d'écran (échouer), visage partiellement couvert

---
### [BIO-03] PWA — Selfie Liveness Screen avec guidage adaptatif

**Labels:** `frontend`, `pwa`, `biometrics`, `sprint-4`, `priority:critical`  
**Epic:** Epic 2 — Capture Journey  
**Estimate:** 5h  
**Sprint:** Sprint 4  
**Milestone:** 4

**Sous-tâches :**
- [ ] Page `/kyc/liveness` : caméra frontale + overlay ellipse guide
- [ ] MediaPipe Face Landmarks WASM : EAR (Eye Aspect Ratio) pour clignement, pose pour "tourner tête"
- [ ] Challenges aléatoires : ["Souriez", "Clignez des yeux", "Tournez légèrement à gauche"] — 2 parmi 3
- [ ] Capturer 5 frames à intervalles 500ms pendant validation du geste
- [ ] Upload `POST /kyc/capture/liveness` avec frames
- [ ] Polling résultat : `GET /kyc/session/{id}/biometric-status`
- [ ] 3-strike flow : compteur visible, message lockout + "Recommencer" (purge cache session)
- [ ] Animation feedback : ✅ vert (OK) / ❌ rouge (échec) + message explicatif

---

### [BIO-04] Backend — Dossier Global Confidence Score

**Labels:** `backend`, `ai-engine`, `sprint-4`, `priority:high`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 3h  
**Sprint:** Sprint 4  
**Milestone:** 4

**Sous-tâches :**
- [ ] Créer `services/scoring/confidence_scorer.py`
- [ ] Formule : `global_score = w1*ocr_avg_confidence + w2*face_match_score + w3*liveness_score + w4*data_coherence_score`
- [ ] `data_coherence_score` : cohérence interne (DDN < aujourd'hui, CNI non expirée, formats valides)
- [ ] Poids configurables : `w1=0.25, w2=0.35, w3=0.30, w4=0.10`
- [ ] Stocker dans `kyc_sessions.global_confidence_score`
- [ ] Flags auto : `ocr_low_confidence`, `liveness_suspicious`, `possible_duplicate`
- [ ] Tests : 5 scénarios de scoring (excellent → rejet)

---

### [BIO-05] Backend — Pipeline biométrique Celery asynchrone

**Labels:** `backend`, `celery`, `biometrics`, `sprint-4`, `priority:high`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 4h  
**Sprint:** Sprint 4  
**Milestone:** 4

**Sous-tâches :**
- [ ] Celery task `tasks/bio_tasks.py` : `run_biometrics_pipeline(session_id)`
- [ ] Séquence : (1) liveness check → (2) si passé, face match → (3) compute global score
- [ ] Déclenché automatiquement après upload selfie
- [ ] Mettre à jour `kyc_sessions.biometric_status` : PENDING → PROCESSING → COMPLETED / FAILED
- [ ] Logger chaque étape dans `biometric_results` avec timestamps
- [ ] Tests : pipeline complet success, liveness fail stoppe pipeline, timeout Celery

---

### [BIO-06] PWA — Écran de lockout 3 strikes liveness

**Labels:** `frontend`, `pwa`, `ux`, `sprint-4`, `priority:high`  
**Epic:** Epic 2 — Capture Journey  
**Estimate:** 3h  
**Sprint:** Sprint 4  
**Milestone:** 4

**Sous-tâches :**
- [ ] Détecter status `LOCKED_LIVENESS` lors du polling biometric-status
- [ ] Afficher message de refus d'accès pour raisons de sécurité
- [ ] Bouton "Recommencer" : `POST /kyc/session/restart` → purger IndexedDB + créer nouvelle session
- [ ] Bouton "Aller en agence" : afficher liste agences proches + instructions
- [ ] Timer cooldown 60 secondes avant de pouvoir "Recommencer"
- [ ] Audit log : `LIVENESS_LOCKOUT`

---

### [BIO-07] DB — Migration `biometric_results` + `liveness_checks`

**Labels:** `database`, `biometrics`, `sprint-4`, `priority:high`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 2h  
**Sprint:** Sprint 4  
**Milestone:** 4

**Sous-tâches :**
- [ ] Migration `007_biometrics` : table `biometric_results` (session_id, liveness_score, is_real, face_match_score, verified, processing_time_ms, attempt_number, created_at)
- [ ] Index sur `biometric_results.session_id`
- [ ] Ajouter colonnes dans `kyc_sessions` : `biometric_status`, `liveness_attempts`, `global_confidence_score`

---

### [BIO-08] Backend — Service crop portrait CNI

**Labels:** `backend`, `ai-engine`, `biometrics`, `sprint-4`, `priority:medium`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 2h  
**Sprint:** Sprint 4  
**Milestone:** 4

**Sous-tâches :**
- [ ] Créer `services/biometrics/cni_portrait_extractor.py`
- [ ] Méthode 1 : bounding box fixe (zone haut-gauche CNI MINREX — dimensions standardisées)
- [ ] Méthode 2 (fallback) : MediaPipe face detection sur image CNI → crop autour du visage détecté
- [ ] Sauvegarder crop dans `/data/documents/{session_id}/cni_portrait.jpg`
- [ ] Test : CNI avec visage → portrait extrait de qualité suffisante pour DeepFace

---

### [BIO-09] Backend — Biometric status polling endpoint

**Labels:** `backend`, `biometrics`, `sprint-4`, `priority:medium`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 1h  
**Sprint:** Sprint 4  
**Milestone:** 4

**Sous-tâches :**
- [ ] `GET /kyc/session/{id}/biometric-status` : `{liveness: {status, score, attempts}, face_match: {status, score, verified}}`
- [ ] Masquer les scores bruts dans la réponse client (retourner seulement `passed/failed/pending`)
- [ ] Rate limit : max 1 polling/3s par session

---

### [BIO-10] Documentation — Benchmarks biométrie (FaceNet vs ArcFace)

**Labels:** `documentation`, `ai-engine`, `sprint-4`, `priority:medium`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 2h  
**Sprint:** Sprint 4  
**Milestone:** 4

**Sous-tâches :**
- [ ] Tester FaceNet-512 vs ArcFace sur 20 paires same-person + 20 paires different-person (images CNI camerounaises)
- [ ] Calculer FAR (False Accept Rate) et FRR (False Reject Rate) pour chaque modèle
- [ ] Documenter dans `docs/biometric-benchmarks.md` avec tableau comparatif
- [ ] Choisir et documenter le seuil optimal + justification dans ADR

---

### [BIO-11] Backend — Endpoint pipeline status complet

**Labels:** `backend`, `sprint-4`, `priority:medium`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 1h  
**Sprint:** Sprint 4  
**Milestone:** 4

**Sous-tâches :**
- [ ] `GET /kyc/session/{id}/pipeline-status` : `{ocr: {paddle, glm}, biometrics: {liveness, face_match}, score, flags}`
- [ ] Utilisé par PWA pour afficher progression globale du traitement
- [ ] Timeout global 120s sans completion → status = PROCESSING_ERROR + notification agent

---

### [BIO-12] Backend — Biometric Data Retention Policy

**Labels:** `backend`, `security`, `compliance`, `sprint-4`, `priority:medium`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 2h  
**Sprint:** Sprint 4  
**Milestone:** 4

**Sous-tâches :**
- [ ] Définir politique : images biométriques (selfie, portrait CNI) supprimées 30j après clôture dossier
- [ ] Script `scripts/purge_biometric_data.py` : supprimer fichiers + mettre `documents.purged_at`
- [ ] Celery Beat task `purge_old_biometric_data` : cron quotidien 03:00
- [ ] Conserver uniquement les hash SHA-256 et les scores (pas les images brutes)
- [ ] Documenter dans ADR et rapport PFE (conformité Loi 2024-017 Cameroun)
- [ ] Audit log : `BIOMETRIC_DATA_PURGED` avec `session_id`, `files_deleted_count`

---
## Sprint 5 - KYC State Machine & Business Logic

### [KYC-SM-01] Backend — KYC State Machine Engine

**Labels:** `backend`, `business-logic`, `sprint-5`, `priority:critical`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 6h  
**Sprint:** Sprint 5  
**Milestone:** 4

**Sous-tâches :**
- [ ] Créer `services/kyc/state_machine.py` : toutes les transitions depuis l'architecture
- [ ] États : `DRAFT → PENDING_KYC → COMPLIANCE_REVIEW → READY_FOR_OPS → PROVISIONING → ACTIVATED_FULL` + états terminaux
- [ ] Chaque transition : `transition(session, event, actor_id) -> new_status` avec guards
- [ ] Guards : ex. `PENDING_KYC → COMPLIANCE_REVIEW` requiert `global_confidence_score IS NOT NULL`
- [ ] Chaque transition insère dans `audit_logs` : event, old_status, new_status, actor_id, timestamp, sha256_payload
- [ ] `access_level` mis à jour automatiquement selon état KYC
- [ ] Tests : toutes les transitions valides ET invalides (guard failure)

---

### [KYC-SM-02] Backend — Duplicate Detection Service

**Labels:** `backend`, `business-logic`, `sprint-5`, `priority:high`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 3h  
**Sprint:** Sprint 5  
**Milestone:** 4

**Sous-tâches :**
- [ ] Activer `pg_trgm` : `CREATE EXTENSION IF NOT EXISTS pg_trgm`
- [ ] Index GIN sur `users.nom || ' ' || users.prenom` pour similarity search
- [ ] Fonction `check_duplicate(nom, prenom, ddn, numero_cni) -> List[DuplicateMatch]`
- [ ] CNI exact match → flag `DUPLICATE_EXACT` (fraude évidente)
- [ ] Nom+Prénom fuzzy + même DDN → flag `POSSIBLE_DUPLICATE`
- [ ] Flag stocké dans `kyc_sessions.flags (JSONB array)`
- [ ] Tests : même CNI deux fois, homonyme, personnes différentes

---

### [KYC-SM-03] Backend — Endpoint soumission dossier complet

**Labels:** `backend`, `sprint-5`, `priority:critical`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 4h  
**Sprint:** Sprint 5  
**Milestone:** 4

**Sous-tâches :**
- [ ] `POST /kyc/session/{id}/submit` : orchestrer validation finale avant DRAFT→PENDING_KYC
- [ ] Checklist : CNI recto ✓, CNI verso ✓, selfie ✓, OCR ✓, biometrics ✓, consent ✓
- [ ] Si incomplet → 422 avec liste des items manquants
- [ ] Déclencher scoring final, duplicate check, transition state machine
- [ ] Réponse : `{session_id, status: "PENDING_KYC", queue_position: N, estimated_review_time: "~1h"}`
- [ ] Notification client : "Votre dossier est en cours de vérification"
- [ ] Audit log : `DOSSIER_SUBMITTED`

---

### [KYC-SM-04] Backend — Audit Log SHA-256 Integrity Service

**Labels:** `backend`, `security`, `compliance`, `sprint-5`, `priority:high`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 2h  
**Sprint:** Sprint 5  
**Milestone:** 4

**Sous-tâches :**
- [ ] Service `services/audit/audit_service.py` : `log_event(session_id, event_type, payload, actor_id)`
- [ ] SHA-256 payload : `sha256(json.dumps({event, session_id, old_status, new_status, timestamp}, sort_keys=True))`
- [ ] Stocker dans `audit_logs.sha256_hash`
- [ ] Endpoint `GET /audit-logs/{id}/verify` : recalculer hash vs stocké → `{valid: bool}`
- [ ] Tests : hash valide, hash tampered (modif payload → hash différent)

---

### [KYC-SM-05] DB — Migration state machine + access levels

**Labels:** `database`, `sprint-5`, `priority:high`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 1h  
**Sprint:** Sprint 5  
**Milestone:** 4

**Sous-tâches :**
- [ ] Vérifier migration `001_initial` : tous les états KYC présents dans contrainte CHECK
- [ ] Ajouter colonne `kyc_sessions.access_level` (enum : NONE, LIMITED, FULL, BLOCKED)
- [ ] Ajouter colonne `kyc_sessions.flags (JSONB)` avec default `[]`
- [ ] Ajouter colonne `kyc_sessions.biometric_status` (PENDING/PROCESSING/COMPLETED/FAILED)

---

### [KYC-SM-06] Backend — Access Level Management Service

**Labels:** `backend`, `business-logic`, `sprint-5`, `priority:medium`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 2h  
**Sprint:** Sprint 5  
**Milestone:** 4

**Sous-tâches :**
- [ ] Service `services/kyc/access_level_service.py` : calcul access level basé sur état KYC + NIU + AML
- [ ] `ACTIVATED_FULL` + NIU document → `access_level = FULL`
- [ ] `ACTIVATED_FULL` + NIU déclaratif → `access_level = LIMITED`
- [ ] AML confirmed → `access_level = BLOCKED`
- [ ] `GET /user/access-level` : retourner niveau d'accès courant

---

### [KYC-SM-07] Backend — Pipeline orchestration post-upload

**Labels:** `backend`, `celery`, `sprint-5`, `priority:high`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 2h  
**Sprint:** Sprint 5  
**Milestone:** 4

**Sous-tâches :**
- [ ] Signal post-upload CNI Verso → auto-trigger `run_glm_ocr_async`
- [ ] Signal post-upload selfie → auto-trigger `run_biometrics_pipeline`
- [ ] Signal post-biometrics completed → auto-trigger `compute_global_score`
- [ ] Signal post-score computed → auto-trigger AML screening
- [ ] Timeout global 120s → PROCESSING_ERROR + notification agent

---

### [KYC-SM-08] Backend — KYC Checklist Validation Service

**Labels:** `backend`, `sprint-5`, `priority:medium`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 2h  
**Sprint:** Sprint 5  
**Milestone:** 4

**Sous-tâches :**
- [ ] Service `services/kyc/checklist_service.py` : `get_checklist(session_id) -> ChecklistResult`
- [ ] Items : cni_recto, cni_verso, selfie, address, niu, consent, ocr_completed, biometrics_completed
- [ ] Retourner `{completed: bool, missing_items: [...], completion_percent: float}`
- [ ] Endpoint `GET /kyc/session/{id}/checklist`

---

### [KYC-SM-09] Backend — Session Expiry & Cleanup Celery

**Labels:** `backend`, `celery`, `sprint-5`, `priority:medium`  
**Epic:** Epic 4 — AI Engine  
**Estimate:** 2h  
**Sprint:** Sprint 5  
**Milestone:** 4

**Sous-tâches :**
- [ ] Celery Beat task `expire_stale_sessions` : cron toutes les heures
- [ ] Sessions `DRAFT` inactives depuis > 72h → status = `EXPIRED`
- [ ] Sessions `PENDING_INFO` sans réponse depuis > 7j → status = `EXPIRED`
- [ ] Notification client avant expiration (24h avant) : "Votre dossier expire dans 24h"
- [ ] Audit log : `SESSION_EXPIRED` avec raison
- [ ] Purger fichiers documents associés aux sessions expirées (script `cleanup_expired_docs.py`)
- [ ] Tests : session DRAFT 73h → expirée, session récente → non touchée

---
## Sprint 6 - Offline Support & Back-Office Foundation

### [OFFLINE-01] PWA — Background Sync & Retry Queue

**Labels:** `frontend`, `pwa`, `offline`, `sprint-6`, `priority:high`  
**Epic:** Epic 2 — Capture Journey  
**Estimate:** 5h  
**Sprint:** Sprint 6  
**Milestone:** 5

**Sous-tâches :**
- [ ] Implémenter `UploadQueue` dans Service Worker : file d'attente persistente des requêtes échouées
- [ ] Background Sync API (`navigator.serviceWorker.ready.sync.register('upload-retry')`)
- [ ] Retry avec exponential backoff : 5s → 15s → 45s → abandon + notification UI
- [ ] Badge compteur "X uploads en attente" dans header PWA
- [ ] Test scénario "ENEO Blackout" : upload → couper réseau → reconnecter → upload complété auto
- [ ] Test sur Android Chrome (pas seulement desktop)

---

### [OFFLINE-02] Backend — Session Resumption API

**Labels:** `backend`, `offline`, `sprint-6`, `priority:high`  
**Epic:** Epic 2 — Capture Journey  
**Estimate:** 3h  
**Sprint:** Sprint 6  
**Milestone:** 5

**Sous-tâches :**
- [ ] `GET /kyc/session/current` : état courant (statut, last_step, documents uploadés)
- [ ] Au chargement PWA : comparer état serveur vs IndexedDB → utiliser le plus avancé
- [ ] Si conflit (documents en IndexedDB non sur serveur) → déclencher upload automatique
- [ ] `DELETE /kyc/session/{id}/cache` : purger session (3-strike lockout "Recommencer")

---

### [OFFLINE-03] PWA — Vérification SHA-256 avant re-upload

**Labels:** `frontend`, `pwa`, `offline`, `sprint-6`, `priority:medium`  
**Epic:** Epic 2 — Capture Journey  
**Estimate:** 2h  
**Sprint:** Sprint 6  
**Milestone:** 5

**Sous-tâches :**
- [ ] Avant chaque upload de reprise, appeler `POST /kyc/capture/verify-checksum`
- [ ] Si `{already_uploaded: true}` → skip upload, utiliser `document_id` retourné
- [ ] Purger entrée IndexedDB après confirmation serveur
- [ ] Log "Reprise sans re-upload" pour debugging

---

### [OFFLINE-04] PWA — Purge IndexedDB après confirmation serveur

**Labels:** `frontend`, `pwa`, `sprint-6`, `priority:medium`  
**Epic:** Epic 2 — Capture Journey  
**Estimate:** 1h  
**Sprint:** Sprint 6  
**Milestone:** 5

**Sous-tâches :**
- [ ] Après upload confirmé (200 OK avec `document_id`), supprimer entrée IndexedDB correspondante
- [ ] Conserver uniquement `session_metadata` et `step_progress` en IndexedDB
- [ ] Tester : IndexedDB ne contient plus d'images après soumission réussie

---

### [OFFLINE-05] Back-Office React — Setup & Layout Global

**Labels:** `backoffice`, `frontend`, `sprint-6`, `priority:critical`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 5h  
**Sprint:** Sprint 6  
**Milestone:** 5

**Sous-tâches :**
- [ ] Initialiser app React + TypeScript + Vite + TailwindCSS dans `backoffice/`
- [ ] Layout global : Sidebar navigation + Header avec user dropdown + Breadcrumbs
- [ ] Sidebar items : Dashboard, File d'attente, Analytics, AML, Administration, Paramètres
- [ ] Routing React Router v6 : routes protégées par rôle
- [ ] Responsive : desktop-first 1920x1080 minimum

---

### [OFFLINE-06] Back-Office React — Auth Guard & Role Guard

**Labels:** `backoffice`, `frontend`, `auth`, `sprint-6`, `priority:high`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 2h  
**Sprint:** Sprint 6  
**Milestone:** 5

**Sous-tâches :**
- [ ] Composant `<AuthGuard />` : redirect /login si pas de token valide
- [ ] Composant `<RoleGuard role="AGENT_KYC" />` : afficher 403 si mauvais rôle
- [ ] Hook `useAuth()` : décoder JWT, exposer `{user, role, logout}`
- [ ] Intercepteur Axios : refresh token automatique si 401

---

### [OFFLINE-07] Back-Office React — Design System & Composants de base

**Labels:** `backoffice`, `frontend`, `sprint-6`, `priority:medium`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 3h  
**Sprint:** Sprint 6  
**Milestone:** 5

**Sous-tâches :**
- [ ] Configurer TailwindCSS avec palette BICEC (bleu, blanc, gris)
- [ ] Créer composants : `<Badge />`, `<StatusChip />`, `<ConfidenceBar />`, `<DataTable />`, `<Modal />`
- [ ] `<ConfidenceBar />` : barre de couleur (vert/jaune/rouge selon score)
- [ ] `<StatusChip />` : chip coloré par statut KYC

---

### [OFFLINE-08] PWA — Service Worker Update Flow & Version Management

**Labels:** `frontend`, `pwa`, `offline`, `sprint-6`, `priority:medium`  
**Epic:** Epic 2 — Capture Journey  
**Estimate:** 2h  
**Sprint:** Sprint 6  
**Milestone:** 5

**Sous-tâches :**
- [ ] Détecter nouveau Service Worker en attente (`registration.waiting`)
- [ ] Afficher banner non-intrusif : "Mise à jour disponible — Actualiser"
- [ ] Bouton "Actualiser" → `skipWaiting()` + `location.reload()`
- [ ] Ne jamais forcer l'update automatiquement si upload en cours (vérifier upload queue vide)
- [ ] Versionner le SW : `const SW_VERSION = "1.0.0"` → log dans console pour debugging

---

## Sprint 7 - Back-Office Core Features

### [BO-01] Backend — Agent Load Balancer (Smooth WRR + Least Connections)

**Labels:** `backend`, `backoffice`, `sprint-7`, `priority:critical`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 6h  
**Sprint:** Sprint 7  
**Milestone:** 5

⚠️ Livrable PFE primaire — Agent Load Balancing.

**Sous-tâches :**
- [ ] Créer `services/backoffice/load_balancer.py`
- [ ] Algorithme Smooth Weighted Round Robin (WRR) avec `capacity_weight` par agent
- [ ] Least Connections overlay : si même priorité WRR → agent avec moins de dossiers ouverts
- [ ] Redis counter `agent_active_dossiers:{agent_id}` : incrément à assignation, décrément à fermeture
- [ ] Contraintes : max 10 dossiers simultanés par agent, respecter disponibilité/pause
- [ ] `POST /backoffice/queue/assign` : sélectionner dossier + agent optimal
- [ ] `GET /backoffice/queue/agent/{id}` : dossiers assignés, triés priorité
- [ ] Logger chaque assignment dans `agent_assignments` table
- [ ] Tests : 3 agents de capacités différentes + 10 dossiers → vérifier distribution

---

### [BO-02] Backend — Queue API avec priorité et pagination cursor

**Labels:** `backend`, `backoffice`, `sprint-7`, `priority:critical`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 4h  
**Sprint:** Sprint 7  
**Milestone:** 5

**Sous-tâches :**
- [ ] `GET /backoffice/queue` : dossiers PENDING_KYC + PENDING_INFO triés par `(flags_count DESC, global_confidence_score ASC, created_at ASC)`
- [ ] Filtres : `status`, `agent_id`, `date_range`, `has_flags`
- [ ] Pagination cursor-based (performance sur 1000+ dossiers)
- [ ] Response : `{id, client_name, global_score, flags, age_hours, assigned_agent}`
- [ ] `POST /backoffice/queue/dossier/{id}/claim` : lock optimiste 30min (Redis TTL)
- [ ] `GET /backoffice/queue/stats` : `{total_pending, avg_wait_hours, oldest_dossier_age_hours}`

---
### [BO-03] Back-Office React — Jean's Queue View

**Labels:** `backoffice`, `frontend`, `sprint-7`, `priority:critical`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 5h  
**Sprint:** Sprint 7  
**Milestone:** 5

**Sous-tâches :**
- [ ] Page `ValidationQueue` : tableau dossiers (ID, Nom, Score, Flags, Âge, Agent assigné)
- [ ] Color coding : vert (score > 0.85), jaune (0.65-0.85), rouge (<0.65 ou flags)
- [ ] Badges flags : "DUPLICATE", "LOW_OCR", "LIVENESS_SUSPICIOUS", "NIU_DECLARATIF"
- [ ] Filtres par statut, date, agent
- [ ] Bouton "Prendre en charge" → `POST /backoffice/queue/dossier/{id}/claim` → redirect Dossier Detail
- [ ] Auto-refresh toutes les 30 secondes

---

### [BO-04] Back-Office React — Evidence Viewer "Zoom + Compare"

**Labels:** `backoffice`, `frontend`, `sprint-7`, `priority:critical`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 7h  
**Sprint:** Sprint 7  
**Milestone:** 5

⚠️ UX Spec v2 — C'est ce que BICEC veut voir en démo.

**Sous-tâches :**
- [ ] Layout 3 colonnes : [Images originales] | [Champs OCR extraits] | [Actions]
- [ ] Viewer image : CNI Recto + CNI Verso + Selfie + Facture (onglets switchables)
- [ ] Zoom pan sur image (react-zoom-pan-pinch ou custom canvas)
- [ ] Champs OCR éditables avec indicateur confiance par champ
- [ ] Hover sur champ OCR → highlight bounding box sur image
- [ ] Panneau biométrique : score face match + score liveness (jauge visuelle)
- [ ] Panneau flags : liste alertes avec description
- [ ] Backend `GET /backoffice/dossier/{id}/detail` : toutes les données du dossier
- [ ] Audit log : `DOSSIER_VIEWED` à l'ouverture

---

### [BO-05] Backend — Dossier Detail Endpoint complet

**Labels:** `backend`, `backoffice`, `sprint-7`, `priority:critical`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 3h  
**Sprint:** Sprint 7  
**Milestone:** 5

**Sous-tâches :**
- [ ] `GET /backoffice/dossier/{id}/detail` : agréger toutes les données (user, session, documents, ocr_fields, biometric_results, flags, audit_log)
- [ ] Endpoint retourne URLs signées temporaires pour chaque image (TTL 15min)
- [ ] RBAC : AGENT_KYC, SUPERVISOR_AML, OPERATIONS_MANAGER seulement
- [ ] Audit log : `DOSSIER_VIEWED` à chaque appel

---

### [BO-06] Backend — Image Serving Endpoint sécurisé

**Labels:** `backend`, `security`, `sprint-7`, `priority:high`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 2h  
**Sprint:** Sprint 7  
**Milestone:** 5

**Sous-tâches :**
- [ ] `GET /backoffice/dossier/{id}/image/{doc_type}` : streamer l'image via FastAPI `FileResponse`
- [ ] Vérification JWT + ownership avant accès (agent ne peut voir que ses dossiers assignés)
- [ ] Headers : `Content-Disposition: inline`, `Cache-Control: no-store`
- [ ] Rate limit : max 60 requêtes/minute par agent (éviter scraping)

---

### [BO-07] DB — Migration `agent_assignments` + `backoffice_locks`

**Labels:** `database`, `backoffice`, `sprint-7`, `priority:high`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 1h  
**Sprint:** Sprint 7  
**Milestone:** 5

**Sous-tâches :**
- [ ] Migration `008_backoffice` : table `agent_assignments` (session_id, agent_id, assigned_at, completed_at, assignment_method WRR/MANUAL)
- [ ] Table `backoffice_locks` : (session_id, agent_id, lock_expires_at) — lock optimiste
- [ ] Index sur `agent_assignments.agent_id`, `agent_assignments.assigned_at`

---

### [BO-08] Backend — Agent Availability & Workload API

**Labels:** `backend`, `backoffice`, `sprint-7`, `priority:medium`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 2h  
**Sprint:** Sprint 7  
**Milestone:** 5

**Sous-tâches :**
- [ ] `PATCH /backoffice/agents/{id}/availability` : `{available: bool}` — agent se met en pause
- [ ] `GET /backoffice/agents/workload` : `[{agent_id, name, active_dossiers, capacity_weight, available}]`
- [ ] Redis counter `agent_active_dossiers:{agent_id}` : décrémenter à approve/reject/request-info
- [ ] Tests : agent en pause → non sélectionné par load balancer

---

### [BO-09] Back-Office React — Real-time Queue Stats Banner

**Labels:** `backoffice`, `frontend`, `sprint-7`, `priority:medium`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 2h  
**Sprint:** Sprint 7  
**Milestone:** 5

**Sous-tâches :**
- [ ] Banner en haut de la Queue View : "X dossiers en attente · Délai moyen Yh · Plus ancien : Zh"
- [ ] Appel `GET /backoffice/queue/stats` au chargement + toutes les 30s
- [ ] Alerte visuelle (rouge) si dossier en attente depuis > 24h (SLA breach)

---

## Sprint 8 - Back-Office Actions & Notifications

### [BO-10] Backend + Back-Office — Approve / Reject / Request Info

**Labels:** `backend`, `backoffice`, `frontend`, `sprint-8`, `priority:critical`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 6h  
**Sprint:** Sprint 8  
**Milestone:** 5

**Sous-tâches :**
- [ ] `POST /backoffice/dossier/{id}/approve` : transition → COMPLIANCE_REVIEW (ou READY_FOR_OPS si pas de flag AML) + audit log `DOSSIER_APPROVED`
- [ ] `POST /backoffice/dossier/{id}/reject` : body `{reason_code, comment}` → REJECTED + audit log `DOSSIER_REJECTED`
- [ ] `POST /backoffice/dossier/{id}/request-info` : body `{requested_fields: [...], message}` → PENDING_INFO + notification client
- [ ] `POST /backoffice/dossier/{id}/correct-ocr` : correction champ → `ocr_metrics.correction_made=true`
- [ ] RBAC : seul AGENT_KYC peut appeler ces endpoints
- [ ] Front : modal confirmation avant Reject ("Action irréversible")
- [ ] Front : formulaire Request Info avec checkboxes champs + message libre
- [ ] Tests : approve valide, reject sans raison (422), double approve (idempotent)

---

### [BO-11] Backend — Notification Polling System

**Labels:** `backend`, `notifications`, `sprint-8`, `priority:high`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 4h  
**Sprint:** Sprint 8  
**Milestone:** 5

**Sous-tâches :**
- [ ] Table `notifications` : `id`, `user_id`, `type`, `payload (JSONB)`, `read_at`, `created_at`
- [ ] `GET /notifications?since={timestamp}` : notifications non-lues depuis timestamp
- [ ] PWA polling : foreground = 15s, background (document.hidden) = 60s
- [ ] Types : `DOSSIER_APPROVED`, `DOSSIER_REJECTED`, `INFO_REQUESTED`, `SESSION_STATUS_CHANGED`
- [ ] `POST /notifications/{id}/read` : marquer comme lu
- [ ] Celery task `send_sms_notification` : Orange SMS fallback pour alertes critiques
- [ ] Tests : polling retourne nouvelles notifs, notifs lues disparaissent

---

### [BO-12] Backend — Amplitude Mock Provisioning Service

**Labels:** `backend`, `integration`, `sprint-8`, `priority:medium`  
**Epic:** Epic 6 — Thomas AML  
**Estimate:** 4h  
**Sprint:** Sprint 8  
**Milestone:** 5

**Sous-tâches :**
- [ ] Créer `services/provisioning/amplitude_mock.py`
- [ ] `POST /mock/amplitude/provision` : simuler délai 2-5s, retourner `{account_id: "BICEC-{uuid}", status: "PROVISIONED"}`
- [ ] Logger chaque appel dans `provisioning_logs` table
- [ ] Celery task `trigger_amplitude_provisioning(session_id)` : déclenché sur READY_FOR_OPS → PROVISIONING
- [ ] Documenter dans ADR-012 : "Amplitude Mock Strategy — Pourquoi et comment migrer Phase 2"

---

### [BO-13] Back-Office React — Notification Bell UI

**Labels:** `backoffice`, `frontend`, `sprint-8`, `priority:high`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 3h  
**Sprint:** Sprint 8  
**Milestone:** 5

**Sous-tâches :**
- [ ] Icône cloche dans Header avec badge compteur non-lus
- [ ] Dropdown liste des 10 dernières notifications avec timestamp relatif ("il y a 5 min")
- [ ] Click sur notification → redirect vers dossier concerné
- [ ] Polling `GET /notifications?since={last_check}` toutes les 30s
- [ ] `POST /notifications/read-all` : marquer toutes comme lues

---

### [BO-14] Back-Office React — Reject Reason Codes UI

**Labels:** `backoffice`, `frontend`, `sprint-8`, `priority:medium`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 2h  
**Sprint:** Sprint 8  
**Milestone:** 5

**Sous-tâches :**
- [ ] Liste de codes de rejet dans `core/reject_reasons.py` : IDENTITY_MISMATCH, DOCUMENT_EXPIRED, LOW_QUALITY_IMAGE, LIVENESS_FAIL, DUPLICATE_DETECTED, AML_FLAGGED, INCOMPLETE_DOSSIER, OTHER
- [ ] Formulaire Reject : radio buttons pour reason_code + textarea commentaire libre (obligatoire si OTHER)
- [ ] Afficher reason_code traduit en français dans historique dossier
- [ ] Tests : rejet sans reason_code → 422

---

### [BO-15] Back-Office React — Dossier History Timeline

**Labels:** `backoffice`, `frontend`, `sprint-8`, `priority:medium`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 3h  
**Sprint:** Sprint 8  
**Milestone:** 5

**Sous-tâches :**
- [ ] Composant `<DossierTimeline />` : liste chronologique des événements audit_logs
- [ ] Icône par type d'événement (upload, OCR, biométrie, approbation, rejet, etc.)
- [ ] Afficher actor (Marie, Jean, Système) avec avatar
- [ ] Endpoint `GET /backoffice/dossier/{id}/history` : audit_logs filtrés par session_id, triés DESC

---

### [BO-16] Back-Office React — Audit Log Viewer (Sylvie)

**Labels:** `backoffice`, `frontend`, `sprint-8`, `priority:medium`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 3h  
**Sprint:** Sprint 8  
**Milestone:** 5

**Sous-tâches :**
- [ ] Page `/backoffice/audit-logs` (MANAGER only)
- [ ] Tableau avec filtres : event_type, session_id, agent_id, date_range
- [ ] Colonne SHA-256 tronquée (8 chars) + bouton "Vérifier intégrité" → appel `/audit-logs/{id}/verify`
- [ ] Export CSV : `GET /audit-logs/export?date_from={}&date_to={}&format=csv`
- [ ] Pagination cursor-based

---

### [BO-17] DB — Migration `provisioning_logs` + `agent_assignments`

**Labels:** `database`, `sprint-8`, `priority:medium`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 1h  
**Sprint:** Sprint 8  
**Milestone:** 5

**Sous-tâches :**
- [ ] Migration `009_provisioning` : table `provisioning_logs` (session_id, mock_account_id, payload_sent JSONB, response_received JSONB, latency_ms, created_at)
- [ ] Ajouter colonne `kyc_sessions.provisioned_account_id`

---

### [BO-18] Backend — Dossier Reassignment (Agent Absence)

**Labels:** `backend`, `backoffice`, `sprint-8`, `priority:medium`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 2h  
**Sprint:** Sprint 8  
**Milestone:** 5

**Sous-tâches :**
- [ ] `POST /backoffice/dossier/{id}/reassign {agent_id}` (MANAGER only)
- [ ] Libérer lock Redis de l'ancien agent, assigner au nouvel agent
- [ ] Audit log : `DOSSIER_REASSIGNED` avec `from_agent_id`, `to_agent_id`, `reason`
- [ ] Back-office UI : bouton "Réassigner" visible Sylvie dans queue view avec modal sélection agent
- [ ] Tests : réassignation valide, agent cible non disponible (422)

---

### [BO-19] Backend — SLA Breach Detection & Escalation Auto

**Labels:** `backend`, `backoffice`, `celery`, `sprint-8`, `priority:medium`  
**Epic:** Epic 5 — Jean's Desk  
**Estimate:** 2h  
**Sprint:** Sprint 8  
**Milestone:** 5

**Sous-tâches :**
- [ ] Celery Beat task `check_sla_breaches` : cron toutes les 30min
- [ ] SLA défini : dossier PENDING_KYC depuis > 2h sans prise en charge → breach
- [ ] Sur breach : notifier Sylvie (MANAGER), flag `sla_breach=true` dans session
- [ ] `GET /backoffice/queue/stats` inclure `{sla_breaches_today: N}`
- [ ] Back-office : badge rouge sur dossier en SLA breach dans Queue View

---
## Sprint 9 - KYC Address, NIU & Consent

### [KYC-ADDR-01] Backend + PWA — Address Cascade API & UI

**Labels:** `backend`, `frontend`, `pwa`, `sprint-9`, `priority:high`  
**Epic:** Epic 3 — Address & Consent  
**Estimate:** 5h  
**Sprint:** Sprint 9  
**Milestone:** 6

**Sous-tâches :**
- [ ] Créer table `cameroon_geo` : `ville`, `commune`, `quartier`, `lieu_dit`
- [ ] Seeder avec données réelles des villes camerounaises
- [ ] Endpoints : `GET /geo/villes`, `GET /geo/communes?ville={v}`, `GET /geo/quartiers?commune={c}`, `GET /geo/lieux?quartier={q}`
- [ ] PWA : 4 dropdowns progressifs (chaque sélection débloque le suivant)
- [ ] Stocker adresse dans `kyc_sessions.address`
- [ ] Tests : sélection complète valide, quartier invalide (404)

---

### [KYC-ADDR-02] PWA — GPS Auto-fill & Privacy Notice

**Labels:** `frontend`, `pwa`, `privacy`, `sprint-9`, `priority:medium`  
**Epic:** Epic 3 — Address & Consent  
**Estimate:** 3h  
**Sprint:** Sprint 9  
**Milestone:** 6

**Sous-tâches :**
- [ ] Bouton "Utiliser ma position" : appeler `navigator.geolocation.getCurrentPosition()`
- [ ] Afficher notice RGPD avant de demander la permission GPS
- [ ] Stocker coordonnées chiffrées AES-256 dans `kyc_sessions.gps_coordinates`
- [ ] Calculer distance GPS vs centroïde quartier sélectionné
- [ ] Si distance > `GPS_COHERENCE_THRESHOLD_KM` → banner non-bloquant
- [ ] Permission refusée → masquer bouton GPS, continuer sans coordonnées

---

### [KYC-ADDR-03] DB — Migration `cameroon_geo` + seeder

**Labels:** `database`, `sprint-9`, `priority:high`  
**Epic:** Epic 3 — Address & Consent  
**Estimate:** 2h  
**Sprint:** Sprint 9  
**Milestone:** 6

**Sous-tâches :**
- [ ] Migration `010_geo` : table `cameroon_geo` (id, region, ville, commune, quartier, lieu_dit, lat, lng)
- [ ] Index sur `(region, ville, commune, quartier)`
- [ ] Script `scripts/seed_geo.py` : importer données GeoNames Cameroun + ajouts manuels (quartiers Yaoundé, Douala, Bafoussam)
- [ ] Vérifier couverture : toutes les 10 régions, 58 départements, villes principales

---

### [KYC-ADDR-04] PWA — Adresse GPS Coherence UI Feedback

**Labels:** `frontend`, `pwa`, `sprint-9`, `priority:low`  
**Epic:** Epic 3 — Address & Consent  
**Estimate:** 1h  
**Sprint:** Sprint 9  
**Milestone:** 6

**Sous-tâches :**
- [ ] Si distance GPS > threshold → afficher banner jaune non-bloquant : "Votre position GPS semble éloignée du quartier sélectionné. Vous pouvez continuer."
- [ ] Ne pas bloquer la progression : coherence GPS est informatif, pas obligatoire
- [ ] Log le flag `gps_coherence_mismatch=true` dans `kyc_sessions.flags`

---

### [KYC-BILL-01] Backend + PWA — Upload facture utilitaire & GLM-OCR

**Labels:** `backend`, `frontend`, `pwa`, `ocr`, `sprint-9`, `priority:high`  
**Epic:** Epic 3 — Address & Consent  
**Estimate:** 5h  
**Sprint:** Sprint 9  
**Milestone:** 6

**Sous-tâches :**
- [ ] PWA : toggle ENEO / CAMWATER + upload photo facture (réutiliser `<CameraCapture />`)
- [ ] Backend `POST /kyc/capture/utility_bill {utility_type: ENEO|CAMWATER}` : stocker + queue GLM-OCR
- [ ] GLM-OCR extraction : date de facturation, nom agence ENEO/CAMWATER
- [ ] Mapping agence → agence BICEC la plus proche (table `bicec_agency_zones`)
- [ ] Stocker dans `kyc_sessions.assigned_agency_id`
- [ ] PWA : afficher résultats extraits pour review/correction
- [ ] Tests : facture ENEO valide, GLM-OCR extraction, mapping agence

---

### [KYC-BILL-02] DB + Backend — BICEC Agency Zones Mapping

**Labels:** `backend`, `database`, `sprint-9`, `priority:medium`  
**Epic:** Epic 3 — Address & Consent  
**Estimate:** 2h  
**Sprint:** Sprint 9  
**Milestone:** 6

**Sous-tâches :**
- [ ] Table `bicec_agencies` : id, name, city, district, address, lat, lng
- [ ] Table `bicec_agency_zones` : agency_id, eneo_zone_code, camwater_zone_code
- [ ] Script `scripts/seed_bicec_agencies.py` : 10 agences BICEC principales
- [ ] Service `services/geo/agency_mapper.py` : `get_nearest_agency(utility_type, zone_code) -> BICECAgency`

---

### [KYC-NIU-01] Backend + PWA — Déclaration ou Upload NIU

**Labels:** `backend`, `frontend`, `pwa`, `sprint-9`, `priority:high`  
**Epic:** Epic 3 — Address & Consent  
**Estimate:** 4h  
**Sprint:** Sprint 9  
**Milestone:** 6

**Sous-tâches :**
- [ ] PWA : deux options — "Uploader mon attestation NIU" / "Déclarer mon NIU manuellement"
- [ ] Upload NIU : `POST /kyc/capture/niu_document` → stocker + flag `niu_type=DOCUMENT`
- [ ] Déclaration manuelle : `POST /kyc/niu/declare {niu_number}` → validation Regex format camerounais
- [ ] Regex invalide → inline error : "Format NIU invalide (ex: M0XX12345678A)"
- [ ] Déclaration manuelle valide : `kyc_sessions.niu_declarative = true` → `access_level = LIMITED` à l'activation
- [ ] Note dossier pour Jean : "⚠️ NIU Déclaratif — Vérification manuelle requise"

---

### [KYC-NIU-02] Backend — NIU Validation Service

**Labels:** `backend`, `sprint-9`, `priority:medium`  
**Epic:** Epic 3 — Address & Consent  
**Estimate:** 2h  
**Sprint:** Sprint 9  
**Milestone:** 6

**Sous-tâches :**
- [ ] Service `services/kyc/niu_service.py` : validation format NIU camerounais (regex + checksum si applicable)
- [ ] `GET /kyc/session/{id}/niu-status` : `{niu_type: DOCUMENT|DECLARATIVE, verified: bool}`
- [ ] GLM-OCR prompt spécialisé pour extraction NIU depuis attestation scannée
- [ ] Tests : NIU format valide, NIU format invalide (regex fail), upload attestation NIU

---

### [KYC-CONS-01] Backend + PWA — Consentement Digital & Soumission dossier

**Labels:** `backend`, `frontend`, `pwa`, `sprint-9`, `priority:critical`  
**Epic:** Epic 3 — Address & Consent  
**Estimate:** 4h  
**Sprint:** Sprint 9  
**Milestone:** 6

**Sous-tâches :**
- [ ] PWA : 3 checkboxes NON pré-cochées : (1) CGU, (2) Politique Confidentialité, (3) Traitement données biométriques (Loi 2024-017)
- [ ] Bouton "Soumettre" désactivé jusqu'à ce que les 3 soient cochées
- [ ] Backend `POST /kyc/session/{id}/consent` : stocker `{cgu: true, privacy: true, data_processing: true, ip_address, user_agent, timestamp}` dans `kyc_sessions.consent_payload (JSONB)`
- [ ] Audit log : `CONSENT_SIGNED`
- [ ] PWA : écran confirmation avec numéro de dossier + délai estimé

---

### [KYC-CONS-02] Backend — CGU & Privacy Policy PDF Serving

**Labels:** `backend`, `sprint-9`, `priority:medium`  
**Epic:** Epic 3 — Address & Consent  
**Estimate:** 1h  
**Sprint:** Sprint 9  
**Milestone:** 6

**Sous-tâches :**
- [ ] Stocker CGU.pdf, PrivacyPolicy.pdf, BiometricDataPolicy.pdf dans `docs/legal/`
- [ ] Endpoint `GET /legal/{document_type}` : streamer PDF (no auth required)
- [ ] PWA : liens "Lire les CGU" ouvrent PDF dans nouvel onglet

---

### [KYC-CONS-03] DB — Migration colonnes consentement + NIU

**Labels:** `database`, `sprint-9`, `priority:high`  
**Epic:** Epic 3 — Address & Consent  
**Estimate:** 1h  
**Sprint:** Sprint 9  
**Milestone:** 6

**Sous-tâches :**
- [ ] Ajouter colonnes dans `kyc_sessions` : `consent_payload (JSONB)`, `niu_declarative (bool)`, `gps_coordinates (JSONB encrypted)`, `address (JSONB)`, `assigned_agency_id`
- [ ] Migration `011_consent_niu`

---

## Sprint 10 - AML Screening

### [AML-01] Backend — Seed PEP/Sanctions Lists & Weekly Sync Celery

**Labels:** `backend`, `aml`, `celery`, `sprint-10`, `priority:critical`  
**Epic:** Epic 6 — Thomas AML  
**Estimate:** 5h  
**Sprint:** Sprint 10  
**Milestone:** 6

**Sous-tâches :**
- [ ] Créer table `sanctions_entries` : id, full_name, aliases (JSONB), dob, nationality, list_source, risk_category (PEP/SANCTION/BOTH)
- [ ] Index GIN `pg_trgm` sur `full_name` + GIN sur `aliases`
- [ ] Script `scripts/import_sanctions.py` : parser et insérer OpenSanctions / UN Consolidated List / OFAC
- [ ] Celery beat : `sync_sanctions_weekly` — cron lundi 02:00
- [ ] Endpoint admin `POST /admin/sanctions/sync` (ADMIN role) : trigger manuel
- [ ] Migration Alembic `012_aml`

---

### [AML-02] Backend — Fuzzy Matching Engine

**Labels:** `backend`, `aml`, `sprint-10`, `priority:critical`  
**Epic:** Epic 6 — Thomas AML  
**Estimate:** 5h  
**Sprint:** Sprint 10  
**Milestone:** 6

⚠️ Livrable PFE primaire.

**Sous-tâches :**
- [ ] Service `services/aml/screening_service.py` : `screen_name(nom, prenom, ddn) -> List[AMLMatch]`
- [ ] Query pg_trgm : `SELECT * FROM sanctions_entries WHERE similarity(full_name, ?) > 0.6 ORDER BY similarity DESC LIMIT 10`
- [ ] Score composite : pg_trgm similarity + Jaro-Winkler + DDN exact match bonus
- [ ] Seuils : score > 0.85 → `ALERT`, 0.70-0.85 → `REVIEW`, < 0.70 → `CLEAR`
- [ ] Auto-trigger après soumission dossier (Celery task `run_aml_screening(session_id)`)
- [ ] Table `aml_alerts` : session_id, matched_entry_id, match_score, status (PENDING/CLEARED/CONFIRMED), reviewed_by, justification
- [ ] Tests : nom exact PEP → ALERT, homonyme proche → REVIEW, personne non listée → CLEAR

---
### [AML-03] Back-Office — Thomas AML Dashboard

**Labels:** `backoffice`, `frontend`, `aml`, `sprint-10`, `priority:high`  
**Epic:** Epic 6 — Thomas AML  
**Estimate:** 5h  
**Sprint:** Sprint 10  
**Milestone:** 6

**Sous-tâches :**
- [ ] Page `AMLAlerts` : liste alertes PENDING triées par score DESC
- [ ] Vue détail alerte : profil client vs profil sanctions side-by-side
- [ ] Action "Faux positif (homonyme)" : champ justification obligatoire → `POST /aml/alerts/{id}/clear`
- [ ] Action "Confirmer — Geler le compte" : `POST /aml/alerts/{id}/confirm` → `access_level = BLOCKED`
- [ ] Audit log : `AML_CLEARED`, `AML_CONFIRMED_FREEZE` avec justification stockée
- [ ] RBAC : seul SUPERVISOR_AML peut accéder

---

### [AML-04] Backend — AML Alert Management (Clear/Confirm/Escalate)

**Labels:** `backend`, `aml`, `sprint-10`, `priority:high`  
**Epic:** Epic 6 — Thomas AML  
**Estimate:** 3h  
**Sprint:** Sprint 10  
**Milestone:** 6

**Sous-tâches :**
- [ ] `POST /aml/alerts/{id}/clear` : body `{justification}` → status = CLEARED, dossier reprend son flux normal
- [ ] `POST /aml/alerts/{id}/confirm` : → status = CONFIRMED, `kyc_sessions.access_level = BLOCKED`, notification OPERATIONS_MANAGER
- [ ] `POST /aml/alerts/{id}/escalate` : → notifier Sylvie (MANAGER) si Thomas incertain
- [ ] Tests : clear sans justification (422), confirm → compte bloqué

---

### [AML-05] Backend — Account Freeze on AML Confirm

**Labels:** `backend`, `aml`, `security`, `sprint-10`, `priority:high`  
**Epic:** Epic 6 — Thomas AML  
**Estimate:** 2h  
**Sprint:** Sprint 10  
**Milestone:** 6

**Sous-tâches :**
- [ ] Transition state machine : `COMPLIANCE_REVIEW → REJECTED` (si AML confirmé)
- [ ] Mettre `kyc_sessions.access_level = BLOCKED`
- [ ] Révoquer tous les JWT actifs de l'utilisateur (supprimer refresh tokens Redis)
- [ ] Notifier client : "Votre dossier est en cours d'examen approfondi"
- [ ] Audit log : `ACCOUNT_FROZEN` avec `aml_alert_id`

---

### [AML-06] Backend — Weekly Sanctions Sync Celery Beat

**Labels:** `backend`, `aml`, `celery`, `sprint-10`, `priority:medium`  
**Epic:** Epic 6 — Thomas AML  
**Estimate:** 2h  
**Sprint:** Sprint 10  
**Milestone:** 6

**Sous-tâches :**
- [ ] Celery Beat task `sync_sanctions_weekly` : re-télécharger OpenSanctions, upsert (no DELETE), log durée
- [ ] Audit log : `SANCTIONS_SYNC_COMPLETED` avec `{records_added, records_updated, duration_s}`
- [ ] Alert si sync échoue : notification à ADMIN
- [ ] Idempotence : re-run sans doublon

---

### [AML-07] Backend — AML Audit Trail complet

**Labels:** `backend`, `aml`, `compliance`, `sprint-10`, `priority:medium`  
**Epic:** Epic 6 — Thomas AML  
**Estimate:** 2h  
**Sprint:** Sprint 10  
**Milestone:** 6

**Sous-tâches :**
- [ ] Logguer dans `audit_logs` tous les événements AML : `AML_SCREENING_TRIGGERED`, `AML_ALERT_CREATED`, `AML_CLEARED`, `AML_CONFIRMED_FREEZE`
- [ ] SHA-256 sur chaque événement AML (immutabilité)
- [ ] Endpoint `GET /aml/alerts/{id}/history` : chronologie complète de l'alerte

---

### [AML-08] DB — Migration tables AML

**Labels:** `database`, `aml`, `sprint-10`, `priority:high`  
**Epic:** Epic 6 — Thomas AML  
**Estimate:** 1h  
**Sprint:** Sprint 10  
**Milestone:** 6

**Sous-tâches :**
- [ ] Migration `012_aml` : tables `sanctions_entries` + `aml_alerts`
- [ ] Index GIN `pg_trgm` sur `sanctions_entries.full_name`
- [ ] Vérifier que `CREATE EXTENSION IF NOT EXISTS pg_trgm` est en tête de migration

---

### [AML-09] Backend — AML Screening Auto-trigger post-soumission

**Labels:** `backend`, `aml`, `celery`, `sprint-10`, `priority:high`  
**Epic:** Epic 6 — Thomas AML  
**Estimate:** 2h  
**Sprint:** Sprint 10  
**Milestone:** 6

**Sous-tâches :**
- [ ] Signal post-score : `compute_global_score` terminé → auto-trigger `run_aml_screening(session_id)`
- [ ] Si AML ALERT → transition `PENDING_KYC → COMPLIANCE_REVIEW` immédiate
- [ ] Si AML CLEAR → transition `PENDING_KYC → READY_FOR_OPS` (si score ≥ threshold)
- [ ] Tests : soumission dossier PEP → dossier va en COMPLIANCE_REVIEW

---

### [AML-10] Back-Office — Thomas AML Statistics Tab

**Labels:** `backoffice`, `frontend`, `aml`, `sprint-10`, `priority:low`  
**Epic:** Epic 6 — Thomas AML  
**Estimate:** 2h  
**Sprint:** Sprint 10  
**Milestone:** 6

**Sous-tâches :**
- [ ] Onglet "Statistiques AML" dans le dashboard Thomas
- [ ] Tiles : alertes PENDING, traitées aujourd'hui, taux faux positifs
- [ ] Graphique barre : alertes par semaine (Recharts)
- [ ] `GET /analytics/aml/stats` : données agrégées

---

### [AML-11] Backend — AML False Positive Rate Reporting

**Labels:** `backend`, `aml`, `analytics`, `sprint-10`, `priority:low`  
**Epic:** Epic 6 — Thomas AML  
**Estimate:** 2h  
**Sprint:** Sprint 10  
**Milestone:** 6

**Sous-tâches :**
- [ ] Vue SQL `v_aml_fp_rate` : `{week, alerts_total, cleared_fp, confirmed, fp_rate_pct}`
- [ ] Endpoint `GET /analytics/aml/fp-rate?weeks=4` (Thomas/Sylvie)
- [ ] Afficher dans onglet stats AML (AML-10)
- [ ] Alerte si FP rate > 80% (seuil de pertinence du moteur de matching)

---

## Sprint 11 - Analytics & Data Warehouse

### [ANALYTICS-01] Backend — Funnel Events Tracking

**Labels:** `backend`, `analytics`, `sprint-11`, `priority:critical`  
**Epic:** Epic 7 — Analytics  
**Estimate:** 4h  
**Sprint:** Sprint 11  
**Milestone:** 7

⚠️ Livrable PFE primaire.

**Sous-tâches :**
- [ ] Service `services/analytics/event_tracker.py` : `track_event(session_id, step, duration_ms, device_type, dropped=False)`
- [ ] Événements à tracker : STEP_STARTED, STEP_COMPLETED, STEP_DROPPED (si session abandonnée)
- [ ] Insérer dans `fact_kyc_funnel` du DWH
- [ ] Calcul taux de conversion par étape : (sessions step N+1) / (sessions step N)
- [ ] Endpoint `GET /analytics/funnel` : données pour graphique funnel

---

### [ANALYTICS-02] Backend — Star Schema Data Warehouse

**Labels:** `backend`, `analytics`, `database`, `sprint-11`, `priority:critical`  
**Epic:** Epic 7 — Analytics  
**Estimate:** 6h  
**Sprint:** Sprint 11  
**Milestone:** 7

⚠️ Livrable PFE primaire — Data Warehouse.

**Sous-tâches :**
- [ ] Tables dimension : `dim_date`, `dim_device`, `dim_agency`, `dim_step`, `dim_agent`
- [ ] Tables fait : `fact_kyc_funnel`, `fact_ocr_performance`, `fact_agent_load`, `fact_aml_screening`
- [ ] Script `scripts/refresh_dwh.py` : INSERT INTO fact SELECT WHERE date > last_refresh (cron 5min)
- [ ] Vue `v_ocr_observability` : FER par engine, temps moyen, correction rate, par jour
- [ ] Vue `v_agent_performance` : dossiers/agent/jour, temps moyen validation, FTR rate
- [ ] Export CSV/JSON `GET /analytics/export?table=funnel&format=csv` (Sylvie)
- [ ] Migration Alembic `013_dwh`
- [ ] Documenter star schema dans rapport PFE avec diagramme Mermaid

---

### [ANALYTICS-03] Back-Office — Sylvie's Command Dashboard

**Labels:** `backoffice`, `frontend`, `analytics`, `sprint-11`, `priority:high`  
**Epic:** Epic 7 — Analytics  
**Estimate:** 5h  
**Sprint:** Sprint 11  
**Milestone:** 7

**Sous-tâches :**
- [ ] Page `CommandCenter` avec tiles RYG (Recharts)
- [ ] Tiles : Queue SLA validés ≤ 2h, Liveness Failure Rate, Duplicate Alert Rate, Amplitude Batch Success, System Health
- [ ] Graphique funnel (bar chart horizontal Recharts)
- [ ] Graphique OCR FER par jour (line chart)
- [ ] Auto-refresh 30s
- [ ] `GET /analytics/dashboard` : toutes métriques en une requête (< 3s sur 1000 dossiers)
- [ ] Bouton "Escalader" sur dossier flaggé → réassignation prioritaire

---

### [ANALYTICS-04] Backend — Audit Log Viewer + COBAC Export

**Labels:** `backend`, `compliance`, `analytics`, `sprint-11`, `priority:high`  
**Epic:** Epic 7 — Analytics  
**Estimate:** 4h  
**Sprint:** Sprint 11  
**Milestone:** 7

**Sous-tâches :**
- [ ] `GET /audit-logs?session_id&agent_id&date_from&event_type` : recherche paginée
- [ ] Vérification SHA-256 à la demande : `GET /audit-logs/{id}/verify`
- [ ] `GET /backoffice/dossier/{id}/export-cobac` : générer archive ZIP contenant PDF summary (ReportLab), images originales CNI + selfie, JSON audit trail complet
- [ ] Export async (Celery task) + polling `GET /exports/{job_id}/status`
- [ ] Audit log de l'export lui-même : `COBAC_EXPORT_REQUESTED`

---

### [ANALYTICS-05] Backend — DWH Incremental Refresh Celery Cron

**Labels:** `backend`, `analytics`, `celery`, `sprint-11`, `priority:medium`  
**Epic:** Epic 7 — Analytics  
**Estimate:** 2h  
**Sprint:** Sprint 11  
**Milestone:** 7

**Sous-tâches :**
- [ ] Celery Beat task `refresh_dwh_incremental` : cron toutes les 5min
- [ ] Mettre à jour `dim_date` si nouveau jour
- [ ] Insérer nouveaux faits depuis `last_refresh_timestamp` stocké dans Redis
- [ ] Log durée de refresh dans `analytics_refresh_logs`

---

### [ANALYTICS-06] Back-Office React — Funnel Chart Component

**Labels:** `backoffice`, `frontend`, `analytics`, `sprint-11`, `priority:medium`  
**Epic:** Epic 7 — Analytics  
**Estimate:** 3h  
**Sprint:** Sprint 11  
**Milestone:** 7

**Sous-tâches :**
- [ ] Composant `<KYCFunnelChart />` : bar chart horizontal Recharts avec 7 étapes
- [ ] Afficher taux de conversion par étape en pourcentage
- [ ] Tooltip : "X sessions ont atteint cette étape (Y% de drop)"
- [ ] Filtres : date_range, device_type, agency

---

### [ANALYTICS-07] Back-Office React — Agent Performance Table

**Labels:** `backoffice`, `frontend`, `analytics`, `sprint-11`, `priority:medium`  
**Epic:** Epic 7 — Analytics  
**Estimate:** 2h  
**Sprint:** Sprint 11  
**Milestone:** 7

**Sous-tâches :**
- [ ] Tableau agents : nom, dossiers traités aujourd'hui, temps moyen validation, FTR (First Time Right) rate
- [ ] `GET /analytics/agents/performance?date_from={}&date_to={}`
- [ ] Tri par colonne, export CSV

---

### [ANALYTICS-08] Back-Office React — OCR Observability View

**Labels:** `backoffice`, `frontend`, `analytics`, `sprint-11`, `priority:medium`  
**Epic:** Epic 7 — Analytics  
**Estimate:** 3h  
**Sprint:** Sprint 11  
**Milestone:** 7

**Sous-tâches :**
- [ ] Page `/analytics/ocr` (Sylvie only)
- [ ] Tableau : FER par engine (PaddleOCR vs GLM-OCR) par jour
- [ ] Top 5 champs avec faible confiance (heatmap ou tableau coloré)
- [ ] Taux de corrections manuelles par agent
- [ ] Données depuis `v_ocr_observability`

---

### [ANALYTICS-09] DB — Migration DWH (dim + fact tables)

**Labels:** `database`, `analytics`, `sprint-11`, `priority:high`  
**Epic:** Epic 7 — Analytics  
**Estimate:** 2h  
**Sprint:** Sprint 11  
**Milestone:** 7

**Sous-tâches :**
- [ ] Migration `013_dwh` : toutes les tables dim_* et fact_*
- [ ] Index sur `fact_kyc_funnel.session_date`, `fact_ocr_performance.extraction_date`
- [ ] Partition `fact_kyc_funnel` par mois (si > 10 000 lignes prévues)

---

### [ANALYTICS-10] Backend — COBAC PDF Report Generator

**Labels:** `backend`, `compliance`, `sprint-11`, `priority:medium`  
**Epic:** Epic 7 — Analytics  
**Estimate:** 3h  
**Sprint:** Sprint 11  
**Milestone:** 7

**Sous-tâches :**
- [ ] Créer `services/reporting/cobac_pdf_generator.py` avec ReportLab ou WeasyPrint
- [ ] Template PDF : entête BICEC, summary client, scores biométriques, historique audit
- [ ] Intégrer dans export COBAC (ANALYTICS-04)
- [ ] Test : PDF généré en < 5s pour dossier complet

---

### [ANALYTICS-11] Back-Office React — CSV Export Button

**Labels:** `backoffice`, `frontend`, `analytics`, `sprint-11`, `priority:low`  
**Epic:** Epic 7 — Analytics  
**Estimate:** 1h  
**Sprint:** Sprint 11  
**Milestone:** 7

**Sous-tâches :**
- [ ] Bouton "Exporter CSV" sur toutes les pages analytics (funnel, OCR, agents)
- [ ] Appel `GET /analytics/export?table={}&format=csv` → déclencher téléchargement
- [ ] Nommer fichier : `veripass_funnel_2026-03-07.csv`

---

### [ANALYTICS-12] Backend — KPI Aggregation Endpoint

**Labels:** `backend`, `analytics`, `sprint-11`, `priority:medium`  
**Epic:** Epic 7 — Analytics  
**Estimate:** 2h  
**Sprint:** Sprint 11  
**Milestone:** 7

**Sous-tâches :**
- [ ] `GET /analytics/dashboard` : agréger en une requête les KPIs principaux (< 3s)
- [ ] KPIs : total_sessions_today, completion_rate, avg_processing_time_min, liveness_failure_rate, aml_alert_rate, ocr_fer_paddle, ocr_fer_glm
- [ ] Mettre en cache Redis 60s pour éviter requêtes répétées

---

### [ANALYTICS-13] Backend — Long-Polling Notifications pour Back-Office

**Labels:** `backend`, `backoffice`, `sprint-11`, `priority:medium`  
**Epic:** Epic 7 — Analytics  
**Estimate:** 3h  
**Sprint:** Sprint 11  
**Milestone:** 7

**Sous-tâches :**
- [ ] Endpoint SSE `GET /backoffice/events/stream` : Server-Sent Events pour agents connectés
- [ ] Events streamés : `new_dossier_arrived`, `sla_breach`, `aml_alert_created`
- [ ] Fallback polling toutes les 30s si SSE non supporté (Safari)
- [ ] Authentification : JWT dans header `Authorization` (SSE ne supporte pas cookies facilement)
- [ ] Tests : event émis → reçu par client SSE connecté en < 2s

---
## Sprint 12 - Testing & Quality Assurance

### [TEST-01] Tests d'intégration — Coverage ≥ 70%

**Labels:** `testing`, `sprint-12`, `priority:critical`  
**Epic:** Cross-cutting  
**Estimate:** 8h  
**Sprint:** Sprint 12  
**Milestone:** 7

**Sous-tâches :**
- [ ] Pytest fixtures : DB de test isolée (pytest-postgresql), Redis mock (fakeredis), Celery eager mode
- [ ] Couvrir : auth OTP, upload CNI, OCR pipeline, state machine transitions, Jean approve/reject, AML screening
- [ ] `pytest --cov=app --cov-report=html` → rapport coverage
- [ ] CI GitHub Actions : pytest + coverage sur chaque push

---

### [TEST-02] Tests E2E Playwright — Parcours Marie complet

**Labels:** `testing`, `e2e`, `sprint-12`, `priority:critical`  
**Epic:** Cross-cutting  
**Estimate:** 6h  
**Sprint:** Sprint 12  
**Milestone:** 7

**Sous-tâches :**
- [ ] Flow complet : OTP → PIN setup → CNI recto → CNI verso → OCR review → selfie → liveness → adresse → NIU → consentement → soumission
- [ ] Utiliser seed data (20 images CNI synthétiques + selfies)
- [ ] Vérifier chaque étape sans erreur console
- [ ] Mesurer temps total du parcours (target < 8 minutes)

---

### [TEST-03] Tests E2E Playwright — Résumption offline

**Labels:** `testing`, `e2e`, `offline`, `sprint-12`, `priority:high`  
**Epic:** Cross-cutting  
**Estimate:** 3h  
**Sprint:** Sprint 12  
**Milestone:** 7

**Sous-tâches :**
- [ ] Playwright + `page.setOfflineMode(true)` pendant upload CNI
- [ ] Vérifier banner "Hors ligne" affiché
- [ ] `page.setOfflineMode(false)` → vérifier reprise auto upload en < 5s
- [ ] Vérifier qu'aucun doublon en DB

---

### [TEST-04] Tests E2E Playwright — 3 strikes liveness lockout

**Labels:** `testing`, `e2e`, `biometrics`, `sprint-12`, `priority:high`  
**Epic:** Cross-cutting  
**Estimate:** 2h  
**Sprint:** Sprint 12  
**Milestone:** 7

**Sous-tâches :**
- [ ] Simuler 3 échecs liveness en série (mock MiniFASNet → score < threshold)
- [ ] Vérifier écran lockout affiché après 3e échec
- [ ] Vérifier `kyc_sessions.status = LOCKED_LIVENESS` en DB
- [ ] Vérifier timer cooldown 60s bloque le bouton "Recommencer"

---

### [TEST-05] Tests E2E Playwright — Jean approve flow complet

**Labels:** `testing`, `e2e`, `backoffice`, `sprint-12`, `priority:high`  
**Epic:** Cross-cutting  
**Estimate:** 3h  
**Sprint:** Sprint 12  
**Milestone:** 7

**Sous-tâches :**
- [ ] Login Jean → Queue View → Prendre en charge → Evidence Viewer → Approve
- [ ] Vérifier transition status → COMPLIANCE_REVIEW
- [ ] Vérifier notification client générée
- [ ] Vérifier audit log `DOSSIER_APPROVED` avec SHA-256

---

### [TEST-06] Tests sécurité — RBAC & JWT tampering

**Labels:** `testing`, `security`, `sprint-12`, `priority:high`  
**Epic:** Cross-cutting  
**Estimate:** 3h  
**Sprint:** Sprint 12  
**Milestone:** 7

**Sous-tâches :**
- [ ] Test : JWT d'un CLIENT tente d'accéder à `/backoffice/queue` → 403
- [ ] Test : JWT expiré → 401
- [ ] Test : JWT avec role modifié (tampering) → signature invalide → 401
- [ ] Test : agent A tente d'accéder au dossier de l'agent B → 403
- [ ] Test : SQL injection sur `?filter=nom` → pas d'erreur 500 (paramétré)

---

### [TEST-07] CI/CD — GitHub Actions Pipeline

**Labels:** `infrastructure`, `ci-cd`, `sprint-12`, `priority:high`  
**Epic:** Cross-cutting  
**Estimate:** 3h  
**Sprint:** Sprint 12  
**Milestone:** 7

**Sous-tâches :**
- [ ] Workflow `ci.yml` : sur chaque push → `ruff`, `black`, `isort`, `pytest --cov=app`
- [ ] Workflow `docker-build.yml` : sur push develop → build images Docker (sans push)
- [ ] Ajouter badge CI dans README
- [ ] Configurer branch protection : merge bloqué si CI fails

---

### [TEST-08] Performance Benchmark — Hardware cible

**Labels:** `testing`, `performance`, `sprint-12`, `priority:high`  
**Epic:** Cross-cutting  
**Estimate:** 4h  
**Sprint:** Sprint 12  
**Milestone:** 7

**Sous-tâches :**
- [ ] Scénario de charge : 5 sessions simultanées (5 tabs Chrome)
- [ ] Mesurer : temps OCR PaddleOCR (target < 5s), temps GLM-OCR (target < 30s), temps liveness (target < 10s), temps face match (target < 15s)
- [ ] Mesurer temps total parcours Marie de bout en bout
- [ ] Documenter résultats dans `docs/performance-report.md`

---

### [TEST-09] Tests de charge — 5 sessions simultanées

**Labels:** `testing`, `performance`, `sprint-12`, `priority:medium`  
**Epic:** Cross-cutting  
**Estimate:** 3h  
**Sprint:** Sprint 12  
**Milestone:** 7

**Sous-tâches :**
- [ ] Utiliser Locust ou k6 pour simuler 5 utilisateurs concurrents
- [ ] Scénario : 5 uploads CNI simultanés → 5 pipelines OCR → 5 pipelines biométrie
- [ ] Vérifier : pas de deadlock Celery, pas d'OOM, queue Redis stable
- [ ] Documenter résultats (succès/dégradations observées)

---

### [TEST-10] Golden Dataset — Données de démo préparées

**Labels:** `testing`, `demo`, `sprint-12`, `priority:critical`  
**Epic:** Cross-cutting  
**Estimate:** 4h  
**Sprint:** Sprint 12  
**Milestone:** 7

**Sous-tâches :**
- [ ] Script `scripts/seed_demo.py` : créer 5 profils utilisateurs complets
- [ ] Profil 1 "Happy Path" : Marie Mballa — score 0.92, approuvée, accès FULL
- [ ] Profil 2 "AML Alert" : Thomas Biya — flag PEP, en COMPLIANCE_REVIEW chez Thomas
- [ ] Profil 3 "Low OCR" : Jean Foe — score OCR 0.45, en attente Jean
- [ ] Profil 4 "Lockout Liveness" : Sophie Tagne — 3 tentatives, LOCKED_LIVENESS
- [ ] Profil 5 "NIU Déclaratif" : Paul Kom — accès LIMITED
- [ ] Vérifier que le script est idempotent (re-run sans erreur)

---

### [TEST-11] Tests Unitaires — Services AI Mocks

**Labels:** `testing`, `ai-engine`, `sprint-12`, `priority:high`  
**Epic:** Cross-cutting  
**Estimate:** 3h  
**Sprint:** Sprint 12  
**Milestone:** 7

**Sous-tâches :**
- [ ] Mock `PaddleOCRService` : retourner résultats prédéfinis sans charger les modèles ONNX
- [ ] Mock `GLMOCRService` : simuler réponse JSON after 2s delay
- [ ] Mock `LivenessService` : retourner `{is_real: True, score: 0.92}` configurable
- [ ] Mock `FaceMatchService` : retourner `{verified: True, distance: 0.25}` configurable
- [ ] Utiliser `pytest.monkeypatch` ou `unittest.mock.patch`
- [ ] Permettre CI GitHub Actions de tourner sans GPU ni modèles téléchargés

---

## Sprint 13 - Demo Preparation & Documentation

### [DEMO-01] Rapport PFE — Sections techniques finales

**Labels:** `documentation`, `pfe`, `sprint-13`, `priority:critical`  
**Epic:** Cross-cutting  
**Estimate:** 8h  
**Sprint:** Sprint 13  
**Milestone:** 8

**Sous-tâches :**
- [ ] Section Contribution Data/IA : résultats OCR observability, benchmarks modèles, courbes FER
- [ ] Section Architecture : C4 diagrams, ADRs justifiés
- [ ] Section Sécurité & Conformité : COBAC compliance, AES-256, audit SHA-256, Loi 2024-017
- [ ] Section Performance : benchmarks hardware réels vs théoriques
- [ ] Section Perspectives Phase 2 : DGI integration, Amplitude live, mobile app Flutter
- [ ] Aligner avec métriques réels de la démo

---

### [DEMO-02] Docker Compose — Package démo portable

**Labels:** `infrastructure`, `demo`, `sprint-13`, `priority:critical`  
**Epic:** Cross-cutting  
**Estimate:** 4h  
**Sprint:** Sprint 13  
**Milestone:** 8

**Sous-tâches :**
- [ ] `docker compose build --no-cache` → vérifier toutes les images buildent sans erreur
- [ ] `docker compose up` + seed demo data → vérifier les 5 profils chargés
- [ ] Tester depuis zéro sur machine fraîche (pas de cache local)
- [ ] Créer `demo.md` : instructions "Lancer la démo en 3 commandes"
- [ ] Backup images Docker en `.tar.gz` (plan B si no internet le jour J)

---

### [DEMO-03] Script de démo — Walkthrough 10 minutes

**Labels:** `documentation`, `demo`, `sprint-13`, `priority:critical`  
**Epic:** Cross-cutting  
**Estimate:** 3h  
**Sprint:** Sprint 13  
**Milestone:** 8

**Sous-tâches :**
- [ ] Rédiger `docs/demo-script.md` : script ligne par ligne (narrateur + actions écran)
- [ ] Durée cible : 10 minutes pour jury, 5 minutes version courte
- [ ] Séquence : (1) Marie ouvre PWA → (2) parcours complet → (3) Jean traite dossier → (4) Sylvie voit dashboard → (5) Thomas gère alerte AML
- [ ] Identifier 3 moments "wow" à mettre en avant (OCR en live, liveness 3D, COBAC export)

---

### [DEMO-04] QR Code — Accès PWA depuis mobile physique

**Labels:** `infrastructure`, `demo`, `sprint-13`, `priority:high`  
**Epic:** Cross-cutting  
**Estimate:** 1h  
**Sprint:** Sprint 13  
**Milestone:** 8

**Sous-tâches :**
- [ ] Configurer IP locale dans `.env` : `PWA_PUBLIC_URL=https://192.168.X.X:3000`
- [ ] Générer QR code pointant vers l'IP locale
- [ ] Générer certificat TLS pour l'IP locale (Chrome n'autorise pas caméra sur HTTP)
- [ ] Tester accès depuis un smartphone Android sur même réseau WiFi

---

### [DEMO-05] ADRs finaux — Review et complétion

**Labels:** `documentation`, `sprint-13`, `priority:medium`  
**Epic:** Cross-cutting  
**Estimate:** 2h  
**Sprint:** Sprint 13  
**Milestone:** 8

**Sous-tâches :**
- [ ] Vérifier cohérence ADR-001 à ADR-012 avec code final livré
- [ ] Créer ADR-013 : "Stratégie de test E2E — Playwright vs Cypress"
- [ ] Créer ADR-014 : "DWH embarqué vs DWH externe — Choix PostgreSQL star schema"
- [ ] Lier chaque ADR dans le rapport PFE (section "Décisions d'architecture")

---

### [DEMO-06] Architecture Diagrams — Mise à jour finale

**Labels:** `documentation`, `sprint-13`, `priority:medium`  
**Epic:** Cross-cutting  
**Estimate:** 2h  
**Sprint:** Sprint 13  
**Milestone:** 8

**Sous-tâches :**
- [ ] Mettre à jour diagramme C4 Level 1 (System Context) si changements
- [ ] Mettre à jour diagramme C4 Level 2 (Containers) avec tous les services réels
- [ ] Créer diagramme séquence : "Parcours Marie complet" (Mermaid)
- [ ] Créer diagramme séquence : "Jean traite un dossier" (Mermaid)
- [ ] Exporter en PNG pour rapport PFE

---

### [DEMO-07] Vidéo démo — Enregistrement backup

**Labels:** `demo`, `sprint-13`, `priority:medium`  
**Epic:** Cross-cutting  
**Estimate:** 2h  
**Sprint:** Sprint 13  
**Milestone:** 8

**Sous-tâches :**
- [ ] Enregistrer une vidéo de la démo complète (OBS ou loom)
- [ ] Durée : 10-12 minutes — parcours complet avec narration
- [ ] Stocker en backup USB + cloud (si crash hardware le jour J)
- [ ] Créer version accélérée 3min pour slide de présentation

---

### [DEMO-08] Pre-commit Hooks + Code Quality finale

**Labels:** `infrastructure`, `ci-cd`, `sprint-13`, `priority:medium`  
**Epic:** Cross-cutting  
**Estimate:** 1h  
**Sprint:** Sprint 13  
**Milestone:** 8

**Sous-tâches :**
- [ ] Configurer `.pre-commit-config.yaml` : black, isort, ruff, mypy (backend), eslint (frontend)
- [ ] `pre-commit run --all-files` → zéro warning
- [ ] Vérifier que `ruff check app/` passe sans erreurs critiques

---

### [DEMO-09] Rapport PFE — Résumé Exécutif & Abstract

**Labels:** `documentation`, `pfe`, `sprint-13`, `priority:high`  
**Epic:** Cross-cutting  
**Estimate:** 3h  
**Sprint:** Sprint 13  
**Milestone:** 8

**Sous-tâches :**
- [ ] Abstract (1 page, anglais) : contexte BICEC, problème, solution, résultats clés, technologies
- [ ] Résumé exécutif (2 pages, français) : pour direction BICEC non-technique
- [ ] Highlights chiffrés : FER OCR atteint, latence biométrie réelle, coût vs Onfido/Jumio
- [ ] Aligner avec README GitHub (README peut servir de base)

---

## Admin & Security (Cross-Sprint)

### [ADMIN-01] Security — Rate Limiting Middleware global

**Labels:** `backend`, `security`, `priority:high`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 2h  
**Sprint:** Sprint 1

**Sous-tâches :**
- [ ] Middleware FastAPI avec `slowapi` (ou implémentation custom Redis)
- [ ] Règles globales : 100 req/min par IP (API générale), 10 req/min par IP (auth endpoints), 3 req/min par IP (OTP send)
- [ ] Réponse 429 avec header `Retry-After`
- [ ] Tests : dépasser la limite → 429

---

### [ADMIN-02] Security — Input Validation Middleware

**Labels:** `backend`, `security`, `priority:high`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 2h  
**Sprint:** Sprint 1

**Sous-tâches :**
- [ ] Pydantic validators sur tous les schémas d'entrée : longueurs max, types stricts, regex sur téléphone/NIU/CNI
- [ ] Rejeter tout Content-Type non attendu avec 415
- [ ] Sanitiser les chaînes de caractères (strip HTML)
- [ ] Tests : injection SQL dans query params → 422 (pas 500)

---

### [ADMIN-03] Security — TLS et headers HTTP sécurité

**Labels:** `backend`, `security`, `infrastructure`, `priority:high`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 2h  
**Sprint:** Sprint 1

**Sous-tâches :**
- [ ] Configurer Nginx : `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`
- [ ] Désactiver TLS 1.0 et 1.1 dans Nginx (`ssl_protocols TLSv1.2 TLSv1.3`)
- [ ] Vérifier avec `curl -I https://localhost` que tous les headers sont présents
- [ ] Documenter dans ADR (section sécurité)

---

### [ADMIN-04] Monitoring — /metrics Prometheus endpoint

**Labels:** `backend`, `monitoring`, `priority:medium`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 2h  
**Sprint:** Sprint 1

**Sous-tâches :**
- [ ] Ajouter `prometheus-fastapi-instrumentator` dans requirements
- [ ] Exposer `GET /metrics` (accès restreint IP locale uniquement)
- [ ] Métriques auto : request count, latency p50/p95/p99, error rate par endpoint
- [ ] Métriques custom : `kyc_sessions_total`, `ocr_processing_seconds`, `celery_task_queue_length`

---

### [ADMIN-05] Documentation — Environment Variables Reference

**Labels:** `documentation`, `infrastructure`, `priority:medium`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 1h  
**Sprint:** Sprint 1

**Sous-tâches :**
- [ ] Mettre à jour `.env.example` avec toutes les variables utilisées dans le projet
- [ ] Documenter chaque variable dans `docs/env-reference.md` : nom, description, exemple, valeur par défaut, requis/optionnel
- [ ] Vérifier que `.env.example` ne contient aucune vraie valeur secrète

---

### [ADMIN-06] Documentation — API Contract OpenAPI maintenance

**Labels:** `documentation`, `backend`, `priority:medium`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 1h  
**Sprint:** Sprint 1

**Sous-tâches :**
- [ ] Script `scripts/export_openapi.sh` : exporter `openapi.json` depuis server en cours + commit dans `docs/api/`
- [ ] Ajouter step dans CI GitHub Actions : générer + vérifier `openapi.json` pas de breaking change

---

### [ADMIN-07] Conventional Commits — Hooks et Changelog

**Labels:** `infrastructure`, `priority:medium`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 1h  
**Sprint:** Sprint 0

**Sous-tâches :**
- [ ] Configurer `commitlint` : `.commitlintrc.json` avec règles Conventional Commits
- [ ] Hook `commit-msg` via husky ou `.githooks/`
- [ ] Configurer `standard-version` ou `semantic-release` pour CHANGELOG.md auto
- [ ] Documenter les types autorisés dans `CONTRIBUTING.md` : feat, fix, chore, docs, test, refactor, perf

---

### [ADMIN-08] Backend — Error Handling Global Middleware

**Labels:** `backend`, `security`, `priority:high`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 2h  
**Sprint:** Sprint 1

**Sous-tâches :**
- [ ] `exception_handlers.py` : intercepter toutes les exceptions non gérées
- [ ] Retourner `{"error": "INTERNAL_ERROR", "correlation_id": "uuid", "message": "..."}` — jamais de stack trace en production
- [ ] Logger stack trace complet côté serveur (structuré JSON)
- [ ] Handler spécialisé : `RequestValidationError` → 422 avec détail des champs invalides
- [ ] Handler : `HTTPException` → relayer tel quel
- [ ] Tests : endpoint qui lance Exception → 500 sans stack trace dans response body

---

### [ADMIN-09] Backend — Structured Logging Configuration

**Labels:** `backend`, `monitoring`, `priority:medium`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 1h  
**Sprint:** Sprint 1

**Sous-tâches :**
- [ ] Configurer `python-json-logger` : tous les logs en JSON structuré
- [ ] Champs obligatoires dans chaque log : `timestamp`, `level`, `correlation_id`, `service`, `message`
- [ ] Log rotation : fichier `logs/app.log` max 50MB, 5 backups
- [ ] Filtrer les données sensibles des logs : masquer `otp_code`, `pin`, `jwt_token` (regex remplacer par `****`)
- [ ] Tests : vérifier que les logs ne contiennent aucun secret

---

### [ADMIN-10] Backend — Database Connection Pooling & Health

**Labels:** `backend`, `infrastructure`, `priority:medium`  
**Epic:** Epic 1 — Foundation  
**Estimate:** 1h  
**Sprint:** Sprint 1

**Sous-tâches :**
- [ ] Configurer SQLAlchemy async : pool_size=10, max_overflow=20, pool_timeout=30, pool_recycle=1800
- [ ] Endpoint `/health` inclure latence DB : `{"db": "ok", "db_latency_ms": 12}`
- [ ] Alerte si `db_latency_ms > 500` : logger WARNING
- [ ] Tester : 50 connexions simultanées → pas de `QueuePool limit reached`

---

### [SECURITY-01] Checklist Sécurité Finale & Hardening

**Labels:** `backend`, `security`, `infrastructure`, `sprint-12`, `priority:high`  
**Epic:** Cross-cutting  
**Estimate:** 3h  
**Sprint:** Sprint 12  
**Milestone:** 7

**Sous-tâches :**
- [ ] Vérifier tous les endpoints requièrent authentification (sauf `/health`, `/auth/otp/*`, `/legal/*`)
- [ ] Vérifier aucun secret dans le code (git grep `SECRET_KEY\|password\|API_KEY` — aucun résultat hardcodé)
- [ ] Vérifier toutes les queries SQLAlchemy sont paramétrées (pas de f-string SQL)
- [ ] Vérifier ImageMagick / Pillow : pas de traitement d'image sans validation MIME stricte
- [ ] Désactiver les logs de requêtes SQL en production (`echo=False`)
- [ ] Vérifier `DEBUG=False` en production dans `core/config.py`
- [ ] Documenter les résultats dans `docs/security-checklist.md`

---

## Optional - Banking Discovery (Post-MVP)

### [DISCOVERY-01] PWA — Plan Comparison Screen

**Labels:** `frontend`, `pwa`, `epic-8`, `priority:low`  
**Epic:** Epic 8 — Banking Discovery (Optionnel)  
**Estimate:** 3h  
**Sprint:** Post-MVP (si temps)

**Sous-tâches :**
- [ ] Page `/discover/plans` : 3 colonnes (Compte Courant, Compte Épargne, Compte Business)
- [ ] Données depuis JSON statique (pas d'API nécessaire pour MVP)
- [ ] Bouton "Ouvrir ce compte" → redirect vers KYC flow
- [ ] Design mobile-first

---

### [DISCOVERY-02] PWA — Account Dashboard Shell

**Labels:** `frontend`, `pwa`, `epic-8`, `priority:low`  
**Epic:** Epic 8 — Banking Discovery (Optionnel)  
**Estimate:** 3h  
**Sprint:** Post-MVP (si temps)

**Sous-tâches :**
- [ ] Page `/dashboard` : écran post-approbation avec accès limité
- [ ] Afficher : statut KYC, niveau d'accès, prochain step si LIMITED
- [ ] Accès conditionnel basé sur `access_level` retourné par `GET /user/access-level`

---

### [DISCOVERY-03] PWA — Use-Case Selection Chips

**Labels:** `frontend`, `pwa`, `ux`, `epic-8`, `priority:low`  
**Epic:** Epic 8 — Banking Discovery (Optionnel)  
**Estimate:** 2h  
**Sprint:** Post-MVP (si temps)

**Sous-tâches :**
- [ ] Écran onboarding après login initial : chips "Je veux ouvrir un compte", "Je veux envoyer de l'argent", "Je veux épargner"
- [ ] Sélection guide vers le bon flow KYC
- [ ] Stocker dans `kyc_sessions.use_case` pour analytics

---

## Summary

**Total Issues:** 154  
**Sprints:** 0-13 (14 sprints)  
**Milestones:** M0 à M7 (8 milestones)  
**Epics:** 8 epics principaux

**Distribution par Sprint:**
- Sprint 0: 10 issues (Infrastructure)
- Sprint 1: 10 issues (Auth & Foundation)
- Sprint 2: 9 issues (Capture Journey)
- Sprint 3: 8 issues (OCR Engine)
- Sprint 4: 12 issues (Biometric Engine)
- Sprint 5: 9 issues (KYC State Machine)
- Sprint 6: 8 issues (Offline & BO Foundation)
- Sprint 7: 9 issues (Back-Office Core)
- Sprint 8: 10 issues (BO Actions & Notifications)
- Sprint 9: 11 issues (Address, NIU, Consent)
- Sprint 10: 11 issues (AML Screening)
- Sprint 11: 13 issues (Analytics & DWH)
- Sprint 12: 11 issues (Testing)
- Sprint 13: 9 issues (Demo & Documentation)
- Admin/Security: 10 issues (Cross-sprint)
- Discovery: 3 issues (Optional)

**Priorités:**
- Critical: 45 issues
- High: 58 issues
- Medium: 42 issues
- Low: 9 issues
