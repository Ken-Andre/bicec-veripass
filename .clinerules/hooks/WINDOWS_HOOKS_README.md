# 🪝 Hooks Cline - Configuration pour Windows 11

## ⚠️ Problème identifié

Vos hooks n'apparaissaient pas dans le tableau de bord Cline parce que :

1. **Sur Windows, les hooks doivent avoir l'extension `.ps1`** (PowerShell)
2. Vos hooks étaient des scripts bash sans extension (ex: `prevent-js-in-ts`)
3. Cline ignore les hooks qui n'ont pas le bon format pour la plateforme

> Documentation officielle : "On Windows, only `HookName.ps1` is supported (PowerShell script files). Wrong-platform naming is ignored by hook discovery."

## ✅ Solution implémentée

J'ai créé des versions PowerShell (`.ps1`) de tous vos hooks existants :

### PreToolUse Hooks

| Hook | Fichier PowerShell | Description |
|------|-------------------|-------------|
| prevent-js-in-ts | `prevent-js-in-ts.ps1` | Empêche la création de fichiers .js dans un projet TypeScript |
| start-dev-env | `start-dev-env.ps1` | Vérifie que Docker est lancé avant d'exécuter des commandes dev |

### TaskStart Hooks

| Hook | Fichier PowerShell | Description |
|------|-------------------|-------------|
| init-env | `init-env.ps1` | Initialise l'environnement au démarrage d'une tâche |

### PostToolUse Hooks

| Hook | Fichier PowerShell | Description |
|------|-------------------|-------------|
| log-actions | `log-actions.ps1` | Log toutes les actions dans `~/.cline-actions.log` |
| run-tests | `run-tests.ps1` | Lance automatiquement les tests après modification de code |

## 📁 Structure actuelle

```
.clinerules/hooks/
├── PreToolUse/
│   ├── prevent-js-in-ts        # Version bash (non fonctionnel sur Windows)
│   ├── prevent-js-in-ts.ps1    # ✅ Version PowerShell
│   ├── start-dev-env           # Version bash (non fonctionnel sur Windows)
│   └── start-dev-env.ps1       # ✅ Version PowerShell
├── TaskStart/
│   ├── init-env                # Version bash (non fonctionnel sur Windows)
│   └── init-env.ps1            # ✅ Version PowerShell
├── PostToolUse/
│   ├── log-actions             # Version bash (non fonctionnel sur Windows)
│   ├── log-actions.ps1         # ✅ Version PowerShell
│   ├── run-tests               # Version bash (non fonctionnel sur Windows)
│   └── run-tests.ps1           # ✅ Version PowerShell
└── WINDOWS_HOOKS_README.md     # Ce fichier
```

## 🚀 Utilisation

Les hooks `.ps1` sont maintenant automatiquement détectés par Cline sous Windows 11. Vous n'avez rien d'autre à faire !

### Pour tester un hook

1. **PreToolUse - prevent-js-in-ts** : Essayez de créer un fichier `.js` dans le projet
   ```bash
   # Ce devrait être bloqué si tsconfig.json existe
   echo "test" > test.js
   ```

2. **TaskStart - init-env** : Démarrez une nouvelle tâche dans Cline
   - Vous verrez les vérifications Docker et .env

3. **PostToolUse - log-actions** : Exécutez n'importe quelle action dans Cline
   - Vérifiez le fichier `~/.cline-actions.log`

## 🔧 Dépannage

### Les hooks ne s'exécutent toujours pas ?

1. **Vérifiez que PowerShell est disponible** :
   ```powershell
   powershell -NoProfile -Command "$PSVersionTable.PSVersion"
   ```

2. **Vérifiez la politique d'exécution PowerShell** :
   ```powershell
   Get-ExecutionPolicy
   ```
   Si c'est `Restricted`, exécutez (en tant qu'administrateur) :
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

3. **Redémarrez Cline** après avoir modifié les hooks

### Voir les logs d'erreur

Les hooks écrivent dans stderr, visible dans la console Cline. Vérifiez les messages d'erreur dans l'interface.

## 📚 Ressources

- [Documentation officielle Cline Hooks](https://docs.cline.bot/customization/hooks)
- [Format d'entrée/sortie des hooks](https://docs.cline.bot/customization/hooks#how-hooks-work)

## 🔄 Mise à jour des hooks bash originaux

Les fichiers bash originales (`prevent-js-in-ts`, `start-dev-env`, etc.) sont toujours présentes mais **ne fonctionnent pas sous Windows**. Vous pouvez :

1. **Les conserver** : Utile si vous travaillez aussi sur Linux/macOS
2. **Les supprimer** : Pour clarifier le dossier (seuls les `.ps1` sont nécessaires sur Windows)

---

**Date de création** : 19 Mars 2026  
**Système** : Windows 11  
**Version Cline** : Compatible avec toutes les versions supportant les hooks PowerShell