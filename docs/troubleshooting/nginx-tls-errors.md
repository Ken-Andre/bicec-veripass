# Guide de Dépannage - Nginx TLS & Security Headers

## Erreurs Rencontrées et Solutions

### Erreur 1 : Permission Denied sur les certificats auto-signés

**Symptôme :**
```
nginx: [emerg] cannot load certificate key "/etc/ssl/certs/nginx-selfsigned.key": 
BIO_new_file() failed (SSL: error:8000000D:system library::Permission denied:calling fopen(/etc/ssl/certs/nginx-selfsigned.key, r))
```

**Cause :**
Les fichiers générés par OpenSSL via Docker sur Windows ont des permissions NTFS qui ne sont pas compatibles avec le processus nginx (non-root) à l'intérieur du container Linux. Le processus nginx s'exécute avec l'utilisateur `nginx` (UID 101) et ne peut pas lire les fichiers créés avec les permissions par défaut de Docker for Windows.

**Solution :**
Créer un Dockerfile personnalisé qui copie les certificats à l'intérieur du container avec les bonnes permissions :

```dockerfile
FROM nginxinc/nginx-unprivileged:1.27-bookworm

USER root
COPY certs/nginx-selfsigned.crt /etc/ssl/certs/nginx-selfsigned.crt
COPY certs/nginx-selfsigned.key /etc/ssl/certs/nginx-selfsigned.key

RUN chmod 644 /etc/ssl/certs/nginx-selfsigned.crt && \
    chmod 644 /etc/ssl/certs/nginx-selfsigned.key && \
    chown root:root /etc/ssl/certs/nginx-selfsigned.crt /etc/ssl/certs/nginx-selfsigned.key

USER nginx
```

**Alternative (moins recommandée) :**
Utiliser `icacls` sur Windows pour modifier les permissions :
```powershell
icacls code\infra\nginx\certs\nginx-selfsigned.key /grant Everyone:R
icacls code\infra\nginx\certs\nginx-selfsigned.crt /grant Everyone:R
```
⚠️ Cette solution ne fonctionne pas toujours car Docker for Windows utilise WSL2 et les permissions Linux sont gérées séparément.

---

### Erreur 2 : OpenSSL non disponible sur Windows

**Symptôme :**
```
openssl : Le terme 'openssl' n'est pas reconnu comme nom de cmdlet
```

**Cause :**
OpenSSL n'est pas installé par défaut sur Windows 10/11.

**Solutions :**

**Option A - Utiliser Docker (recommandé) :**
```powershell
docker run --rm -v "${PWD}/code/infra/nginx/certs:/certs" alpine/openssl req `
    -x509 -nodes -days 365 `
    -newkey rsa:2048 `
    -keyout /certs/nginx-selfsigned.key `
    -out /certs/nginx-selfsigned.crt `
    -subj "/C=CM/ST=Centre/L=Yaounde/O=BICEC/OU=VeriPass/CN=localhost"
```

**Option B - PowerShell native :**
```powershell
$cert = New-SelfSignedCertificate `
    -DnsName "localhost" `
    -CertStoreLocation "cert:\LocalMachine\My" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -NotAfter (Get-Date).AddYears(1)
```
⚠️ Note : PowerShell génère un certificat au format PFX/PKCS12, pas au format PEM requis par Nginx. Il faut exporter manuellement.

**Option C - Installer OpenSSL :**
Télécharger depuis https://slproweb.com/products/Win32OpenSSL.html et ajouter au PATH.

---

### Erreur 3 : Syntaxe PowerShell vs Bash

**Symptôme :**
```
The token '&&' is not a valid statement separator in this version
```

**Cause :**
PowerShell n'utilise pas `&&` comme séparateur de commandes (contrairement à Bash).

**Solution :**
Utiliser `;` pour enchaîner les commandes :
```powershell
# ❌ Ne fonctionne pas en PowerShell
cd code && docker-compose up -d

