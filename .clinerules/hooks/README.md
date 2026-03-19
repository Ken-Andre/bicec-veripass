# 🪝 Hooks Cline - BICEC VeriPass

Hooks pour automatiser les tâches quotidiennes du projet. Les hooks s'exécutent automatiquement à des moments clés du cycle de vie de Cline.

## 📁 Structure

```
.clinerules/hooks/
├── README.md           # Ce fichier
├── PreToolUse/         # Avant l'exécution d'un outil
│   ├── start-dev-env
│   └── prevent-js-in-ts
├── PostToolUse/        # Après l'exécution d'un outil
│   ├── run-tests
│   └── log-actions
└── TaskStart/          # Au démarrage d'une tâche
    └── init-env
```

## 🔄 Types de Hooks

### PreToolUse
S'exécutent **avant** chaque action de Cline. Permettent de:
- Valider les actions
- Annuler des opérations dangereuses
- Modifier le contexte

### PostToolUse
S'exécutent **après** chaque action de Cline. Permettent de:
- Logger les actions
- Lancer des tests automatiquement
- Notifier des résultats

### TaskStart
S'exécutent **au démarrage** d'une nouvelle tâche. Permettent de:
- Initialiser l'environnement
- Vérifier les prérequis
- Afficher un état

## 📋 Liste des Hooks

### 1. `start-dev-env` (PreToolUse)
Vérifie que Docker est lancé avant les commandes de développement.

**Déclencheur:** `npm run dev`, `docker compose up`  
**Action:** Annule si Docker n'est pas en cours d'exécution

### 2. `prevent-js-in-ts` (PreToolUse)
Empêche la création de fichiers `.js` dans un projet TypeScript.

**Déclencheur:** Création d'un fichier `.js`  
**Action:** Annule avec message d'erreur

### 3. `run-tests` (PostToolUse)
Lance automatiquement les tests après modification de fichiers de test.

**Déclencheur:** Modification d'un fichier de test (Python ou TypeScript)  
**Action:** Exécute les tests correspondants

### 4. `log-actions` (PostToolUse)
Log toutes les actions dans `~/.cline-actions.log`.

**Déclencheur:** Toute action  
**Action:** Écrit dans le fichier de log

### 5. `init-env` (TaskStart)
Initialise et vérifie l'environnement au démarrage.

**Déclencheur:** Nouvelle tâche  
**Action:** Vérifie Docker, services, fichiers .env

## 🔧 Activation

Les hooks sont activés automatiquement s'ils sont présents dans `.clinerules/hooks/`.

Pour désactiver un hook:
```bash
chmod -x .clinerules/hooks/<type>/<hook-name>
```

Pour activer:
```bash
chmod +x .clinerules/hooks/<type>/<hook-name>
```

## 📝 Créer un Hook

1. Créer un fichier dans le bon répertoire (PreToolUse, PostToolUse, ou TaskStart)
2. Rendre exécutable: `chmod +x nom-du-hook`
3. Le hook reçoit du JSON via stdin et doit retourner du JSON via stdout

### Format d'entrée (stdin)
```json
{
  "taskId": "abc123",
  "clineVersion": "3.62.0",
  "timestamp": 1736654400000,
  "workspacePath": "/path/to/project",
  "preToolUse": {
    "tool": "write_to_file",
    "parameters": { "path": "src/file.ts", "content": "..." }
  }
}
```

### Format de sortie (stdout)
```json
{
  "cancel": false,
  "contextModification": "Optional text",
  "errorMessage": ""
}
```

## 🎯 Conventions

- Toujours inclure `#!/bin/bash`
- Toujours retourner un JSON valide
- Utiliser `echo '{"cancel":false}'` par défaut
- Pour annuler: `echo '{"cancel":true,"errorMessage":"..."}'`
- Les messages d'erreur s'affichent dans stderr avec `>&2`