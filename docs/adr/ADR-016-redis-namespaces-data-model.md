# ADR-016 — Redis : Namespaces et Modèle de Données

**Statut :** DÉCIDÉ  
**Date :** 2026-03-20  
**Issues :** AUTH-02, AUTH-03, AUTH-06, AUTH-07, ADMIN-01, ANALYTICS-12  
**Référence :** ADR-010 (Celery + Redis), architecture §3 C4 L2, backlog complet

---

## Contexte

Redis est déjà en production dans la stack VeriPass (ADR-010) avec deux rôles distincts :

1. **Broker Celery + backend de résultats** — les workers `glm_ocr_jobs`, `notifications`, `provisioning_batch`, `sanctions_sync` consomment leurs tâches via Redis.
2. **Store volatil applicatif** — l'API lit et écrit Redis directement pour les OTP, les refresh tokens, le rate limiting et les caches courts.

Aucun document ne formalisait jusqu'ici les patterns de clés, les TTL et les invariants de design. Cette absence crée un risque de collision de namespaces, de TTL incohérents et de dépendance implicite à Redis pour des données qui doivent rester dans PostgreSQL.

Les issues AUTH-06 et AUTH-07 demandent explicitement de définir les namespaces `otp:`, `refresh:`, `session:`, `agent_active:`, `rate_limit:` et de configurer les TTL dans `core/config.py`.

---

## Décision

### 1. Rôles de Redis dans VeriPass

| Rôle | Description | Géré par |
|------|-------------|----------|
| **Broker Celery** | Files de tâches (`glm_ocr_jobs`, `notifications`, `provisioning_batch`, `sanctions_sync`) | Celery / `celery_config.py` |
| **Backend de résultats Celery** | Résultats des tâches async (TTL géré par Celery) | Celery / `celery_config.py` |
| **OTP store** | Hash OTP Marie, TTL 5 min, anti-replay | `modules/auth/` |
| **Refresh tokens JWT** | Invalidation ciblée par `user_id + jti`, TTL 7 jours | `core/security.py` |
| **Rate limiting** | Compteurs par IP/téléphone pour OTP, auth, API globale | `core/rate_limit.py` |
| **Locks applicatifs** | Mutex distribué pour OCR/GLM (concurrence=1 sur i3) | `tasks/` Celery workers |
| **Cache analytics** | Snapshot KPIs dashboard, TTL 60s | `modules/analytics/` |

Redis ne contient **aucune donnée réglementaire** (audit_logs, KYC, PEP/Sanctions, DWH, notifications persistantes). La source de vérité est toujours **PostgreSQL**.

---

### 2. Tableau des Namespaces

| Pattern de clé | Type Redis | TTL par défaut | Rôle fonctionnel | Source of truth |
|----------------|-----------|----------------|-----------------|-----------------|
| `otp:{phone}` | String | **600 s** (10 min) | Hash bcrypt de l'OTP 6 chiffres envoyé à Marie. Supprimé immédiatement après vérification réussie (anti-replay). | — (éphémère) |
| `otp_verify_attempts:{phone}` | String (counter INCR) | **600 s** | Compteur de tentatives de vérification OTP par numéro. Bloqué à 3 tentatives. Supprimé après succès. | — (éphémère) |
| `ratelimit:otp:{ip}` | String (counter INCR) | **600 s** | Compteur envois OTP par IP. Max 3/10 min (ADMIN-01 + AUTH-03). | — (éphémère) |
| `ratelimit:auth:{ip}` | String (counter INCR) | **60 s** | Compteur requêtes auth endpoints par IP. Max 10/min (ADR-015, Nginx + applicatif). | — (éphémère) |
| `ratelimit:global:{ip}` | String (counter INCR) | **60 s** | Compteur requêtes API générales par IP. Max 100/min. | — (éphémère) |
| `refresh:{user_id}:{jti}` | String (valeur vide) | **604 800 s** (7 jours) | Présence = refresh token valide. Supprimé à `POST /auth/logout` ou révocation AML. Permet invalidation ciblée sans blacklist globale. | — (éphémère) |
| `lock:ocr:{session_id}` | String (SET NX) | **120 s** (TTL sécurité) | Mutex distribué : interdit l'exécution simultanée PaddleOCR + GLM-OCR sur i3 (ADR-003). Libéré par le worker à la fin de la tâche. | — (éphémère) |
| `lock:glm` | String (SET NX) | **300 s** (TTL sécurité) | Mutex global GLM-OCR (concurrence=1). Un seul job GLM à la fois sur le worker dédié. | — (éphémère) |
| `lock:agent:{agent_id}` | String (SET NX) | **30 s** (TTL sécurité) | Mutex pour l'algorithme WRR/Least-Connections lors de l'assignation d'un dossier à un agent. Évite les double-assignations concurrentes. | — (éphémère) |
| `analytics:dashboard:today` | String (JSON sérialisé) | **60 s** | Snapshot des KPIs dashboard Sylvie (ANALYTICS-12) : `total_sessions_today`, `completion_rate`, `avg_processing_time_min`, `liveness_failure_rate`, `aml_alert_rate`, `ocr_fer_paddle`, `ocr_fer_glm`. Recalculé depuis PostgreSQL à expiration. | PostgreSQL (`analytics_events`, `kyc_sessions`) |

