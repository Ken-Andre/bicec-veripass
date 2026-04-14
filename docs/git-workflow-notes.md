# Git Workflow Notes - BICEC VeriPass

## Workflow pour les Pull Requests

### Quand un reviewer demande des corrections sur une PR existante :

1. **S'assurer d'être sur la bonne branche** (la branche source de la PR)
   ```bash
   git checkout <nom-de-la-branche>
   # Exemple: git checkout feature/my-feature
   ```

2. **Faire les corrections demandées par les reviewers**

3. **Commit et push → la PR se met à jour automatiquement**
   ```bash
   git add .
   git commit -m "fix: description des corrections"
   git push origin <nom-de-la-branche>
   ```

### Règles Importantes
- ✅ **Ne JAMAIS créer une nouvelle PR** si une existe déjà pour cette branche
- ✅ Les commits pushés sur la branche source d'une PR existante sont **automatiquement ajoutés** à la PR
- ✅ Toujours vérifier la branche courante avec `git branch` avant de faire des modifications
- ✅ Utiliser `git status` pour voir les fichiers modifiés avant de committer

## Erreurs à Éviter
- ❌ Ne pas créer de PR dans le mauvais sens (ex: depuis une branche déjà mergée)
- ❌ Ne pas confondre les noms de branches
- ❌ Ne pas oublier de pull les derniers changements avant de travailler : `git pull origin <branche>`
- ✅ Toujours vérifier les branches disponibles avec `git branch -a`

## Commandes Utiles
```bash
# Voir toutes les branches
git branch -a

# Voir la branche courante
git branch

# Voir le statut des fichiers
git status

# Voir l'historique des commits
git log --oneline -10

# Pull les derniers changements
git pull origin <branche>
```
