# Architecture bicec-veripass — Patch v3-bis
**Sections :** State Machine (définitive), C4 L3, Analytics OLAP/OLTP, Format Mermaid  
**Date :** 2026-03-04

---

## §0. Convention Mermaid — Format adopté pour tous les diagrammes

Chaque diagramme suit ce patron en deux parties :

**Partie 1 — Code source (avec config ELK) :**
```
%%{init: {"layout": "elk", ...}}%%
stateDiagram-v2 / graph / erDiagram ...
```
GitHub affiche "Unable to render rich display / Unknown layout: elk" — c'est normal et attendu. Le code reste lisible et modifiable.

**Partie 2 — Image SVG exportée :**
```
![Titre](https://mermaid.ink/svg/pako:...)
```
Copier le code dans [mermaid.live](https://mermaid.live) → Export SVG → uploader sur Gist → coller le lien `mermaid.ink/svg/pako:...`.

**Labels :** utiliser `<br>` pour les sauts de ligne (plus compatible que `\n`).

---

## §5-DEF. State Machine KYC — Version Définitive

### Les deux dimensions indépendantes

**`status`** = état du workflow KYC (piloté par Jean, Thomas, le système — visible back-office)  
**`access_level`** = niveau de permission de Marie dans l'app (évolue en parallèle du workflow)

### Matrice access_level

| Status courant | `access_level` | Ce que Marie peut faire dans l'app |
|---|---|---|
| DRAFT → PENDING_KYC → PENDING_INFO | `RESTRICTED` | Vitrine lecture seule, messagerie support |
| COMPLIANCE_REVIEW (PEP en cours d'examen) | `RESTRICTED` | Idem + message "vérification complémentaire en cours" |
| VALIDATED_PENDING_AGENCY | `PENDING_ACTIVATION` | Exploration app élargie — pas encore de fonctions bancaires |
| ACTIVATED_LIMITED | `LIMITED_ACCESS` | Dépôts, retraits, virements, carte, solde |
| ACTIVATED_FULL | `FULL_ACCESS` | Tout débloqué + Auth Rail BICEC |
| MONITORED (PEP confirmé, compte actif) | `FULL_ACCESS` ou `LIMITED_ACCESS` | Selon NIU — compte actif, sous surveillance |
| DISABLED | `BLOCKED` | Accès suspendu |

### Règle Thomas : non-bloquant sur le flow principal

Thomas intervient **en parallèle**. Ses actions ont du poids quand elles surviennent (suspension, MONITORED, provisioning Axway) mais ne bloquent jamais Jean ni la venue en agence de Marie — sauf si fraude avérée confirmée.

Le **provisioning Axway/Sopra Amplitude** est entièrement parallèle et non-bloquant. Il s'exécute indépendamment de l'activation du compte côté BICEC. C'est un bonus fin de MVP — priorité 3 dans la roadmap.

```mermaid
%%{init: {"theme": "base", "layout": "elk", "themeVariables": {"primaryColor": "#E3F2FD", "primaryTextColor": "#1A237E", "primaryBorderColor": "#1976D2", "lineColor": "#1976D2", "secondaryColor": "#FFF3E0", "tertiaryColor": "#F3E5F5"}}}%%
stateDiagram-v2
    direction TB

    [*] --> DRAFT : Marie crée session<br>access_level = RESTRICTED

    DRAFT --> LOCKED_LIVENESS : 3 échecs liveness<br>consécutifs
    note right of LOCKED_LIVENESS
        Cooldown 60s avant nouvelle session.
        Check user.lockout_count_24h ≤ 3.
        Au-delà : blocage création session.
    end note
    LOCKED_LIVENESS --> DRAFT : Recommencer<br>(après cooldown, cache purgé)
    LOCKED_LIVENESS --> [*] : Aller en agence

    DRAFT --> ABANDONED : Inactif > 24h<br>(Celery beat — analytique seul)
    DRAFT --> PENDING_KYC : Soumission complète<br>access_level reste RESTRICTED

    note right of PENDING_KYC
        File d'attente Jean.
        Scoring confiance automatique.
        Détection doublons arrière-plan.
        Screening AML/PEP automatique.
    end note

    PENDING_KYC --> PENDING_INFO : Jean demande<br>info / doc supplémentaire
    PENDING_INFO --> PENDING_KYC : Marie renvoie<br>via messagerie support
    PENDING_INFO --> ABANDONED : Inactif > 7j (Celery beat)

    PENDING_KYC --> COMPLIANCE_REVIEW : Alerte AML<br>auto-détectée<br>access_level = RESTRICTED
    note right of COMPLIANCE_REVIEW
        Thomas examine PEP/Sanctions.
        Parallèle — ne bloque pas Jean.
        Faux positif → retour PENDING_KYC.
        PEP confirmé → MONITORED (actif).
        Fraude avérée → DISABLED.
    end note
    COMPLIANCE_REVIEW --> PENDING_KYC : Thomas efface<br>faux positif
    COMPLIANCE_REVIEW --> MONITORED : Thomas confirme PEP<br>compte actif + surveillé
    COMPLIANCE_REVIEW --> DISABLED : Thomas confirme<br>fraude avérée

    PENDING_KYC --> REJECTED : Jean rejette<br>(fraude évidente uniquement)
    REJECTED --> [*]

    PENDING_KYC --> VALIDATED_PENDING_AGENCY : Jean pre-approuve<br>access_level = PENDING_ACTIVATION<br>SMS + notif app envoyés

    note right of VALIDATED_PENDING_AGENCY
        Marie n'est plus RESTRICTED.
        Elle peut explorer l'app (pas encore bancaire).
        Provisioning Axway démarre en parallèle (Thomas).
        L'agent en agence active physiquement le compte.
    end note

    VALIDATED_PENDING_AGENCY --> ACTIVATED_LIMITED : Signature agence<br>SANS NIU valide<br>access_level = LIMITED_ACCESS
    VALIDATED_PENDING_AGENCY --> ACTIVATED_FULL : Signature agence<br>AVEC NIU valide<br>access_level = FULL_ACCESS
    VALIDATED_PENDING_AGENCY --> DISABLED : Thomas suspend<br>(fraude avant agence)

    note right of ACTIVATED_LIMITED
        ✅ Dépôts, retraits, virements<br>carte, consultation solde.<br>❌ Crypto, épargne, crédit.<br>Banner : "Soumettez NIU pour tout débloquer."
    end note

    ACTIVATED_LIMITED --> ACTIVATED_FULL : Marie soumet NIU<br>via messagerie support<br>Agent agence valide

    ACTIVATED_FULL --> EXPIRY_WARNING : Doc expirant<br>détecté < 30j (Celery beat)
    EXPIRY_WARNING --> PENDING_RESUBMIT : Jean notifie Marie<br>(délai 30 jours)
    PENDING_RESUBMIT --> ACTIVATED_FULL : Nouveau doc + agent réapprouve
    PENDING_RESUBMIT --> ACTIVATED_LIMITED : Délai 30j dépassé

    MONITORED --> ACTIVATED_FULL : Surveillance levée
    MONITORED --> DISABLED : Fraude confirmée après surveillance

    ACTIVATED_FULL --> DISABLED : Thomas suspend
    ACTIVATED_LIMITED --> DISABLED : Thomas suspend

    DISABLED --> [*]
```

> **Exporter en SVG :** [mermaid.live](https://mermaid.live) → coller le code → Export SVG → Gist → lien `mermaid.ink/svg/pako:...`
![state-diagram-v2](https://mermaid.ink/svg/pako:eNqNV81u20YQfpUFC8N2Izv6sSxHSAPQIhUwkWVBUpymVSGsyZW8Nrlkl0vFimGglxYo0FPRYwv00EN07xvoTfwknd2lJMqU3OgkkrPfzH7zzczuneGGHjHqxs7OHWVU1NHdwBBXJCADo44GxiWO4V8B_vl4GiZCvyX-jX6pLC8wp_jSJ7H8CMsjTgPMp43QD7m2_8quNMtNS69JP_fJrcialMxypWavmZyG3CN8zehF7dgqpwFRRrZ9i4kbMu9REM1ms2IX08AJF_Tx94pdbVYHxv39_c7OgMUCC2JRPOY4OJiUBwzBz6OcuIKGDPVPB0y_-_7rH9DBwStkdc1mH9XRGfBBkMvnM4JiEsdg_fKSv8KuCw9Dn0yIj75BXbvX7zqNvm0tcPR6idQ6b7y1rWHLubDbdq8HmBU0n7lXxI2RTyeEAZCEhE3G8D4RdBRrDBYKgjgdXwkUjh7jaBP5a4Sh74UfGTouxghPMBOwMoHA_GXIhxlrcHyDkpjwQz90b0AGQzdMmBiWj67Qw6__oErG2EwOPOLP_4agL8EajzUVWJG2jk2YpwLWT483naW0C_kMAsJcwuW-93DE559j5KbbKCAXAzsoSvh4PtvfjidTVUcmbJODdwTBAWSef_PUbFvnbdsCY4dhSPgIvUKwW-W8QWD5FF0SLNDDT38gzLA_FfTHRHKX-PuP0Tp223Lar4dvPzQArxcmAVUsQPhB5M8_C5KTBycx5DEvkfX0ZoBX_Dcp5NDbxUIQBsZvCM6msueGnLIxuGYjimHzCCciDLAKP2NnzWciFboXJpBIBjrhnM4_c3IQ-Y8wOSFMoppnrecdu7MBc5Vq_ZzlJMuR026eA0kyauSRADNPkUPZKETPIRQXxUkEpM1ADAJDMa7DqeV5znVFcsImIVV4E4pRAHSDAOQXiRlysQVrsxpq1yirhP1tO2ucn3Vajtlu2MOufeHY75UAof0QSZfKPLB14GnCoWf8T6_IyyDnYZWa_hXkIUbkFgfQLSG2zvMeZF3mNc5ksIM59kGJoBwpaLCEjEs9R7D4kYKaOLlFURhTScPDL78DrSJMeHbfWWRQg9IaD-YzZX523nb6511gc09RuZ_F5jjxQJKT-Ux1T2lvOT3ztGVbG3tGntx88hccjEbYVeSOMjt4CmYV6RIk3YpiUjfgIIJUaE08Ax3xCaHA5Owp3MWO8rAqunUOtsmqa7-xpSAWxcLJNRG6k-ylEPPZhHqqCSRMlqIsmbQ5LVenTXGblwuz5VgmGA4XX8zXdrvxYeE1gm6Ao4jL2bFBt8tFjb5zYfad87Y06p31gCtIInAGi5Esy-l8Fm9ucttCWKlGVzfbhZ6JIj-JM-WS0ZYtZ1tEEgHVEMHQhwng70r3e1LkMAfgFbqE4pBdJSvKDg8nVPZr1eFuP-IpgmKF8wnYwwyJVrWzp9OZXdzalTNGrIaN0soEIrmaxoukIFirlbSlW25Ng2pPmlw16s4cLYkeHTMsEohQe1W0m-0eajvv0AT71NuUrnQ9pKuxPC18oevmu1Zri1_zwm487Vcu_nKn-fKJkzgCyrLa12caHcT-ZmHleFtl7eHPn-UEjOb_irggGxzHVP6bgDRkwvThC0MPL8jajRNfpOcbOI-QQ_n14a_fUINPIxEWoBBBJGMmjaGkPSqUxSlmDEQoj57yTCCr95PiKZLtFHqqkDrTjZgfDozN0shnf2NidI3Eyo90sn0IqpQpzaaC1WnL-1PI0pn9bcfpfhi-N7ttSBU4s2BMQ5FRDjmQcMvZhl6iSjE3N1V1rmNkuzhU87tT2Nqi56jGAfGqLamcA76PKUCja6Au3l_vZcv1G4lpy9aFE3W0eIZ0scrjatrUvghqVXfWIpJrmTtoLLEcBRpkNU42l046O9ShDCpD9f78uoz602m5HK-gen0sjjNQT-RtayE9pawnFqXn3oVBOlqMgjHm1DPqgiekYASEB1g-GnfSfu2y6REYzT7cMQv6U-7KOWD3ABdh9l0YBgtEyNP4yqiPsB_DUxJ5q2vb0gTikxdJuLMY9dJR9ViBGPU749aoH5TL1cNisVopHZVqL05qlXKtYEzh_VHtsFwslUqV6kmlVCkeVe8LxifluHR4fFQulUvH1eOTSrFWLZ4UDAJ1HfIzfZtWl-r7_wBkGOrL)
---

## §3-L3. C4 Level 3 — Composants FastAPI (dagre + directives)

> C4 Mermaid ne supporte pas ELK actuellement — dagre avec directives de padding.

```mermaid
%%{init: {"theme": "base", "layout": "elk", "themeVariables": {"primaryColor": "#E3F2FD", "primaryTextColor": "#1A237E", "primaryBorderColor": "#1976D2", "lineColor": "#1976D2", "secondaryColor": "#FFF3E0", "tertiaryColor": "#F3E5F5"}, "flowchart": {"diagramPadding": 25, "nodeSpacing": 50, "rankSpacing": 65, "curve": "basis"}}}%%

graph LR
    subgraph MODULES["Modules FastAPI — Routes"]
        direction TB
        AUTH["<b>auth</b><br>OTP · PIN · JWT<br>Login back-office"]
        KYC["<b>kyc</b><br>Capture · OCR confirm<br>Liveness · State Machine<br>Submit · Session résume"]
        BO["<b>backoffice</b><br>Jean : queue/inspect<br>approve/reject/info<br>OCR override"]
        AML["<b>aml</b><br>Screening PEP<br>Conflits · Agences<br>Batch Axway"]
        ANALYTICS["<b>analytics</b><br>Funnel · SLA<br>Health · Events<br>Escalade · Redistribute"]
        NOTIF["<b>notifications</b><br>Polling cursor-based<br>SMS dispatch · Email"]
        SUPPORT["<b>support</b><br>Threads · Messages<br>Pièces jointes<br>Routing agent"]
    end

    subgraph SERVICES["Services Partagés"]
        direction TB
        OCR["<b>OCR Service</b><br>PaddleOCR primaire<br>GLM-OCR fallback Celery<br>Fusion résultats partielle"]
        BIO["<b>Biometrics</b><br>MiniFASNet liveness<br>DeepFace face match<br>Validation landmarks 478pt"]
        AUDIT["<b>Audit Service</b><br>SHA-256 intégrité<br>Append-only log partitionné<br>Export COBAC PDF/JSON"]
        CORE["<b>Core</b><br>DB Pool OLTP/DWH<br>JWT · bcrypt · Argon2<br>AES-256 encrypt/decrypt"]
    end

    AUTH --> CORE
    KYC --> OCR
    KYC --> BIO
    KYC --> AUDIT
    KYC --> CORE
    BO --> AUDIT
    BO --> CORE
    AML --> AUDIT
    AML --> CORE
    ANALYTICS --> CORE
    NOTIF --> CORE
    SUPPORT --> AUDIT
    SUPPORT --> CORE
```

---

## §13-OLAP. OLTP vs OLAP — Explication simple

### En une phrase chacun

**OLTP** (Online Transaction Processing) = la base de données opérationnelle, temps réel.  
Optimisée pour les **écritures rapides et lectures unitaires** ("donne-moi le dossier de Marie", "Jean approuve cette session"). Chaque opération touche **1 ou quelques lignes** — doit être rapide (<100ms).

**OLAP** (Online Analytical Processing) = l'entrepôt d'analyse (Data Warehouse).  
Optimisée pour les **requêtes d'agrégation sur de grands volumes** ("combien de dossiers ont été abandonnés à l'étape CNI par région en mars ?"). Chaque requête parcourt **des milliers de lignes** pour produire un chiffre ou un graphe.

> Dans bicec-veripass MVP : PostgreSQL sert les deux, isolés par schéma (`public` = OLTP, `dwh` = OLAP, `audit` = audit log). En Phase 2, on peut migrer l'OLAP vers DuckDB (in-process, ultra-rapide pour l'analytique locale, 0 infra supplémentaire).

---

## §13-ANALYTICS. Périmètre complet — Dashboard Sylvie

### A. Analytics Opérationnels VeriPass

| Métrique | Source données | Visuel Sylvie |
|---|---|---|
| Funnel drop-off étape A→G | `fact_analytics_events GROUP BY step` | Graphe entonnoir % conversion |
| Durée par étape p50/p90 | `fact_analytics_events.duration_ms` | Heatmap friction |
| Taux retry/corrections OCR | `ocr_fields.human_corrected` | Courbe confiance vs correction humaine |
| Taux succès liveness 1er essai | `biometric_results.liveness_score` | KPI card |
| SLA Jean (% dossiers < 2h) | `fact_validation_actions.sla_met` | Gauge R/Y/G |
| Charge agents (queue depth) | `agents.active_dossier_count` | Bar chart load balancing |
| Temps onboarding total p90 | `fact_kyc_sessions.total_duration_s` | Histogramme vs cible < 15min |
| Taux abandon par étape | `fact_kyc_sessions.dropout_step` | Sankey / Funnel |
| Alertes AML par semaine | `aml_alerts` | Timeline |
| Uptime / latence API p95 | Health endpoint + logs Nginx | Sparkline vert/rouge |

### B. Qualité Données & OCR Observability (focus jury PFE)

| Métrique | Source | Intérêt jury |
|---|---|---|
| Distribution confidence PaddleOCR vs GLM | `documents.confidence_per_field` | ★ Comparaison moteurs OCR |
| CER estimé (OCR vs correction Jean) | `ocr_fields` delta | ★ Précision sur CNI camerounaises |
| Laplacian Variance images capturées | `documents.capture_quality_metrics` | Impact guidance UX sur qualité |
| Luminance histogram (surexposition/sous-ex) | `documents.capture_quality_metrics` | Conditions capture Cameroun |
| Champs OCR les plus corrigés | `ocr_fields.field_name WHERE human_corrected` | ★ Identifier faiblesses extraction |

### C. Analytics Dataset / Cadrage Documentaire

> Sources : Document cadrage dataset (§L95–L115), document cadrage projet (§L1261–L1327)

| Métrique | Description |
|---|---|
| Volume CNI collectées (pilote) | Nb paires CNI recto/verso exploitables en entraînement futur |
| Distribution qualité images | % nettes / floues / surexposées avant/après guidance UX |
| Répartition types factures | ENEO vs CAMWATER vs autre — impact extraction GLM-OCR |
| Couverture géographique | Région → Ville → Agence — biais géographique dataset |
| Taux complétude NIU | % UPLOADED vs DECLARATIF vs ABSENT |
| Distribution langues | Français vs Anglais — usage effectif |
| Volumétrie stockage | Go/utilisateur moyen → projection capacité 10 ans COBAC |
| Diversité tonalités peau | Distribution pour valider équité MiniFASNet sur corpus local |

### D. KPIs Stratégiques Direction

| Indicateur | Cible | Seuil alerte |
|---|---|---|
| Onboardings complétés / jour | ↗ tendance | 🔴 si régression 2 jours consécutifs |
| MTTA (Mean Time To Activation) | < 24h | 🔴 > 48h |
| CAC vs agence physique | × 3 moins cher | Comparatif mensuel |
| Dossiers SLA > 2h | 0 | 🔴 dès 1 |
| Queue depth Jean | < 10 | 🟡 > 5, 🔴 > 10 |
| Taux conformité dossiers (COBAC-ready) | > 95% | Export audit |

---

*Patch v3-bis — 2026-03-04*
*State Machine définitive · C4 L3 épuré · OLAP/OLTP expliqué · Analytics complet · `<br>` + %%init%% appliqués*
