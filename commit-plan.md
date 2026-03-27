# Plan de Commits Groupés - Bicec Veripass

Analyse des 60 fichiers modifiés et mapping aux issues "In Progress"

## Fichiers Modifiés (git status)

### Groupe 1: AUTH - Mobile OTP & PIN Login
**Issues potentielles:** #50, #52, #54 (AUTH-05, AUTH-07, AUTH-04)

**Fichiers nouveaux:**
- `code/mobile/src/views/auth/EmailEntryScreen.tsx`
- `code/mobile/src/views/auth/EmailOtpVerifyScreen.tsx`
- `code/mobile/src/views/auth/OtpVerifyScreen.tsx`
- `code/mobile/src/views/auth/PinLoginScreen.tsx`
- `code/mobile/src/views/auth/PinSetupScreen.tsx`
- `code/mobile/src/views/auth/index.ts`

**Fichiers modifiés:**
- `code/mobile/src/contexts/AuthContext.tsx`
- `code/mobile/src/App.tsx`
- `code/mobile/src/services/apiClient.ts`
- `code/mobile/src/views/HomePage.tsx`
- `code/mobile/src/components/ScreenLayout.tsx`
- `code/mobile/vite.config.ts`

**Commit message:**
```
feat(auth): implement mobile OTP & PIN authentication flow

- Add email entry and OTP verification screens
- Implement PIN setup and login screens
- Update AuthContext with OTP/PIN logic
- Configure API client for auth endpoints

Closes #52 (Mobile OTP Capture Screen)
Closes #54 (Redis TTL for OTP storage)
Related to #50 (Auth Router & Token Management)
```

---

### Groupe 2: AUTH - Backend JWT & Token Management
**Issues:** #50, #48 (AUTH-05, AUTH-03)

**Fichiers nouveaux:**
- `code/backend/app/modules/auth/jwt_service.py`
- `code/backend/app/db/seed_data.py`

**Fichiers modifiés:**
- `code/backend/app/modules/auth/models.py`
- `code/backend/app/modules/auth/router.py`
- `code/backend/app/modules/auth/schemas.py`
- `code/backend/app/modules/auth/utils.py`
- `code/backend/app/core/redis.py`

**Commit message:**
```
feat(auth): add JWT service and token management

- Implement JWT service with refresh token logic
- Add seed data for demo users (rôles: JEAN, THOMAS, SYLVIE, ADMIN_IT)
- Update auth router with OTP/PIN endpoints
- Enhance Redis client for OTP storage
- Add auth schemas for OTP/PIN validation

Note: JEAN/THOMAS/SYLVIE/ADMIN_IT sont des rôles fonctionnels (ADR-009).
Les comptes demo (jean@bicec.cm) n'existent qu'en ENVIRONMENT=development.

Closes #50 (Auth Router & Token Management)
Closes #48 (PIN Setup & Secure Storage)
```

---

### Groupe 3: AUTH - Back-Office Login UI
**Issue:** #53 (AUTH-07)

**Fichiers modifiés:**
- `code/backoffice/src/contexts/AuthContext.tsx`
- `code/backoffice/src/pages/LoginPage.tsx`

**Commit message:**
```
feat(backoffice): implement login dashboard UI

- Add login page with role-based redirect
- Implement password visibility toggle
- Add "Forgot password" link
- Update AuthContext for back-office agents

Closes #53 (Back-Office Login Dashboard)
```

---

### Groupe 4: RBAC & Security - Unit Tests
**Issue:** #49 (AUTH-04)

**Fichiers nouveaux:**
- `code/backend/tests/unit/test_rbac_unit.py`
- `code/backend/tests/unit/test_security.py`
- `code/backend/tests/unit/test_auth_schemas.py`
- `code/backend/tests/unit/test_health_unit.py`
- `code/backend/tests/unit/test_otp_redis.py`
- `code/backend/tests/unit/test_seed_data.py`

**Fichiers modifiés:**
- `code/backend/tests/unit/conftest.py`

