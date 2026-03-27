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
| 9 | Story 1.1 | Docker Compose Infrastructure Setup | [-] | [ ] | Aucune |
| 178 | ADMIN-05 | Production docker-compose.yml | [ ] | [ ] | #9 |
| 46 | INFRA-07 | Local Daily Prune Script | [ ] | [ ] | #178 |
| 180 | ADMIN-07 | S3 Bucket config backups images | [ ] | [ ] | #178, #46 |
| 183 | ADMIN-10 | PostgreSQL Replication/Backups auto | [x] | [ ] | #178, #180 |

**Flux logique :** #9 → #178 → #46 → #180 → #183

---

## 🔴 M1 - Auth Complete (Deadline: 20 mars ⚠️ DÉPASSÉE de 1 jour)

| # | Issue | Description | LOCAL | CLOUD | Dépendances |
|---|-------|-------------|-------|-------|-------------|
| 49 | AUTH-03 | Back-Office RBAC Logic & JWT | [x] | [ ] | #50, #51 |
| 50 | AUTH-04 | Auth Router & Token Management | [x] | [x] | Aucune |
| 48 | AUTH-02 | PIN Setup & Secure Storage | [x] | [x] | #50 |
| 51 | AUTH-05 | Users & Roles tables | [x] | [x] | #50 |
| 52 | AUTH-06 | Mobile OTP Capture Screen | [-] | [ ] | #50 |
| 54 | AUTH-08 | Redis TTL for OTP storage | [x] Q-dev | [x] Q-dev | #50 |
| 53 | AUTH-07 | Back-Office Login Dashboard | [-] | [ ] | #50, #51, #49 |

**Flux logique :** #50 → #48/#51 → #49 → #52 → #54 → #53

---

## 🔴 M1 - Security (Rate Limiting)

| # | Issue | Description | LOCAL | CLOUD | Dépendances |
|---|-------|-------------|-------|-------|-------------|
| 174 | ADMIN-01 | Security — Rate Limiting Middleware global | [-] | [ ] | #50 |

**Flux logique :** #50 → #174

---

## 🟡 M2 - Document Capture & OCR (Deadline: 3 avril)

| # | Issue | Description | LOCAL | CLOUD | Dépendances |
|---|-------|-------------|-------|-------|-------------|
| 308 | CAPTURE-04 | Docker Filesystem Volume for doc storage | [x] | [ ] | #9 |
| 310 | CAPTURE-06 | MediaPipe WASM Client-Side Quality Gate | [-] | [ ] | #308 |
| 311 | CAPTURE-08 | SHA-256 Integrity Hash Calculation | [x] | [ ] | #308 |
| 312 | OCR-03 | Celery Worker for OCR Async Jobs | [-] | [ ] | #308 |
| 314 | OCR-07 | UI Field Override Logic & Human Tagging | [-] | [ ] | #312 |

**Flux logique :** #308 → #310/#311/#312 → #314

---

## 📝 Notes

- **LOCAL** = Travail en cours sur la machine (commit local, branche en cours)
- **CLOUD** = Validé sur GitHub (PR merged, issue closed, critères cochés)
- **Dépendances** = Issues qui doivent être terminées AVANT de commencer celle-ci

---

*Dernière mise à jour : 2026-03-26*