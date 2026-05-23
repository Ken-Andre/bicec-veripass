# Configuration WSL2 pour BICEC VeriPass (Windows)

## Pourquoi configurer WSL2 ?

Sans configuration, Docker Desktop peut consommer jusqu'à 12-14 GB de RAM, laissant seulement 2-4 GB pour Windows, VS Code et Chrome. Avec les modèles IA (Sprint 2+), cela provoque :
- Swap intensif → disque saturé
- Freeze de Windows
- Crash des containers Docker

La configuration WSL2 limite Docker à 8 GB, garantissant 8 GB pour le reste du système.

---

## Prérequis

- Windows 10 version 2004+ ou Windows 11
- WSL2 installé et activé
- Docker Desktop avec backend WSL2

---

## Installation (5 minutes)

### Étape 1 : Copier le template

```powershell
# Ouvrir PowerShell
cd C:\Users\<VOTRE_USERNAME>

# Copier le template depuis le repo
copy <CHEMIN_REPO>\infra\.wslconfig.template .wslconfig
```

Remplacer `<VOTRE_USERNAME>` et `<CHEMIN_REPO>` par vos valeurs.

---

### Étape 2 : Éditer le fichier

Ouvrir `C:\Users\<VOTRE_USERNAME>\.wslconfig` avec Notepad et modifier :

```ini
# Ligne 19 : Remplacer <USERNAME> par votre nom d'utilisateur Windows
swapFile=C:\\Users\\<USERNAME>\\AppData\\Local\\Temp\\wsl-swap.vhdx

# Exemple :
swapFile=C:\\Users\\yoann\\AppData\\Local\\Temp\\wsl-swap.vhdx
```

**Ajuster les CPU cores si nécessaire :**
- Intel i3 / Ryzen 3 : `processors=2`
- Intel i5 / Ryzen 5 : `processors=4`
- Intel i7+ / Ryzen 7+ : `processors=6`

---

### Étape 3 : Redémarrer WSL

```powershell
# Arrêter toutes les distributions WSL
wsl --shutdown

# Attendre 10 secondes
Start-Sleep -Seconds 10

# Relancer Docker Desktop
# (via l'icône dans la barre des tâches)
```

---

### Étape 4 : Vérifier la configuration

```powershell
# Vérifier que WSL est bien redémarré
wsl --list --verbose

# Sortie attendue :
#   NAME                   STATE           VERSION
# * docker-desktop         Running         2
#   docker-desktop-data    Running         2
```

**Dans Docker Desktop :**
1. Ouvrir Docker Desktop
2. Aller dans Settings → Resources → Advanced
3. Vérifier que "Memory" affiche ~8 GB

---

## Vérification dans le container

Une fois `docker compose up` lancé :

```bash
# Vérifier la RAM disponible dans un container
docker exec vp_api free -h

# Sortie attendue (Total ~8 GB) :
#               total        used        free      shared  buff/cache   available
# Mem:          7.8Gi       2.5Gi       4.2Gi        50Mi       1.1Gi       5.0Gi
```

---

## Budget RAM par service (Sprint 2+)

| Service | RAM | Notes |
|---------|-----|-------|
| nginx | 128 MB | Reverse proxy |
| pwa | 128 MB | Static files |
| backoffice | 128 MB | Static files |
| api | 2.5 GB | FastAPI + PaddleOCR (lazy) |
| celery_ocr | 3.5 GB | GLM-OCR 0.9B quantifié (lazy) |
| celery_notif | 512 MB | SMS, emails |
| celery_beat | 128 MB | Scheduler |
| postgres | 512 MB | Database |
| redis | 256 MB | Cache + Celery broker |
| flower | 256 MB | Monitoring |
| **TOTAL** | **~8 GB** | Avec lazy loading |

---

## Dépannage

### Problème : WSL ne redémarre pas

```powershell
# Forcer l'arrêt
wsl --shutdown

# Vérifier qu'aucun processus WSL ne tourne
Get-Process | Where-Object {$_.Name -like "*wsl*"}

# Si des processus persistent, les tuer
Stop-Process -Name "wsl" -Force
Stop-Process -Name "wslservice" -Force

# Redémarrer Docker Desktop
```

---

### Problème : Docker Desktop n'applique pas la limite

1. Ouvrir Docker Desktop → Settings → Resources
2. Décocher "Use WSL 2 based engine"
3. Appliquer
4. Recocher "Use WSL 2 based engine"
5. Appliquer
6. Redémarrer Docker Desktop

---

### Problème : Swap file non créé

Vérifier que le dossier existe :

```powershell
# Créer le dossier si nécessaire
New-Item -ItemType Directory -Force -Path "$env:LOCALAPPDATA\Temp"

# Vérifier les permissions
icacls "$env:LOCALAPPDATA\Temp"
```

---

## Désinstallation

Pour revenir à la configuration par défaut :

```powershell
# Supprimer le fichier .wslconfig
Remove-Item C:\Users\<VOTRE_USERNAME>\.wslconfig

# Redémarrer WSL
wsl --shutdown
```

Docker Desktop utilisera alors la configuration par défaut (50% de la RAM système).

---

## Références

- [Microsoft WSL2 Configuration](https://learn.microsoft.com/en-us/windows/wsl/wsl-config#wslconfig)
- [Docker Desktop WSL2 Backend](https://docs.docker.com/desktop/wsl/)
- Budget RAM détaillé : `docs/analysis-issue-9-ports-wsl2.md`
