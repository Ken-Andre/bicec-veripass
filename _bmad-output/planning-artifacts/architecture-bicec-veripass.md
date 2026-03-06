# Architecture Document — bicec-veripass

**Auteur :** Ken-André  
**Date :** 2026-02-28  
**Version :** 1.0  
**Statut :**  Approuvé pour implémentation  
**Documents sources :** PRD v1, UX Spec v2.1, Product Brief, Research Reports (KYC + Technical + Architectural Foundations)

---

## Table des matières

0. [Introduction](#0-introduction)
0bis. [Guide de Lecture des Diagrammes](#0bis-guide-de-lecture-des-diagrammes)
0ter. [Matrice de Fusion](#0ter-matrice-de-fusion)
1. [Contexte & Contraintes](#1-contexte--contraintes)
2. [Architecture Decisions Records (ADRs)](#2-architecture-decision-records-adrs)
3. [Vue C4 — Architecture Système](#3-vue-c4--architecture-système)
4. [Diagramme Use Case](#4-diagramme-use-case)
5. [State Machine KYC](#5-state-machine-kyc)
6. [Diagrammes de Séquence](#6-diagrammes-de-séquence)
7. [Modèle de Données (ERD)](#7-modèle-de-données-erd)
8. [API Contract (FastAPI)](#8-api-contract-fastapi)
9. [Infrastructure Docker Compose](#9-infrastructure-docker-compose)
10. [Budget RAM & Profil Hardware](#10-budget-ram--profil-hardware)
11. [Sécurité Architecture](#11-sécurité-architecture)
12. [Pipeline AI/ML](#12-pipeline-aiml)
13. [Stratégie Analytics & Data Warehouse](#13-stratégie-analytics--data-warehouse)
14. [Stratégie de Chiffrement (Phased)](#14-stratégie-de-chiffrement-phased)
18. [Stratégie de Test](#18-stratégie-de-test)
19. [FAQ Technique — Réponses Jury](#19-faq-technique--réponses-jury)

---

## 0. Introduction

### 0.1 Objectif du Document

Ce document d'architecture technique définit l'implémentation complète du système **bicec-veripass**, une plateforme d'onboarding KYC digital souveraine pour la Banque Internationale du Cameroun pour l'Épargne et le Crédit (BICEC).

**Public cible :**
- Équipe de développement (implémentation)
- Jury académique PFE Data/IA Engineering
- Direction IT BICEC (validation technique)
- Auditeurs COBAC (conformité réglementaire)


### 0.2 Livrables Primaires (PFE)

En tant que projet de fin d'études en Data/IA Engineering, les composants évalués prioritairement sont :

1. **Funnel Analytics** : Observabilité drop-off par étape (§13.1-13.2)
2. **OCR Observability** : Métriques confidence, correction rate, engine performance (§12.1)
3. **Agent Load Balancing** : Algorithme Smooth WRR + Least Connections (§12.3)
4. **AML Screening** : Fuzzy matching pg_trgm sur listes PEP/Sanctions (§12.5)
5. **Data Warehouse** : Star schema OLAP avec refresh incrémental (§7.4)

### 0.3 Conventions de Notation

- **[ADR-XXX]** : Architecture Decision Record (décision justifiée)
- **[FRXX]** : Functional Requirement (PRD)
- **[NFRXX]** : Non-Functional Requirement (PRD)
- **[GXX]** : Correction issue (architecture-patch-v3bis-final)
- **[EXX]** : Erreur UX (Fonctionnalité_Interaction_Erreurs.csv)
- **[BX]** : Scénario métier (UX Spec v2.1)


---

## 0bis. Guide de Lecture des Diagrammes

### Comment lire un diagramme C4

Le modèle C4 décrit un système à 4 niveaux de zoom croissants, comme une carte géographique :

| Niveau                 | Analogie           | Ce qu'on voit                                                                         |
| ---------------------- | ------------------ | ------------------------------------------------------------------------------------- |
| **C4 L1 – Contexte**   | Vue satellite      | Le système entier + les acteurs humains + systèmes externes qui l'entourent           |
| **C4 L2 – Conteneurs** | Vue du quartier    | Les grandes "boîtes" déployées (serveurs, apps, bases de données) et leurs connexions |
| **C4 L3 – Composants** | Plan d'un bâtiment | À l'intérieur d'une boîte, les modules logiciels et leurs interactions internes       |
| **C4 L4 – Code**       | Plan d'une pièce   | Classes, fonctions (non produit ici — niveau implémentation)                          |

**Symboles utilisés :**
- **Personne** (icône humain) = acteur externe (Marie, Jean…)
- **Boîte pleine** = composant interne au système
- **Boîte en pointillés** = système externe (Orange SMS, Axway…)
- **Flèche →** = direction du flux de données ou appel
- **Label sur flèche** = protocole ou rôle du lien (ex : `HTTPS/443`, `SQL/5432`)

### Comment lire un diagramme de Séquence

Se lit **de haut en bas**, comme une conversation dans le temps :

```
Acteur A          Acteur B          Système C
   |                 |                  |
   |----requête------>|                 |     ← A appelle B
   |                 |----traitement--->|     ← B appelle C
   |                 |<---réponse-------|     ← C répond à B
   |<----résultat----|                  |     ← B répond à A
```

- Les **barres verticales** = lignes de vie des acteurs
- Les **rectangles sur une ligne de vie** = période d'activité (traitement en cours)
- `alt / else` = bloc conditionnel (si/sinon)
- `Note over X` = commentaire sur un acteur
- `loop` = répétition
- Flèche **pleine** `—>` = appel synchrone (attend réponse)
- Flèche **pointillée** `-->` = réponse ou appel asynchrone

### Comment lire un State Machine (Diagramme d'états)

- **`[*]`** = point de départ ou de fin
- **Rectangle arrondi** = un état stable du système
- **Flèche entre états** = transition (déclenchée par un événement)
- **Label sur flèche** = condition ou action qui déclenche la transition
- **`note`** = clarification sur un état

### Comment lire un ERD (Entity-Relationship Diagram)

Mermaid utilise la notation **Crow's Notation** pour représenter les cardinalités.

| Notation     | Signification                                                          |
| ------------ | ---------------------------------------------------------------------- |
| `\|\|--o{`   | Un (obligatoire) → Zéro ou plusieurs (optionnel) = **1:N optionnel**   |
| `\|\|--\|{`  | Un (obligatoire) → Un ou plusieurs (obligatoire) = **1:N obligatoire** |
| `\|\|--\|\|` | Un (obligatoire) → Un (obligatoire) = **1:1 strict**                   |
| `o\|--\|\|`  | Zéro ou un (optionnel) → Un (obligatoire) = **0,1:1**                  |
| `o{--\|\|`   | Zéro ou plusieurs (optionnel) → Un (obligatoire) = **N:1 optionnel**   |
| `}\|--\|{`   | Un ou plusieurs ↔ Un ou plusieurs = **N:M obligatoire**                |
| `}o--o{`     | Zéro ou plusieurs ↔ Zéro ou plusieurs = **N:M optionnel**              |
| `PK`         | Clé primaire — identifiant unique de la table                          |
| `FK`         | Clé étrangère — référence vers une autre table                         |
| `UK`         | Unique Key — valeur unique (mais pas la PK)                            |

#### Mémo visuel des symboles côté entité

| Symbole (côté) | Lecture           |
| -------------- | ----------------- |
| `\|`           | Exactement **1**  |
| `o`            | **0** (optionnel) |
| `{`            | **Plusieurs (N)** |
| `o{`           | **0 ou N**        |
| `\|{`          | **1 ou N**        |
| `o\|`          | **0 ou 1**        |

Exemple de lecture : `users ||--o{ kyc_sessions` = **un user peut avoir plusieurs sessions KYC** (mais une session appartient à un seul user).

---

## 0ter. Matrice de Fusion

> Pour tout implémenteur ou relecteur : le document consolidé intègre dans cet ordre :
> `v1.0 (base) → corrections-v2 → patch-v3 → patch-v3bis → patch-v3bis-final`

| Section            | Document actif                      | Statut v1.0                       |
| ------------------ | ----------------------------------- | --------------------------------- |
| §1 Contexte        | v1.0                                | ✅ Conservé                        |
| §2 ADRs            | v1.0 + compléments Y                | ✅ Enrichi                         |
| §3 C4 L1           | v1.0                                | ✅ Conservé                        |
| §3 C4 L2/L3        | corrections-v2 + v3bis §3bis        | ❌ v1 obsolète                     |
| §4 Use Case        | corrections-v2 + Y                  | ❌ v1 obsolète                     |
| §5 State Machine   | state-machine-kyc-v3-updated.md     | ❌ v1 + v2 obsolètes               |
| §6 Séquences       | corrections-v2 + patch-v3 + Y       | ❌ v1 partiellement obsolète       |
| §7 ERD/LDM         | patch-v3bis §7bis                   | ❌ v1 + v3 partiellement obsolètes |
| §8 API Contract    | patch-v3 + v3bis §8bis              | ❌ v1 partiellement obsolète       |
| §9 Docker Compose  | patch-v3                            | ❌ v1 partiellement obsolète       |
| §10 RAM Budget     | patch-v3bis §10bis                  | ❌ v1 + v3 obsolètes               |
| §11 Sécurité       | v1.0 + Y (matrice RBAC, audit DDL)  | ✅ Enrichi                         |
| §12 Pipeline AI/ML | v1.0 + Y (flowcharts)               | ✅ Enrichi                         |
| §13 Analytics      | v1.0 + Y (star schema, events, SQL) | ❌ §13.3 supprimé                  |
| §14 Chiffrement    | v1.0 + patch-v3bis AR5              | ❌ Phase 1 corrigée                |
| §18 Test Strategy  | patch-v4                            | ➕ Nouveau                         |
| §19 FAQ Technique  | patch-v4                            | ➕ Nouveau (réponses jury)         |

---

## 1. Contexte & Contraintes

### 1.1 Résumé du Projet

**bicec-veripass** est une plateforme d'onboarding KYC digital souveraine pour BICEC (Cameroun), transformant un processus manuel de 14 jours en un parcours numérique de 15 minutes. Le système intègre de l'IA locale (OCR + biométrie), un back-office multi-rôles (Jean/Thomas/Sylvie), et une PWA mobile pour le client (Marie).

C'est un **Projet de Fin d'Études** (PFE) en Data/IA Engineering, présenté à un jury. Les composants Data/BI (funnel analytics, OCR observability, agent load-balancing) sont les **livrables primaires** évalués.

### 1.2 Contraintes Non-Négociables

| Contrainte          | Détail                                                                     |
| ------------------- | -------------------------------------------------------------------------- |
| **Hardware**        | Intel Core i3 @ 2.5GHz, 16GB RAM, 200GB Disk (nœud principal)              |
| **Docker WSL2**     | RAM cap **8GB** via `.wslconfig`                                           |
| **Souveraineté**    | 100% On-Premise, zéro cloud SaaS pour données KYC (Loi 2024-017)           |
| **Open Source**     | 0 FCFA en licences SaaS — stack 100% open-source                           |
| **Timeline**        | 2 mois pour MVP fonctionnel (Mars : 21j, Avril : 22j, Mai début)           |
| **Réglementaire**   | COBAC R-2019/01, COBAC R-2023/01, Law 2024-017 (effectif juin 2026)        |
| **Stockage images** | 10 ans conservation COBAC — filesystem volume Docker, pas PostgreSQL BYTEA |

### 1.3 Machine de Développement

| Machine                          | Specs                                         | Rôle                                                     |
| -------------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| **Machine principale (i3)**      | Intel Core i3 @ 2.5GHz, 16GB RAM              | Docker stack complet, dev quotidien                      |
| **Machine secondaire (Ryzen 7)** | AMD Ryzen 7, iGPU Radeon 780M (VRAM partagée) | GLM-OCR worker accéléré (Vulkan/ROCm via Ollama) en nuit |

---

## 2. Architecture Decision Records (ADRs)

### ADR-001 : PWA React/TypeScript vs Flutter (Frontend Mobile Marie)

**Statut :**  DÉCIDÉ  
**Date :** 2026-02-28

**Contexte :**  
Le PRD initial indiquait Flutter comme stack mobile. Contraintes réelles : développeur sur Windows, iPhone personnel, pas de Mac pour build iOS, 2 mois de timeline.

**Options évaluées :**

| Critère                 | PWA React/TS            | Flutter                |
| ----------------------- | ----------------------- | ---------------------- |
| Build iOS sans Mac      | Safari 15+ / WebRTC     | Requiert macOS         |
| Test sur iPhone perso   | URL localhost           | AVD virtuel uniquement |
| RAM Docker + dev        | Pas d'AVD               | AVD = +2-4GB RAM       |
| Stack cohérente         | Même TS que back-office | Dart = 4ème langage    |
| Tests E2E               | Playwright natif        | Adaptation nécessaire  |
| Time-to-market          | Hot reload immédiat     | Lent sur Windows       |
| Caméra (KYC)            | `getUserMedia` + WebRTC | Camera plugin Flutter  |
| Crédibilité banque prod | Perçue inférieure       | App native préférée    |
| Post-MVP BICEC          | API contract inchangé   | N/A                    |

**Décision :** **PWA React/TypeScript**

**Justification :**
- L'API Contract FastAPI reste 100% identique — BICEC peut wraper en React Native ou Flutter post-internship sans modifier le backend.
- `getUserMedia` + WebRTC est supporté sur iOS 15+ Safari, Android 8+ Chrome — la cible exacte du projet.
- Une PWA installable (Add to Home Screen) est indiscernable d'une app native pour l'utilisateur final.
- Des institutions financières comme Nubank (Brésil, $40B valorisation) et plusieurs néobanques africaines utilisent des PWA pour leurs flows d'onboarding.
- **Référence :** LeanCode (2024), WEZOM (2025), Vofox Solutions (2026) — comparatifs Flutter vs PWA confirment 50-70% de réduction du time-to-market pour les PWA sur des timelines MVP contraintes.

**Conséquences :**
- MediaPipe WASM remplace MediaPipe Flutter pour le pre-check liveness côté client
- Service Workers pour offline/résumption de session (scénario "ENEO Blackout")
- Playwright pour les tests E2E (cohérent avec la stack TS)

---

### ADR-002 : Architecture Monolithe Modulaire (Modular Monolith)

**Statut :**  DÉCIDÉ  
**Date :** 2026-02-28

**Contexte :**  
Choix entre Monolithe, Microservices, ou Serverless pour le backend FastAPI.

**Options évaluées :**

| Critère           | Monolithe Modulaire          | Microservices              | Serverless             |
| ----------------- | ---------------------------- | -------------------------- | ---------------------- |
| Setup initial     | Faible                       | 30% du temps en infra      | Non applicable on-prem |
| Debug             | Un process, logs centralisés | Distributed tracing requis | N/A                    |
| Déploiement       | Un docker-compose            | Orchestrateur (K8s)        | N/A                    |
| Tests             | Integration simple           | Inter-service complexe     | N/A                    |
| RAM i3 (16GB)     | Optimisé                     | Overhead par service       | N/A                    |
| Évolution Phase 2 | Modules extractibles         | Déjà prêt                  | N/A                    |

**Décision :** **Monolithe Modulaire déployé en Docker multi-containers**

**Justification :**
- Un monolithe modulaire = codebase unique avec des **modules internes à responsabilité unique** (`auth/`, `kyc/`, `backoffice/`, `aml/`, `analytics/`) — facilement découpable en microservices Phase 2.
- Sur i3/16GB, les microservices introduiraient ~500MB RAM d'overhead par service (service mesh, health checks, etc.) sans bénéfice pour un pilote 20-50 utilisateurs.
- **Référence :** AWS (2024) — "Monolithic architecture is often the right choice for early-stage products." SparxIT MVP Architecture Guide (2024).
- Docker multi-containers (un container par responsabilité fonctionnelle) donne l'isolation réseau et la fault-tolerance sans la complexité d'un vrai microservice mesh.

**Structure des modules FastAPI :**
```
app/
 modules/
    auth/          # OTP, PIN, sessions
    kyc/           # Capture, OCR, biométrie, state machine
    backoffice/    # Jean, Thomas, Sylvie
    aml/           # Screening PEP/Sanctions, déduplication
    analytics/     # Funnel, SLA, events
    admin/         # Agences, agents
    notifications/ # Polling, SMS, Email
 core/              # Config, DB, security, logging
 main.py
```

---

### ADR-003 : Stratégie OCR Hybride (PaddleOCR Primaire + GLM-OCR Fallback)

**Statut :**  DÉCIDÉ  
**Date :** 2026-02-28

**Décision :**
- **PaddleOCR PP-OCRv5** : moteur primaire pour CNI (structured fields). CPU-only, <1s/image, ~2M params, Apache 2.0.
- **GLM-OCR 0.9B** : fallback si confidence PaddleOCR <85%, et extraction sémantique de factures ENEO/CAMWATER. Version quantifiée, worker Celery dédié, séquentiel (10-30s/page acceptable en back-office async).

**Pipeline :**
```
Image → PaddleOCR → confidence ≥85% → Résultat direct
                  → confidence <85%  → Queue Celery → GLM-OCR → Résultat
```

**Orchestration :**
- **Celery** comme orchestrateur de tâches asynchrones
- **Redis** comme message broker Celery
- Worker dédié `glm_ocr_worker` (concurrence=1, queue `glm_ocr_jobs`)
- **Interdiction formelle** d'exécution simultanée PaddleOCR + GLM-OCR (CPU saturation sur i3)

**GLM-OCR sur Ryzen 7 (nuit/batch) :**
- iGPU Radeon 780M (VRAM ~2.5GB GLM-OCR) via Ollama/Vulkan ou ONNX DirectML
- Worker Celery dédié sur cette machine pour traitements lourds batch

**Limite connue (ADR) :**
- PaddleOCR et GLM-OCR extraient et structurent les champs textuels. Ils ne vérifient **pas l'authenticité physique** du document (hologrammes, microprint, UV).
- **MVP** : Jean (agent humain) assure la validation visuelle des originaux haute-résolution.
- **Phase 2** : Étudier un modèle CNN entraîné sur CNI camerounaises légitimes (classification doc authentique vs frauduleux) — à noter comme limite dans le rapport PFE.

---

### ADR-004 : Stratégie de Notifications (Sans Firebase)

**Statut :**  DÉCIDÉ  
**Date :** 2026-02-28

**Contexte :** Firebase Cloud Messaging = appel cloud externe → violation Loi 2024-017 potentielle + dépendance Google.

**Décision : Polling Local + SMS/Email Fallback**

**Mécanisme :**
- Après login Marie, la PWA ouvre un polling périodique sur `GET /notifications?since={timestamp}`
  - Foreground : toutes les **15-30 secondes**
  - Background : toutes les **60-120 secondes**
- Les notifications sont stockées dans PostgreSQL (table `notifications`)
- L'app affiche un **centre de notifications interne** (badge compteur + liste)
- **Fallback SMS** : Orange Cameroon SMS API pour notifications critiques (activation, rejet)
- **Fallback Email** : SMTP local (ou Orange SMS) pour confirmations

**Avantages :**
- 100% on-premise, zéro cloud
- Simple à implémenter et débugger
- Fonctionnel même sans service worker actif

---

### ADR-005 : SMS OTP — Orange Cameroon SMS API

**Statut :**  DÉCIDÉ

**Décision :** Orange Cameroon SMS API (portail développeur, client_id/client_secret, bundles en ligne 50-50 000 SMS, paiement Orange Money).

**Justification :** Opérateur local régulé ANTIC/ARPCE, friction administrative minimale pour un pilote, pas de dépendance à un gateway international.

---

### ADR-006 : Stockage Images (Filesystem Volume Docker)

**Statut :**  DÉCIDÉ

**Décision :** Filesystem chiffré (volume Docker monté) pour images haute-résolution (CNI recto/verso, selfie vidéo, factures). PostgreSQL stocke uniquement : chemin logique, SHA-256, métadonnées, dates.

**Justification :**
- COBAC exige conservation 10 ans des images/vidéos originales haute-résolution (pas uniquement les embeddings mathématiques).
- PostgreSQL BYTEA/TOAST sur gros fichiers binaires dégrade performances requêtes métier, alourdit backups, complique rétention sélective.
- Un volume Docker (LUKS/AES-256 Phase finale MVP) permet isolation physique, politique de sauvegarde dédiée (WORM, rotation), archivage froid après N années.

**Stratégie chiffrement (Phased) :**
- **Phase dev/debug** : pas de chiffrement au repos (itération rapide) — TLS en transit dès le départ
- **Phase pré-pilote** : activation LUKS ou chiffrement applicatif niveau volume Docker
- Voir ADR-014 (Stratégie Chiffrement) pour détail

---

### ADR-007 : PEP/Sanctions Screening Local

**Statut :**  DÉCIDÉ

**Décision : Screening offline sur tables PostgreSQL locales**

**Sources :**
- **ONU** : Consolidated Sanctions List (XML) — via OpenSanctions `targets.simple.csv`
- **UE** : Financial Sanctions Files (FSF) — webgate.ec.europa.eu, export CSV via OpenSanctions
- **OFAC/US** : SDN + Consolidated Lists (CSV/XML) — Treasury Sanctions List Service
- **PEP interne** : `pep.csv` maintenu par conformité BICEC (registres officiels, informations publiques)

**Implémentation :**

*Étape 1 — Seed initial :*
- Téléchargement manuel des listes UN/EU/OFAC
- Script Python d'ingestion → table `pep_sanctions` PostgreSQL (normalisation noms, alias, pays, programmes, dates)

*Étape 2 — Mises à jour :*
- Job cron nocturne : re-télécharge + upsert (désactivations, nouveaux entrants)
- **Fréquence cible MVP : hebdomadaire**

*Étape 3 — Screening Thomas :*
- Interface fuzzy search (nom + date naissance + pays) sur table locale
- Scoring similarité + gestion faux positifs avec justification obligatoire

**Phase 2 :** Migration possible vers API commerciale (Dow Jones, Refinitiv, OpenSanctions API) sous réserve Loi 2024-017 et contrats tiers.

---

### ADR-008 : Service Worker Offline — Périmètre MVP

**Statut :**  DÉCIDÉ

**Offline OBLIGATOIRE pour :**
- Shell applicatif PWA (HTML/JS/CSS/icônes)
- Métadonnées de session (étapes complétées, formulaires, flags OCR) → **IndexedDB**
- Copies temporaires chiffrées des images capturées (jusqu'à confirmation upload serveur → purge locale)

**Offline NON requis pour :**
- Stockage long terme images haute-résolution (côté serveur uniquement)
- Historique complet des transactions depuis mobile

**Flow résumption session :**
```
Coupure réseau → Service Worker cache session locale (IndexedDB)
Retour réseau → App détecte → "Reprise à l'étape [X]..." (< 2s)
              → Progressive upload → Backend confirme réception (200 + SHA-256 match)
              → App purge copie locale
```

---

### ADR-009 : Authentification Back-Office (Email/Password Local)

**Statut :**  DÉCIDÉ

Pas d'Active Directory pour MVP. Email/Password hashé bcrypt/Argon2 dans PostgreSQL local. RBAC strict par rôle (JEAN, THOMAS, SYLVIE). Sessions JWT avec expiry.

---

### ADR-010 : Celery + Redis pour Tâches Asynchrones

**Statut :**  DÉCIDÉ

- **Celery** : orchestrateur de tâches (GLM-OCR, envoi SMS/Email, batch Amplitude, cron PEP/Sanctions)
- **Redis** : message broker Celery + sessions OTP (TTL) + anti-replay liveness
- Workers dédiés par queue : `glm_ocr_jobs`, `notifications`, `provisioning_batch`, `sanctions_sync`

---

## 3. Vue C4 — Architecture Système

### C4 Level 1 — Contexte Système

```mermaid
C4Context
    title bicec-veripass — Contexte Système

    Person(marie, "Marie", "Cliente BICEC</br>Entrepreneuse 24 ans</br>Douala")
    Person(jean, "Jean", "Agent KYC</br>Validation dossiers</br>Agence BICEC")
    Person(thomas, "Thomas", "Superviseur AML/CFT</br>Conformité nationale")
    Person(sylvie, "Sylvie", "Manager</br>Directrice régionale")

    System(veripass, "bicec-veripass", "Plateforme KYC digitale souveraine</br>Onboarding 15 min + Back-office multi-rôles")

    System_Ext(orange, "Orange Cameroon SMS API", "Envoi OTP par SMS")
    System_Ext(amplitude, "Sopra Amplitude", "Core Banking System</br>Provisioning comptes")
    System_Ext(sanctions, "OpenSanctions / UN / EU / OFAC", "Listes sanctions</br>Téléchargées en batch")

    Rel(marie, veripass, "Onboarding KYC", "HTTPS/PWA")
    Rel(jean, veripass, "Validation dossiers", "HTTPS/SPA")
    Rel(thomas, veripass, "AML/Conformité/Admin", "HTTPS/SPA")
    Rel(sylvie, veripass, "Monitoring & SLA", "HTTPS/SPA")

    Rel(veripass, orange, "Envoi SMS OTP", "HTTPS REST")
    Rel(thomas, amplitude, "Provisioning batch", "HTTPS SOAP/REST")
    Rel_Back(sanctions, veripass, "Sync hebdo listes</br>(cron batch)", "HTTPS download")
```

---

### C4 Level 2 — Conteneurs

```mermaid
C4Container
    title bicec-veripass — Conteneurs Docker

    Person(marie, "Marie", "PWA Browser")
    Person(agent, "Jean/Thomas/Sylvie", "Desktop Chrome/Edge")

    System_Boundary(veripass, "bicec-veripass (Docker Compose)") {
        Container(nginx, "Nginx", "Reverse Proxy", "TLS 1.3 termination</br>Routage vers containers</br>Rate limiting")

        Container(pwa, "PWA Marie", "React/TypeScript</br>Vite + Service Worker", "Onboarding KYC</br>MediaPipe WASM</br>IndexedDB offline")

        Container(backoffice, "Back-Office SPA", "React/TypeScript</br>Vite", "Jean: Validation Desk</br>Thomas: AML/Compliance</br>Sylvie: Command Center")

        Container(api, "FastAPI Backend", "Python 3.11</br>FastAPI + Celery", "Modules: auth, kyc,</br>backoffice, aml,</br>analytics, admin,</br>notifications")

        Container(celery, "Celery Workers", "Python</br>Celery", "glm_ocr_worker</br>notifications_worker</br>amplitude_batch_worker</br>sanctions_sync_worker")

        ContainerDb(postgres, "PostgreSQL 16", "OLTP + DWH Analytics</br>Star Schema", "KYC, audit, analytics</br>PEP/Sanctions, agents")

        ContainerDb(redis, "Redis 7", "In-memory", "Celery broker</br>OTP sessions (TTL)</br>Anti-replay liveness")

        Container(storage, "Filesystem Volume", "Docker Volume</br>/data/documents", "Images CNI, selfies</br>Factures (10 ans COBAC)")
    }

    System_Ext(orange, "Orange Cameroon SMS API")
    System_Ext(axway, "Axway API Manager</br>(réseau BICEC intranet)</br>→ Sopra Amplitude Core Banking")
    System_Ext(sanctions, "OpenSanctions / UN</br>EU FSF · OFAC</br>Sync hebdo batch")

    Rel(marie, nginx, "HTTPS", "443")
    Rel(agent, nginx, "HTTPS", "443")
    Rel(nginx, pwa, "HTTP", "3000")
    Rel(nginx, backoffice, "HTTP", "3001")
    Rel(nginx, api, "HTTP", "8000")
    Rel(api, postgres, "SQL", "5432")
    Rel(api, redis, "Redis Protocol", "6379")
    Rel(api, storage, "Read/Write", "Filesystem")
    Rel(celery, postgres, "SQL", "5432")
    Rel(celery, redis, "Queue/Broker", "6379")
    Rel(celery, orange, "SMS OTP", "HTTPS")
    Rel(celery, axway, "ISO 20022 provisioning", "REST/HTTPS")
    Rel(celery, sanctions, "Sync listes PEP/Sanctions", "HTTPS Download")
```

> **Note Redis :** L'API **pousse** les tâches dans Redis (PUSH/SET). Celery les **consomme** (POP). L'API lit aussi Redis directement pour vérifier les OTP et les tokens anti-replay liveness. Redis joue donc deux rôles distincts : **broker de messages** (pour Celery) et **cache sessions** (pour l'API).

---

### C4 Level 3 — Composants Backend FastAPI

```mermaid
%%{init: {"theme": "base", "layout": "elk", "themeVariables": {"primaryColor": "#E3F2FD", "primaryTextColor": "#1A237E", "primaryBorderColor": "#1976D2", "lineColor": "#1976D2"}}}%%
flowchart TD
    subgraph api["**FastAPI App Modular Monolith** [SYSTEM]"]

        subgraph row1["API Layer"]
            auth_mod["**Auth Module**<br>*FastAPI Router*<br>OTP send/verify<br>PIN setup/verify<br>JWT sessions<br>Back-office login"]
            kyc_mod["**KYC Module**<br>*FastAPI Router*<br>Session create/resume<br>Capture CNI/Bill/NIU<br>Liveness<br>State machine<br>Submit dossier"]
        end

        subgraph row2["Processing Layer"]
            ocr_svc["**OCR Service**<br>*Python Service*<br>PaddleOCR primaire<br>GLM-OCR fallback<br>Quality metrics<br>Confidence scoring"]
            bio_svc["**Biometrics Service**<br>*Python Service*<br>MediaPipe landmarks<br>MiniFASNet liveness<br>DeepFace face match<br>Anti-spoofing score"]
        end

        subgraph row3["Business Layer"]
            bo_mod["**Back-Office Module**<br>*FastAPI Router*<br>Jean: queue, inspect<br>approve/reject/info<br>Thomas: AML, conflicts<br>Sylvie: analytics, SLA"]
            aml_mod["**AML Module**<br>*FastAPI Router*<br>Fuzzy search PEP/Sanctions<br>Alert management<br>Deduplication<br>Fraud flagging"]
        end

        subgraph row4["Support Layer"]
            analytics_mod["**Analytics Module**<br>*FastAPI Router*<br>Funnel events<br>SLA dashboard<br>System health<br>Escalation<br>Load balancing"]
            notif_mod["**Notifications Module**<br>*FastAPI Router*<br>Polling endpoint<br>Celery triggers<br>SMS/Email dispatch"]
        end

        subgraph row5["Infrastructure Layer"]
            audit_svc["**Audit Service**<br>*Python Service*<br>SHA-256 hashing<br>Append-only log<br>IP tracking<br>COBAC export"]
            core["**Core**<br>*Config/DB/Security*<br>DB connection pool<br>JWT utils<br>bcrypt/Argon2<br>Settings"]
        end

    end

    auth_mod -->|uses| core
    kyc_mod -->|calls| ocr_svc
    kyc_mod -->|calls| bio_svc
    kyc_mod -->|logs every action| audit_svc
    bo_mod -->|logs every decision| audit_svc
    aml_mod -->|logs every alert action| audit_svc
    analytics_mod -->|queries DWH| core
```
![C4-Container-Component-L3](https://mermaid.ink/svg/pako:eNqNVm1z2jgQ_isa3-RLBgLhJQnMTWcMmJQWCBdz1-mVTkbYi62LLPlkOa2b8t9vJRuSlHIpHxJ5dyU9--jZlR6dQIbg9J2Tk0cmmO6Tx5WjY0hg5fTJylnTDEc1HHFayFyXVuD3pdFG_kUVo2sOmXHi9FSxhKpiKLlUZfxvXnvcGo_KOZV7CV_185Bzt9W-9F6EDKQKQb0I6l1ejFoVICbgZ77tdntyshIbLr8EMVWaLEcrQfCX5etI0TQmNGWfVs7p6Zhm2l1MiJumZCbDnFOF_4XkTMenp-ST_9FferPPK-fzSpRLvFhGyS_nuI5ZYUoLUDaOPPvRXMd3iQztZi5-lLvA6enva_Vmv_0t8grK2m6WC5KBCBsPoNimMKbFZI4mnafPbO8-LNGWZUyKzHwPaHBfl5sNC4BwGTFxAOW-CPZI3n8cvgrEL1cngQKqoaEgyxMwjiFNda6ADOeTxoBx3phP_jT2KXsAgZPsZI1zSEKDGI_IGvJ1wjQJJS76A0-Y7DFyW4h2oWRgoIjoCMcyUHfZQ2ATuxneEh_UA9JQZbYodIxZ7IyWTxqGHEyoVRlTFuH1dFY3tg3lfI1sGtsfOUUlFCQBrVhgMxtKsWEhCOQ5C6RCWAeA1kzuAQ2YrCa_jmsGIaMLluIJUhGi_O_tjjOsyrHrz0ET_oziEUA6pghjY_4kVAexMbtCs3qWSrkxjBmI8KtstxHxIEemcYcjXK_lXkNWcTel4l7T0jugok_-zSGHGmEiSyHQxk7TVMkHI65_0NJgYiONeRnLhGZ94s6mNRIg4ZwFutRVwR8Y9AkVlBcaWa0Rf-oell3Cn6puNn0V3zj_9q3AeqIqiMnCWzR8KgK9qy2XA_aQBPeMsNcJXbIf5inCoibKLqFoHpINp1H0oyb-h_IOQvTzNJW4wZEOssv0KaGd5RfSEgI4ARRNRd_UJSHN4rWkKiz5zDQkJAbKtZWPlwWU75OaShqSNRpE8DOhC6nZZo9rbr4qRl7HtpCcG4UiOalkJalDQKYLguUSRaBKxDO_4WGNchKyLDUi_1VquwhqIjYKt1Z5YDvWsR4dMr0vWNd8vV6r_lu33upekBjZxDSsTNIU4dSl4IVpwcY0WWAyWCdVxPBm4A4JfDXHfQDDVKpFMMRBtbFtNlFjNGj4EOQKW5G1jwamKgRYiRKsdb67EnLNuOVtHagi1Q1XRVK0ynauNcLIjtH3bLi7tEi9_uZ7jrfMdwuudFbXiPWhVDg6qwZ81F_1w0M_spQZdeKZU5vL96fDKKPLfvNjcAgBy34WXtX9weK2gI9s8aLA7EzsU4pBRkYf3u4yd2pOpFjo9FFLUHMSUKhJ_HQezSIv3kshbGjO8Xxrpevw1VTa7di8liyKlVkzAi-MykcU3kIZ1HY-gS-0Bcc-b9qPj5LSEBUYtnKmk7nn3t753vXMmy_9anUzBxWS4UWlsBCB35hnVIlhceuNvds7b3TtvQgvAg4DvOuNWJ9tga7rW88bfVw5JnS7ElskI6XibymTHR9K5lHs9EvQTp6GOHvEKNbiUwgKzLzkcqGdfrvZ6tpFnP6j89Xp17u9s3an12me93rti1avfYXuwumfN3tnnYtes3nVOW9dNLuX25rzze57ftbsYmDn6qrbu-pddTqXNQevTy1tvngw9lG7_Q8cGY5L)
---

## 4. Diagramme Use Case

```mermaid
%%{init: {"theme": "base", "flowchart": {"nodeSpacing": 30, "rankSpacing": 60, "useMaxWidth": false}, "themeVariables": {"primaryColor": "#E3F2FD", "primaryTextColor": "#1A237E", "primaryBorderColor": "#1976D2", "lineColor": "#1976D2"}}}%%
graph LR
    subgraph Acteurs
        direction TB
        Marie((" Marie<br>Cliente"))
        Jean((" Jean<br>Agent KYC"))
        Thomas((" Thomas<br>Superviseur AML"))
        Sylvie((" Sylvie<br>Manager"))
        System((" Système<br>Automatique"))
    end

    subgraph UC_Mobile[" Application Mobile - PWA Marie"]
        direction TB
        UC1[UC1: S'inscrire par OTP SMS/Email]
        UC2[UC2: Configurer PIN & Biométrie]
        UC3[UC3: Capturer CNI Recto/Verso]
        UC4[UC4: Passer le test de liveness]
        UC5[UC5: Saisir adresse & GPS optionnel]
        UC6[UC6: Uploader facture utilitaire]
        UC7[UC7: Déclarer ou uploader NIU]
        UC8[UC8: Accepter CGU & Signer digitalement]
        UC9[UC9: Soumettre le dossier KYC]
        UC10[UC10: Suivre l'état du dossier]
        UC11[UC11: Explorer les services BICEC]
        UC12[UC12: Reprendre session après coupure]
        UC13[UC13: Recevoir notifications]
    end

    subgraph UC_Jean[" Back-Office Jean - Validation"]
        direction TB
        UC14[UC14: Consulter la queue de dossiers]
        UC15[UC15: Inspecter dossier haute-résolution]
        UC16[UC16: Comparer selfie vs photo CNI]
        UC17[UC17: Valider ou corriger données OCR]
        UC18[UC18: Approuver le dossier]
        UC19[UC19: Rejeter avec motif]
        UC20[UC20: Demander info supplémentaire]
    end

    subgraph UC_Thomas[" Back-Office Thomas - AML/CFT"]
        direction TB
        UC21[UC21: Examiner alertes PEP/Sanctions]
        UC22[UC22: Effacer faux positif AML]
        UC23[UC23: Confirmer match & geler compte]
        UC24[UC24: Résoudre conflits d'identité]
        UC25[UC25: Gérer les agences CRUD]
        UC26[UC26: Surveiller batch Amplitude]
        UC27[UC27: Relancer batch en erreur]
        UC28[UC28: Provisionner comptes Amplitude]
    end

    subgraph UC_Sylvie[" Command Center Sylvie"]
        direction TB
        UC29[UC29: Consulter dashboard R/Y/G]
        UC30[UC30: Analyser funnel drop-off]
        UC31[UC31: Escalader dossier SLA dépassé]
        UC32[UC32: Redistribuer charge agents]
        UC33[UC33: Exporter pack conformité COBAC]
        UC34[UC34: Surveiller santé système]
    end

    subgraph UC_System[" Système Automatique"]
        direction TB
        UC35[UC35: Scorer dossier globalement]
        UC36[UC36: Détecter doublons identité]
        UC37[UC37: Déclencher alerte SLA 2h]
        UC38[UC38: Sync listes PEP/Sanctions hebdo]
        UC39[UC39: Purger cache session locale]
        UC40[UC40: Backup DB quotidien]
    end

    Marie --> UC1 & UC2 & UC3 & UC4 & UC5 & UC6 & UC7 & UC8 & UC9 & UC10 & UC11 & UC12 & UC13
    Jean --> UC14 & UC15 & UC16 & UC17 & UC18 & UC19 & UC20
    Thomas --> UC21 & UC22 & UC23 & UC24 & UC25 & UC26 & UC27 & UC28
    Sylvie --> UC29 & UC30 & UC31 & UC32 & UC33 & UC34
    System --> UC35 & UC36 & UC37 & UC38 & UC39 & UC40

```

![Use-Case Diagram](https://mermaid.ink/svg/pako:eNqNV41u2zYQfhVCQ9YWSBpL9E9sDAUcJw2yNY0RJy26uhhoiba5SqRGUl6ywO9TP4dfbHek1Zpu0iZAFIX67od3392R91GqMh71or29eyGF7ZH7cWTnvODjqEfG0YQZeNuHt2mu_k3nTFv8ACAJcqOSpULOcIU2EKSZ_Ly12HaLleEX7Pa9yOwcF6csN3yJH5ydd0wLNsm52egttSiYvhuoXGnvwy-n9HXy-sS7sfl8zW_tNiTuJ7RzGkCOlc64DkDdTvsk8aBcSP7Qt-Vyubc3ljPNyjl5czWWBH5MNfEL_dTyShu_ij-Z0Dy1Qklyffxt9QL2xJ8_H0f-7beJfjXIBZcWYvnixTfc75xJB8MXRPVnACJ_fBiEuOu5KphxSP-K2FFVcr0QBhwi_Ys3ocToLl9sXPCvKHHBJJtxvYs0lhcbpLHrL4XD9isLhqz4p9rymctsLHdCcjP460JNRM4_goZ-WeYiZS4gfpUckOH7vo_DOPr0s8jdDOKP8Nsjo2dCmlQDiJRMk8vrIRldjA5PCybyT9v4BPBJjwyUnIpZpbkmw_O35FdyLFSxXlkwG8ApwCnAWWkdePD2nFyBI-rwHddGBdgmYJs9MmTGABL2YrmxJOMkFwsuuTEBugXoFjjOhBGasEwDgIMjZ8MRUSXuVPLQ9TZItHvkpswVA6pCZaToFKmsyIVlsPcA3gF4p0dO1qs0Z-i7qkhVy749vwnARwA-6gFhU15a3OfZDfgyEjMJ_2RiBvpzqD5pA6kuSHVhD6oquLXgCmw6U8YIEAJWBti4gZlqALoSC4Q-g3AziE9Vi4Rwl1jI7Okt-KxdQA0xSOEUXo7PB6c7-jGzMaT2ipcamAcmDIQUGcNKvf5iSKqqstoJUowJjilKpXyhIBNSWTHdkLLO2CNExjJEGh-z9PPB5RSkuCtNIPE7lovM6Xgai5E7cdPx0lQ5ZiBnBIqp4kigTYBCAsXIoBgodC5NCVoxUZvYz1ll-YFer4zKKzQXCiKR4jYaK0rHDMPzqeBkYUg5V1Yhy0MJ5FIMZHLb8lRKldZi5oxKuV5BTi4HV6EUkipGVpWlVtXCF8WDyUYixV3Mwt8cN8IWPCUFZiIsXuRQAhw64QWT6IiQUwU5gT6yXiE9t6rgkaT5jribNr8KiYPWeDh4ff2krCXI0cRxlBUCKwWKREPVk-Hp8HDEZLpNoo2Ma0BA09Mp1K-r4uqWlMoI2CxaD9FIz4Ru-pUuAA9dNp1Dbc442IIsFFCvoQxyKQEuXWH-KyyEFKShRRiSPYP0SSvsehXKIJcS4NLZelXXGvR-iaU2uLo5CcHIn6SNlawXXOTox8R51S-gn9sq23EI2ZN0MLs5xOQrmkvCtYZ5FKKRNQmwZqgVjCvXB-t9mu8sPJJkP8QwycBxpAoZ4DjVm-n2tOwiKZPudk1mzMwniumMXB1-ODwLJwVykwI3-5LldzgBphW2cJJpVR6oachkitShSB2Tsty15Lp4R2_6JFuvShgjO1miyB3qWlwmDMyqSYWhgVPWjLt02ZBr1E0v6nqo0rgBOGt9dmxQukASkMHlcT_soxTpQ5tBdg2TCDabgf-z2OMJ4ePWAYEEp4MnhJ4iHSlOx9S1_jo0s1xNHppDFBlJ227Y2boVVpMcEkceJjxFTtJ6PALR51-r1yUgmYdwJCUFUo7uZArz3HxX5GTOJ1l4HqBIIAoEGlYaG2XKwMrXoZQrSHxYKE2kUBMohJ2pKsnJMYwAaIIZnAW_j7k7I5GDg1fYQKEhAFndk7pn0z1b7tl2z457Hrln1z3jhv_jpWMvHlOv3g8yr90ri7222KuLvb7YK4y9xqThhet26sSTjXdef-L9S7zOxOtMvM7E60yOvBZfrLUWb4F6n6nXSTdb9jpps5ZDBm7kqLdAvQXqLVDvNfU6m-B1tB_NtMiintUV34-g08LREf6N7lHnQ5ccv75zz3H2H7rt1F--v_LUXx669-C35f6WBzvXn43ojy5BO5hHb0I7uB9ch2rkY3ci5_RYLl1QSyb_VKqo4wrngNk86rnN7UdVCWckfiIYNI9vEC6d5UraqNei3cQpiXr30W3Ui5vJy06redRq0VYMjwbdj-6i3kESd-nLo1aTdmmn0Wm0k-V-9J-z23oZN9pHnTaNj9rtTjsBddA9rdIX_ibrLrTL_wFtQn0c)
---

## 5. State Machine KYC

![KYC / Onboarding State Diagram](https://mermaid.ink/svg/pako:eNqtWd1u2zgWfhWugGLjjZPYcZomxkwBx1YKt46dkd3MZOrCYGXaYStRHoryNA0C7NUAc7vYR9iLZq_3DfwmfZI9JCVZlGznZ9qLwYQiv3N4zsdzzpfcWG4wJlbdevYMhQIL0qJ4yrG_M98fMliT_8aUE1fQgKHByZCly-_-8R7t7LxELadxOkB1dIY5JcjlizuCQhKGcCCzmwWCIE6nVwIFE30m_Sb_xafxTEScoGa3XUYenRMGQGVjIx5zWCNl1G2_LSM3YCFhgvjwH2Pbt3_-G4kgEogw5AUu9vZmPJjKo3SSbiRsrBzL-KlvI-_V6TXf2K1Rp31hd-1-H25YQ4s794q4Yepaeiy_ORuYpkddNLQc4gY--OkSPrR-2PvAX265GODQLOLTxV0ZPInmBEdJ8FC7VdqILxOQojc8j3B5WTyVJobWyjud291Wu_tq9OaymWYsDCKfCOQRNA7AMHhXPOfY_YHTbg7AhUazqaPxDrvu4muI8GyGQupHnsBscacuNqeCU0aQD9xCGLgzX9y9X0uGAriRyJa0IX2kKirl2OsZicyEk88zL-AQA-_v0iOIROJF3dgnGSN9FQpsDBmVYedCkpbPqUtyfPMhGxBTFaloNgu42DW-NyI3kra44iBiFEgMaLubSJZNQzYt7e5pDyL7mmCGxsTHbExUPCmbBGgvJcg4cCOD8Mb5zXlWeHkgtHVWPShtcLDZOzvvtBvdpj1y7Iu2_TOgNjwVtcZZR2HiSAQ7EE4BtQJKQAaseLjo4uAq8HGIyGSCXX3nCY4-o1kQUiEf7D1gZ71ue9Bz7NYSCvI8odwnYOg8fm2BPxMpH5GPKRAr4nNCPW9xV7rXSKvdb5x0VtnQDnMcSboDNjcDkI-mYzdal6PTnjPqnfeTfANpuUyL8RBTCPOIip_Tu2j323Dx7qulRx5mcfw-YOFeoYY_86gAv7LuZE9KKIAc2Y7TcwDH5pxEHEEWrxj9LdJYGZQYY3lkvS-cCH59n91mz3Hs5gBWl8YnAfexZmoQyToPgfY8qjtKxoHM2fVeuAGHSkPQ9v3-NADroiHrUJKxxiu727yUZE8iYOZcdjtVSZAml1p8F16HYvEVqAfPnk7g6ekH2D_rgxeQ52wpXGtTtaD2WduouZopc0wFmmOPjuN62290-ypOapE8DPzcsUenbzude9EbF3bTQF9Tx9dZM8qlDoIKDKJsR5fqeXC9uAtzhXpoXQSCkziyiIQCzfjivwL9zdjmQH0lX3bmQRQu2x8Ujogb20I6ZbJBCgQpc6MZPFL4ca4t6IJtbSzZuWjJCJrR64MFrKYX7YMuOr-DxTD9UvtcUsvbugpp6kwow17WVi7tq5OlORVB08PASkhPDKySyInOFdp6Xa2V1mbMNJRru3ezxf9EiHpvykbPhAWzAV7ErS8sqxcG7IH_UyGFjKKTTu-nt4s_--aZE8xkNuqQ5Cak15Nt40ucDbjK5lSYd8hExTAxgOEPPJgETM2uEGIqJMmA1R-84LcISnSY7-TiCjmYegjmgRCd0HN8XUZNGE-avTIwx93Y0_PksH85bzuXo58bTlyP-klViJukJgiMLZTrwC678evq_l7_sl-tLAfAHFy2g4KDb08gkckLNqqOZiGY9DCFmUJ9dEmp0JtSkCKxjTExMzoYhIM6mDSwmHObDKyaJ1uxj0A8HIZx7fn2x7-AVSEMclqBwKQPIxgGymVCv-z-j2jTUEu-Lvu_bJsbklnEDKNwBizQ4Y0x9yAqEZCLJRbVVLH-Ua9FzbT9fJweds6MSK5OZa4MwwaMKzFJYFCC9JrOD2MNd0MZFXV0M7TEFbz2oSWf7pjAkOaJoVWGHzx8DS9OfyDeJ70IkpKLHutAjZJfBI9IOfmu0HzCp8QeT0koFybYC9UG99r1yAkn-BNl0z4UFUGm1xq73R3Yjmo19tC6vb199mzICsp1lWx9oGbVw6wLOiAcQXSIh37MpCEBepxM1LMCFFHZeuBxhhokV4xNIL1FTaNB4I2D3xk6rISyPbP4FYLiWwrtZPM2kvMnvH9XF5UIVM0uCOBPkJwRSB0mRvsHV-jbn_9BteWpLYhAKNWyXdkHCLvyvKQ_Lgvdk1Uu2orfmhvfQ3YHiI_-qMVvaT3-_Sr3oRK3mFlZWQhS68UUP1GkQWFUQhF6mizmulQ9WKRxOQzFVVsJgaQlLGVoaRV5suDLtA6oT2RW6zCCwLQlZ44JeoleoI8wHoXLfbLKNgmE9jptHup629qrlTw5KjBkddieIh2_l2r8foJxUjal4vdUiasl4mtbkjEhGicfiYhHhqTdLO7mMOIx8DBSUk0SJXYtPb58QV2V2Lgq6LQO2Tbyg1hfP1qoJoceJU3BZk6YosZ5O7W_SZkmZH7uUwYwIWahHDtm8jeAGZ07ZBmSHsfxeJRcfYJWBatFpfpXZepKPy4anXbroRoV3HonBZecmjxokanyysqu94mttdCmNo4HmZV6EQzmteiQ5ZppXnQ8wnSigtbZzivVgu2cjEpuvsKCaTg2mpd4kmxS4IGsK9raaCcJ4tr7FeSdeq2GuCuipp7fLz4ATnYqLT-gwfyAapWPGu-pUkNGIxYatYpuMSWzrhgaoBBdQ2cUdcWDoJbkzMuJfIIAWci_CGBJnTiS5thcTH9xcl51LtMBTnWlTifqtbpjTR43TPrr-fTgQwbZ7zl1n8aKN1tla8rp2KrrUV7O9z6WP1s3EmeNfNCfigpCr68SEfpLqiOY_oXRKjWRfHuopJD7b4fsFm4yw-zXIPCtujJpAQunV-nNotl4KTrSVS5_G8Wbcs626tVK5eBIwVj1G-szLNSe7x69ODw-qh4f1A5eVA7K1rVV36m-qO0e1qq1_eOjSqVyfHR0W7a-KMP7u8eVw-pB7eiwCp-OjgGNjKkI-Jn-q536493t_wGrD7bI)
> **Règle Terminologique Normative (Patch V4) :**
>
> | Champ | Valeurs légales | Usage |
> |---|---|---|
> | `kyc_sessions.status` | `DRAFT` \| `PENDING_KYC` \| `PENDING_INFO` \| `COMPLIANCE_REVIEW` \| `READY_FOR_OPS` \| `PROVISIONING` \| `OPS_ERROR` \| `OPS_CORRECTION` \| `VALIDATED_PENDING_AGENCY` \| `ACTIVATED_LIMITED` \| `ACTIVATED_PRE_FULL` \| `ACTIVATED_FULL` \| `EXPIRY_WARNING` \| `PENDING_RESUBMIT` \| `MONITORED` \| `REJECTED` \| `DISABLED` \| `ABANDONED` | État du **workflow KYC** |
> | `kyc_sessions.access_level` | `RESTRICTED` \| `PENDING_ACTIVATION` \| `LIMITED_ACCESS` \| `PRE_FULL_ACCESS` \| `FULL_ACCESS` \| `BLOCKED` | Niveau de **droits dans l'app Marie** |
>
> ⚠️ Le terme `RESTRICTED_ACCESS` n'existe **pas** comme valeur d'un champ. Tout résidu de ce terme dans le code ou les diagrammes est une erreur v1 à corriger.

```mermaid
%%{init: {"theme": "default", "layout": "elk", "startOnLoad": true, "elk": {"mergeEdges": false, "cycleBreakingStrategy": "INTERACTIVE"}}}%%
stateDiagram-v2
    direction TB

    [*] --> DRAFT : Marie crée session</br>access_level = RESTRICTED

    DRAFT --> LOCKED_LIVENESS : 3 échecs liveness</br>consécutifs
    note right of LOCKED_LIVENESS
        Cooldown 60s avant nouvelle session
        + vérification user.lockout_count_24h ≤ 3
        (résout E02 + E05)
    end note
    LOCKED_LIVENESS --> DRAFT : Clic "Recommencer"</br> (après cooldown, cache</br> purgé)
    LOCKED_LIVENESS --> [*] : Clic "Aller en agence"

    DRAFT --> PENDING_KYC : Marie soumet</br>access_level reste </br>RESTRICTED

    PENDING_KYC --> PENDING_INFO : Jean demande</br>info / doc supplémentaire
    PENDING_INFO --> PENDING_KYC : Marie renvoie</br>le document (messagerie)
    note right of PENDING_INFO
        Timeout : si inactif > 7 jours
        → Celery notifie Jean + Marie
        (résout E08)
    end note

    PENDING_KYC --> COMPLIANCE_REVIEW : Alerte AML</br>auto-détectée
    COMPLIANCE_REVIEW --> PENDING_KYC : Thomas efface</br>faux positif
    COMPLIANCE_REVIEW --> MONITORED : Thomas confirme PEP</br>(compte actif, surveillé)
    COMPLIANCE_REVIEW --> DISABLED : Thomas confirme</br>fraude avérée

    PENDING_KYC --> REJECTED : Jean rejette</br>(fraude évidente uniquement)
    REJECTED --> [*] : Notification Marie</br>+ motif

    PENDING_KYC --> READY_FOR_OPS : Jean approuve

    READY_FOR_OPS --> PROVISIONING : Thomas lance\nbatch Amplitude API

    PROVISIONING --> OPS_ERROR : Timeout 5min\nsans réponse Amplitude</br>(résout E09)
    OPS_ERROR --> PROVISIONING : Thomas retry

    PROVISIONING --> OPS_CORRECTION : Erreur format\nou NIU collision
    OPS_CORRECTION --> PROVISIONING : Thomas corrige + retry

    PROVISIONING --> VALIDATED_PENDING_AGENCY : Amplitude confirme</br>[SMS template + notif app envoyés]

    VALIDATED_PENDING_AGENCY --> ACTIVATED_LIMITED : Jean avait validé\nSANS NIU valide\naccess_level = LIMITED_ACCESS
    VALIDATED_PENDING_AGENCY --> ACTIVATED_PRE_FULL : Jean avait validé\nAVEC NIU valide\naccess_level = PRE_FULL_ACCESS

    ACTIVATED_PRE_FULL --> ACTIVATED_FULL : Signature agence</br>(wet 3x)\naccess_level = FULL_ACCESS

    ACTIVATED_LIMITED --> ACTIVATED_PRE_FULL : Marie uploade NIU</br>+ Jean revalide

    ACTIVATED_FULL --> EXPIRY_WARNING : Système détecte\ndoc expirant < 30j
    EXPIRY_WARNING --> PENDING_RESUBMIT : Jean notifie Marie</br>(délai 30 jours)
    PENDING_RESUBMIT --> ACTIVATED_FULL : Marie soumet + Jean réapprouve
    PENDING_RESUBMIT --> ACTIVATED_LIMITED : Délai dépassé\naccess_level rétrogradé

    MONITORED --> ACTIVATED_FULL : Surveillance levée
    MONITORED --> DISABLED : Fraude confirmée après surveillance

    ACTIVATED_FULL --> DISABLED : Thomas suspend
    ACTIVATED_LIMITED --> DISABLED : Thomas suspend
    ACTIVATED_PRE_FULL --> DISABLED : Thomas suspend
    MONITORED --> DISABLED : Thomas suspend
```
---

## 6. Diagrammes de Séquence

### SEQ-01 : Onboarding Marie (Parcours nominal)

```mermaid
sequenceDiagram
    actor Marie
    participant PWA
    participant Nginx
    participant API as FastAPI
    participant OCR as OCR Service
    participant BIO as Biometrics Service
    participant Celery
    participant Redis
    participant PG as PostgreSQL
    participant FS as Filesystem
    participant Orange as Orange SMS API

    Marie->>PWA: Ouvre l'app
    PWA->>PWA: Service Worker vérifie session locale (IndexedDB)

    Marie->>PWA: Saisit numéro téléphone
    PWA->>API: POST /auth/otp/send {phone}
    API->>Celery: Task: send_sms_otp
    Celery->>Orange: SMS API: envoie OTP
    API->>Redis: Stocke OTP hash (TTL 5min)
    API-->>PWA: 200 OK

    Marie->>PWA: Saisit code OTP
    PWA->>API: POST /auth/otp/verify {phone, code}
    API->>Redis: GET otp:{phone}
    alt Code incorrect ou expiré
        API-->>PWA: 401 OTP_EXPIRED / OTP_INVALID
    else Code correct
        API->>Redis: DEL otp:{phone}
        Note over API,Redis: Anti-replay : code supprimé immédiatement après vérification
        API->>Redis: DEL otp_verify_attempts:{phone}
        API->>PG: Crée/récupère user + kyc_session (status=DRAFT)
        API-->>PWA: 200 JWT token + session_id
    end

    Note over Marie,PWA: Phase identité

    Marie->>PWA: Capture CNI Recto
    PWA->>PWA: MediaPipe WASM: qualité frame (blur, glare)
    PWA->>API: POST /kyc/capture/cni {session_id, side=RECTO, image}
    API->>FS: Stocke image chiffrée /data/documents/{session_id}/cni_recto.jpg
    API->>PG: INSERT document (chemin, sha256, status=PROCESSING)
    API->>OCR: extract(image, doc_type=CNI_RECTO)
    OCR->>OCR: PaddleOCR → confidence par champ
    alt confidence ≥ 85% tous champs
        OCR-->>API: {fields, confidence_map, engine=PADDLE}
    else confidence < 85%
        OCR->>Celery: Queue glm_ocr_jobs {image, doc_type}
        Celery->>OCR: GLM-OCR fallback (10-30s)
        OCR-->>API: {fields, confidence_map, engine=GLM}
    end
    API->>PG: UPDATE document (ocr_raw_json, confidence_per_field)
    API-->>PWA: OCR result + confidence badges ()

    Marie->>PWA: Confirme/corrige champs OCR
    PWA->>API: POST /kyc/ocr/confirm {session_id, corrected_fields}
    API->>PG: INSERT ocr_fields (human_corrected si correction)
    API-->>PWA: 200 OK

    Note over Marie,PWA: Phase liveness

    Marie->>PWA: Démarre liveness
    PWA->>PWA: MediaPipe WASM: 478 landmarks en temps réel
    PWA->>PWA: Calcul Yaw angle, EAR, présence visage
    PWA->>API: POST /kyc/liveness {session_id, landmarks_data}
    API->>BIO: MiniFASNet liveness check + DeepFace face match
    BIO->>BIO: Score liveness (anti-spoofing)
    BIO->>BIO: Score face match (selfie vs CNI photo)
    API->>PG: INSERT biometric_results (scores, model_version)
    alt liveness OK (score ≥ seuil)
        API-->>PWA: {liveness: PASS, face_match_score: 0.92}
    else échec (strike++)
        API->>PG: UPDATE kyc_session (liveness_strike_count++)
        alt strike_count < 3
            API-->>PWA: {liveness: FAIL, strikes_remaining: N}
        else strike_count = 3
            API->>PG: UPDATE kyc_session (status=LOCKED_LIVENESS)
            API->>Redis: Purge session token
            API-->>PWA: {liveness: LOCKED}
            PWA->>PWA: Affiche message lockout (FR19)</br>Attend clic "Recommencer"
        end
    end

    Note over Marie,PWA: Adresse, NIU, Consentement

    Marie->>PWA: Upload facture ENEO/CAMWATER
    PWA->>API: POST /kyc/capture/bill {session_id, image}
    API->>FS: Stocke image facture
    API->>Celery: Queue glm_ocr_jobs (factures = GLM-OCR direct)
    Celery-->>API: {agence_utilitaire, date, adresse_extraite}
    API->>PG: UPDATE kyc_session (agency_id basé agence utilitaire)
    API-->>PWA: OCR résultat facture

    Marie->>PWA: Accepte 3 checkboxes CGU + Privacy + DataProcessing
    Marie->>PWA: Signature digitale
    PWA->>API: POST /kyc/submit {session_id, consent_record}
    API->>PG: INSERT consent_records
    API->>PG: UPDATE kyc_session (status=PENDING_KYC)
    API->>PG: INSERT analytics_events (event=KYC_Submitted, timestamp, step_durations)
    API->>Celery: Task: check_duplicates + aml_screening
    API-->>PWA: 200 {message: "Dossier soumis, notification < 2h"}
    PWA->>PWA: Affiche écran célébration (E03)
```

---

### SEQ-02 : Validation Jean (Evidence-First)


```mermaid
sequenceDiagram
    actor Agent as Jean / Thomas / Sylvie
    participant BO as Back-Office SPA
    participant API as FastAPI
    participant PG as PostgreSQL

    Agent->>BO: Ouvre l'URL back-office
    BO->>BO: Vérifie JWT stocké (localStorage chiffré)
    alt JWT valide
        BO->>BO: Redirige vers dashboard selon rôle
    else Pas de JWT / expiré
        BO->>Agent: Affiche écran login (email + password)
        Agent->>BO: Saisit identifiants
        BO->>API: POST /auth/backoffice/login {email, password}
        API->>PG: SELECT agent (email) → compare bcrypt hash
        alt Identifiants valides
            API->>PG: INSERT audit_log (action=LOGIN, agent_id, ip)
            API-->>BO: {access_token, role: JEAN/THOMAS/SYLVIE, agency_id}
            BO->>BO: Stocke JWT
            BO->>BO: Redirige vers dashboard du rôle</br>(Jean→Queue, Thomas→AML, Sylvie→Command Center)
        else Identifiants invalides
            API-->>BO: 401 Unauthorized
            BO->>Agent: Message erreur + compteur tentatives
        end
    end
```

---

### SEQ-03 : Screening AML Thomas

```mermaid
sequenceDiagram
    actor Thomas
    participant BO as Back-Office SPA
    participant API as FastAPI
    participant PG as PostgreSQL
    participant Audit as Audit Service
    participant Celery
    participant Amplitude as Sopra Amplitude

    Note over PG,Celery: [Tâche auto-déclenchée à soumission dossier]
    Celery->>PG: Fuzzy search nom+DDN dans pep_sanctions
    alt Match trouvé (score ≥ seuil)
        Celery->>PG: INSERT aml_alerts (session_id, match_score, status=OPEN)
        Celery->>PG: UPDATE kyc_session (status=COMPLIANCE_REVIEW)
        Celery->>PG: INSERT notifications (user_id=thomas, type=AML_ALERT)
    end

    Thomas->>BO: Ouvre dashboard AML
    BO->>API: GET /aml/alerts?status=OPEN
    API->>PG: SELECT alertes actives
    API-->>BO: Liste alertes PEP/Sanctions

    Thomas->>BO: Sélectionne alerte Marie
    BO->>API: GET /aml/alerts/{id}
    API->>PG: SELECT alert + profil client + détail sanctions match
    API-->>BO: Side-by-side: profil client | entrée liste sanctions

    alt Thomas = Faux Positif (homonymat)
        Thomas->>BO: Saisit justification + Clique "Effacer alerte"
        BO->>API: POST /aml/alerts/{id}/clear {justification}
        API->>PG: UPDATE aml_alert (status=CLEARED, justification, cleared_by=thomas)
        API->>PG: UPDATE kyc_session (status=PENDING_KYC)
        API->>Audit: LOG {action=AML_CLEARED, justification, ip}
        API-->>BO: 200 OK
    else Thomas = Match confirmé
        Thomas->>BO: Clique "Confirmer match"
        BO->>API: POST /aml/alerts/{id}/confirm {justification}
        API->>PG: UPDATE kyc_session (status=REJECTED)
        API->>Audit: LOG {action=AML_CONFIRMED_FRAUD}
        API-->>BO: 200 OK
    end

    Note over Thomas,Amplitude: [Provisioning Amplitude — après tous feux verts]
    Thomas->>BO: Lance batch provisioning
    BO->>API: POST /admin/batch/create {dossier_ids}
    API->>PG: INSERT amplitude_batches (status=PENDING)
    API->>Celery: Task: amplitude_batch_worker {batch_id}
    Celery->>Amplitude: HTTPS Webservice: créer comptes
    alt Succès
        Amplitude-->>Celery: 200 account_created
        Celery->>PG: UPDATE batch_items (status=SUCCESS)
        Celery->>PG: UPDATE kyc_session (status=ACTIVATED)
        Celery->>PG: INSERT notifications (user_id=marie, type=ACCOUNT_ACTIVATED)
    else Erreur technique
        Amplitude-->>Celery: 4xx/5xx erreur
        Celery->>PG: UPDATE batch_items (status=OPS_ERROR, error_detail)
    end
```

---

### SEQ-04 : Dashboard Sylvie (30-Second Scan)

```mermaid
sequenceDiagram
    actor Sylvie
    participant BO as Back-Office SPA
    participant API as FastAPI
    participant PG as PostgreSQL

    Sylvie->>BO: Ouvre Command Center
    BO->>API: GET /analytics/health
    API->>PG: Agrège métriques temps réel
    Note right of API: queue_depth, avg_validation_time</br>sla_violations, system_uptime</br>ocr_accuracy_trend, active_agents
    API-->>BO: {status: GREEN/YELLOW/RED, metrics}

    BO->>API: GET /analytics/funnel?period=today
    API->>PG: Query fact_analytics_events GROUP BY step
    API-->>BO: {steps: [{name, entered, completed, drop_off_rate}]}

    BO->>BO: Affiche dashboard R/Y/G</br>+ Funnel graph</br>+ Big Numbers

    alt SLA violation détectée (dossier > 2h)
        BO->>BO: Badge  sur dossier concerné
        Sylvie->>BO: Clique "Escalader"
        BO->>API: POST /analytics/escalate/{dossier_id}
        API->>PG: UPDATE kyc_session (priority=HIGH, escalated_at=NOW())
        API->>PG: INSERT notifications (agent_id=jean, type=ESCALATION, timer_minutes=30)
        API-->>BO: 200 OK
    end

    alt Queue Jean > 10 dossiers
        Sylvie->>BO: Clique "Redistribuer charge"
        BO->>API: POST /analytics/redistribute
        API->>PG: SELECT agents disponibles (load-balancing WRR)
        API->>PG: UPDATE dossier_assignments (nouvelle répartition)
        API-->>BO: {redistributed_count: N}
    end
```

---

### SEQ-05 : Résumption Session (Scénario ENEO Blackout)

```mermaid
sequenceDiagram
    actor Marie
    participant PWA
    participant SW as Service Worker
    participant IDB as IndexedDB
    participant API as FastAPI
    participant PG as PostgreSQL

    Note over Marie,PG: [Coupure réseau en plein upload CNI Verso]

    Marie->>PWA: Était à l'étape CNI Verso
    PWA->>SW: Détecte perte réseau
    SW->>IDB: Sauvegarde état session {session_id, step=CNI_VERSO, metadata}
    SW->>IDB: Sauvegarde image capturée (temporaire, chiffrée)
    PWA->>PWA: Affiche: "Connexion perdue. Votre progression est sauvegardée."

    Note over Marie,API: [20 minutes plus tard - réseau rétabli]

    Marie->>PWA: Rouvre l'app
    PWA->>SW: Service Worker intercepte
    SW->>IDB: Récupère session locale {session_id, step, images}
    PWA->>API: GET /kyc/session/{session_id} [avec JWT existant]
    API->>PG: SELECT kyc_session (status, last_step_completed)
    API-->>PWA: {status: DRAFT, last_step: CNI_RECTO_DONE}

    PWA->>PWA: Affiche: "Reprise à l'étape CNI Verso...  Nous avons sauvegardé votre progression."
    Note over PWA: Résumption < 2s (NFR8) 

    Marie->>PWA: Continue - Upload CNI Verso depuis cache local
    PWA->>API: POST /kyc/capture/cni {session_id, side=VERSO, image} [depuis IDB]
    API-->>PWA: 200 + sha256 confirmation
    SW->>IDB: Purge image locale (upload confirmé)
```

---

### SEQ-06 : Messagerie Support — Marie ↔ Jean

```mermaid
sequenceDiagram
    actor Marie
    participant PWA
    participant API as FastAPI
    participant PG as PostgreSQL
    actor Jean

    Note over Marie,Jean: Marie est en access_level: RESTRICTED, statut dossier PENDING_INFO

    Marie->>PWA: Ouvre messagerie support
    PWA->>API: GET /support/threads?session_id={id}
    API->>PG: SELECT messages du thread lié à la session
    API-->>PWA: {thread_id, messages, attachments}
    PWA->>PWA: Affiche historique messages + pièces jointes

    Marie->>PWA: Écrit message + joint nouveau document
    PWA->>API: POST /support/messages {thread_id, text, attachment_b64}
    API->>PG: INSERT message (sender=MARIE, content, attachment_path)
    API->>PG: INSERT notifications (agent_id=jean, type=NEW_MESSAGE)
    API-->>PWA: 200 {message_id}

    Note over API,Jean: [Système route le message vers Jean</br>(agent responsable du dossier)</br>ou agent disponible si Jean absent]

    API->>PG: SELECT dossier_assignment (session_id) → agent responsable
    alt Agent responsable disponible aujourd'hui
        API->>PG: Notif → Jean (agent d'origine)
    else Agent absent toute la journée
        API->>PG: WRR → sélectionne agent disponible
        API->>PG: Notif → nouvel agent assigné
        API->>PG: UPDATE dossier_assignment (agent_id, with_full_dossier=true)
    end

    Jean->>BO: Ouvre notification message
    BO->>API: GET /support/threads/{thread_id}
    API->>PG: SELECT messages + dossier complet du client
    API-->>BO: {messages, dossier_summary, documents_urls}
    BO->>BO: Affiche message + pièces jointes</br>+ dossier complet Marie visible en sidebar

    Jean->>BO: Rédige réponse
    BO->>API: POST /support/messages {thread_id, text, sender=JEAN}
    API->>PG: INSERT message (sender=JEAN)
    API->>PG: INSERT notifications (user_id=marie, type=AGENT_REPLY)
    API-->>BO: 200 OK

    Marie->>PWA: [polling 15s] GET /notifications
    API-->>PWA: {type: AGENT_REPLY}
    PWA->>PWA: Affiche nouveau message Jean
```

---

### SEQ-07 : Marie utilise l'App Post-Onboarding (États d'accès)

> **Nouvelle séquence** — manquait dans la v1.

```mermaid
sequenceDiagram
    actor Marie
    participant PWA
    participant API as FastAPI
    participant PG as PostgreSQL

    Marie->>PWA: Ouvre l'app (login PIN / biométrie)
    PWA->>API: POST /auth/pin/verify {user_id, pin_hash}
    API->>PG: SELECT user + kyc_session (access_level)
    API-->>PWA: {access_token, access_level: RESTRICTED/LIMITED/FULL}

    alt access_level = RESTRICTED
        PWA->>PWA: Affiche dashboard VITRINE
        PWA->>PWA: Banner: "⏳ Dossier en cours de validation"
        PWA->>PWA: Fonctionnalités : read-only, plans, cartes verrouillées
        PWA->>PWA: Messagerie support disponible
    else access_level = LIMITED_ACCESS
        PWA->>PWA: Affiche dashboard avec restrictions
        PWA->>PWA: Banner: "⚠️ Complétez votre NIU pour débloquer tout"
        PWA->>PWA: Dépôts : ✅ | Virements, retraits, cartes : 🔒
    else access_level = FULL_ACCESS
        PWA->>PWA: Affiche dashboard complet
        PWA->>PWA: Tous services disponibles
        PWA->>PWA: Auth Rail BICEC actif
    end

    Note over Marie,PWA: Auth Rail — Accès autres apps BICEC

    Marie->>PWA: Clique sur icône "BiPay" dans section apps
    alt App BiPay installée
        PWA->>PWA: Ouvre BiPay avec token d'identité BICEC
    else App non installée
        PWA->>PWA: Redirige vers Play Store / App Store
        Note over PWA: Dans BiPay, Marie se connecte</br>avec son email/phone + OTP</br>Amplitude reconnaît son identité KYC
    end

    Note over Marie,PWA: Polling notifications

    loop Toutes les 15-30s (foreground)
        PWA->>API: GET /notifications?since={last_timestamp}
        API->>PG: SELECT notifications non lues
        API-->>PWA: {notifications: [...]}
        PWA->>PWA: Affiche badge + centre notifications
    end
```

---

### SEQ-08 : Expiration Document — Flow Jean + Marie

```mermaid
sequenceDiagram
    participant SYS as Système (Celery beat)
    participant PG as PostgreSQL
    actor Jean
    participant BO as Back-Office SPA
    actor Marie
    participant PWA

    Note over SYS,PG: [Job cron quotidien — vérification expiration docs]

    SYS->>PG: SELECT sessions FULL_ACCESS</br>où doc expiry < NOW() + 30 jours
    PG-->>SYS: Liste sessions concernées
    SYS->>PG: INSERT notifications (agent_id=jean, type=DOC_EXPIRY_WARNING)
    SYS->>PG: UPDATE kyc_session (doc_expiry_flag=true)

    Jean->>BO: Reçoit notification expiration
    BO->>API: GET /backoffice/dossiers/{id}/expiry
    API-->>BO: Détail doc expirant + date limite client

    Jean->>BO: Envoie notice au client
    BO->>API: POST /support/messages {text: "Votre CNI expire le XX, veuillez la renouveler"}
    API->>PG: INSERT notification (user_id=marie, type=DOC_EXPIRY_NOTICE, deadline=30j)

    Marie->>PWA: Reçoit notification expiration
    Note over Marie,PWA: Marie a 30 jours pour soumettre nouveau doc

    alt Marie soumet dans le délai
        Marie->>PWA: Upload nouveau document CNI
        PWA->>API: POST /kyc/capture/cni {session_id, new_doc}
        API->>PG: INSERT document (status=PENDING_REVIEW)
        API->>PG: INSERT notifications (agent_id=jean, type=NEW_DOC_SUBMITTED)
        Jean->>BO: Revoit nouveau document
        BO->>API: POST /backoffice/dossiers/{id}/reapprove
        API->>PG: UPDATE kyc_session (doc_expiry_flag=false, status=FULL_ACCESS)
        API->>PG: INSERT audit_log (action=DOC_REAPPROVED)
    else Délai dépassé
        SYS->>PG: UPDATE kyc_session (access_level='RESTRICTED')
        SYS->>PG: INSERT notifications (user_id=marie, type=ACCOUNT_RESTRICTED)
        Note over SYS: Jean peut lever la restriction</br>après nouveau doc validé (J12)
    end
```

---




## 7. Modèle de Données (ERD)

### 7.1 Modèle Conceptuel (CDM)



```mermaid
%%{init: {"theme": "default", "layout": "elk", "themeVariables": {"primaryColor": "#E3F2FD", "primaryTextColor": "#1A237E", "primaryBorderColor": "#1976D2", "lineColor": "#1976D2"}}}%%

erDiagram
    USER ||--o{ KYC_SESSION : "initie"
    USER ||--o{ NOTIFICATION : "reçoit"
    USER ||--o{ OTP_SESSION : "s'authentifie via"

    KYC_SESSION ||--|{ DOCUMENT : "contient"
    KYC_SESSION ||--o| BIOMETRIC_RESULT : "produit"
    KYC_SESSION ||--o{ AML_ALERT : "génère"
    KYC_SESSION ||--o{ DUPLICATE_CHECK : "déclenche"
    KYC_SESSION ||--o| CONSENT_RECORD : "finalise par"
    KYC_SESSION ||--o| DOSSIER_ASSIGNMENT : "assigné à"
    KYC_SESSION ||--o{ VALIDATION_DECISION : "reçoit"
    KYC_SESSION ||--o{ PROVISIONING_BATCH_ITEM : "provisionné dans"
    KYC_SESSION ||--o{ SUPPORT_THREAD : "associé à"

    DOCUMENT ||--|{ OCR_FIELD : "extrait en"

    AGENT ||--o{ DOSSIER_ASSIGNMENT : "traite"
    AGENT ||--o{ VALIDATION_DECISION : "émet"
    AGENT }|--|| AGENCY : "appartient à"

    PROVISIONING_BATCH ||--|{ PROVISIONING_BATCH_ITEM : "contient"

    PEP_SANCTIONS ||--o{ AML_ALERT : "déclenche"
    SUPPORT_THREAD ||--|{ SUPPORT_MESSAGE : "contient"

    AUDIT_LOG }|--|| USER : "tracé par"
```
![cdm](https://mermaid.ink/svg/pako:eNp9ld9uokAUxl-FzMbsjW2KaBXuKIwtqUoj2KQbEjKV0U4WZ8wATbvIu-zdrs_hi-3wz4qrGhMd5vudOeeb4zEFcxZgoIFWKyWUxJqUeiB-wyvsAU3yQIAXKAljD7TFIkSfLIk1D-DwZ_mkUD4jTtBriKMcEfiakxXinwYLGS-jfIPKsDM0S6badvFHfCiR9Y7Shw3JHeMB5g2R2r81O1U2hOJTe1mWtVoe9SjmJkFLjlYelcRr5sCptNlcXbFUenwxfAc6jmVPpBzOSyei5P-VE9u1hpahu7WU490fRuJTWtt9akSNvqNEOERjsiBYeicoh0rsMIGc3qSSaRuzMZy4BTpnghJkfcyxnm2kO8seQ3dqGf4UOrNRya05CxJyHkslfTzy9RGclvrlbkt3fzm-AJizp1FuAPSNB2g8Fliw285DTOdv-EKChj1xRD0iPcOemgW3IBSFJMLSGvELpGmLJZz6uvi4n-xNQVFElnS3lXa_L-T7rI8ss7gv34SG5Zy5uJPWiErdmQn9O901HnzLhePa1XcSEUbzwwNEo6-L3N9adYu2MfWHFhyV9Yoe54jEEqZfhH5fy3NzT1daUHtvG8S58nbbFY6bRJantCkWxkvp4FoYXzRW5WElbxZe13LWj8PuLCM8QdH6-sTI83JOt1qzZ6qDZ6bl-iP7vs61-DlVDsyF2UWfgDZYchIALeYJboMV5iuUL0GaR2nMq1cUiW_t8nk5r8qNcmQd6I-mVpHO5dl1pDk7wI50F6ZYrTw3yvL9zKPiLSxYI_qDsVXtAmfJ8g1oCxRGYpWsAxTjat7tJZgWJyc0BtptV-kVQYCWgg-gXfXU65vejdzrdJWuKquqfNsGn0CTB8p1ZyCrA0VWux2518_a4Fdxrnyt9AYDuT-Qu11VUeQbEQ8HJGZ8XP6HiLZYkCXI_gG5bfGX)

---

### 7.2 Modèle Logique (LDM) — Tables OLTP

```mermaid
%%{init: {"theme": "default", "layout": "elk", "themeVariables": {"primaryColor": "#E3F2FD", "primaryTextColor": "#1A237E", "primaryBorderColor": "#1976D2", "lineColor": "#1976D2"}}}%%
erDiagram
    users {
        UUID id PK
        VARCHAR(20) phone UK
        VARCHAR(255) email UK
        VARCHAR(255) pin_hash
        BOOLEAN biometric_opt_in
        VARCHAR(10) language
        INT liveness_lockout_count_24h
        TIMESTAMPTZ last_lockout_reset_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    kyc_sessions {
        UUID id PK
        UUID user_id FK
        UUID agency_id FK
        TEXT status
        TEXT access_level
        TEXT niu_type
        DECIMAL confidence_score_global
        INT liveness_strike_count
        BOOLEAN priority_flag
        BOOLEAN doc_expiry_flag
        TIMESTAMPTZ doc_expiry_deadline
        TIMESTAMPTZ doc_expiry_notified_at
        TIMESTAMPTZ escalated_at
        TIMESTAMPTZ started_at
        TIMESTAMPTZ submitted_at
        TIMESTAMPTZ completed_at
        TEXT last_step_completed
        INET submission_ip
    }

    documents {
        UUID id PK
        UUID session_id FK
        TEXT doc_type
        TEXT file_path
        TEXT sha256_hash
        TEXT ocr_engine
        JSONB ocr_raw_json
        JSONB confidence_per_field
        JSONB capture_quality_metrics
        TIMESTAMPTZ captured_at
        INT file_size_bytes
    }

    ocr_fields {
        UUID id PK
        UUID document_id FK
        TEXT field_name
        TEXT extracted_value
        DECIMAL confidence_score
        BOOLEAN human_corrected
        TEXT corrected_value
        UUID corrected_by_agent_id FK
        TIMESTAMPTZ corrected_at
    }

    biometric_results {
        UUID id PK
        UUID session_id FK
        DECIMAL face_match_score
        DECIMAL liveness_score
        DECIMAL anti_spoofing_score
        TEXT model_version_face
        TEXT model_version_liveness
        TIMESTAMPTZ processed_at
    }

    agents {
        UUID id PK
        UUID agency_id FK
        VARCHAR(100) name
        VARCHAR(255) email UK
        TEXT password_hash
        TEXT role
        INT static_weight
        INT current_weight
        BOOLEAN is_available
        INT active_dossier_count
        TIMESTAMPTZ last_activity_at
    }

    agencies {
        UUID id PK
        VARCHAR(100) name
        VARCHAR(100) city
        VARCHAR(100) region
        VARCHAR(100) commune
        VARCHAR(100) quartier
        BOOLEAN is_active
        TIMESTAMPTZ created_at
    }

    dossier_assignments {
        UUID id PK
        UUID session_id FK
        UUID agent_id FK
        TIMESTAMPTZ assigned_at
        TIMESTAMPTZ completed_at
        BOOLEAN is_current
    }

    validation_decisions {
        UUID id PK
        UUID session_id FK
        UUID agent_id FK
        TEXT decision
        TEXT reason
        INET agent_ip
        TIMESTAMPTZ decided_at
    }

    aml_alerts {
        UUID id PK
        UUID session_id FK
        UUID pep_sanctions_id FK
        TEXT alert_type
        DECIMAL match_score
        TEXT status
        UUID cleared_by FK
        TEXT justification
        TIMESTAMPTZ created_at
        TIMESTAMPTZ resolved_at
    }

    pep_sanctions {
        UUID id PK
        TEXT source
        TEXT entity_type
        TEXT full_name
        TEXT[] aliases
        DATE date_of_birth
        TEXT nationality
        TEXT[] programs
        BOOLEAN is_active
        DATE last_synced_at
    }

    duplicate_checks {
        UUID id PK
        UUID session_id_new FK
        UUID session_id_existing FK
        TEXT match_type
        TEXT resolution
        UUID resolved_by FK
        TIMESTAMPTZ resolved_at
    }

    consent_records {
        UUID id PK
        UUID session_id FK
        BOOLEAN cgu_accepted
        BOOLEAN privacy_accepted
        BOOLEAN data_processing_accepted
        TEXT consent_method
        VARCHAR cgu_version
        VARCHAR privacy_version
        JSONB consent_metadata
        TIMESTAMPTZ signed_at
        INET client_ip
    }

    otp_sessions {
        UUID id PK
        VARCHAR(20) phone
        VARCHAR(255) email
        TEXT code_hash
        TIMESTAMPTZ expires_at
        INT attempts
        BOOLEAN is_used
        INET request_ip
    }

    provisioning_batches {
        UUID id PK
        UUID created_by FK
        TIMESTAMPTZ created_at
        TEXT status
        TEXT error_type
        TEXT error_detail
        INT retry_count
    }

    provisioning_batch_items {
        UUID id PK
        UUID batch_id FK
        UUID session_id FK
        TEXT status
        TEXT axway_request_id
        TEXT iso20022_message_ref
        JSONB axway_response
        TIMESTAMPTZ processed_at
    }

    notifications {
        UUID id PK
        UUID user_id FK
        TEXT type
        TEXT message
        JSONB payload
        BOOLEAN is_read
        TIMESTAMPTZ sent_at
        TIMESTAMPTZ read_at
    }

    audit_log {
        BIGSERIAL id PK
        TEXT table_name
        TEXT record_id
        TEXT action
        JSONB old_data
        JSONB new_data
        TEXT changed_fields
        TEXT performed_by
        TIMESTAMPTZ performed_at
        INET client_ip
    }

    support_threads {
        UUID id PK
        UUID session_id FK
        TIMESTAMPTZ created_at
        TEXT status
    }

    support_messages {
        UUID id PK
        UUID thread_id FK
        TEXT sender_type
        UUID sender_id
        TEXT content
        TEXT attachment_path
        TEXT attachment_sha256
        TIMESTAMPTZ sent_at
        TIMESTAMPTZ read_at
    }

    kyc_sessions ||--o{ support_threads : "session_id"
    support_threads ||--|{ support_messages : "thread_id"

    users ||--o{ kyc_sessions : "user_id"
    users ||--o{ notifications : "user_id"
    users ||--o{ otp_sessions : "phone/email"
    kyc_sessions ||--|{ documents : "session_id"
    kyc_sessions ||--o| biometric_results : "session_id"
    kyc_sessions ||--o{ aml_alerts : "session_id"
    kyc_sessions ||--o{ duplicate_checks : "session_id_new"
    kyc_sessions ||--o| consent_records : "session_id"
    kyc_sessions ||--o{ dossier_assignments : "session_id"
    kyc_sessions ||--o{ validation_decisions : "session_id"
    kyc_sessions ||--o{ amplitude_batch_items : "session_id"
    documents ||--|{ ocr_fields : "document_id"
    agents ||--o{ dossier_assignments : "agent_id"
    agents ||--o{ validation_decisions : "agent_id"
    agencies ||--o{ agents : "agency_id"
    agencies ||--o{ kyc_sessions : "agency_id"
    provisioning_batches ||--|{ provisioning_batch_items : "batch_id"
    pep_sanctions ||--o{ aml_alerts : "pep_sanctions_id"
```

> **Contraintes CHECK à ajouter en DDL :**
> ```sql
> -- Sur kyc_sessions
> status CHECK IN ('DRAFT','PENDING_KYC','PENDING_INFO','COMPLIANCE_REVIEW',
>                  'READY_FOR_OPS','PROVISIONING','OPS_ERROR','OPS_CORRECTION',
>                  'VALIDATED_PENDING_AGENCY','ACTIVATED_LIMITED','ACTIVATED_PRE_FULL',
>                  'ACTIVATED_FULL','EXPIRY_WARNING','PENDING_RESUBMIT',
>                  'MONITORED','REJECTED','DISABLED','ABANDONED')
> access_level CHECK IN ('RESTRICTED','LIMITED_ACCESS','PRE_FULL_ACCESS',
>                         'FULL_ACCESS','BLOCKED','PENDING_ACTIVATION')
> -- Sur agents (Jean,Thomas,Sylvie)
> role CHECK IN ('AGENT','CONFORMITY','STAKEHOLDER')
> ```
> Trigger PostgreSQL validant les combinaisons `(status, access_level)` légales selon la matrice du §5.

![LDM](mermaid.ink/svg/pako:eNrVWW1v2zYQ_iuGhgArkHaJ0ySOv-XF3bI1bdG6xdB5IGiJltlSpEpSSdwk_31HSoolknKUpl8WFCisO5J3z72TN1EsEhKNo62tG8qpHg9uZpFekozMovFgFiVkgQumZ9E2_GB4JQo9nkWEfS2_WM5PWFI8Z0SZJbA8lzTDcnUqmJDlLr9M9l4NX52VayrylFzrJsvu8XDvcNJiOREyIbLFdHR4cDaspKGchGh3d3dbWzM-4_1VKgn_B62IPKM4lTib8QH8FYpIBdLZH-bv48fzswFNBu_-Wn_7dPz-9I_j978Od54N8qXgZPAxRN3ffzYgGaasm5xTjpZYLdfkk7dvX0-O3wzmVGRESxojkWtEub_BLpzOME8LnJI1dXp-MfkwPb54N_08iCXBmiQI6zC9yJMW_W5WHfN1FSNFlKKCPwiG_WZgQ0B45RJANh6vXNJ08vd0oDTWhXI-4jiGcxEjl4Q5JE4LpFd5Q9ezyen5xfHrQSz4giZwEEEqFpKglIk5bqw_fzMdMHpJuNlbAapfCYpFwbWPO_iUkFSv0ILh1CcnIkbkOqfSZWji2mBKCE6MBz7IyIWmC7rBWETFmG00JwAqN9KLeUb1Jo5YZDkjHodBn2GlATqSo3umJr6Tabm99RlEc8ehQNEiI1z386bK9YJeYyBre4H9vKCMoBzrpetkSzzcP3BizFJELBHhacs2f354--bEUiS-Ql-U4C6t4Wo5uDxYjCUeD851AV74rcDMeFIZx6oD8pK5jbjxV6uRot8Jmq80UQ6gRkZ7eD9Ea_yDkNp9EMeZCyqkXolj4w6XmBU9As-Pl2WRYQ4uIyWJWy5jD7j_7h5ghV5T5ytkEokvfst3a24vna1zqSQKKtWTvLDWfYFB6wzreOnqXnOsM06YjrmmSOVCLChPXSaLTwatBEOXUJKMIObEjQz1gWGAcilMbg0BZMHth0o4oa9rEhSltic9UA6tGjlW6gqqeChOpWCkHRmmcIAtrwhNl07QxAU4AfiJS6vdkSqEL0EE04e0V4KfA3ooEWB0CGynOjRxtJnQspvgDmIZU9K7idgAmSXFcEoHSZKUCt61TmRZwbt2hdwkNSgahshi0a-naKT4EjkwJU35k5P9vbNtDPrysEdXtIaulcc4ykA6otAbGbkSEtP-jdDjtbFFrTrDdX2CWyXIltlql7yjo4CdkmCIZwxhRuRPsEoOTYDCPDbwqKA-9qCOZi2YMoMNYVkEGMHSlgD_mC-FMk1TbA31Yy0wFATBLkOAtbR8CLNSflFIL0ODsUyaCLUsBWOBqvvPvwAfxYo0kDg7nk4GpldHYoHmVHptDrcQ2HbD2w3yvplvVK9QtyeVvd4KynoozoucGcihg16S-Otj3QlxcuW7VINOrilYlae-uUvPCSBpjVi0ncBue29d13t6eQB0N8rEGrQVUJueFDc14nFaIDPi5K1eqDF7XGIort0c4AMYVYXcNA0-Z5lPaEo1ZsgkR2x7Uac1bk4FfgK1eSZmtJlo1p2nznvPht6gvKkt8HrDhLj9QHMcMmMTUV7bjGHAyXId9nYYU92pRZJvBVEBPTEUDqoLEGJu_I70s3-dbzY4XDAldQ7EREohQ05fEhKiW9AZCCT0uqtmB9OlE6KAVT-9Kv5kU-g-POKX89FaCjBgboLs0Q1rOS2Xif_HbyisjAFoMzi1dalSyp3jFRM4CXoW2DTpiC8TRd3lB4dqdZFQjZhIm5qdnP_-YfL-HCpoqPZo09GGZrgyeYHm3kVLO19Woy8MgibHuN8haTvfyxhdYp6CfcpJ1G3qiVwImdlg6DDwPUfv7KOKPBemt1ga6J52nfDYmPSEqPyknxSlxOEwITwhbpBXolsK9Qdnrgl3hYXch-OlnfMDVyENankr8tP8tXVdeHv7_Lm48Qxl7l7XhphFYXOaxbc3PsBje4lcAWgWN29rqxNbUpgFVcjXZ7WY2wnkIe5WzTPMtpj9VpatqAME0GN97RVW3wfuNnBZ0XftTbPJ77_Ia-jaS03Dtklet0t6xMGBibH_6uCI9hioQqUwvH5txsqujds3-wCyvl2rl1Q3Kg9oWk-E4VWdGoaW2SuHWre0dYK9runi9aLGX-E1QhUK3RDW3UK9RXuWCjurO1XOomg7SiVNorGWBdmOMiIh3uBnZNNt6wlqDvPSLNouv_tPUA1-5xXKirf5Lcrh6XyQcvg2vErVnF1PU4YOyRX-AQQ55p-FyGoUpCjSZTReYKbgV_mCU71g3X-VtmqcmgYwGh-MDvfsLtH4JrqOxs-Hh0cv9od7e6Ph7mj_6OUeUFfm887wxcHh7uHuy9HL4Q78N7zbjr7bk3dfjA6PRvujg4P9vcPhzsFotB0RaFGEvCjfOu2T591_zYjNqQ)
---

### 7.3 Data Dictionary (Champs critiques)

| Table                      | Champ                        | Type         | Contrainte           | Description                                     | Exemple                                                                   |
| -------------------------- | ---------------------------- | ------------ | -------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| `kyc_sessions`             | `status`                     | TEXT         | NOT NULL             | État machine KYC                                | `PENDING_KYC`                                                             |
| `kyc_sessions`             | `access_level`               | TEXT         | DEFAULT 'RESTRICTED' | Niveau accès compte                             | `LIMITED_ACCESS`                                                          |
| `kyc_sessions`             | `niu_type`                   | TEXT         | NULL                 | Mode NIU                                        | `DECLARATIVE`, `UPLOADED`, `MISSING`                                      |
| `kyc_sessions`             | `confidence_score_global`    | DECIMAL(5,4) | NULL                 | Score global dossier (0-1)                      | `0.8750`                                                                  |
| `kyc_sessions`             | `liveness_strike_count`      | INT          | DEFAULT 0            | Nombre échecs liveness                          | `2`                                                                       |
| `consent_records`          | `consent_method`             | TEXT         | NOT NULL             | Modalité de consentement                        | `CHECKBOX_DIGITAL`, `PAPER_SCAN`                                          |
| `consent_records`          | `cgu_version`                | VARCHAR      | DEFAULT '1.0.0'      | Version CGU lors du consentement (Loi 2024-017) | `"1.0.0"`, `"1.1.0"`                                                      |
| `consent_records`          | `privacy_version`            | VARCHAR      | DEFAULT '1.0.0'      | Version politique vie privée                    | `"1.0.0"`                                                                 |
| `consent_records`          | `consent_metadata`           | JSONB        | NULL                 | Métadonnées consentement                        | `{"user_agent": "...", "screen_resolution": "..."}`                       |
| `users`                    | `liveness_lockout_count_24h` | INT          | DEFAULT 0            | Compteur lockouts 24h                           | `2` (max 30 avant blocage)                                                |
| `users`                    | `last_lockout_reset_at`      | TIMESTAMPTZ  | NULL                 | Dernier reset du compteur                       | `2026-03-05T00:00:00Z`                                                    |
| `provisioning_batch_items` | `axway_request_id`           | TEXT         | NULL                 | ID requête Axway                                | `axw-req-abc123`                                                          |
| `provisioning_batch_items` | `iso20022_message_ref`       | TEXT         | NULL                 | Référence message ISO 20022                     | `acmt.009-20260305-001`                                                   |
| `documents`                | `doc_type`                   | TEXT         | NOT NULL             | Type document                                   | `CNI_RECTO`, `CNI_VERSO`, `BILL_ENEO`, `SELFIE`, `NIU`                    |
| `documents`                | `ocr_engine`                 | TEXT         | NULL                 | Moteur OCR utilisé                              | `PADDLE`, `GLM`, `PADDLE_THEN_GLM`                                        |
| `documents`                | `capture_quality_metrics`    | JSONB        | NULL                 | Métriques qualité capture                       | `{"laplacian": 145, "luminance_std": 0.32}`                               |
| `ocr_fields`               | `confidence_score`           | DECIMAL(5,4) | NOT NULL             | Confiance extraction                            | `0.9200` ( ≥0.85)                                                         |
| `agents`                   | `role`                       | TEXT         | NOT NULL             | Rôle agent back-office                          | `JEAN`, `THOMAS`, `SYLVIE`                                                |
| `agents`                   | `static_weight`              | INT          | DEFAULT 1            | Poids WRR statique                              | `2` (agent senior)                                                        |
| `aml_alerts`               | `alert_type`                 | TEXT         | NOT NULL             | Type alerte                                     | `PEP`, `SANCTIONS_UN`, `SANCTIONS_EU`, `SANCTIONS_OFAC`                   |
| `aml_alerts`               | `status`                     | TEXT         | DEFAULT 'OPEN'       | État alerte                                     | `OPEN`, `CLEARED`, `CONFIRMED`, `ESCALATED`                               |
| `pep_sanctions`            | `entity_type`                | TEXT         | NOT NULL             | Type entité                                     | `INDIVIDUAL`, `ENTITY`                                                    |
| `audit_log`                | `action`                     | TEXT         | NOT NULL             | Type action                                     | `INSERT`, `UPDATE`, `DELETE`, `VIEW`, `OCR_CORRECTED`, `DOSSIER_APPROVED` |
| `audit_log`                | `old_data`                   | JSONB        | NULL                 | État avant modification                         | `{"status": "PENDING_KYC"}`                                               |

---

### 7.4 Star Schema Analytics (DWH)

```mermaid
erDiagram
    fact_kyc_sessions {
        UUID session_id PK
        UUID user_dim_id FK
        UUID agency_dim_id FK
        UUID time_dim_id FK
        TEXT final_status
        INT total_duration_seconds
        INT cni_capture_duration_s
        INT liveness_duration_s
        INT ocr_processing_duration_s
        INT validation_duration_s
        INT liveness_strikes
        DECIMAL ocr_confidence_avg
        DECIMAL face_match_score
        TEXT niu_type
        TEXT ocr_engine_used
        BOOLEAN human_correction_needed
        TEXT dropout_step
    }

    fact_analytics_events {
        BIGSERIAL id PK
        UUID session_id FK
        UUID user_dim_id FK
        UUID time_dim_id FK
        TEXT event_name
        TEXT step_name
        INT duration_ms
        TEXT device_info
        TEXT error_code
        JSONB extra_props
    }

    fact_validation_actions {
        UUID id PK
        UUID session_id FK
        UUID agent_dim_id FK
        UUID time_dim_id FK
        TEXT decision
        INT validation_duration_seconds
        BOOLEAN sla_met
        INT sla_remaining_minutes
        BOOLEAN ocr_correction_made
    }

    dim_users {
        UUID id PK
        TEXT phone_prefix
        TEXT city
        TEXT region
        TEXT language
        DATE cohort_month
    }

    dim_agents {
        UUID id PK
        TEXT name
        TEXT role
        UUID agency_id FK
        INT static_weight
    }

    dim_agencies {
        UUID id PK
        TEXT name
        TEXT city
        TEXT region
    }

    dim_time {
        UUID id PK
        TIMESTAMPTZ full_timestamp
        DATE date
        INT hour
        INT day_of_week
        INT week
        INT month
        INT year
    }

    fact_kyc_sessions }|--|| dim_users : "user_dim_id"
    fact_kyc_sessions }|--|| dim_agencies : "agency_dim_id"
    fact_kyc_sessions }|--|| dim_time : "time_dim_id"
    fact_analytics_events }|--|| dim_users : "user_dim_id"
    fact_analytics_events }|--|| dim_time : "time_dim_id"
    fact_validation_actions }|--|| dim_agents : "agent_dim_id"
    fact_validation_actions }|--|| dim_time : "time_dim_id"
    dim_agents }|--|| dim_agencies : "agency_id"
```

### 7.5 Legende
Notation Mermaid :

||--o{ signifie : un à plusieurs (0 ou plus)
||--|{ signifie : un à au moins un (1 ou plus)
||--o| signifie : un à zéro ou un
}|--|| signifie : plusieurs à exactement un

---

## 8. API Contract (FastAPI)

### 8.1 Auth

| Méthode | Endpoint                        | Body                        | Réponse                      | Description                     | Rate Limit                                                 |
| ------- | ------------------------------- | --------------------------- | ---------------------------- | ------------------------------- | ---------------------------------------------------------- |
| POST    | `/api/v1/auth/otp/send`         | `{phone?, email?, channel}` | `{expires_in: 300}`          | Envoi OTP (SMS Orange ou Email) | **5/15min → 429** ; lock 30min après 5 échecs vérification |
| POST    | `/api/v1/auth/otp/verify`       | `{phone?, email?, code}`    | `{access_token, session_id}` | Vérifie OTP, crée session JWT   | 5 tentatives max                                           |
| POST    | `/api/v1/auth/pin/setup`        | `{session_id, pin_hash}`    | `{success}`                  | Setup PIN 6 chiffres            | —                                                          |
| POST    | `/api/v1/auth/pin/verify`       | `{user_id, pin_hash}`       | `{access_token}`             | Login récurrent par PIN         | —                                                          |
| POST    | `/api/v1/auth/backoffice/login` | `{email, password}`         | `{access_token, role}`       | Login agents back-office        | —                                                          |
| POST    | `/api/v1/auth/refresh`          | `{}`                        | `{access_token}`             | Refresh JWT                     | —                                                          |
| POST    | `/api/v1/auth/logout`           | `{}`                        | `{success}`                  | Invalide token                  | —                                                          |

### 8.2 KYC — Marie

| Méthode | Endpoint                    | Body                                                             | Réponse                                                | Description                                    |
| ------- | --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| POST    | `/api/v1/kyc/session/start` | `{user_id}`                                                      | `{session_id, status}`                                 | Crée session KYC                               |
| GET     | `/api/v1/kyc/session/{id}`  | —                                                                | `{session, last_step, status}`                         | Récupère état session (résumption)             |
| POST    | `/api/v1/kyc/capture/cni`   | `{session_id, side, image_b64}`                                  | `{ocr_fields, confidence_map, doc_id}`                 | Upload + OCR CNI — **413 si payload >10MB**    |
| POST    | `/api/v1/kyc/capture/bill`  | `{session_id, bill_type, image_b64}`                             | `{agency_name, date, address, doc_id}`                 | Upload + GLM-OCR facture                       |
| POST    | `/api/v1/kyc/capture/niu`   | `{session_id, mode, value/image_b64}`                            | `{niu_status, access_impact}`                          | Upload ou déclaration NIU                      |
| POST    | `/api/v1/kyc/liveness`      | `{session_id, landmarks_json}`                                   | `{liveness_pass, face_match_score, strikes_remaining}` | Check liveness + face match                    |
| POST    | `/api/v1/kyc/ocr/confirm`   | `{session_id, doc_id, fields}`                                   | `{success}`                                            | Confirme/corrige extraction OCR                |
| POST    | `/api/v1/kyc/address`       | `{session_id, region, ville, commune, quartier, lieu_dit, gps?}` | `{success}`                                            | Sauvegarde adresse                             |
| POST    | `/api/v1/kyc/submit`        | `{session_id, consent_record}`                                   | `{message, estimated_delay}`                           | Soumission finale — **409 si status != DRAFT** |

### 8.2bis — Tailles Payload & Compression Client

> **Comportement côté PWA (service de capture) :** L'image capturée par `getUserMedia` est redimensionnée et compressée *avant* envoi pour garantir des temps de transfert acceptables sur réseau 3G/4G camerounais.

```
Image capturée par getUserMedia (résolution native mobile)
    → Canvas resize : max 1920×1080 (conserve ratio)
    → JPEG encode   : qualité 88%
    → Taille estimée : 300KB – 800KB (CNI bien éclairée)
    → Conversion base64 pour envoi API
    → Taille payload : ~400KB – 1.1MB (×1.37 overhead base64)
```

| Endpoint                           | Taille nominale attendue | Limite serveur (filet sécurité) |
| ---------------------------------- | ------------------------ | ------------------------------- |
| `POST /kyc/capture/cni`            | ~400KB–1.1MB             | **10MB** (413)                  |
| `POST /kyc/capture/bill`           | ~300KB–900KB             | **10MB** (413)                  |
| `POST /kyc/liveness`               | ~15KB (landmarks JSON)   | **100KB** (413)                 |
| `POST /support/messages` (avec PJ) | ~500KB–2MB               | **5MB** (413)                   |

> Une image >10MB après compression cliente indique un bug côté client (format non comprimé). La limite serveur est un dernier rempart, pas une cible.

### 8.3 Back-Office — Jean

| Méthode | Endpoint                                        | Description                                             |
| ------- | ----------------------------------------------- | ------------------------------------------------------- |
| GET     | `/api/v1/backoffice/dossiers`                   | Queue dossiers (filtres: status, priority, agent_id)    |
| GET     | `/api/v1/backoffice/dossiers/{id}`              | Détail complet + liens documents (JWT+RBAC)             |
| GET     | `/api/v1/documents/{session_id}/{filename}`     | Récupère fichier image (JWT+RBAC, remplace signed URLs) |
| POST    | `/api/v1/backoffice/dossiers/{id}/approve`      | Approuve dossier (Jean)                                 |
| POST    | `/api/v1/backoffice/dossiers/{id}/reject`       | Rejette avec motif (Jean)                               |
| POST    | `/api/v1/backoffice/dossiers/{id}/request-info` | Demande doc supplémentaire → notification Marie         |
| POST    | `/api/v1/backoffice/dossiers/{id}/override-ocr` | Correction manuelle champ OCR + justification           |

### 8.4 AML — Thomas

| Méthode | Endpoint                            | Description                                        |
| ------- | ----------------------------------- | -------------------------------------------------- |
| GET     | `/api/v1/aml/alerts`                | Liste alertes PEP/Sanctions actives                |
| GET     | `/api/v1/aml/alerts/{id}`           | Détail alerte (profil vs liste sanctions)          |
| POST    | `/api/v1/aml/alerts/{id}/clear`     | Efface faux positif + justification obligatoire    |
| POST    | `/api/v1/aml/alerts/{id}/confirm`   | Confirme match → gel compte                        |
| POST    | `/api/v1/aml/alerts/{id}/monitor`   | Marque PEP confirmé → MONITORED (actif, surveillé) |
| POST    | `/api/v1/aml/alerts/{id}/escalate`  | Escalade pour revue supérieure                     |
| GET     | `/api/v1/aml/conflicts`             | File déduplication (doublons détectés)             |
| POST    | `/api/v1/aml/conflicts/{id}/merge`  | Fusionne profils (B1: même personne)               |
| POST    | `/api/v1/aml/conflicts/{id}/reject` | Flagge fraude (B2: noms différents)                |

### 8.5 Admin — Thomas & Agencies

| Méthode | Endpoint                         | Description                       |
| ------- | -------------------------------- | --------------------------------- |
| GET     | `/api/v1/admin/agencies`         | Liste agences                     |
| POST    | `/api/v1/admin/agencies`         | Crée agence                       |
| PUT     | `/api/v1/admin/agencies/{id}`    | Modifie agence                    |
| DELETE  | `/api/v1/admin/agencies/{id}`    | Désactive agence                  |
| GET     | `/api/v1/admin/batch`            | Statuts batches provisioning      |
| POST    | `/api/v1/admin/batch/create`     | Lance batch provisioning (Thomas) |
| POST    | `/api/v1/admin/batch/{id}/retry` | Relance batch en erreur           |

### 8.6 Analytics — Sylvie

| Méthode | Endpoint                                  | Description                                              |
| ------- | ----------------------------------------- | -------------------------------------------------------- |
| GET     | `/api/v1/analytics/health`                | Santé système R/Y/G (queue, SLA, uptime, OCR accuracy)   |
| GET     | `/api/v1/analytics/funnel`                | Funnel drop-off par étape (paramètre: period)            |
| GET     | `/api/v1/analytics/sla`                   | Dashboard SLA agents (violations, moyennes)              |
| GET     | `/api/v1/analytics/agents`                | Charge agents (WRR current weights, active counts)       |
| POST    | `/api/v1/analytics/escalate/{dossier_id}` | Escalade Sylvie → flag HIGH_PRIORITY + notif Jean        |
| POST    | `/api/v1/analytics/redistribute`          | Redistribue dossiers par load balancing WRR              |
| GET     | `/api/v1/analytics/ocr-quality`           | Métriques OCR (confidence distribution, engine accuracy) |
| POST    | `/api/v1/audit/export/{session_id}`       | Export pack COBAC (PDF + JSON + images)                  |

### 8.7 Notifications — Marie

| Méthode | Endpoint                                  | Description                                                             |
| ------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| GET     | `/api/v1/notifications?after_id={cursor}` | Polling cursor-based — retourne nouvelles notifications + `next_cursor` |
| POST    | `/api/v1/notifications/{id}/read`         | Marque notification lue                                                 |

### 8.8 Schéma d'erreur standard (toutes routes)

```json
{
  "error": {
    "code": "OTP_RATE_LIMIT_EXCEEDED",
    "message": "Trop de tentatives. Réessayez dans 15 minutes.",
    "retry_after_seconds": 900,
    "request_id": "req_abc123"
  }
}
```

| Code HTTP | Code erreur métier          | Déclencheur                         |
| --------- | --------------------------- | ----------------------------------- |
| 400       | `VALIDATION_ERROR`          | Champ manquant ou format incorrect  |
| 401       | `TOKEN_EXPIRED`             | JWT expiré                          |
| 401       | `TOKEN_INVALID`             | JWT invalide ou falsifié            |
| 403       | `RBAC_DENIED`               | Rôle insuffisant                    |
| 409       | `SESSION_ALREADY_SUBMITTED` | Double-soumission `/kyc/submit`     |
| 413       | `PAYLOAD_TOO_LARGE`         | Image >10MB                         |
| 422       | `OCR_ALL_FIELDS_FAILED`     | Confidence = 0% sur tous les champs |
| 429       | `OTP_RATE_LIMIT_EXCEEDED`   | >5 envois OTP/15min                 |
| 429       | `LIVENESS_LOCKOUT`          | 3 strikes consécutifs               |
| 500       | `INTERNAL_ERROR`            | Erreur serveur non anticipée        |
| 503       | `OCR_SERVICE_UNAVAILABLE`   | PaddleOCR ou GLM-OCR indisponible   |

### 8.9 Support Messagerie — Marie ↔ Jean

| Méthode | Endpoint                                  | Description                                          |
| ------- | ----------------------------------------- | ---------------------------------------------------- |
| GET     | `/api/v1/support/threads?session_id={id}` | Liste threads support d'une session                  |
| POST    | `/api/v1/support/threads`                 | Ouvre un nouveau thread                              |
| GET     | `/api/v1/support/threads/{id}`            | Lit les messages d'un thread                         |
| POST    | `/api/v1/support/messages`                | Envoie un message (texte + pièce jointe optionnelle) |

---

## 9. Infrastructure Docker Compose

```yaml
# docker-compose.yml — bicec-veripass MVP
# WSL2 RAM cap: 8GB via .wslconfig

version: '3.8'

networks:
  veripass-net:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  documents_storage:  # Images CNI, selfies, factures — 10 ans COBAC
  nginx_certs:

services:

  #  REVERSE PROXY 
  nginx:
    image: nginx:alpine
    container_name: vp_nginx
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - nginx_certs:/etc/ssl/certs
    depends_on:
      - api
      - pwa
      - backoffice
    networks:
      - veripass-net
    restart: unless-stopped

  #  PWA MARIE 
  pwa:
    build:
      context: ./frontend/pwa
      dockerfile: Dockerfile
    container_name: vp_pwa
    environment:
      - VITE_API_URL=https://localhost/api
    networks:
      - veripass-net
    restart: unless-stopped
    # RAM: ~128MB (nginx serve static)

  #  BACK-OFFICE SPA 
  backoffice:
    build:
      context: ./frontend/backoffice
      dockerfile: Dockerfile
    container_name: vp_backoffice
    environment:
      - VITE_API_URL=https://localhost/api
    networks:
      - veripass-net
    restart: unless-stopped
    # RAM: ~128MB

  #  FASTAPI BACKEND 
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: vp_api
    environment:
      - DATABASE_URL=postgresql+asyncpg://vp_user:${DB_PASSWORD}@postgres:5432/veripass
      - REDIS_URL=redis://redis:6379/0
      - STORAGE_PATH=/data/documents
      - JWT_SECRET=${JWT_SECRET}
      - ORANGE_SMS_CLIENT_ID=${ORANGE_SMS_CLIENT_ID}
      - ORANGE_SMS_CLIENT_SECRET=${ORANGE_SMS_CLIENT_SECRET}
      - OCR_CONFIDENCE_THRESHOLD=0.85
      - PADDLE_LAZY_LOAD=true   # PaddleOCR chargé à la 1ère requête OCR
    volumes:
      - documents_storage:/data/documents
    depends_on:
      - postgres
      - redis
    networks:
      - veripass-net
    restart: unless-stopped
    mem_limit: 2.5g     # PaddleOCR lazy (2GB) + FastAPI workers (512MB)
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      start_period: 60s
    # GLM-OCR via worker Celery séparé

  #  CELERY WORKERS 
  celery_ocr:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: vp_celery_ocr
    command: celery -A app.celery worker -Q glm_ocr_jobs --concurrency=1 -n ocr_worker@%h
    environment:
      - DATABASE_URL=postgresql+asyncpg://vp_user:${DB_PASSWORD}@postgres:5432/veripass
      - REDIS_URL=redis://redis:6379/0
      - STORAGE_PATH=/data/documents
      - GLM_LAZY_LOAD=true      # GLM-OCR chargé à la 1ère tâche de la queue
    volumes:
      - documents_storage:/data/documents
    depends_on:
      api:
        condition: service_healthy  # Ne démarre qu'après API prête
    networks:
      - veripass-net
    restart: unless-stopped
    mem_limit: 3.5g     # GLM-OCR 0.9B quantifié: 2.5-3.5GB RAM lazy
    # Séquentiel obligatoire (concurrency=1)

  celery_notifications:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: vp_celery_notif
    command: celery -A app.celery worker -Q notifications,provisioning_batch,sanctions_sync --concurrency=2 -n notif_worker@%h
    environment:
      - DATABASE_URL=postgresql+asyncpg://vp_user:${DB_PASSWORD}@postgres:5432/veripass
      - REDIS_URL=redis://redis:6379/0
      - ORANGE_SMS_CLIENT_ID=${ORANGE_SMS_CLIENT_ID}
      - ORANGE_SMS_CLIENT_SECRET=${ORANGE_SMS_CLIENT_SECRET}
    depends_on:
      - redis
      - postgres
    networks:
      - veripass-net
    restart: unless-stopped
    mem_limit: 512m

  celery_beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: vp_celery_beat
    command: celery -A app.celery beat --loglevel=info
    environment:
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
    networks:
      - veripass-net
    restart: unless-stopped
    mem_limit: 128m
    # Crons: sync PEP/Sanctions (hebdo), backup DB (quotidien), prune disk (si >85%)

  #  POSTGRESQL 
  postgres:
    image: postgres:16-alpine
    container_name: vp_postgres
    environment:
      - POSTGRES_DB=veripass
      - POSTGRES_USER=vp_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - veripass-net
    restart: unless-stopped
    mem_limit: 512m

  #  REDIS 
  redis:
    image: redis:7-alpine
    container_name: vp_redis
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - veripass-net
    restart: unless-stopped
    mem_limit: 256m
```

---

### 9.2 Monitoring Technique (Phase 2)

> **MVP :** Logs JSON structurés (FastAPI + Nginx) consultables via `docker-compose logs -f`.

**Phase 2 — Stack Prometheus + Grafana (on-premise, zéro cloud) — services commentés dans docker-compose.yml :**

```yaml
# Phase 2 - à activer dès que le pilote est stable

  # prometheus:
  #   image: prom/prometheus:latest
  #   volumes:
  #     - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
  #   networks: [veripass-net]
  #   mem_limit: 256m

  # grafana:
  #   image: grafana/grafana:latest
  #   environment:
  #     - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
  #   networks: [veripass-net]
  #   mem_limit: 256m

  # Exporters :
  # - prometheus-fastapi-instrumentator  (métriques HTTP sur /metrics)
  # - celery-prometheus-exporter         (queue depth, task duration, failures)
  # - postgres_exporter
  # - redis_exporter
  # - nginx-prometheus-exporter
```

**Alertmanager (Phase 2) :** Alerte email si `CPU > 85%` ou `disk > 80%` ou `queue_depth > 10`.

---

## 10. Budget RAM & Profil Hardware

### 10.1 Budget RAM — Version honnête (WSL2 cap 8GB)

| Phase                                        | Mémoire    | Condition                                          |
| -------------------------------------------- | ---------- | -------------------------------------------------- |
| Démarrage à froid (aucune requête)           | ~2.2GB     | Nginx + PG + Redis + API (sans modèles en mémoire) |
| API active, PaddleOCR chargé                 | ~3.7GB     | Après 1ère requête OCR                             |
| Celery actif, GLM en attente                 | ~4.2GB     | Workers prêts, pas de tâche GLM                    |
| **Peak : PaddleOCR en cours + GLM en cours** | **~7.2GB** | **⚠️ Séquentiel obligatoire (Redis lock)**          |
| Peak absolu théorique (si lock échoue)       | ~9GB       | ❌ OOM — le Redis lock l'empêche                    |

> Le Redis lock applicatif (§12 pipeline) est **la seule protection** contre l'OOM. Il doit être implémenté avant toute mise en production, même sur i3.

**Règle critique : PaddleOCR et GLM-OCR ne s'exécutent JAMAIS simultanément.**
- `api` traite PaddleOCR synchrone
- `celery_ocr` traite GLM-OCR en file d'attente (Celery queue), concurrence=1

### 10.2 Politique Disk (200GB)

| Partition                        | Taille allouée | Contenu                                            |
| -------------------------------- | -------------- | -------------------------------------------------- |
| Modèles AI (PaddleOCR + GLM-OCR) | ~5GB           | ONNX models                                        |
| Documents KYC (filesystem)       | ~50GB          | Images CNI, selfies, factures — pilote 20-50 users |
| PostgreSQL data                  | ~10GB          | OLTP + DWH                                         |
| Docker images/layers             | ~15GB          | Builds                                             |
| Logs                             | ~5GB           | JSON logs                                          |
| Buffer libre                     | ~115GB         | Marge sécurité                                     |

**Prune automatique :** Si disk >85% (170GB) → `docker system prune -f` + backup DB quotidien avant pruning.

---

## 11. Sécurité Architecture

> **Principe Directeur** : Défense en profondeur en **5 couches** conformément à la **Loi n°2024-017 relative à la cybercriminalité au Cameroun** et aux directives **COBAC** sur la protéction des données bancaires.
>
> | Couche | Mécanisme | Menace couverte |
> |---|---|---|
> | 1 — Transit | TLS 1.3 (Nginx) | Interception réseau |
> | 2 — Périmètre | JWT Auth + RBAC + Rate Limit | Accès non autorisé |
> | 3 — Application | Pydantic validation + param. queries | Injection, XSS |
> | 4 — Stockage | SHA-256 document hashing + AES-256 (Phase 1+) | Corruption, vol |
> | 5 — Audit | Append-only audit_log + trigger PostgreSQL | Effacement de traces |

### 11.1 Couches de Défense (Defense in Depth)

```
Internet / Client
    ↓ TLS 1.3 (Nginx)
Nginx (Rate limiting, CSP headers, HTTPS forced)
    ↓ HTTP interne (réseau Docker isolé)
FastAPI (JWT auth, RBAC, parameterized queries, Pydantic validation)
    ↓ SQLAlchemy parameterized
PostgreSQL (roles least-privilege, audit_log append-only)
    ↓ Filesystem chiffré (Phase 1+)
Docker Volume (AES-256 LUKS + applicatif Python via Fernet)
```

### 11.2 Matrice RBAC

| Permission               | Marie | Jean | Thomas | Sylvie |
| ------------------------ | ----- | ---- | ------ | ------ |
| Onboarding KYC           | ✅     | ❌    | ❌      | ❌      |
| Voir ses notifications   | ✅     | ❌    | ❌      | ❌      |
| Queue dossiers (agence)  | ❌     | ✅    | ❌      | ❌      |
| Inspect + approve/reject | ❌     | ✅    | ❌      | ❌      |
| Override OCR             | ❌     | ✅    | ❌      | ❌      |
| AML screening            | ❌     | ❌    | ✅      | ❌      |
| Agency CRUD              | ❌     | ❌    | ✅      | ❌      |
| Batch Amplitude          | ❌     | ❌    | ✅      | ❌      |
| Dashboard analytics      | ❌     | ❌    | ❌      | ✅      |
| Escalade + redistribute  | ❌     | ❌    | ❌      | ✅      |
| Export COBAC             | ❌     | ❌    | ✅      | ✅      |
| Audit log (lecture)      | ❌     | ❌    | ✅      | ✅      |

### 11.3 Audit Log — Implémentation PostgreSQL

```sql
-- Table append-only, partitionnée par mois
CREATE TABLE audit_log (
    id             BIGSERIAL,
    table_name     TEXT NOT NULL,
    record_id      TEXT NOT NULL,
    action         TEXT NOT NULL, -- INSERT, UPDATE, DELETE, VIEW, OCR_CORRECTED, etc.
    old_data       JSONB,
    new_data       JSONB,
    changed_fields TEXT,
    performed_by   TEXT NOT NULL,
    performed_at   TIMESTAMPTZ DEFAULT NOW(),
    client_ip      INET
) PARTITION BY RANGE (performed_at);

-- Révocation des droits de modification (append-only)
REVOKE UPDATE, DELETE ON audit_log FROM vp_user;
REVOKE UPDATE, DELETE ON audit_log FROM vp_admin;

-- Trigger générique sur tables critiques (kyc_sessions, documents, aml_alerts)
CREATE OR REPLACE FUNCTION audit_trigger_fn() RETURNS trigger AS $$
BEGIN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, performed_by, client_ip)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id::text, OLD.id::text),
        TG_OP,
        row_to_json(OLD)::jsonb,
        row_to_json(NEW)::jsonb,
        current_setting('app.current_user', true),
        inet_client_addr()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 11.4 OWASP Mobile Top 10 — Mitigations

| Risque OWASP                 | Mitigation bicec-veripass                                          |
| ---------------------------- | ------------------------------------------------------------------ |
| M1 Broken Auth               | JWT avec expiry court + refresh, rate limit OTP, anti-replay Redis |
| M2 Insecure Data Storage     | IndexedDB chiffré côté client (Phase finale), volume Docker LUKS   |
| M3 Insecure Communication    | TLS 1.3 obligatoire, HSTS, aucun HTTP en production                |
| M4 Insufficient Cryptography | AES-256 au repos, bcrypt/Argon2 passwords, SHA-256 intégrité       |
| M7 Client Code Quality       | CSP strict, code obfuscation build production, no eval()           |
| M9 Reverse Engineering       | Build minifié + obfusqué, pas de secrets dans le bundle            |
| M10 Extraneous Functionality | Pas de debug endpoints en production, env vars séparées            |

---

## 12. Pipeline AI/ML

### 12.1 Pipeline OCR (Détail)

```mermaid
flowchart TD
    A[Image reçue</br>/kyc/capture/cni ou /bill] --> B{Type document?}

    B -->|CNI Recto/Verso| C[PaddleOCR PP-OCRv5</br>CPU ONNX Runtime</br>< 1s/image]
    B -->|Facture ENEO/CAMWATER| D[Queue Celery</br>glm_ocr_jobs]

    C --> E{Confidence</br>par champ ≥ 85%?}
    E -->|Tous champs OK| F["Résultat direct</br>fields, confidence_map</br>engine: PADDLE"]
    E -->|Certains champs < 85%| G[Queue Celery</br>glm_ocr_jobs]

    G --> H[GLM-OCR 0.9B Quantifié</br>Celery Worker Dédié</br>10-30s/page</br>concurrence=1]
    D --> H

    H --> I["Résultat GLM<br>#123;fields, confidence_map</br>engine: GLM#125;"]

    F --> J[Métriques qualité</br>Laplacian Variance</br>Luminance Histogram]
    I --> J

    J --> K[Stockage PostgreSQL</br>ocr_fields + confidence_per_field</br>capture_quality_metrics]
    K --> L[Réponse API</br>Confidence badges ]
```

> **Comportement partiel PaddleOCR→GLM (E04) :** Si PaddleOCR extrait certains champs avec confidence ≥ 85% mais pas tous, les champs échoués sont envoyés à GLM uniquement (pas l'image complète). Réponse: `engine: PADDLE_THEN_GLM`, `partial_glm: true`.

**§12.1bis — Fusion résultats PaddleOCR + GLM (pseudocode) :**

```python
def merge_ocr_results(
    paddle_fields: dict[str, OCRField],
    glm_fields: dict[str, OCRField],
    low_confidence_keys: list[str]
) -> tuple[dict, str]:
    """
    Fusionne les résultats OCR :
    - Champs Paddle confidence >= 0.85 : conservés intacts
    - Champs dans low_confidence_keys : écrasés si GLM fait mieux
    - Si GLM n'améliore pas, Paddle est conservé (même si < 0.85)
    """
    final = dict(paddle_fields)
    glm_improved = []

    for key in low_confidence_keys:
        if key in glm_fields and glm_fields[key].confidence > paddle_fields[key].confidence:
            final[key] = glm_fields[key]
            glm_improved.append(key)

    if not glm_improved:
        engine = "PADDLE_GLM_NO_IMPROVEMENT"
    elif len(glm_improved) == len(low_confidence_keys):
        engine = "PADDLE_THEN_GLM_FULL"
    else:
        engine = "PADDLE_THEN_GLM_PARTIAL"

    return final, engine
```

**Cas GLM échoue complètement (timeout 120s ou RuntimeError) :**

```python
try:
    result = glm_model.extract(image, field_hints=low_confidence_keys)
except (TimeoutError, RuntimeError) as e:
    db.update_document(doc_id, ocr_engine="GLM_FAILED", status="PENDING_MANUAL")
    db.insert_notification(
        agent_id=jean_id, type="OCR_MANUAL_REQUIRED",
        payload={"doc_id": doc_id, "reason": str(e)}
    )
    return  # Pas de retry auto GLM (RAM critique)
```

### 12.2 Pipeline Biométrique

```mermaid
flowchart TD
    A[POST /kyc/liveness<br>#123;session_id, landmarks_json#125;] --> B[MediaPipe WASM</br>côté client PWA]

    B --> B1[478 landmarks 3D</br>Yaw angle calcul</br>EAR blink detection</br>Qualité frame]
    B1 -->|Frame valide| C[Envoi landmarks_json</br>au backend FastAPI]
    B1 -->|Frame invalide| B[Retry côté client]

    C --> D[MiniFASNetV2</br>Silent Anti-Spoofing</br>Score liveness 0-1]
    C --> E[DeepFace</br>Face Match</br>Selfie vs CNI Photo</br>Score 0-1]

    D --> F{Liveness</br>Score ≥ seuil?}
    E --> G{Face Match</br>Score ≥ 0.85?}

    F -->| PASS| H[AND Gate]
    F -->| FAIL| I[Strike++</br>Anti-replay Redis]
    G -->| PASS| H
    G -->| FAIL| I

    H --> J[Biometric PASS</br>Stockage biometric_results]
    I --> K{strike_count < 3?}
    K -->|Oui| L[Réponse FAIL</br>#123;strikes_remaining: N#125;]
    K -->|Non: strike = 3| M[Status = LOCKED_LIVENESS</br>Purge Redis session</br>Message lockout FR]
```

> **Validation serveur landmarks (E19) :** Les landmarks reçus du client sont vérifiés côté serveur pour détecter le spoofing : plage de valeurs (x,y,z ∈ [-1,1]), variance temporelle minimale (>0.02 std sur 5 frames), rejet si JSON format invalid. Pas de confiance aveugle aux données client.

> **Landmarks seuls — Confidentialité par design (RGPD + Loi 2024-017) :** La vidéo brute ne quitte **jamais** le device. MediaPipe WASM extrait 478 points 3D normalisés ç{x,y,z ∈ [0.0,1.0]} — environ 15–30KB pour 5 frames. Ces landmarks ne permettent pas de reconstruire le visage (minimisation des données biométriques). Conforme COBAC : les landmarks ne constituent pas des données biométriques « originales » au sens de la conservation 10 ans — seule la selfie photo statique est conservée.

### 12.4 Table UX Erreurs (AR6 — 5 scénarios critiques)

| Code | Erreur                                 | Message affiché Marie                                         | Action système                              |
| ---- | -------------------------------------- | ------------------------------------------------------------- | ------------------------------------------- |
| E01  | OCR confidence <40% tous champs        | « Photo floue ou mal cadrée. Recommencez. »                   | Suppression image, retry immédiat           |
| E04  | OCR partial (certains champs <85%)     | « Quelques champs peu lisibles, on complète automatiquement » | Envoi silencieux queue GLM                  |
| E13  | Liveness FAIL (strike 1-2)             | « Non validé. Recentrez votre visage (× restant) »            | Strike++ Redis, retry                       |
| E14  | Liveness LOCKOUT (strike 3)            | « Limite atteinte pour aujourd'hui. Réessayez demain. »       | Status LOCKED_LIVENESS, lockout_count++     |
| E19  | Landmarks invalides (spoofing detecté) | « Vérification impossible. Utilisez votre visage réel. »      | Rejet immmédiat, audit log SPOOFING_ATTEMPT |

### 12.3 Agent Load Balancing — Smooth Weighted Round Robin

```
Algorithme Smooth WRR + Least Connections :

Chaque agent a :
  - static_weight  : capacité relative (ex: senior=2, junior=1)
  - current_weight : poids courant (mis à jour à chaque assignment)
  - active_count   : dossiers en cours

À chaque nouveau dossier entrant :
  1. Pour chaque agent disponible (is_available=true):
       current_weight += static_weight
  2. Sélectionne agent avec MAX(current_weight)
     → En cas d'égalité: sélectionne MIN(active_count) [Least Connections]
  3. current_weight[sélectionné] -= SUM(tous static_weights)
  4. active_count[sélectionné]++
  5. INSERT dossier_assignments

Exemple (3 agents: Jean-A(w=2), Jean-B(w=1), Jean-C(w=1)):
  Tour 1: CW=[2,1,1] → Jean-A (CW=[2-4,1,1]=[-2,1,1])
  Tour 2: CW=[0,2,2] → Jean-B ou Jean-C par Least Connections
  Tour 3: CW=[2,1,3] → Jean-C
  Tour 4: CW=[4,2,0] → Jean-A
  → Sur 4 tours: Jean-A=2, Jean-B=1, Jean-C=1  (ratio 2:1:1)
```

**Réaffectation agent indisponible (limite MVP documentée) :**

```
Celery beat (toutes les 15min) :
    SELECT dossier_assignments
    WHERE is_current = true
    AND agent.is_available = false
    AND assigned_at < NOW() - INTERVAL '4 hours'
    → Pour chaque dossier orphelin :
        INSERT notification (sylvie, type=DOSSIER_ORPHAN)
        WRR → sélectionne nouvel agent disponible
        UPDATE dossier_assignments (agent_id = nouvel_agent, reassigned_at = NOW())
        INSERT notification (nouvel_agent, type=DOSSIER_REASSIGNED, with_full_context=true)

Si TOUS les agents sont indisponibles simultanément :
    → Dossiers restent en queue sans réaffectation
    → Sylvie reçoit alerte ALL_AGENTS_OFFLINE
    → Sylvie peut relancer manuellement depuis son dashboard
```

### 12.5 AML — Algorithme pg_trgm (G40)

```sql
-- Accès index tri-gramme PostgreSQL pour fuzzy search PEP/Sanctions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_pep_name_trgm ON pep_sanctions USING gin(full_name gin_trgm_ops);

-- Requête de matching lors de la soumission dossier
SELECT id, full_name, date_of_birth, source, similarity(full_name, :candidate_name) AS score
FROM pep_sanctions
WHERE full_name %% :candidate_name         -- Sélecteur tri-gramme rapide
  AND similarity(full_name, :candidate_name) >= 0.65  -- Seuil alerte haute
  AND is_active = true
  AND last_synced_at >= NOW() - INTERVAL '8 days'     -- Périmé si >8 jours
ORDER BY score DESC;

-- Match potentiel (surveillance, pas alerte immédiate) : seuil 0.40-0.65
-- Correspondance DOB tolérance ±2 ans (homonymie):
--   ABS(EXTRACT(YEAR FROM date_of_birth) - :candidate_year) <= 2
```

> **Note staleness :** Si `last_synced_at < NOW() - INTERVAL '8 days'` sur toutes les lignes, Celery Beat ré-enclenche une synchro d'urgence et bloque les nouvelles soumissions avec un message d'alerte Sylvie.

---

## 13. Stratégie Analytics & Data Warehouse

### 13.1 Events Instrumentés (Funnel Complet)

| Event Name             | Step     | Données capturées                      |
| ---------------------- | -------- | -------------------------------------- |
| `App_Opened`           | A01      | device_info, os_version, network_type  |
| `Language_Selected`    | A02      | language                               |
| `Phone_OTP_Sent`       | A03      | phone_prefix, channel=SMS              |
| `Phone_OTP_Verified`   | A03      | duration_ms                            |
| `Email_Entered`        | A05      | email_domain                           |
| `Email_OTP_Verified`   | A06      | duration_ms                            |
| `PIN_Setup_Done`       | A07      | duration_ms                            |
| `Biometric_OptIn`      | A08      | opted_in (bool)                        |
| `CNI_Capture_Started`  | B02      | side=RECTO                             |
| `CNI_Capture_Success`  | B03      | side, attempts, laplacian, luminance   |
| `CNI_Capture_Failed`   | B03      | side, reason (blur/glare/timeout)      |
| `OCR_Processing_Done`  | B07      | engine, duration_ms, confidence_avg    |
| `OCR_Review_Confirmed` | B08      | corrections_made (int)                 |
| `Liveness_Started`     | B09      |                                        |
| `Liveness_Attempt`     | B10      | strike_number, score                   |
| `Liveness_Pass`        | B11      | face_match_score, duration_ms          |
| `Liveness_Lockout`     | B10_Fail | total_strikes=3                        |
| `Address_Completed`    | C01      | gps_used (bool)                        |
| `Bill_Uploaded`        | C04      | bill_type (ENEO/CAMWATER)              |
| `NIU_Declared`         | C05      | mode (UPLOADED/DECLARATIVE)            |
| `Consent_Completed`    | D01      | duration_ms                            |
| `Digital_Signed`       | D02      |                                        |
| `Dossier_Submitted`    | E02      | total_duration_s, niu_type, ocr_engine |
| `Session_Resumed`      | —        | resume_step, gap_duration_s            |
| `Session_Abandoned`    | —        | last_step, time_on_step_s              |

### 13.2 Requêtes Analytics Clés (pour dashboards PFE)

```sql
-- 1. FUNNEL DROP-OFF par étape
SELECT 
    step_name,
    COUNT(*) as entered,
    COUNT(*) FILTER (WHERE event_name LIKE '%_Success' OR event_name LIKE '%_Done') as completed,
    ROUND(100.0 * COUNT(*) FILTER (WHERE event_name LIKE '%_Success') / COUNT(*), 1) as conversion_rate
FROM fact_analytics_events
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY step_name ORDER BY entered DESC;

-- 2. OCR QUALITY OBSERVABILITY
SELECT 
    ocr_engine_used,
    AVG(ocr_confidence_avg) as avg_confidence,
    COUNT(*) FILTER (WHERE human_correction_needed) as manual_corrections,
    ROUND(100.0 * COUNT(*) FILTER (WHERE human_correction_needed) / COUNT(*), 1) as correction_rate
FROM fact_kyc_sessions
GROUP BY ocr_engine_used;

-- 3. AGENT LOAD BALANCING INTELLIGENCE
SELECT 
    a.name,
    a.agency_id,
    COUNT(fva.id) as total_validations,
    AVG(fva.validation_duration_seconds) as avg_duration_s,
    SUM(CASE WHEN fva.sla_met THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as sla_rate
FROM fact_validation_actions fva
JOIN dim_agents a ON fva.agent_dim_id = a.id
WHERE fva.time_dim_id IN (SELECT id FROM dim_time WHERE date >= CURRENT_DATE - 30)
GROUP BY a.name, a.agency_id;

-- 4. SLA MONITORING (Sylvie dashboard)
SELECT
    COUNT(*) FILTER (WHERE status = 'PENDING_KYC' 
        AND submitted_at < NOW() - INTERVAL '2 hours') as sla_violations_2h,
    COUNT(*) FILTER (WHERE status = 'PENDING_KYC') as total_pending,
    AVG(EXTRACT(EPOCH FROM (completed_at - submitted_at))/3600) as avg_validation_hours
FROM kyc_sessions
WHERE submitted_at >= CURRENT_DATE;

-- 5. LIVENESS FAILURE ANALYSIS (OCR/Biometrics Observability)
SELECT 
    DATE_TRUNC('hour', performed_at) as hour,
    COUNT(*) as liveness_attempts,
    AVG((new_data->>'liveness_score')::decimal) as avg_score,
    COUNT(*) FILTER (WHERE (new_data->>'liveness_pass')::bool = false) as failures
FROM audit_log
WHERE action = 'LIVENESS_ATTEMPT'
GROUP BY 1 ORDER BY 1 DESC;
```

### 13.3 Provisioning Sopra Amplitude — Architecture Axway (Thomas)

> **❌ L'ancienne section référençant `amplitude.com` (SaaS analytics américain) est supprimée.** Elle référençait un produit sans lien avec notre architecture. Voir §8.5 et §10.x pour le flow ISO 20022 via Axway.

**Ce que "Amplitude" signifie dans ce projet :** Sopra Banking Software — Amplitude Core Banking System de BICEC. L'accès se fait uniquement via le middleware **Axway API Manager v11.6 AIF** sur le réseau interne BICEC.

**Format des messages — ISO 20022 (obligatoire depuis 2025, directive BEAC) :**

| Action                      | Message ISO 20022                            |
| --------------------------- | -------------------------------------------- |
| Création compte             | `acmt.009` — AccountOpeningInstruction       |
| Confirmation création       | `acmt.010` — AccountOpeningConfirmation      |
| Mise à jour client existant | `acmt.003` — AccountModificationInstruction  |
| Confirmation mise à jour    | `acmt.004` — AccountModificationConfirmation |

**Flow Axway (séquence) :**
```
Celery beat → provisioning_worker
  → build acmt.009 XML payload
  → POST Axway API Manager /v1/accounts
     headers: Authorization: Bearer ${AXWAY_TOKEN}
     body: acmt.009 ISO 20022 XML
  → Axway valide, route vers Amplitude CBS
  → Réponse acmt.010: account_number assigné
  → UPDATE kyc_sessions SET status='ACTIVATED_LIMITED',
      access_level='LIMITED_ACCESS',
      axway_request_id=:req_id,
      iso20022_message_ref=:ref
  → Notification SMS Marie: « Compte créé !»
```

> **Note implémentation :** La documentation exacte des endpoints Axway disponibles dans l'environnement BICEC doit être demandée à l'équipe IT BICEC avant implémentation.

### 13.4 Dashboard Sylvie — Périmètre complet

Le Command Center de Sylvie couvre **4 zones (A–D)** :

| Zone  | Titre                      | Contenu                                                                                     |
| ----- | -------------------------- | ------------------------------------------------------------------------------------------- |
| **A** | Vue temps réel (OLTP live) | File d'attente active, nombre PENDING_KYC, agents disponibles, alertes SLA                  |
| **B** | Analytics DWH (OLAP)       | Funnel drop-off par étape, taux conversion semaine vs semaine, OCR accuracy distribution    |
| **C** | Performance agents         | WRR current weights, active_dossier_count, SLA compliance par agent, temps moyen validation |
| **D** | Actions Sylvie             | Bouton escalade (flag HIGH_PRIORITY), bouton redistribution WRR, export COBAC pack          |

> **Différence OLTP vs OLAP :** Zone A lit `kyc_sessions` directement (OLTP, max freshness). Zones B-C lisent `fact_*` tables du DWH (OLAP, refresh toutes les heures via `pg_cron`). Zone D écrit vers OLTP.

---

## 14. Stratégie de Chiffrement (Phased)

### 14.1 Phase 1 — Dev/Debug (maintenant → mi-MVP)
-  Pas de chiffrement au repos sur les fichiers images (itération rapide, debug facile)
-  **TLS 1.3** en transit (Nginx → clients) — **dès le départ**
-  Passwords bcrypt/Argon2 — **dès le départ**
-  SHA-256 intégrité documents — **dès le départ**
-  JWT signé — **dès le départ**

**Helper AES-256 Phase 1 (encrypt avant stockage documents sensibles) :**
```python
from cryptography.fernet import Fernet
import os

def encrypt_file(file_bytes: bytes, key: bytes) -> bytes:
    """Chiffre un fichier avant stockage. key = FERNET_KEY env var."""
    f = Fernet(key)
    return f.encrypt(file_bytes)

def decrypt_file(encrypted_bytes: bytes, key: bytes) -> bytes:
    """Déchiffre un fichier à la lecture. key = FERNET_KEY env var."""
    f = Fernet(key)
    return f.decrypt(encrypted_bytes)

# Usage dans FastAPI:
# FERNET_KEY = os.environ["FERNET_KEY"].encode()  # 32-byte url-safe base64
# stored = encrypt_file(image_bytes, FERNET_KEY)
# Path(file_path).write_bytes(stored)
```

### 14.2 Phase 2 — Pré-Pilote (mi-MVP → livraison)
-  Activation chiffrement volume Docker (LUKS ou chiffrement applicatif niveau Python avec Fernet/AES-256 sur les fichiers sensibles avant écriture)
-  IndexedDB côté PWA : chiffrement applicatif JS (Web Crypto API) pour les images temporaires locales
-  AES-256 sur biometric_results en base (champ BYTEA si embeddings stockés)

### Justification de l'approche phasée
Chiffrer dès le départ sur filesystem Docker (LUKS) nécessite une configuration volume spécifique qui peut complexifier les premiers `docker-compose up`. Pour un PFE avec 2 mois de deadline, l'approche "TLS dès le départ + chiffrement au repos en pré-pilote" est un compromis pragmatique documenté explicitement dans les ADRs — ce qui est lui-même une preuve de maturité ingenieux.

---

## Légende ERD

| Symbole      | Signification                                 |
| ------------ | --------------------------------------------- |
| `PK`         | Primary Key (Clé Primaire)                    |
| `FK`         | Foreign Key (Clé Étrangère)                   |
| `UK`         | Unique Key (Contrainte unicité)               |
| `\|\|--o{`   | Relation 1:N (un à plusieurs)                 |
| `\|\|--\|\|` | Relation 1:1 (un à un)                        |
| `}o--\|\|`   | Relation N:1 (plusieurs à un, côté optionnel) |

---

*Document généré le 2026-02-28 | Version 1.0 | bicec-veripass MVP Architecture*  
*Document rattrapé le 2026-03-05 | Version 1.1 | bicec-veripass MVP Architecture — 39 corrections appliquées*

---

## 15. Compatibilité RHEL & Licences (G27)

> **Compatibilité RHEL 8/9 :** Toutes les images Docker utilisées sont disponibles sur le régistre UBI Red Hat ou Docker Hub officiel. Aucune dépendance Alpine-only critique. En environnement RHEL, remplacer les images `*:alpine` par leurs équivalents UBI9 ou distroless.

| Composant          | Image Docker                  | Licence            | Compatible RHEL |
| ------------------ | ----------------------------- | ------------------ | --------------- |
| Nginx              | `nginx:alpine` / `nginx:1.25` | BSD-2-Clause       | ✅               |
| PostgreSQL 16      | `postgres:16-alpine`          | PostgreSQL License | ✅               |
| Redis 7            | `redis:7-alpine`              | BSD-3-Clause       | ✅               |
| FastAPI            | PyPI `fastapi`                | MIT                | ✅               |
| PaddleOCR          | PyPI `paddleocr`              | Apache 2.0         | ✅               |
| GLM-OCR 0.9B       | HuggingFace GGUF              | Apache 2.0         | ✅               |
| DeepFace           | PyPI `deepface`               | MIT                | ✅               |
| MediaPipe WASM     | npm `@mediapipe/tasks-vision` | Apache 2.0         | ✅               |
| Celery             | PyPI `celery`                 | BSD-3-Clause       | ✅               |
| React/Vite         | npm `react`, `vite`           | MIT                | ✅               |
| Playwright (tests) | npm `playwright`              | Apache 2.0         | ✅               |

---

## 16. Isolation Schémas PostgreSQL (G28)

```sql
-- Création des 3 schémas séparés
CREATE SCHEMA public;   -- OLTP principal (kyc_sessions, users, agents...)
CREATE SCHEMA dwh;      -- Data Warehouse analytique (fact_*, dim_*)
CREATE SCHEMA audit;    -- Audit logs append-only (audit_log)

-- Permissions ségréguées
GRANT USAGE ON SCHEMA public TO vp_user;
GRANT USAGE ON SCHEMA dwh TO vp_analytics_user;    -- Sylvie lecture seule
GRANT USAGE ON SCHEMA audit TO vp_audit_user;      -- Thomas + Sylvie lecture
REVOKE ALL ON SCHEMA audit FROM vp_user;           -- Les workers ne peuvent pas lire audit

-- Les tables audit_log résident dans le schéma audit:
CREATE TABLE audit.audit_log ( ... );
-- Les tables DWH résident dans dwh:
CREATE TABLE dwh.fact_kyc_sessions ( ... );
```

---

## 17. Automatisation Celery Beat & Redis Cache (G29)

### Celery Beat Schedules

```python
# app/celery_config.py
beat_schedule = {
    # Sync PEP/Sanctions hebdomadaire (lundis 02h00)
    'sync-sanctions-weekly': {
        'task': 'app.tasks.sanctions.sync_pep_sanctions',
        'schedule': crontab(hour=2, minute=0, day_of_week=1),
    },
    # Rotation partitions audit_log (1er du mois)
    'create-audit-partition-monthly': {
        'task': 'app.tasks.maintenance.create_audit_partition',
        'schedule': crontab(hour=0, minute=0, day_of_month=1),
    },
    # Détection sessions ABANDONED (quotidien 03h00)
    'detect-abandoned-sessions': {
        'task': 'app.tasks.kyc.detect_abandoned_sessions',
        'schedule': crontab(hour=3, minute=0),
    },
    # Backup DB quotidien
    'backup-db-daily': {
        'task': 'app.tasks.maintenance.backup_postgres',
        'schedule': crontab(hour=1, minute=0),
    },
    # Vérification disk >85%
    'check-disk-usage': {
        'task': 'app.tasks.maintenance.check_disk',
        'schedule': crontab(hour='*/6'),  # Toutes les 6h
    },
}
```

### Redis Cache Notifications

```python
# Cache Redis pour notifications non lues (TTL 24h)
# Key pattern: notif:user:{user_id}:unread
# Value: JSON list des ids non lus

REDIS_NOTIF_CACHE_TTL = 86400  # 24h

async def get_unread_notifications(user_id: str, after_id: str = None):
    cache_key = f"notif:user:{user_id}:unread"
    cached = await redis.get(cache_key)
    if cached:
        notifs = json.loads(cached)
        if after_id:
            notifs = [n for n in notifs if n['id'] > after_id]
        return notifs
    # Cache miss: lecture PG, mise en cache
    notifs = await db.fetch_unread_notifications(user_id)
    await redis.setex(cache_key, REDIS_NOTIF_CACHE_TTL, json.dumps(notifs))
    return notifs
```

---

## 📋 §15 — Checklist Réconciliation Prototype (G33)

> Voir `docs/test_tmp_trash/onboarding-system-design-wireframe` comme **référence prototype**.

| Élément prototype             | Statut                                   | Action requise                                   |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------ |
| Flux onboarding (A01→E02)     | ✅ Aligné avec §6 séquences               | Aucune                                           |
| Étapes Consentement/Signature | ✅ Décision ADR : checkbox écran Review   | Aucune                                           |
| État RESTRICTED (accueil)     | ⚠️ Prototype montre « RESTRICTED_ACCESS » | Harmoniser en code : access_level = 'RESTRICTED' |
| État ABANDONED                | ❌ Absent du prototype                    | Ajouter écran session expirée avec CTA reprise   |
| Back-office queue Jean        | ✅ Aligné                                 | Aucune                                           |
| Dashboard Sylvie zones A-D    | ⚠️ Zones C et D absentes du prototype     | Ajouter dans backoffice SPA (Phase 2)            |
| Flow ISO 20022 Axway          | ❌ Non visible dans prototype             | À implémenter côté backend uniquement            |

### G31 — Harmonisation RESTRICTED dans séquences

> Dans SEQ-07 et SEQ-08, toute mention de `RESTRICTED_ACCESS` comme valeur de `status` est incorrecte. `RESTRICTED_ACCESS` est un label lisible (access_level), la valeur enum correcte est `RESTRICTED` ou `LIMITED_ACCESS`. Correction : chercher `RESTRICTED_ACCESS` dans les séquences et remplacer par `access_level: 'RESTRICTED'`.

### G32 — État ABANDONED

Transitions légales ajoutées à la state machine :
- `DRAFT → ABANDONED` : session inactive >72h sans soumission (Celery Beat 03h00)
- `PENDING_INFO → ABANDONED` : client ne répond pas dans les 15 jours

Action Celery :
```python
async def detect_abandoned_sessions():
    # Sessions DRAFT inactives depuis 72h
    abandoned_draft = await db.query("""
        UPDATE kyc_sessions SET status = 'ABANDONED'
        WHERE status = 'DRAFT'
          AND updated_at < NOW() - INTERVAL '72 hours'
        RETURNING id, user_id
    """)
    for session in abandoned_draft:
        await notify_user(session.user_id, 'SESSION_ABANDONED',
            {'resume_link': f'/kyc/resume/{session.id}'})
        await analytics.track('Session_Abandoned', session.id)
```

### G34 — Détection Dropout

Colonne `dropout_step` déjà dans `fact_kyc_sessions`. Procédure :
1. Celery Beat 03h00 : sélectionne sessions `ABANDONED` sans `dropout_step`
2. Détermine dernière étape complétée via `last_step_completed` (OLTP)
3. Remplit `fact_kyc_sessions.dropout_step` pour analyse funnel
4. Alerte Sylvie si taux dropout étape >30% sur 7 jours

### G35 — Voir §13.3 pour le flow Axway ISO 20022 complet

---

*Document généré le 2026-02-28 | Version 1.0 | bicec-veripass MVP Architecture*  
*Document rattrapé le 2026-03-05 | Version 1.1 | bicec-veripass MVP Architecture — 39 corrections appliquées*  
*Patch V4 intégré le 2026-03-05 | Version 1.2 | 9 corrections + 4 Q&A (revue jury)*

---

## 18. Stratégie de Test

> **Pyramide de tests appliquée au MVP bicec-veripass :**

```
         /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
        /   E2E — Playwright   \   ← Peu nombreux, parcours critiques
       /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
      /  Intégration — FastAPI  \  ← Contrats API + effets DB
     /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
    /   Unitaires — Pytest/Vitest \  ← Nombreux, rapides, logique métier
   /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
```

| Niveau                    | Outil                               | Ce qui est testé                                                                            | Priorité MVP |
| ------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------- | ------------ |
| **Unitaires Backend**     | Pytest                              | State machine transitions, `merge_ocr_results`, WRR algorithm, AML fuzzy scoring, JWT utils | ★★★          |
| **Unitaires Frontend**    | Vitest + React Testing Library      | Composants PWA, gestion états offline, formulaires OCR                                      | ★★           |
| **Intégration API**       | FastAPI TestClient + pytest-asyncio | Chaque endpoint : body, codes erreur, DB side effects                                       | ★★★          |
| **E2E Parcours nominaux** | Playwright                          | Onboarding Marie complet, validation Jean, login back-office                                | ★★★          |
| **E2E Cas limites**       | Playwright                          | Liveness lockout, session resumption, OTP rate limit                                        | ★★           |
| **Fixtures KYC**          | Pytest fixtures                     | Sessions dans chaque état pour tests répétables                                             | ★★★          |

**Fixtures essentielles (`conftest.py`) :**

```python
@pytest.fixture
def session_pending_kyc(db):
    """Session soumise prête pour validation Jean"""
    return create_test_session(
        status="PENDING_KYC",
        with_documents=True,
        with_biometrics=True
    )

@pytest.fixture
def session_activated_full(db):
    """Session compte activé FULL_ACCESS"""
    return create_test_session(
        status="ACTIVATED_FULL",
        access_level="FULL_ACCESS"
    )

@pytest.fixture
def session_abandoned(db):
    """Session abandonnée après 72h inactives"""
    return create_test_session(
        status="ABANDONED",
        updated_at=datetime.now() - timedelta(hours=73)
    )
```

---

## 19. FAQ Technique — Réponses Jury

### Q1 — Que se passe-t-il si GLM-OCR échoue complètement ?

**Défini dans §12.1bis.** Résumé :
- Timeout Celery configuré à **120s** sur le worker `celery_ocr`
- Si `TimeoutError` ou `RuntimeError` : document marqué `ocr_engine = 'GLM_FAILED'`, `status = 'PENDING_MANUAL'`
- Jean reçoit une notification avec badge rouge sur tous les champs concernés
- Jean effectue la saisie manuelle depuis les images haute-résolution
- Pas de retry automatique GLM (RAM critique) — Jean peut déclencher manuellement
- L'événement est log dans `audit_log` + comptabilisé dans les métriques OCR (taux échec GLM)

---

### Q2 — Pourquoi envoyer uniquement les landmarks, pas la vidéo brute ?

**Défini dans §12.2.** Résumé :

```
Flux vidéo getUserMedia (caméra)
    → MediaPipe WASM (100% dans le navigateur, WASM sandbox)
    → 478 points 3D normalisés extraits par frame (x, y, z ∈ [0.0, 1.0])
    → Sélection de 5 frames espacées de 200ms
    → landmarks_json = [{frame: 1, points: [...]}, ...] (~15–30KB total)
    → Seul landmarks_json envoyé à l'API — jamais la vidéo
```

| Dimension               | Bénéfice                                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **RGPD / Loi 2024-017** | Minimisation des données : les landmarks ne permettent pas de reconstruire le visage                                          |
| **Performance**         | 15–30KB au lieu de plusieurs Mo de vidéo                                                                                      |
| **COBAC**               | Les landmarks ne sont pas des données biométriques « originales » — conservation 10 ans ne s'applique qu'à la selfie statique |

---

### Q3 — Comment `SET LOCAL app.current_user` est-il positionné ?

**Pattern exact — Middleware FastAPI (transaction scope) :**

```python
# app/core/middleware.py
from starlette.middleware.base import BaseHTTPMiddleware

class AuditContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        user_id = getattr(request.state, "user_id", "anonymous")

        async with db.begin():
            # SET LOCAL : scopé à la transaction → thread-safe dans asyncpg pool
            await db.execute(
                "SELECT set_config('app.current_user', :uid, true)",
                {"uid": str(user_id)}
            )
            # true = LOCAL (transaction scope), pas SESSION scope
            response = await call_next(request)

        return response
```

Le trigger PostgreSQL lit `current_setting('app.current_user', true)` — le `true` (missing_ok) évite une exception si la variable n'est pas positionnée (ex. migrations).

---

### Q4 — Comment la mémoire GLM est-elle libérée après chaque tâche ?

**Mécanisme `--max-tasks-per-child=1` (docker-compose.yml) :**

```yaml
# docker-compose.yml — celery_ocr
celery_ocr:
  command: >
    celery -A app.celery worker
    -Q glm_ocr_jobs
    --concurrency=1
    --max-tasks-per-child=1
    -n ocr_worker@%h
```

`--max-tasks-per-child=1` : après chaque tâche GLM, le process Python worker se termine proprement. Celery en fork automatiquement un nouveau. **La mémoire du modèle GLM (2.5–3.5GB) est libérée par l'OS après `exit()` du process enfant.**

**Coût (acceptable) :** Rechargement du modèle = 5–15s de warm-up. Acceptable en back-office async (les factures ne sont pas traitées en temps réel pour Marie).