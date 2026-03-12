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
