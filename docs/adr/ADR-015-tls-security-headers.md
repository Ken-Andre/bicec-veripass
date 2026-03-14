# ADR-015 : TLS 1.3 et Security Headers (Nginx)

**Statut :** DÉCIDÉ  
**Date :** 2026-03-14  
**Issues :** #44 (INFRA-05), #176 (ADMIN-03)

## Contexte

Les issues #44 et #176 exigent la configuration de Nginx comme reverse proxy avec TLS 1.3 et security headers HTTP, conformément à la couche 1 de défense en profondeur (§11.1 architecture).

## Décision

### TLS Configuration
- **TLS 1.2 + TLS 1.3** activés (désactivation TLS 1.0/1.1)
- **Certificats auto-signés** pour le développement local
- **Let's Encrypt** réservé pour la production (nécessite domaine public)

### Security Headers
| Header | Valeur | Conformité |
|--------|--------|------------|
| Strict-Transport-Security | max-age=31536000; includeSubDomains | OWASP M3 |
| X-Content-Type-Options | nosniff | OWASP M3 |
| X-Frame-Options | DENY | OWASP M7 |
| Content-Security-Policy | default-src 'self'; ... | OWASP M7 |
| Referrer-Policy | strict-origin-when-cross-origin | RGPD |
| Permissions-Policy | camera=(), microphone=() | RGPD |

### Rate Limiting
- API générale : 10 req/s (burst 20)
- Auth endpoints : 1 req/s (burst 5)

## Fichiers modifiés

| Fichier | Description |
|---------|-------------|
| `code/infra/nginx/nginx.conf` | Configuration TLS + Security Headers |
| `code/infra/nginx/Dockerfile` | Dockerfile personnalisé pour permissions |
| `code/infra/nginx/generate-certs.ps1` | Script génération certificats (PowerShell) |
| `code/infra/nginx/generate-certs.sh` | Script génération certificats (Bash) |
| `code/docker-compose.yml` | Utilise Dockerfile personnalisé |

## Conséquences

### Dev local
- Accès via `https://localhost:443` (avertissement certificat auto-signé)
- Script `generate-certs.ps1` pour régénérer les certificats

### Production
- Remplacer les certificats auto-signés par Let's Encrypt
- Commande : `certbot certonly --webroot -w /var/www/certbot -d veripass.bicec.cm`

## Tests de validation

```bash
# Vérifier TLS
curl.exe -I -k https://localhost

# Vérifier redirect HTTP→HTTPS
curl.exe -I http://localhost

# Résultat attendu : 301 redirect vers HTTPS
```

## Références
- OWASP Mobile Top 10 (§11.4)
- Architecture §11.1 (Defense in Depth)
- Architecture §14.1 (Phase 1 Chiffrement)