> **Namespaces réservés Celery** (gérés automatiquement, ne pas écrire manuellement) :
> `celery`, `celery-task-meta-*`, `_kombu.*` — ces clés sont créées et gérées par Celery/Kombu.

---

### 3. Règles de Design

**R1 — Redis n'est jamais source of truth.**  
Toute donnée métier, réglementaire ou d'audit (tables `audit_logs`, `kyc_sessions`, `users`, `aml_alerts`, `notifications`, DWH star schema) réside exclusivement dans PostgreSQL. Redis ne contient que des données dérivées, éphémères ou des caches recalculables.

**R2 — Namespace explicite obligatoire.**  
Toute clé Redis doit commencer par un préfixe de namespace suivi de `:`. Les préfixes autorisés sont : `otp:`, `refresh:`, `ratelimit:`, `lock:`, `analytics:`. Toute clé sans namespace est une anomalie à corriger.

**R3 — TTL obligatoire sur toutes les clés applicatives.**  
Aucune clé applicative ne doit être créée sans TTL (`EXPIRE` ou `SET ... EX`). Les clés sans TTL sont réservées aux structures internes Celery. Un TTL de sécurité doit être positionné sur tous les locks (même si le worker libère le lock avant expiration) pour éviter les deadlocks en cas de crash.

**R4 — Fail-soft en cas de défaillance Redis.**  
Conformément à l'ADR-010, une indisponibilité Redis ne doit pas bloquer les opérations critiques PostgreSQL. Les services doivent gérer `redis.exceptions.ConnectionError` et `redis.exceptions.TimeoutError` avec un fallback gracieux (ex : rate limiting désactivé temporairement, cache analytics recalculé depuis PG). Le health check `/health` expose `{"redis": "error"}` sans lever une exception 500 sur les endpoints métier.

**R5 — Anti-replay OTP.**  
La clé `otp:{phone}` doit être supprimée (`DEL`) immédiatement après une vérification réussie, avant de retourner le JWT. De même, `otp_verify_attempts:{phone}` est supprimé après succès. Cela garantit qu'un OTP ne peut être utilisé qu'une seule fois même si le réseau rejoue la requête.

**R6 — Révocation refresh tokens.**  
À `POST /auth/logout`, à la suspension d'un compte (Thomas — AML), ou à la réinitialisation de PIN, toutes les clés `refresh:{user_id}:*` de l'utilisateur concerné doivent être supprimées (pattern `SCAN` + `DEL` ou `UNLINK`). Ne pas utiliser `KEYS *` en production.

---

### 4. Impacts sur le Code

#### 4.1 `core/config.py` — TTL manquants

Les constantes TTL ne sont pas encore définies. À ajouter dans `Settings` :

```python
# Redis TTL (secondes)
REDIS_OTP_TTL: int = 600           # 10 min — AUTH-03
REDIS_OTP_ATTEMPTS_TTL: int = 600  # 10 min — AUTH-03
REDIS_REFRESH_TOKEN_TTL: int = 604800  # 7 jours — AUTH-02
REDIS_RATELIMIT_OTP_TTL: int = 600     # 10 min — ADMIN-01
REDIS_RATELIMIT_AUTH_TTL: int = 60     # 1 min — ADMIN-01
REDIS_RATELIMIT_GLOBAL_TTL: int = 60   # 1 min — ADMIN-01
REDIS_LOCK_OCR_TTL: int = 120          # sécurité — ADR-003
REDIS_LOCK_GLM_TTL: int = 300          # sécurité — ADR-003
REDIS_LOCK_AGENT_TTL: int = 30         # sécurité — §12.3
REDIS_ANALYTICS_CACHE_TTL: int = 60    # ANALYTICS-12
```

