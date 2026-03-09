# Guide de Contribution — BICEC VeriPass

## Branches

| Branche | Rôle |
|---------|------|
| `main` | Production — protégée, merge via PR uniquement |
| `develop` | Intégration continue — base pour toutes les features |
| `feature/<ticket>-<description>` | Développement d'une feature (ex: `feature/AUTH-04-backoffice-login`) |
| `fix/<ticket>-<description>` | Correction de bug (ex: `fix/OCR-02-glm-timeout`) |
| `docs/<description>` | Documentation uniquement |

## Workflow

```
develop → feature/xxx → PR → code review → merge develop → PR → merge main
```

1. Toujours partir de `develop` : `git checkout -b feature/TICKET-description develop`
2. Commits atomiques avec Conventional Commits (voir ci-dessous)
3. Ouvrir une PR vers `develop` — minimum 1 reviewer
4. Squash merge obligatoire vers `main`

## Convention de Commits (Conventional Commits)

```
<type>(<scope>): <description courte>

[corps optionnel]

[footer optionnel]
```

### Types

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `docs` | Documentation uniquement |
| `refactor` | Refactoring sans changement de comportement |
| `test` | Ajout ou modification de tests |
| `chore` | Tâches de maintenance (CI, deps, config) |
| `perf` | Amélioration de performance |
| `style` | Formatage, linting (pas de logique) |

### Scopes suggérés

`auth` · `kyc` · `ocr` · `biometrics` · `backoffice` · `admin` · `aml` · `analytics` · `infra` · `db` · `notifications` · `pwa`

### Exemples

```
feat(auth): Add Admin IT email/password login with JWT
fix(ocr): Handle CNI_ANCIEN_LANDSCAPE face detection bounding box
docs(schema): Add complete PostgreSQL DDL with all tables
test(auth): Add RBAC isolation tests for Admin IT endpoints
chore(infra): Configure Docker health checks for all services
```

## Standards de code

### Backend (Python)
- Formatter : `ruff format` (remplace black)
- Linter : `ruff check`
- Type hints obligatoires sur toutes les fonctions publiques
- Tests : `pytest` avec couverture ≥ 80%

### Frontend / Back-Office (TypeScript)
- Formatter : `prettier`
- Linter : `eslint`
- Composants fonctionnels React uniquement
- Tests : `vitest`

## Pull Requests

- Titre = message du commit principal (Conventional Commits)
- Description : contexte, approche, captures d'écran si UI
- Checklist obligatoire :
  - [ ] Tests ajoutés/mis à jour
  - [ ] Pas de secrets dans le code
  - [ ] Migration Alembic créée si changement de schéma
  - [ ] `docs/` mis à jour si nouveau comportement

## Sécurité

- **Ne jamais committer** `.env`, clés API, mots de passe, certificats
- Utiliser `.env.example` pour documenter les variables
- Signaler toute vulnérabilité directement à l'équipe projet (pas via issue publique)
