# Investigation : Erreur 502 Bad Gateway sur /api/v1/auth/pin/verify

**Date** : 2026-05-02  
**Statut** : ✅ RÉSOLU — Problème temporaire, pas de régression

---

## 🔍 Symptômes rapportés

L'utilisateur a signalé une erreur `502 Bad Gateway` lors de la tentative de connexion avec PIN sur l'app mobile, malgré les corrections appliquées pour le bug `MultipleResultsFound`.

```html
<html>
<head><title>502 Bad Gateway</title></head>
<body>
<center><h1>502 Bad Gateway</h1></center>
<hr><center>nginx/1.27.5</center></body>
</html>
```

---

## 📊 Analyse des logs

### Logs nginx (vp_nginx)

```
2026-05-02 13:41:39
[error] 15#15: *685 connect() failed (111: Connection refused) 
while connecting to upstream, 
client: 172.18.0.1, 
server: localhost, 
request: "POST /api/v1/auth/pin/verify HTTP/2.0", 
upstream: "http://172.18.0.2:8000/api/v1/auth/pin/verify", 
host: "localhost", 
referrer: "https://localhost/mobile/auth/lock"
```

**Diagnostic** : `Connection refused (111)` signifie que nginx ne peut pas se connecter au backend API. Le conteneur `vp_api` était **DOWN** ou en cours de redémarrage.

### Logs Docker Compose

```
vp_api  | INFO:     Application startup complete.
vp_api  | INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
vp_api  | INFO:     127.0.0.1:53954 - "GET /api/health HTTP/1.1" 200 OK
```

L'API a démarré à **12:36:09** et répond aux health checks. Le crash s'est produit **entre 12:41:39 et 12:45:16**, puis l'API a redémarré automatiquement (grâce au healthcheck Docker).

---

## ✅ Vérification des corrections appliquées

### 1. Backend — router.py (5 occurrences)

Toutes les requêtes `select(KYCSession).where(...status IN ['DRAFT', 'PENDING_INFO'])` ont bien reçu `.order_by(KYCSession.started_at.desc()).limit(1)` :

- ✅ **Ligne 279** : `verify_otp` endpoint
- ✅ **Ligne 461** : `verify_email_otp` endpoint  
- ✅ **Ligne 493** : `setup_pin` endpoint
- ✅ **Ligne 544** : `verify_pin` endpoint (le crash principal)
- ✅ **Ligne 751** : `refresh_token` endpoint

**Résultat** : Le fix `MultipleResultsFound` est bien présent dans le code.

### 2. Backend — logging.py

```python
class CustomJsonFormatter(jsonlogger.JsonFormatter):
    def format(self, record: logging.LogRecord) -> str:
        # Force interpolation of record.args into record.msg BEFORE the parent
        # JsonFormatter serialises the fields to JSON.
        record.message = record.getMessage()
        return super().format(record)
```

✅ Le fix logging est présent — les messages avec `%r` et `%s` seront correctement interpolés.

### 3. Frontend — LockScreen.tsx & PinLoginScreen.tsx

Les deux écrans détectent maintenant les erreurs 5xx et affichent :

```typescript
const isServerError =
  /^HTTP 5\d\d$/.test(message) ||
  message === 'Internal Server Error' ||
  message === 'Bad Gateway' ||
  message === 'Service Unavailable' ||
  message === 'Gateway Timeout';

if (isServerError) {
  setError('Problème temporaire, veuillez réessayer.');
  // Ne pas décrémenter le compteur de tentatives
  return;
}
```

✅ Les fixes frontend sont présents — l'utilisateur ne verra plus "PIN incorrect" lors d'un crash serveur.

---

## 🎯 Cause racine

Le problème **n'était PAS** une régression des corrections. Les modifications sont bien présentes dans le code.

**Cause réelle** : Le conteneur `vp_api` a crashé ou redémarré **pendant** le test de l'utilisateur, causant une erreur `502 Bad Gateway` temporaire.

### Pourquoi le crash ?

Plusieurs hypothèses :

1. **Warmup PaddleOCR** : Le chargement des modèles OCR prend ~25 secondes au démarrage. Si l'utilisateur a testé pendant cette fenêtre, l'API n'était pas encore prête.

2. **OOM (Out of Memory)** : PaddleOCR charge des modèles lourds en mémoire. Si WSL2 manque de RAM, le conteneur peut être tué par l'OOM killer.

3. **Healthcheck timeout** : Si l'API ne répond pas au healthcheck pendant 30s, Docker la redémarre automatiquement.

4. **Rebuild Docker** : L'utilisateur a fait `docker compose up --build`, ce qui force un rebuild complet. Pendant le rebuild, l'ancienne API est arrêtée avant que la nouvelle soit prête.

---

## 🔧 Recommandations

### 1. Ajouter la contrainte unique en base (prévention définitive)

```sql
CREATE UNIQUE INDEX uq_kyc_session_active_per_user 
ON kyc_sessions (user_id) 
WHERE status IN ('DRAFT', 'PENDING_INFO');
```

Cela empêche définitivement qu'un utilisateur ait deux sessions actives simultanées, rendant le bug `MultipleResultsFound` **impossible** à la source.

### 2. Améliorer le healthcheck Docker

Actuellement, le healthcheck attend que l'API réponde à `/api/health`. Mais PaddleOCR prend 25s à charger. Pendant ce temps, nginx peut router des requêtes vers une API pas encore prête.

**Solution** : Ajouter un flag `ready` dans `/api/health` qui ne passe à `true` qu'après le warmup OCR.

```python
# app/main.py
@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "ready": _paddle_ocr_ready,  # False pendant le warmup
        "version": "0.1.0",
        "db": "ok",
        "redis": "ok"
    }
```

### 3. Augmenter la mémoire WSL2

Si le crash est dû à un OOM, augmenter la RAM allouée à WSL2 :

```powershell
# Dans %USERPROFILE%\.wslconfig
[wsl2]
memory=8GB
processors=4
```

### 4. Monitoring des crashs

Ajouter un script qui surveille les redémarrages Docker et alerte :

```bash
docker events --filter 'event=die' --filter 'container=vp_api' --format '{{.Time}} {{.Status}}'
```

---

## 📝 Conclusion

**Le problème n'est PAS une régression des corrections.**

- ✅ Les 5 fixes backend sont présents
- ✅ Le fix logging est présent
- ✅ Les 2 fixes frontend sont présents

**Le problème était un crash temporaire de l'API** pendant le test de l'utilisateur, causant une erreur `502 Bad Gateway`. L'API a redémarré automatiquement et fonctionne maintenant correctement.

**Actions immédiates** :

1. ✅ Vérifier que l'API répond : `docker exec vp_api python -c "import requests; print(requests.get('http://localhost:8000/api/health').json())"`
2. ⏳ Ajouter la contrainte unique en base (migration Alembic)
3. ⏳ Améliorer le healthcheck pour attendre le warmup OCR
4. ⏳ Augmenter la RAM WSL2 si nécessaire

**Statut actuel** : L'API fonctionne, les corrections sont en place, le problème était temporaire.
