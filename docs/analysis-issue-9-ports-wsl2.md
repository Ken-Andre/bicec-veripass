# Analyse d'Impact — Issue #9 : Ports & WSL2 Config

**Date :** 2026-03-20  
**Contexte :** Évaluation de l'écart entre les critères d'acceptation de l'issue #9 et l'implémentation actuelle

---

## 1. État actuel vs Critères d'acceptation

### ✅ Critères implémentés (4/9)

| Critère | État | Notes |
|---------|------|-------|
| Nginx port 443 TLS 1.3 | ✅ | Implémenté, certs mkcert ou self-signed |
| FastAPI via Nginx | ✅ | `/api/` → `http://api:8000` |
| PostgreSQL 5432, Redis 6379 | ✅ | Fonctionnel en interne (ports host modifiés) |
| Health checks < 60s | ✅ | Tous les services configurés |
| Script docker_prune.sh | ✅ | Complet avec seuil 85%, options --force, --dry-run |

### ⚠️ Critères partiels (3/9)

| Critère | État actuel | Écart | Impact |
|---------|-------------|-------|--------|
| PWA port 3000 | Port 8081 (host) | Issue demande 3000 | 🟡 Moyen |
| Back-Office port 3001 | Port 8082 (host) | Issue demande 3001 | 🟡 Moyen |
| WSL2 RAM 8GB | Commentaire seulement | Fichier .wslconfig absent | 🟢 Faible |

### ❌ Critères bloquants (2/9)

| Critère | État | Bloqueur |
|---------|------|----------|
| PWA accessible via Nginx | Container défini mais pas buildé | Pas de code/mobile/src/ complet |
| Back-Office accessible via Nginx | Container défini mais pas buildé | Pas de code/backoffice/src/ complet |

---

## 2. Analyse d'impact des changements de ports

### 2.1 Scénario A : Changer 8081 → 3000 et 8082 → 3001

#### Fichiers impactés (7 fichiers)

**Configuration Docker/Nginx :**
1. `code/docker-compose.yml` — Lignes 69, 95
   ```yaml
   # Avant
   - "8081:8080"  # PWA
   - "8082:8080"  # Back-Office
   
   # Après
   - "3000:8080"  # PWA
   - "3001:8080"  # Back-Office
   ```

**Documentation :**
2. `code/README.md` — Ligne 59-60 (déjà correct !)
   ```markdown
   | PWA (Marie) | https://localhost:3000 |
   | Back-Office | https://localhost:3001 |
   ```

3. `docs/test-report-2026-03-18.md` — Lignes 54, 73
   - Mettre à jour les URLs de test

**Configuration Frontend :**
4. `code/mobile/vite.config.ts` — Ligne 33 (déjà correct !)
   ```typescript
   urlPattern: /^https:\/\/localhost:3000\/api\//i,
   ```

5. `code/backoffice/package.json` — Lignes 7, 10 (déjà correct !)
   ```json
   "dev": "vite --port 3001",
   "preview": "vite preview --port 3001",
   ```

**Configuration Backend :**
6. `code/backend/app/core/config.py` — Ligne 32 (déjà correct !)
   ```python
   CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
   ```

7. `code/.env.example` — Ligne 81 (déjà correct !)
   ```bash
   CORS_ORIGINS=https://localhost:3000,https://localhost:3001
   ```

#### Verdict Scénario A
- **Impact :** 🟢 FAIBLE — Seulement 2 fichiers à modifier (docker-compose.yml + test-report)
- **Risque :** 🟢 MINIMAL — Les frontends et backend sont déjà configurés pour 3000/3001
- **Recommandation :** ✅ **FAIRE LE CHANGEMENT** — Aligner docker-compose avec la doc

---

### 2.2 Scénario B : Garder 8081/8082 et mettre à jour la doc

#### Fichiers impactés (15+ fichiers)

**Documentation à modifier :**
- `code/README.md`
- `.kiro/specs/bicec-veripass-complete-implementation/requirements.md`
- `.kiro/specs/bicec-veripass-complete-implementation/tasks.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/bicec-veripass-complete-backlog.md`
- `docs/AUDIT-REPORT-2026-03-19.md`
- `.cline/skills/hooks/hs/start-dev-environment.sh`

