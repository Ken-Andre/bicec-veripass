# Changelog — Issue #9 : Docker Compose Infrastructure Setup

**Date :** 2026-03-20  
**Issue :** [#9](https://github.com/Ken-Andre/bicec-veripass/issues/9)  
**Status :** ✅ Implémenté (en attente de #42 et #43 pour validation complète)

---

## Changements appliqués

### 1. Alignement des ports Docker (Priorité HAUTE)

**Problème :** Les ports host dans `docker-compose.yml` (8081, 8082) ne correspondaient pas aux critères d'acceptation de l'issue #9 (3000, 3001), alors que toute la documentation et la configuration des frontends/backend utilisaient déjà 3000/3001.

**Solution :**
- ✅ `code/docker-compose.yml` — PWA : `8081:8080` → `3000:8080`
- ✅ `code/docker-compose.yml` — Back-Office : `8082:8080` → `3001:8080`
- ✅ `docs/test-report-2026-03-18.md` — URLs de test mises à jour

**Impact :**
- Alignement complet entre code, doc et critères d'acceptation
- Aucun changement nécessaire dans les frontends (déjà configurés pour 3000/3001)
- Aucun changement nécessaire dans le backend CORS (déjà configuré pour 3000/3001)

**Fichiers modifiés :** 2 fichiers

---

### 2. Configuration WSL2 RAM 8GB (Priorité MOYENNE)

**Problème :** Sans limite RAM, Docker Desktop peut consommer 12-14 GB, provoquant des OOM et freezes Windows quand les modèles IA seront chargés (Sprint 2+).

**Solution :**
- ✅ `infra/.wslconfig.template` — Template de configuration WSL2 (nouveau fichier)
- ✅ `docs/setup-wsl2-windows.md` — Guide d'installation complet (nouveau fichier)
- ✅ `code/README.md` — Instructions d'installation WSL2 ajoutées

**Configuration appliquée :**
```ini
memory=8GB          # Limite Docker à 8 GB
processors=4        # 4 cores (ajustable)
swap=2GB            # Buffer pour pics temporaires
pageReporting=false # Optimisation performance
```

**Impact :**
- Prévient les OOM en Sprint 2+ (PaddleOCR + GLM-OCR = ~8.5 GB)
- Garantit 8 GB pour Windows/IDE/Chrome
- Pas bloquant pour Sprint 0-1 (services légers ~2.5 GB)

**Fichiers créés/modifiés :** 3 fichiers

---

### 3. Documentation d'analyse (Référence)

**Créé :**
- ✅ `docs/analysis-issue-9-ports-wsl2.md` — Analyse d'impact complète

**Contenu :**
- État actuel vs critères d'acceptation (4/9 validés)
- Analyse d'impact des changements de ports (Scénario A vs B)
- Analyse WSL2 : risques par sprint, budget RAM détaillé
- Recommandations finales et checklist de validation

---

## Statut des critères d'acceptation

### ✅ Validés (4/9)

| Critère | État | Notes |
|---------|------|-------|
| PostgreSQL port 5432 | ✅ | Fonctionnel (port host 15432 pour éviter conflits) |
| Redis port 6379 | ✅ | Fonctionnel (port host 16379 pour éviter conflits) |
| Script docker_prune.sh | ✅ | Implémenté (issue #46) |
| FastAPI via Nginx port 8000 | ✅ | API healthy, accessible |

### ⚠️ Partiellement validés (2/9)

| Critère | État actuel | Problème |
|---------|-------------|----------|
| PWA port 3000 via Nginx | ⚠️ Répond sur 8081 | Ports pas encore changés, healthcheck fail |
| Back-Office port 3001 via Nginx | ⚠️ Répond sur 8082 | Ports pas encore changés, healthcheck fail |

### ❌ Non validés (3/9)

| Critère | État | Bloqueur |
|---------|------|----------|
| Nginx port 443 TLS 1.3 | ❌ | Container unhealthy, healthcheck fail |
| Health checks < 60s | ❌ | 5/10 services unhealthy (nginx, pwa, backoffice, flower, celery_beat) |
| WSL2 RAM 8GB | ❌ | Template créé mais pas testé |

---

## Prochaines étapes

### Pour fermer l'issue #9

1. ✅ ~~Aligner les ports 3000/3001 dans docker-compose.yml~~ (fait, pas encore appliqué)
2. ✅ ~~Créer template .wslconfig~~ (fait)
3. ✅ ~~Documenter setup WSL2~~ (fait)
4. ❌ Redémarrer les containers avec les nouveaux ports
5. ❌ Corriger les healthchecks qui échouent (nginx, pwa, backoffice, flower, celery_beat)
6. ❌ Test manuel : `docker compose up` → tous les services healthy
7. ❌ Test manuel : PWA accessible sur https://localhost:3000
8. ❌ Test manuel : Back-Office accessible sur https://localhost:3001
9. ❌ Test manuel : Nginx HTTPS accessible sur https://localhost:443

### Dépendances

- ✅ #44 (Nginx Reverse Proxy) — Terminé
- ✅ #46 (docker_prune.sh) — Terminé
- ⏳ #41 (FastAPI Skeleton) — En cours
- ⏳ #42 (PWA Skeleton) — En cours
- ⏳ #43 (Back-Office Skeleton) — En cours

---

## Budget RAM par sprint

### Sprint 0-1 (Actuel)
```
Services légers sans modèles IA : ~2.5 GB
→ Pas de risque OOM
```

### Sprint 2+ (OCR + Liveness)
```
api (PaddleOCR):     2.5 GB (lazy load)
celery_ocr (GLM):    3.5 GB (lazy load)
Autres services:     2.5 GB
─────────────────────────────
TOTAL:              ~8.5 GB
→ Configuration WSL2 CRITIQUE
```

---

## Références

- Issue GitHub : https://github.com/Ken-Andre/bicec-veripass/issues/9
- Analyse complète : `docs/analysis-issue-9-ports-wsl2.md`
- Guide WSL2 : `docs/setup-wsl2-windows.md`
- Template WSL2 : `infra/.wslconfig.template`

---

## Validation

### Checklist développeur

Avant de démarrer le projet :

- [ ] Copier `infra/.wslconfig.template` → `C:\Users\<USERNAME>\.wslconfig`
- [ ] Éditer `.wslconfig` et remplacer `<USERNAME>`
- [ ] Redémarrer WSL : `wsl --shutdown`
- [ ] Relancer Docker Desktop
- [ ] Vérifier : `wsl --list --verbose` (État = Running)
- [ ] Lancer : `docker compose up --build`
- [ ] Vérifier : Tous les services démarrent en < 60s
- [ ] Vérifier : Health checks passent (voir `docker compose ps`)

### URLs de test (après #42 et #43)

- https://localhost:443 → Nginx (redirect vers /mobile/)
- https://localhost:3000 → PWA (accès direct debug)
- https://localhost:3001 → Back-Office (accès direct debug)
- https://localhost:8000/docs → FastAPI Swagger UI
- http://localhost:5555 → Flower (Celery monitoring)

---

**Auteur :** Kiro AI  
**Validé par :** @Ken-Andre (2026-03-20)