> Note : `OTP_EXPIRY_MINUTES = 10` dans `config.py` actuel est cohérent avec ce TTL de 10 min.

#### 4.2 `core/redis.py` — Helpers namespaces

Le fichier actuel expose uniquement `get_redis()`. À terme, ajouter des helpers pour centraliser la construction des clés et éviter les typos :

```python
# Exemples de helpers à ajouter
def otp_key(phone: str) -> str:
    return f"otp:{phone}"

def otp_attempts_key(phone: str) -> str:
    return f"otp_verify_attempts:{phone}"

def refresh_key(user_id: str, jti: str) -> str:
    return f"refresh:{user_id}:{jti}"

def ratelimit_key(scope: str, identifier: str) -> str:
    return f"ratelimit:{scope}:{identifier}"

def lock_key(resource: str, resource_id: str = "") -> str:
    return f"lock:{resource}:{resource_id}".rstrip(":")

def analytics_key(report: str) -> str:
    return f"analytics:{report}"
```

#### 4.3 `core/security.py` — Refresh tokens non persistés dans Redis

La fonction `create_refresh_token()` génère un JWT mais **ne stocke pas** la clé `refresh:{user_id}:{jti}` dans Redis. L'invalidation ciblée (logout, révocation AML) est donc impossible sans cette persistance. À implémenter dans AUTH-02.

#### 4.4 `core/rate_limit.py` — SlowAPI sans namespaces Redis explicites

SlowAPI gère ses propres clés Redis via `slowapi`. Vérifier que le préfixe de clé SlowAPI est configuré pour rester dans le namespace `ratelimit:` (option `key_prefix` du `Limiter`). Si SlowAPI utilise un préfixe différent, documenter l'exception.

#### 4.5 `modules/auth/` — Service OTP

Vérifier que l'implémentation future respecte :
- `SET otp:{phone} {hash} EX 300` (pas `SETEX` déprécié)
- `DEL otp:{phone}` + `DEL otp_verify_attempts:{phone}` atomiquement après succès (pipeline Redis ou Lua script)

---

## Justification

- Les namespaces explicites évitent les collisions entre les clés applicatives et les clés internes Celery/Kombu.
- Les TTL alignés sur le backlog (AUTH-02, AUTH-03, ADMIN-01, ANALYTICS-12) garantissent la cohérence sécurité/performance sans sur-spécification.
- La règle fail-soft est cohérente avec l'ADR-010 et la contrainte hardware i3/16GB : Redis est un accélérateur, pas un SPOF.
- Centraliser les TTL dans `config.py` permet de les ajuster par environnement (dev/staging/prod) sans modifier le code métier.

---

## Conséquences

- **AUTH-06** peut être implémenté en s'appuyant directement sur ce document comme spécification.
- **AUTH-02** doit implémenter la persistance `refresh:{user_id}:{jti}` dans Redis pour que le logout et la révocation AML fonctionnent.
- `OTP_EXPIRY_MINUTES = 10` dans `config.py` doit être corrigé à `5` (ou les constantes `REDIS_OTP_TTL` doivent prendre le dessus).
- Les tests unitaires doivent utiliser `fakeredis` (déjà mentionné dans le backlog) pour mocker Redis sans dépendance réseau.
- Aucune donnée de ce modèle ne doit être migrée vers PostgreSQL — Redis reste exclusivement un store éphémère.

---

## TODO Techniques (Backlog)

| Priorité | Fichier | Action |
|----------|---------|--------|
| 🔴 Critique | `core/config.py` | Ajouter les 10 constantes `REDIS_*_TTL` (`OTP_EXPIRY_MINUTES = 10` est déjà correct) |
| 🔴 Critique | `core/security.py` | Persister `refresh:{user_id}:{jti}` dans Redis à la création du refresh token (AUTH-02) |
| 🟠 Haute | `core/redis.py` | Ajouter les helpers de construction de clés (section 4.2) |
| 🟠 Haute | `modules/auth/` | Implémenter OTP store avec `SET ... EX` + pipeline DEL anti-replay (AUTH-03) |
| 🟡 Moyenne | `core/rate_limit.py` | Vérifier/configurer le `key_prefix` SlowAPI pour rester dans `ratelimit:` |
| 🟡 Moyenne | `modules/analytics/` | Implémenter cache `analytics:dashboard:today` avec TTL 60s (ANALYTICS-12) |
| 🟡 Moyenne | `tasks/` | Implémenter `lock:ocr:{session_id}` et `lock:glm` avec `SET NX EX` avant exécution OCR |