**Configuration Frontend à modifier :**
- `code/mobile/vite.config.ts` (server.port, preview.port, urlPattern)
- `code/backoffice/package.json` (scripts dev/preview)
- `code/mobile/journal.md`

**Configuration Backend à modifier :**
- `code/backend/app/core/config.py` (CORS_ORIGINS)
- `code/.env.example` (CORS_ORIGINS)
- `code/backend/.env.example`

**Tests E2E à modifier :**
- `code/backoffice/src/test/e2e/backoffice.spec.ts`

#### Verdict Scénario B
- **Impact :** 🔴 ÉLEVÉ — 15+ fichiers à modifier
- **Risque :** 🟡 MOYEN — Incohérence entre doc et code
- **Recommandation :** ❌ **NE PAS FAIRE** — Trop de dette technique

---

## 3. Analyse WSL2 RAM 8GB

### 3.1 État actuel
- **Fichier .wslconfig :** ❌ Absent du repo (normal, c'est un fichier user Windows)
- **Documentation :** ✅ Mentionné dans docker-compose.yml (commentaire ligne 2)
- **Template :** ❌ Pas de `infra/.wslconfig.template` (mentionné dans README ligne 36)

### 3.2 Conséquences si non implémenté

#### Impact sur le développement actuel (Sprint 0-1)
**Risque :** 🟢 FAIBLE

Services actuels (sans GLM-OCR chargé) :
```
nginx:           128 MB
pwa:             128 MB
backoffice:      128 MB
api:             512 MB (FastAPI sans PaddleOCR chargé)
postgres:        512 MB
redis:           256 MB
celery_notif:    512 MB
celery_beat:     128 MB
flower:          256 MB
─────────────────────────
TOTAL:          ~2.5 GB
```

**Verdict :** Pas de risque OOM immédiat, Docker Desktop utilise ~4-5 GB par défaut.

---

#### Impact sur les sprints futurs (Sprint 2+)

**Risque :** 🔴 CRITIQUE

Avec modèles IA chargés (Sprint 2 : OCR, Sprint 3 : Liveness) :
```
api (PaddleOCR):     2.5 GB (lazy load)
celery_ocr (GLM):    3.5 GB (lazy load)
Autres services:     2.5 GB
─────────────────────────────
TOTAL:              ~8.5 GB
```

**Problème :** Sans cap WSL2, Docker Desktop peut allouer jusqu'à 12-14 GB, laissant seulement 2-4 GB pour :
- Windows OS
- VS Code / IDE
- Chrome / navigateurs
- Autres applications

**Symptômes attendus :**
- Swap intensif → disque SSD saturé
- Freeze de l'OS Windows
- Crash des containers Docker
- Impossibilité de tester en local

---

### 3.3 Fichiers impactés par l'ajout de .wslconfig

#### Fichiers à créer (2 fichiers)

1. **`infra/.wslconfig.template`** (nouveau fichier)
   ```ini
   [wsl2]
   # BICEC VeriPass — WSL2 Configuration
   # Copier ce fichier vers C:\Users\<USERNAME>\.wslconfig
   # Puis redémarrer WSL : wsl --shutdown
   
   # RAM cap — 8GB pour Docker, 8GB pour Windows/IDE
   memory=8GB
   
   # CPU cores (ajuster selon votre machine)
   processors=4
   
   # Swap (2GB buffer pour pics temporaires)
   swap=2GB
   swapFile=C:\\Users\\<USERNAME>\\AppData\\Local\\Temp\\wsl-swap.vhdx
   
   # Désactiver la mémoire paginée (performance)
   pageReporting=false
   
   # Limiter la croissance du disque virtuel
   localhostForwarding=true
   ```

2. **`docs/setup-wsl2-windows.md`** (nouveau fichier)
   - Guide pas-à-pas pour configurer WSL2
   - Screenshots
   - Commandes de vérification

#### Fichiers à modifier (1 fichier)

3. **`code/README.md`** — Ligne 36
   ```markdown
   # Avant
   - `.wslconfig` configuré (voir `infra/.wslconfig.template`)
   
   # Après (ajouter instructions)
   - `.wslconfig` configuré :
     1. Copier `infra/.wslconfig.template` → `C:\Users\<USERNAME>\.wslconfig`
     2. Ajuster `<USERNAME>` dans le chemin swap
     3. Redémarrer WSL : `wsl --shutdown` puis relancer Docker Desktop
     4. Vérifier : `wsl --list --verbose` (État = Running)
   ```

---

### 3.4 Recommandation WSL2

**Priorité :** 🟡 MOYENNE (Sprint 1)

**Action recommandée :**
1. ✅ Créer `infra/.wslconfig.template` maintenant (5 min)
2. ✅ Créer `docs/setup-wsl2-windows.md` (15 min)
3. ✅ Mettre à jour `code/README.md` (5 min)
4. ⏸️ Laisser chaque dev configurer son propre `.wslconfig` (fichier user, pas dans git)

**Justification :**
- Pas bloquant pour Sprint 0-1 (services légers)
- Critique avant Sprint 2 (OCR) et Sprint 3 (Liveness)
- Prévient les bugs "ça marche pas chez moi" liés à la RAM

---

## 4. Recommandations finales

### 4.1 Changements de ports (Priorité 🔴 HAUTE)

**Action immédiate :**
```bash
# Modifier code/docker-compose.yml
- "3000:8080"  # PWA (au lieu de 8081)
- "3001:8080"  # Back-Office (au lieu de 8082)

# Mettre à jour docs/test-report-2026-03-18.md
```

**Justification :**
- Aligne le code avec la documentation existante
- Respecte les critères d'acceptation de l'issue #9
- Impact minimal (2 fichiers)
- Tous les autres fichiers sont déjà configurés pour 3000/3001

---

### 4.2 Configuration WSL2 (Priorité 🟡 MOYENNE)

**Action Sprint 1 :**
1. Créer `infra/.wslconfig.template`
2. Créer `docs/setup-wsl2-windows.md`
3. Mettre à jour `code/README.md`

**Justification :**
- Pas bloquant maintenant (services légers)
- Critique avant Sprint 2 (modèles IA)
- Prévient les problèmes de RAM en dev

---

### 4.3 Frontends PWA/Back-Office (Priorité 🔴 CRITIQUE)

**Bloqueurs actuels :**
- Issues #42 (PWA Skeleton) et #43 (Back-Office Skeleton) pas terminées
- Containers définis mais pas de code source buildable

**Action :**
- Terminer #42 et #43 avant de fermer #9
- Une fois buildés, les ports 3000/3001 fonctionneront automatiquement

---

## 5. Checklist de validation Issue #9

### Avant de fermer l'issue

- [ ] Ports 3000/3001 configurés dans docker-compose.yml
- [ ] PWA buildable et accessible via https://localhost:3000
- [ ] Back-Office buildable et accessible via https://localhost:3001
- [ ] Template .wslconfig créé dans infra/
- [ ] Documentation WSL2 setup créée
- [ ] README mis à jour avec instructions WSL2
- [ ] Test manuel : `docker compose up` → tous les services démarrent
- [ ] Test manuel : Health checks passent en < 60s
- [ ] Test manuel : Script docker_prune.sh fonctionne

### Dépendances

- ✅ #44 (Nginx) — Terminé
- ✅ #46 (docker_prune.sh) — Terminé
- ⏳ #41 (FastAPI Skeleton) — En cours
- ⏳ #42 (PWA Skeleton) — En cours
- ⏳ #43 (Back-Office Skeleton) — En cours

---

## 6. Conclusion

**Statut actuel :** 4/9 critères validés (44%)

**Pour atteindre 100% :**
1. Changer ports 8081/8082 → 3000/3001 (2 fichiers, 10 min)
2. Créer template .wslconfig + doc (3 fichiers, 25 min)
3. Terminer issues #42 et #43 (frontends buildables)

**Estimation :** Issue #9 peut être fermée dans Sprint 1 (après #42 et #43).
