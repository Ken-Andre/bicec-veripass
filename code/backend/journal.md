# Pull Request — INFRA-02 : Mise en place du squelette FastAPI (Modular Monolith)

## Description Technique

Cette Pull Request implémente la structure de base du backend pour le projet **BICEC VeriPass**, conformément aux spécifications d'architecture définies dans le document `architecture-bicec-veripass.md`. L'objectif est de fournir une fondation robuste, évolutive et conforme aux standards bancaires dès le premier jour.

### Points Clés de l'Implémentation

1. **Architecture "Modular Monolith" (ADR-002)** :
   - Découpage strict de l'application en 7 modules métier (`auth`, `kyc`, `backoffice`, `admin`, `aml`, `analytics`, `notifications`) dans `app/modules/`.
   - Chaque module est structuré de manière uniforme (`router.py`, `service.py`, `schemas.py`, `models.py`), facilitant une transition future vers des microservices si nécessaire.

2. **Infrastructure de Logging & Observabilité** :
   - Logging structuré au format **JSON**, prêt pour l'ingestion par des outils de monitoring.
   - Système de **masquage des données sensibles** (codes OTP, PIN, tokens) pour garantir la confidentialité des données clients (standard bancaire).
   - Gestion de l'**ID de corrélation** (X-Correlation-ID) injecté dans chaque requête pour assurer la traçabilité de bout en bout.
   - Rotation automatique des logs (50 Mo, 5 fichiers de backup) pour prévenir la saturation du disque.

3. **Couche de Persistance Asynchrone** :
   - Intégration de **SQLAlchemy 2.0** avec le driver asynchrone `asyncpg` pour des performances optimales sous charge.
   - Configuration d'un pool de connexions optimisé (`pool_size=10`, `max_overflow=20`).
   - Initialisation d'**Alembic** pour la gestion asynchrone des migrations de base de données.

4. **Sécurité et Robustesse** :
   - Endpoint `/health` exhaustif vérifiant la connectivité à PostgreSQL et Redis (mocké en local).
   - Gestion globale des exceptions assurant des réponses JSON uniformes et évitant l'exposition de stack traces en production.
   - Politique CORS stricte restreinte aux domaines autorisés.

5. **Gestion des Dépendances Modernes** :
   - Utilisation de `pyproject.toml` et `uv` pour une gestion déterministe des paquets et des environnements virtuels.

---

## Vérification de la Qualité

### Tests Unitaires & Intégration
Le projet utilise `pytest` avec `pytest-asyncio`. Les tests actuels valident :
- Le démarrage du serveur et son cycle de vie (lifespan).
- La validité de l'endpoint de santé (`/health`).
- L'exposition correcte de la documentation OpenAPI (Swagger).

**Preuve d'exécution :**
```bash
python -m uv run pytest
# Résultat : 2 passed
```

### Conformité Architecturale
- **Isolation** : Les modules n'ont pas de dépendances croisées directes au niveau du code.
- **KISS** : La logique est maintenue simple et directe, évitant toute sur-ingénierie prématurée.

---

## Note sur le déploiement
Pour faciliter le cycle de développement itératif et limiter les besoins en bande passante lors du téléchargement d'images lourdes, le développement est actuellement configuré pour fonctionner en **local pur** (PostgreSQL local). La conteneurisation via Docker Compose est prévue pour le ticket **INFRA-05** une fois les modèles de données stabilisés.

---

## Guide de Démarrage Rapide (Backend)

### Lancement du serveur
```bash
cd code/backend
uv run uvicorn app.main:app --reload
```
Le serveur démarre sur `http://127.0.0.1:8000`

### Accès à la documentation API
- **Swagger UI** : `http://127.0.0.1:8000/docs`
- **OpenAPI JSON** : `http://127.0.0.1:8000/api/v1/openapi.json`

### Endpoints API disponibles

| Module | Endpoint | Méthode | Description |
|--------|----------|---------|-------------|
| **health** | `/health` | GET | Vérification de l'état du serveur (DB, Redis) |
| **auth** | `/api/v1/auth/` | GET | Module d'authentification |
| **kyc** | `/api/v1/kyc/` | GET | Module de vérification d'identité |
| **backoffice** | `/api/v1/backoffice/` | GET | Interface d'administration |
| **admin** | `/api/v1/admin/` | GET | Module d'administration système |
| **aml** | `/api/v1/aml/` | GET | Module Anti-Money Laundering |
| **analytics** | `/api/v1/analytics/` | GET | Module d'analytics |
| **notifications** | `/api/v1/notifications/` | GET | Module de notifications |

### Tests API réalisés (13/03/2026)

#### 1. Endpoint `/health` - Health Check
**Statut** : ✅ Succès (Code 200)

**Request** :
```bash
curl -X GET 'http://127.0.0.1:8000/health' -H 'accept: application/json'
```

**Response** :
```json
{
  "status": "ok",
  "version": "0.1.0",
  "db": "ok",
  "redis": "ok"
}
```

**Headers** :
- `x-correlation-id`: 3d7410c8-7132-466d-a5f0-6dd475362e5d
- `x-process-time`: 0.004006624221801758
- `content-type`: application/json

#### 2. Endpoint `/api/v1/kyc/` - KYC Module
**Statut** : ✅ Succès (Code 200)

**Request** :
```bash
curl -X GET 'http://127.0.0.1:8000/api/v1/kyc/' -H 'accept: application/json'
```

**Response** :
```json
{
  "module": "kyc",
  "status": "initialized"
}
```

**Headers** :
- `x-correlation-id`: b101eaf3-9652-4300-98e1-fc4781cf9942
- `x-process-time`: 0.0010516643524169922
- `content-type`: application/json

### Observations

1. **Traçabilité** : L'ID de corrélation (`x-correlation-id`) est correctement injecté dans chaque réponse, permettant le suivi des requêtes de bout en bout.

2. **Performance** : Les temps de réponse sont excellents (< 5ms pour les endpoints testés).

3. **Structure modulaire** : Chaque module (auth, kyc, backoffice, admin, aml, analytics, notifications) expose un endpoint racine fonctionnel.

4. **Documentation** : La documentation Swagger UI est accessible et permet de tester interactivement chaque endpoint.

### Prochaines étapes
- Tester les endpoints avec authentification (JWT)
- Valider les endpoints de création/mise à jour dans chaque module
- Documenter les schémas de requête/réponse détaillés
