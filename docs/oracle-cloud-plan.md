# Plan Oracle Cloud — GLM-OCR Server

## Architecture

```
LOCAL (BICEC Cameroun)                     ORACLE CLOUD PARIS
┌──────────────────────┐                   ┌─────────────────────────────┐
│  FastAPI             │                   │  GLM-OCR Server             │
│  (Paddle si offline) │                   │  (Ubuntu 24.04 ARM)         │
│         │            │                   │  4 OCPU · 24GB RAM · 200GB  │
└────────┬─────────────┘                   │  Docker + FastAPI           │
         │ crée task                       │  + llama.cpp (ARM)          │
         ▼                                 │  + GLM-OCR GGUF (~1.7GB)    │
┌──────────────────────┐                   └─────────────────────────────┘
│  Redis Queue         │     ocr_online=true          ▲
│  glm_ocr_jobs        │──────────────────────────────┘
└──────────────────────┘     HTTPS + AES-256-GCM
         │                     + X-API-Key
         ▼
┌──────────────────────┐
│  Celery Worker       │
│  (proxy HTTP)        │
└──────────────────────┘
```

## 1. Création du compte Oracle Cloud (1x, browser)

1. Aller sur https://signup.cloud.oracle.com
2. Créer un compte Free Tier
3. **Home Region : Europe (Paris)** — définitif, choisir la bonne
4. Ajouter une carte bancaire (micro-autorisation ~$1, non débitée, disparaît sous 3-7 jours)
5. Terminer l'inscription

## 2. Provisionnement VM (1x, browser)

1. Console OCI → Compute → Instances → "Create instance"
2. **Name** : `glm-ocr-server`
3. **Image** : `Canonical Ubuntu 24.04 LTS`
4. **Shape** : Ampere → `VM.Standard.A1.Flex` → 4 OCPU + 24 GB RAM (Always Free eligible)
5. **SSH keys** : coller la clé publique depuis `code/infra/keys/glm-ocr-oracle.pub`
6. **Boot volume** : 200 GB (laisser par défaut)
7. **Networking** : laisser le VCN par défaut
8. "Create", attendre **Running**

## 3. Pare-feu (1x, browser)

1. Networking → Virtual Cloud Networks → VCN créé
2. **Security Lists** → **Default Security List**
3. "Add Ingress Rules" :
   - Source CIDR : `0.0.0.0/0`
   - IP Protocol : TCP
   - Destination Port Range : `443`
   - Description : "HTTPS for GLM-OCR API server"

## 4. Déploiement du serveur (1x, terminal)

```bash
# Depuis ta machine locale
ssh -i code/infra/keys/glm-ocr-oracle ubuntu@<IP_PUBLIQUE_ORACLE>

# Sur la VM Oracle :
# Cloner et lancer le déploiement
```

## 5. Clés générées

| Type | Fichier | Usage |
|---|---|---|
| **Clé SSH privée** | `code/infra/keys/glm-ocr-oracle` | SSH → VM Oracle |
| **Clé SSH publique** | `code/infra/keys/glm-ocr-oracle.pub` | À coller dans OCI |
| **API Key** | `sk-glm-ocr-9192c9e4078e2428907245f6fc33833db44d8f1116b855b1` | Auth HTTP entre Celery et Oracle |

## 6. Variables d'environnement à ajouter

### Côté local (`code/.env`)

```bash
# ── Oracle Cloud GLM-OCR ─────────────────────────────────────
OCR_ONLINE=false                         # true → envoie vers Oracle
OCR_CLOUD_URL=https://<IP_PUBLIQUE_ORACLE>/ocr
OCR_CLOUD_API_KEY=sk-glm-ocr-9192c9e4078e2428907245f6fc33833db44d8f1116b855b1
OCR_CLOUD_KEY=<base64_32_bytes_random>
```

### Côté Oracle (`.env` du serveur)

```bash
API_KEY=sk-glm-ocr-9192c9e4078e2428907245f6fc33833db44d8f1116b855b1
OCR_CLOUD_KEY=<base64_32_bytes_random>  # MÊME clé que côté local
```

## 7. Flux de chiffrement

```
Image CNI (JPEG 5MB)
  ↓ resize 600px + JPEG Q85 → ~300KB
  ↓ AES-256-GCM encrypt (nonce 12B + ciphertext)
  ↓ base64 encode
  ↓ HTTP POST vers Oracle (HTTPS)
  ↓
  Oracle déchiffre → lance llama-mtmd-cli → résultat JSON
  ↓ AES-256-GCM encrypt → base64 → HTTP Response
  ↓
Celery worker déchiffre → mappe → DB locale
```

## 8. Fichiers modifiés côté local

- `code/backend/api/utils/crypto.py` — compress + encrypt/decrypt
- `code/backend/app/tasks/ocr.py` — branche `OCR_ONLINE`
- `code/.env.example` — nouvelles vars
- `code/backend/pyproject.toml` — ajout `cryptography`
- `code/docker-compose.yml` — vars d'env pour `celery_ocr`
- `.gitignore` — exclusion `code/infra/keys/`