# ✅ Fonctionne en PowerShell
cd code; docker-compose up -d

# ✅ Ou exécuter séparément
cd code
docker-compose up -d
```

---

### Erreur 4 : Container nginx en boucle de redémarrage

**Symptôme :**
```
STATUS: Restarting (1)
```

**Cause :**
Nginx ne peut pas démarrer à cause d'une erreur de configuration ou de permission. Vérifier les logs :
```powershell
cd code; docker-compose logs nginx --tail 50
```

**Solutions courantes :**
1. **Erreur de permission** → Voir Erreur 1
2. **Erreur de syntaxe nginx.conf** → Vérifier la syntaxe avec :
   ```powershell
   docker run --rm -v "${PWD}/code/infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" nginxinc/nginx-unprivileged:1.27-bookworm nginx -t
   ```
3. **Certificats manquants** → Générer les certificats avec `generate-certs.ps1`

---

### Erreur 5 : certbot impossible sur localhost

**Symptôme :**
Let's Encrypt ne peut pas émettre de certificats pour `localhost`.

**Cause :**
Let's Encrypt nécessite un nom de domaine public pour valider la propriété via HTTP-01 ou DNS-01 challenge. `localhost` n'est pas un domaine valide.

**Solution :**
- **Développement** : Utiliser des certificats auto-signés (script `generate-certs.ps1`)
- **Production** : Configurer un domaine public (ex: `veripass.bicec.cm`) puis utiliser certbot :
  ```bash
  sudo certbot certonly --webroot -w /var/www/certbot -d veripass.bicec.cm
  ```

---

## Commandes de Dépannage Rapide

### Vérifier l'état des containers
```powershell
cd code; docker-compose ps
```

### Voir les logs nginx
```powershell
cd code; docker-compose logs nginx --tail 50
```

### Tester la configuration nginx
```powershell
docker run --rm -v "${PWD}/code/infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" nginxinc/nginx-unprivileged:1.27-bookworm nginx -t
```

### Vérifier TLS et les headers
```powershell
# TLS
curl.exe -I -k https://localhost

# Headers de sécurité
curl.exe -I -k https://localhost | Select-String -Pattern "(Strict-Transport|X-Content-Type|X-Frame|X-XSS|Referrer-Policy|Content-Security|Permissions-Policy)"

# Redirect HTTP → HTTPS
curl.exe -I http://localhost
```

### Reconstruire le container nginx
```powershell
cd code; docker-compose build nginx; docker-compose up -d nginx
```

### Régénérer les certificats
```powershell
cd code/infra/nginx; .\generate-certs.ps1
cd code; docker-compose build nginx; docker-compose up -d nginx
```

---

## Notes pour la Production

### Let's Encrypt (certificats valides)
Quand un domaine public sera configuré (ex: `veripass.bicec.cm`) :

1. Installer certbot sur le serveur
2. Obtenir le certificat :
   ```bash
   sudo certbot certonly --webroot -w /var/www/certbot -d veripass.bicec.cm
   ```
3. Mettre à jour `nginx.conf` :
   ```nginx
   ssl_certificate /etc/letsencrypt/live/veripass.bicec.cm/fullchain.pem;
   ssl_certificate_key /etc/letsencrypt/live/veripass.bicec.cm/privkey.pem;
   ```
4. Configurer le renouvellement automatique :
   ```bash
   echo "0 0 * * * root certbot renew --quiet" | sudo tee -a /etc/crontab
   ```

### Certificats auto-signés (développement uniquement)
- Valide 365 jours
- Avertissement navigateur normal (à accepter manuellement)
- Pas de validation par autorité de certification

---

## Références
- Issue #44 : Nginx Reverse Proxy & TLS 1.3
- Issue #176 : Security Headers
- ADR-015 : docs/adr/ADR-015-tls-security-headers.md
- Architecture §11.1 : Defense in Depth
- Architecture §14.1 : Phase 1 Chiffrement