**Commit message:**
```
test(auth): add comprehensive unit tests for RBAC & security

- Add RBAC permission tests (rôles JEAN, THOMAS, SYLVIE)
- Add security tests (JWT, password hashing)
- Add OTP Redis storage tests
- Add seed data validation tests
- Update conftest to neutralize DB fixtures (tests/unit/ sans PostgreSQL)

Run with: cd code/backend && uv run pytest tests/unit/ -v

Closes #49 (RBAC Logic & JWT)
```

---

### Groupe 5: Infrastructure - Rate Limiting & Maintenance
**Issues:** #174, #182 (SECURITY-01, ADMIN-02)

**Fichiers nouveaux:**
- `code/backend/tests/test_rate_limiting.py`

**Fichiers modifiés:**
- `code/backend/app/tasks/maintenance.py`

**Commit message:**
```
feat(infra): add rate limiting and maintenance tasks

- Implement rate limiting middleware tests
- Add Celery maintenance tasks (DB cleanup, log rotation)
- Configure Redis for rate limit storage

Closes #174 (Rate Limiting Middleware)
Related to #182 (Sentry integration)
```

---

### Groupe 6: Infrastructure - Docker & Nginx Config
**Issues:** #9, #201, #203 (INFRA-01, INFRA-02)

**Fichiers modifiés:**
- `code/infra/.wslconfig.template`
- `code/backoffice/nginx.conf`
- `code/mobile/nginx.conf`
- `code/.env.example`

**Fichiers nouveaux:**
- `code/backend/data/documents/` (directory)

**Commit message:**
```
chore(infra): update Docker and Nginx configurations

- Add WSL2 memory limit template (.wslconfig)
- Update Nginx configs for backoffice/mobile
- Add document storage directory
- Update .env.example with new variables

Closes #9 (Docker Compose Infrastructure Setup)
Closes #201 (Nginx on port 3000)
Closes #203 (WSL2 8GB config)
```

---

### Groupe 7: Dependencies & Tooling
**Fichiers modifiés:**
- `code/backend/uv.lock`

**Commit message:**
```
chore(deps): update Python dependencies

- Lock new dependencies (redis, celery, jwt)
- Update uv.lock after adding auth packages
```

---

### Groupe 8: Documentation & Planning
**Fichiers modifiés:**
- `.kiro/specs/bicec-veripass-complete-implementation/tasks.md`
- `.vscode/settings.json`

**Fichiers nouveaux (à ignorer ou commit séparé):**
- `board.kanban.*.json` (backups)
- `code/parse_project.py`
- `code/project_*.json`

**Commit message:**
```
docs: update task tracking and workspace settings

- Update Kiro spec tasks with progress
- Update VSCode settings for project
```

---

## Stratégie d'Exécution

1. **Vérifier l'état actuel des issues** avec `gh issue view <number>`
2. **Créer les commits dans l'ordre** (AUTH mobile → AUTH backend → Tests → Infra)
3. **Taguer les issues** après chaque commit avec `gh issue comment <number> -b "✅ Implemented in commit <sha>"`
4. **Pousser par batch** pour review incrémentale

## Commandes à Exécuter

```bash
# Groupe 1: AUTH Mobile
git add code/mobile/src/views/auth/*.tsx code/mobile/src/views/auth/index.ts
git add code/mobile/src/contexts/AuthContext.tsx code/mobile/src/App.tsx
git add code/mobile/src/services/apiClient.ts code/mobile/src/views/HomePage.tsx
git add code/mobile/src/components/ScreenLayout.tsx code/mobile/vite.config.ts
git commit -m "feat(auth): implement mobile OTP & PIN authentication flow..."
git push origin main

# Taguer les issues
gh issue comment 52 -b "✅ Implemented in commit $(git rev-parse HEAD)"
gh issue comment 54 -b "✅ Implemented in commit $(git rev-parse HEAD)"

# Répéter pour chaque groupe...
```

## Notes
- Les fichiers `board.kanban.*.json` et `code/project_*.json` sont des backups/outils → `.gitignore` ou commit séparé
- Le dossier `code/backend/data/documents/` doit être créé mais vide → ajouter `.gitkeep`
- Toujours utiliser `uv run` pour les commandes Python (voir backend-dev-conventions.md)
