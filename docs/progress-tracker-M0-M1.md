# 📊 Progress Tracker — M0 & M1

> **Légende :**
> - `[ ]` = TODO (pas commencé)
> - `[-]` = IN PROGRESS (en cours local/PR en attente)
> - `[x]` = DONE (PR merged/critères validés)

> **Matrice :** LOCAL (travail en cours) | CLOUD (GitHub validé)

---

## 🔴 M0 - Dev Ready (Deadline: 13 mars ⚠️ DÉPASSÉE de 8 jours)

| # | Issue | Description | LOCAL | CLOUD | Dépendances |
|---|-------|-------------|-------|-------|-------------|
| 9 | Story 1.1 | Docker Compose Infrastructure Setup | [x] | [x] | Aucune |
| 178 | ADMIN-05 | Production docker-compose.yml | [ ] | [ ] | #9 |
| 46 | INFRA-07 | Local Daily Prune Script | [ ] | [ ] | #178 |
| 180 | ADMIN-07 | S3 Bucket config backups images | [ ] | [ ] | #178, #46 |
| 183 | ADMIN-10 | PostgreSQL Replication/Backups auto | [x] | [ ] | #178, #180 |

**Flux logique :** #9 → #178 → #46 → #180 → #183

---

## 🔴 M1 - Auth Complete (Deadline: 20 mars ✅ DONE)

| # | Issue | Description | LOCAL | CLOUD | Dépendances |
|---|-------|-------------|-------|-------|-------------|
| 49 | AUTH-03 | Back-Office RBAC Logic & JWT | [x] | [x] | #50, #51 |
| 50 | AUTH-04 | Auth Router & Token Management | [x] | [x] | Aucune |
| 48 | AUTH-02 | PIN Setup & Secure Storage | [x] | [x] | #50 |
| 51 | AUTH-05 | Users & Roles tables | [x] | [x] | #50 |
| 52 | AUTH-06 | Mobile OTP Capture Screen | [x] | [x] | #50 |
| 54 | AUTH-08 | Redis TTL for OTP storage | [x] | [x] | #50 |
| 53 | AUTH-07 | Back-Office Login Dashboard | [x] | [x] | #50, #51, #49 |

**Flux logique :** #50 → #48/#51 → #49 → #52 → #54 → #53

---

## 🔴 M1 - Security (Rate Limiting)

| # | Issue | Description | LOCAL | CLOUD | Dépendances |
|---|-------|-------------|-------|-------|-------------|
| 174 | ADMIN-01 | Security — Rate Limiting Middleware global | [x] | [x] | #50 |

**Flux logique :** #50 → #174

---

## 🟡 M2 - Auth & KYC Flows (Deadline: 05/04 ✅ DONE)

| # | Issue | Description | LOCAL | CLOUD | Dépendances |
|---|-------|-------------|-------|-------|-------------|
| 400 | AUTH-09 | Mobile Auth complete (OTP, PIN, biometric, auto-lock) | [x] | [x] | #52 |
| 401 | AUTH-10 | Forgot PIN & Lock Screen | [x] | [x] | #400 |
| 402 | CAPTURE-06 | MediaPipe WASM Client-Side Quality Gate | [-] | [ ] | #308 |

**Flux logique :** #400 → #401, #308 → #402

---

## 🟡 M3 - AML/CFT & Audit (Deadline: 05/04 ✅ DONE)

| # | Issue | Description | LOCAL | CLOUD | Dépendances |
|---|-------|-------------|-------|-------|-------------|
| 410 | AML-01 | AML Module (alerts, NIU conflicts, service layer) | [x] | [x] | Aucune |
| 411 | AML-02 | AML API endpoints & rate limiting | [x] | [x] | #410 |
| 412 | AUDIT-01 | Audit Module (COBAC compliant, router, schemas) | [x] | [x] | Aucune |
| 413 | AUDIT-02 | Audit API & Celery scheduled tasks | [x] | [x] | #412 |

**Flux logique :** #410 → #412 → #413

---

## 🟡 M4 - Backoffice Complet (Deadline: 05/04 ✅ DONE)

| # | Issue | Description | LOCAL | CLOUD | Dépendances |
|---|-------|-------------|-------|-------|-------------|
| 420 | BACK-01 | Validation Queue & Evidence Viewer pages | [x] | [x] | Aucune |
| 421 | BACK-02 | Compliance Dashboard & AML Pages | [x] | [x] | #410 |
| 422 | BACK-03 | Analytics Pages (Funnel, OCR Observability) | [x] | [x] | Aucune |
| 423 | BACK-04 | Shared Components & UI primitives | [x] | [x] | Aucune |
| 424 | BACK-05 | System Logs Page & Admin tools | [x] | [x] | #412 |
| 425 | BACK-06 | Types, Hooks, Lib, Services refactor | [x] | [x] | Aucune |

**Flux logique :** #423 → #420/#421/#422 → #424

---

## 🟡 Infra & DevOps (Deadline: 05/04 ✅ DONE)

| # | Issue | Description | LOCAL | CLOUD | Dépendances |
|---|-------|-------------|-------|-------|-------------|
| 430 | INFRA-08 | Docker Compose updates (backend, mobile, nginx) | [x] | [x] | #9 |
| 431 | INFRA-09 | Celery scheduled tasks (PEP sync, KYC, sanctions) | [x] | [x] | #412 |
| 432 | INFRA-10 | Nginx conf.d configuration | [x] | [x] | #430 |

**Flux logique :** #430 → #432, #431

---

## 📝 Notes

- **LOCAL** = Travail en cours sur la machine (commit local, branche en cours)
- **CLOUD** = Validé sur GitHub (PR merged, issue closed, critères cochés)
- **Dépendances** = Issues qui doivent être terminées AVANT de commencer celle-ci

---

*Dernière mise à jour : 2026-04-05*