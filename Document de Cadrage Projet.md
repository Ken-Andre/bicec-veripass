# Document de Cadrage Projet : Plateforme KYC Digital Biométrique

## 1. Contexte & Vision

### Situation actuelle
La BICEC (et les banques de la zone CEMAC) utilisent un processus d'onboarding client entièrement papier qui prend **48 heures à 14 jours** pour ouvrir un compte. Les clients doivent se déplacer en agence pendant les heures ouvrables, remplir des formulaires manuels, et attendre une validation administrative lente. Ce modèle génère :
- Un backlog permanent de dossiers incomplets dans les agences
- Une expérience utilisateur frustrante comparée aux opérateurs Mobile Money (MTN, Orange, Wave)
- Des coûts d'acquisition client (CAC) élevés
- Une perte de parts de marché chez les jeunes (18-35 ans) qui préfèrent les solutions digitales

### Vision produit
Créer une **plateforme mobile-first d'onboarding digital 100% à distance** permettant d'ouvrir un compte bancaire en **moins de 15 minutes** (benchmark cible : 11 minutes), accessible 24/7 depuis un smartphone. Cette plateforme combine :
- Capture intelligente de documents d'identité (OCR + QR code)
- Vérification biométrique faciale avec détection de vivacité
- Validation automatique des données fiscales et de localisation
- Intégration temps réel avec le core banking

### Pourquoi c'est critique
- **Business** : Réduction du CAC par 3, accélération de la croissance client, compétitivité face aux néobanques et Mobile Money
- **Opérationnel** : Libération du personnel des tâches administratives pour se concentrer sur le conseil à forte valeur ajoutée
- **Stratégique** : Création d'un socle d'identité numérique réutilisable pour tous les services digitaux de la banque (paiements, crédits, etc.)
- **Réglementaire** : Conformité renforcée avec BEAC/COBAC grâce à l'automatisation et la traçabilité complète

---

## 2. Problèmes à Résoudre

**Problème principal** : Les clients potentiels abandonnent le processus d'ouverture de compte car il est trop long, contraignant et incompatible avec leurs modes de vie digitaux.

**Problèmes secondaires** :
1. **Friction temporelle** : Impossible d'ouvrir un compte en dehors des heures bancaires (soir, weekend)
2. **Qualité des données** : 30-40% des dossiers papier sont incomplets ou contiennent des erreurs de saisie, nécessitant des allers-retours
3. **Risque de fraude** : Difficulté à détecter les faux documents et les usurpations d'identité avec la validation manuelle
4. **Coûts opérationnels** : Le traitement manuel mobilise 15-20 minutes de temps agent par dossier, sans valeur ajoutée
5. **Conformité** : Difficulté à maintenir une traçabilité audit-ready pour les contrôles COBAC/BEAC

**Exemples concrets** :
- **Marie, entrepreneure à Douala** : Doit fermer sa boutique une demi-journée pour se rendre en agence, faire la queue 45 minutes, remplir des formulaires, puis revenir 3 jours plus tard car il manquait une pièce.
- **Agent en agence** : Passe 20 minutes à saisir manuellement les données d'une CNI usée, avec risque d'erreur de frappe, puis doit scanner 5 documents papier qui finissent dans un backlog de validation de 2 semaines.
- **Responsable conformité** : Reçoit des dossiers incomplets 48h après l'ouverture, doit relancer le client par téléphone, créant des délais supplémentaires et une mauvaise expérience.

---

## 3. Utilisateurs Cibles / Personas

### Persona 1 : Le Client Final (Nouveau)
- **Profil** : Marie, 24 ans, entrepreneure à Douala, utilisatrice active d'Orange Money et Instagram
- **Objectifs** : 
  - Ouvrir un compte professionnel rapidement sans perdre une journée de travail
  - Expérience simple et moderne comparable aux apps qu'elle utilise déjà
  - Sécurité de ses données personnelles et biométriques
- **Frustrations actuelles** :
  - Horaires d'agence incompatibles avec son activité commerciale
  - Processus opaque : elle ne sait pas combien de temps ça va prendre
  - Déplacements multiples si un document manque

### Persona 2 : L'Agent Back-Office / Compliance
- **Profil** : Jean, 32 ans, chargé de conformité KYC à l'agence Yaoundé-Centre
- **Objectifs** :
  - Valider rapidement les dossiers complets avec toutes les pièces requises
  - Visualiser les documents originaux capturés pour vérifier la cohérence avec les données extraites par OCR
  - Identifier facilement les cas suspects (PEP, sanctions, documents frauduleux)
  - Maintenir un taux de conformité >95% lors des audits COBAC
- **Frustrations actuelles** :
  - 60% des dossiers arrivent incomplets, nécessitant des relances manuelles
  - Difficile de vérifier l'authenticité d'un document papier (faux, photocopies)
  - Pas de vue consolidée sur le pipeline de validation
  - Impossible de contrôler visuellement la qualité des captures sans avoir accès aux images originales

### Persona 3 : Le Responsable d'Agence / Manager
- **Profil** : Sylvie, 40 ans, directrice d'agence régionale
- **Objectifs** :
  - Augmenter le nombre d'ouvertures de comptes mensuelles sans recruter
  - Réduire le temps de traitement et les erreurs
  - Avoir de la visibilité sur la performance (taux de conversion, points de blocage)
- **Frustrations actuelles** :
  - Équipes surchargées par la saisie manuelle et la gestion papier
  - Perte de clients impatients qui vont chez la concurrence
  - Pas de métriques en temps réel pour piloter l'activité

---

## 4. Scénarios d'Usage Clés

### Scénario 1 : Onboarding client complet (Happy Path)
1. **Découverte** : Marie télécharge l'app suite à une recommandation d'amie
2. **Inscription initiale** : Elle entre son numéro de téléphone, reçoit un code SMS, crée un mot de passe
3. **Capture d'identité** : L'app la guide pour photographier sa CNI (recto + verso), lit automatiquement le QR code ou extrait le texte par OCR
4. **Vérification biométrique** : Elle enregistre un selfie vidéo de 3 secondes (cligne des yeux, tourne la tête vers position aléatoire indiquée), le système compare avec la photo de la CNI
5. **Données complémentaires** : 
   - Elle capture/saisit manuellement son NIU depuis son attestation DGI (document séparé de la CNI)
   - Upload d'une facture d'électricité/eau récente (ENEO/CAMWATER)
   - Autorisation de la géolocalisation GPS
6. **Validation et signature** : Elle révise les informations pré-remplies, accepte les conditions, signe électroniquement
7. **Résultat** : Elle reçoit une confirmation immédiate, son dossier entre en validation, compte activé sous 2-24h avec notification push

### Scénario 2 : Validation back-office avec vérification visuelle
1. **Notification** : Jean reçoit une alerte qu'un nouveau dossier est prêt pour revue
2. **Consultation** : Il accède à un tableau de bord listant les dossiers par score de confiance (>95% = validation automatique suggérée, 70-95% = revue manuelle, <70% = rejet/reprise)
3. **Vérification croisée** : 
   - Il visualise **les photos originales** (CNI recto/verso, selfie, facture, attestation NIU)
   - Il compare visuellement les documents avec les données extraites par OCR
   - Il vérifie la cohérence : photo CNI ↔ selfie, nom CNI ↔ nom sur facture, NIU sur attestation ↔ NIU saisi
   - Il consulte les scores biométriques (liveness, face matching)
   - Il vérifie les résultats de screening PEP/sanctions
4. **Décision finale** : Jean **est le seul à pouvoir activer le compte** - c'est lui qui appuie sur l'interrupteur d'activation après s'être assuré que tout est conforme
5. **Action** : Il approuve et active, demande un complément d'info, ou rejette avec motif
6. **Notification client** : Marie reçoit instantanément le statut de son dossier
7. **Archivage sécurisé** : Toutes les images sont conservées chiffrées pour audit COBAC avec traçabilité complète des actions de Jean

### Scénario 3 : Gestion d'exception (liveness échouée)
1. **Problème** : Le système détecte un éventuel spoofing (photo d'une photo) lors du selfie de Marie
2. **Retry** : L'app lui donne des instructions plus claires ("Placez-vous dans un endroit bien éclairé, regardez directement la caméra")
3. **Limite de tentatives** : Après 3 échecs, le système propose soit un rendez-vous en agence, soit une validation manuelle différée
4. **Escalade** : Le dossier est marqué "revue manuelle prioritaire" pour Jean qui visualise les tentatives et peut autoriser exceptionnellement après vérification des images

### Scénario 4 : Suivi de performance (Manager)
1. **Dashboard** : Sylvie se connecte à un portail web et voit :
   - Nombre d'onboardings démarrés/complétés aujourd'hui
   - Taux de conversion par étape (inscription → capture CNI → NIU → liveness → signature)
   - Temps moyen de traitement
   - Taux de rejet par motif
   - Charge de travail de validation par agent
2. **Analyse** : Elle identifie que 25% des utilisateurs abandonnent à l'étape "upload facture" → décision d'améliorer les instructions
3. **Reporting** : Elle exporte les données pour le comité de direction mensuel

### Scénario 5 : Indisponibilité API externe (résilience)
1. **Contexte** : L'API de vérification NIU (DGI) est temporairement en maintenance
2. **Fallback** : Le système valide uniquement le format du NIU localement (regex + clé de contrôle)
3. **Validation humaine renforcée** : Jean reçoit le dossier avec un flag "NIU non vérifié API DGI", il doit **obligatoirement vérifier visuellement l'attestation NIU** uploadée par le client
4. **Mise en attente** : Le dossier de Marie peut être validé par Jean après contrôle visuel, mais le compte est créé avec restrictions (pas de virements sortants) jusqu'à validation DGI effective
5. **Réconciliation** : Dès que l'API DGI revient, le système rejoue automatiquement les vérifications en batch et lève les restrictions

---

## 5. Périmètre Fonctionnel Souhaité (MVP)

### Blocs fonctionnels INDISPENSABLES (P0 - MVP - 3 mois : février-avril 2026)

#### A. Parcours Client Mobile
- **Inscription sécurisée** : Numéro téléphone + OTP SMS, création mot de passe, consentement RGPD-like (Loi 2024-017)
- **Capture CNI (recto + verso)** : 
  - Auto-cadrage avec guidage visuel (cadre, luminosité, stabilité)
  - Lecture QR code (nouvelles CNI 2024 biométriques) OU OCR (anciennes CNI plastifiées) via PaddleOCR
  - Extraction automatique : nom, prénom, date naissance, numéro CNI, date délivrance, lieu délivrance
  - **Stockage sécurisé des photos originales** (recto + verso) chiffrées AES-256 pour validation humaine et audit
- **Capture/Saisie NIU** :
  - **Le NIU est un document séparé** géré par la DGI (pas sur la CNI)
  - Option 1 : Photo de l'attestation d'immatriculation fiscale (OCR du numéro)
  - Option 2 : Saisie manuelle du NIU avec validation format (regex : 1 lettre + 12 chiffres + 1 lettre de contrôle)
  - **Stockage de la photo de l'attestation NIU** pour vérification humaine
- **Liveness Detection** : 
  - Vidéo-selfie 3-5 secondes avec instructions aléatoires (cligner yeux, tourner tête vers gauche/droite/haut selon instruction)
  - Détection anti-spoofing (photo, écran, masque)
  - **Stockage de la vidéo/photo de selfie** chiffrée pour validation humaine
- **Face Matching** : Comparaison biométrique selfie ↔ photo CNI, score de confiance >98.5%
- **Justificatif de domicile** :
  - Upload facture récente (ENEO électricité, CAMWATER eau, <3 mois)
  - OCR pour extraction date et adresse
  - **Stockage de la photo de facture** pour vérification humaine
- **Géolocalisation GPS** : Capture automatique des coordonnées pour validation cohérence adresse
- **Signature électronique** : Acceptation des CGU et contrat d'ouverture de compte
- **Statut temps réel** : Notification push à chaque étape (document reçu, en validation, compte activé/rejeté)

#### B. Backend & Traitement IA
- **API d'ingestion** : Réception sécurisée des images/vidéos (TLS 1.3)
- **Moteur OCR** : 
  - PaddleOCR déployé en service
  - Extraction structurée des champs (CNI, facture, attestation NIU)
  - Données extraites stockées en base avec lien vers images originales
- **Moteur biométrique** :
  - Détection de vivacité (MiniFASNet ou équivalent open source)
  - Face matching (DeepFace, FaceNet ou similaire)
  - Génération de vecteurs mathématiques (embeddings) pour comparaison
  - **Conservation des images/vidéos biométriques originales** chiffrées AES-256 (pas seulement les vecteurs)
- **Stockage sécurisé documents** :
  - Système de fichiers chiffré ou S3-compatible avec encryption at rest
  - Base de données : métadonnées + pointeurs vers fichiers chiffrés
  - Rétention conforme aux exigences COBAC (minimum 10 ans pour documents KYC)
  - Hash des fichiers pour garantir l'intégrité (détection de modification)
- **Workflow de validation** :
  - Calcul d'un score de confiance global (0-100%) par dossier basé sur :
    * Qualité OCR (lisibilité, champs détectés)
    * Score liveness (0-100%)
    * Score face matching (0-100%)
    * Cohérence données (nom CNI = nom facture, date facture < 3 mois, etc.)
  - Règles de routage : >95% → suggéré auto-validation, 70-95% → revue manuelle standard, <70% → rejet automatique ou reprise
  - **Validation humaine OBLIGATOIRE** : même pour scores >95%, un agent doit visualiser les documents et activer manuellement le compte
- **Intégrations minimales** :
  - **NIU** : 
    * Validation syntaxique locale (regex + clé de contrôle algorithmique si disponible)
    * Appel API DGI si disponible (avec fallback gracieux si indisponible)
    * En cas d'échec API : obligation pour l'agent de vérifier visuellement l'attestation NIU uploadée
  - **IBU** : Simulation locale pour MVP (API factice réaliste), appel API BEAC réelle en Phase 2 post-MVP
  - **Core Banking** : Création compte dans Sopra Banking Amplitude **uniquement après activation manuelle par agent**

#### C. Back-Office Agent (Interface de Validation)
- **File d'attente de validation** : 
  - Liste des dossiers en attente, triés par score de confiance et ancienneté
  - Filtres : plage de scores, date de soumission, statut (nouveau, en cours, bloqué)
  - Indicateurs visuels : flags (NIU non vérifié API, score liveness faible, etc.)
- **Vue détaillée dossier** :
  - **Galerie d'images originales** :
    * CNI recto (zoomable, haute résolution)
    * CNI verso (zoomable)
    * Attestation NIU (zoomable)
    * Facture de domicile (zoomable)
    * Photo/vidéo de selfie (lecture vidéo si vidéo, sinon frame extraite)
  - **Panneau de données extraites** :
    * Champs OCR avec niveau de confiance par champ (nom : 99%, date naissance : 87%, etc.)
    * Possibilité de corriger manuellement si OCR erroné
  - **Indicateurs biométriques** :
    * Score liveness : XX/100 avec visualisation des frames suspects si échec
    * Score face matching : XX/100 avec overlay de points de comparaison (optionnel)
  - **Vérifications croisées automatiques** :
    * Cohérence nom CNI ↔ nom facture (match oui/non)
    * Date facture < 3 mois (valide oui/non)
    * Format NIU valide (oui/non)
    * Géolocalisation dans zone cohérente avec adresse (oui/non)
  - **Résultats checks réglementaires** :
    * Screening PEP (résultat : aucun match / match potentiel avec détails)
    * Sanctions internationales (résultat : aucun match / match potentiel)
    * Recherche IBU/compte existant (résultat : nouveau client / compte détecté chez BICEC ou autre banque)
- **Actions agent** :
  - **Approuver et ACTIVER** : Bouton principal, déclenche la création de compte dans Core Banking et l'activation complète
  - **Demander complément** : Spécifier quels documents/infos sont manquants ou illisibles, notification push au client
  - **Rejeter définitivement** : Avec sélection de motif (document frauduleux, incohérences, client PEP non autorisé, etc.)
  - **Mettre en attente** : Pour escalade vers superviseur ou attente retour API externe
- **Audit trail** : 
  - Log de toutes les actions avec timestamp, identité agent, IP, et motif
  - Historique des consultations du dossier (qui a vu quoi, quand)
  - Capture de l'état du dossier au moment de l'activation (snapshot immuable)

#### D. Monitoring & Reporting
- **Métriques techniques** (Prometheus) :
  - Temps de traitement par étape (OCR, liveness, face matching, appels API)
  - Taux de succès/échec par service
  - Latence des APIs externes (DGI, IBU simulé)
  - Volumétrie de stockage documents (croissance par jour)
- **Métriques business** :
  - Nombre de sessions démarrées / complétées / abandonnées (par jour/semaine)
  - Taux de conversion par étape du funnel (avec identification des points de chute)
  - Distribution des scores de confiance (histogramme)
  - Délai moyen de validation humaine (temps entre soumission et activation par agent)
  - Taux d'erreur OCR nécessitant correction manuelle
  - Volumétrie par agent (nombre de dossiers traités, temps moyen)
- **Dashboard Grafana** : 
  - Vue 1 : Funnel de conversion avec métriques temps réel
  - Vue 2 : Santé système (latences, erreurs, disponibilité)
  - Vue 3 : Conformité et qualité (taux de rejet par motif, scores biométriques moyens)
  - Vue 4 : Charge de travail agents (files d'attente, SLA de traitement)

### Blocs SOUHAITABLES mais NON-CRITIQUES pour MVP (P1 - Post-MVP si temps disponible)

- Génération automatique de plan de localisation via FindMe (géolocalisation GPS + carte statique suffit pour MVP)
- Screening PEP/Sanctions en temps réel via API tierce (peut être semi-manuel/check liste au MVP)
- Multi-langue interface client (français/anglais - uniquement français au MVP acceptable)
- Deep linking depuis BiPay/CRESCO (peut venir après stabilisation MVP)
- Export PDF du dossier complet pour archivage physique
- Statistiques avancées BI (cohortes, prédiction d'abandon, scoring qualité agent)

### Blocs EXPLICITEMENT HORS PÉRIMÈTRE MVP

- **Fonctionnalités bancaires complètes** : paiements, virements, consultation solde, épargne → l'app est uniquement un portail d'onboarding
- **Gestion de compte existant** : modification coordonnées, opposition carte, etc. → à faire dans app bancaire séparée
- **Onboarding entreprises/morales** : uniquement personnes physiques majeures au MVP (pas de SAS, SARL, associations)
- **Comptes mineurs ou tutorés** : uniquement 18+ au MVP
- **Octroi de crédit ou scoring** : le compte est créé mais les produits de crédit sont hors scope
- **Trading / investissements** : hors scope MVP
- **Support multi-banques white-label** : solution dédiée BICEC uniquement
- **Mode offline** : connexion internet obligatoire (tout le traitement est serveur)
- **Permis de conduire comme pièce d'identité** : non accepté au Cameroun pour KYC bancaire selon réglementation locale

---

## 6. Contraintes & Non-Objectifs

### Contraintes FORTES

#### Réglementaires & Sécurité
- **Conformité BEAC/COBAC** : Respect des règlements sur les services de paiement, IBU (Identifiant Bancaire Unique), AML/CFT
- **Loi camerounaise 2024-017** : Protection des données personnelles, consentement explicite, droit à l'oubli, minimisation de la collecte
- **Conservation documentaire** : 
  - **Toutes les images/vidéos capturées doivent être conservées** chiffrées (AES-256) pour audit COBAC et validation humaine
  - Durée de rétention : minimum 10 ans selon normes bancaires camerounaises
  - Accès restreint : uniquement agents KYC autorisés + auditeurs externes
  - Traçabilité des accès : qui a consulté quel dossier, quand
- **Normes biométriques** : Standards ISO pour la capture faciale
- **Audit trail complet** : Traçabilité de toutes les actions (capture, traitement, validation humaine, activation) pour audits COBAC
- **Validation humaine obligatoire** : Même avec IA, un humain doit visualiser les documents et approuver l'activation du compte

#### Géographiques & Linguistiques
- **Pays** : Cameroun uniquement au MVP (extension CEMAC en Phase 2)
- **Langue** : Français uniquement au MVP (anglais en Phase 2 post-MVP)
- **Documents supportés** : 
  - **CNI camerounaise** (ancienne plastifiée + nouvelle 2024 biométrique avec QR code)
  - **Passeport CEMAC** (en alternative si client n'a pas de CNI)
  - **Attestation NIU** (DGI) - document séparé obligatoire
  - **Facture de domicile** (ENEO, CAMWATER, <3 mois)
  - **Permis de conduire NON accepté** comme pièce d'identité principale

#### Techniques
- **Intégrations obligatoires** :
  - Core Banking Sopra Amplitude
  - API DGI pour validation NIU (avec fallback validation format + vérification visuelle humaine si API indisponible)
  - API BEAC pour IBU (simulation factice réaliste au MVP, vraie API en Phase 2)
- **Plateformes** : iOS (>= 13.0) et Android (>= 8.0 / API 26)
- **Performances** :
  - Temps total utilisateur < 15 minutes (cible optimale 11 minutes)
  - Latence API p95 < 3 secondes
  - Support de 100-200 onboardings quotidiens au MVP (montée en charge progressive)
- **Stockage** : 
  - Estimation : ~15-20 MB par dossier complet (CNI recto/verso + NIU + facture + selfie vidéo)
  - Pour 1000 dossiers : ~15-20 GB
  - Planifier infrastructure de stockage avec croissance prévisionnelle

#### Temporelles
- **Roadmap MVP** : **3 mois de développement** (février - avril 2026)
  - **Mois 1 (février)** : Cadrage, setup environnement, développement parcours mobile (capture + OCR basique) + backend foundations
  - **Mois 2 (mars)** : Biométrie (liveness + face matching) + back-office validation + intégrations (NIU, IBU factice)
  - **Mois 3 (avril)** : Tests, sécurisation, monitoring, phase pilote 20-50 comptes sous surveillance
- **Phase pilote** : 20-50 comptes avec validation manuelle intensive et feedback itératif (dernières 2 semaines avril)
- **Validation réglementaire** : Préparation dossier pour audit COBAC avant lancement commercial (mai-juin 2026)

#### Identité Visuelle & UX
- **Charte BICEC** : L'application doit **respecter l'identité visuelle de la BICEC** (couleurs corporate, logo, typographie) pour garantir la reconnaissance de marque
- **Standards UX/UI professionnels** :
  - Contraste élevé pour lisibilité (WCAG AA minimum)
  - Navigation intuitive et cohérente
  - Feedback visuel immédiat à chaque action
  - Gestion d'erreur claire et constructive
  - Design responsive adapté aux petits écrans (5-6 pouces minimum)
  - Animations fluides mais sobres (pas de surcharge visuelle)
- **Équilibre** : Modernité et professionnalisme bancaire (pas trop "fun" ni trop austère)

### Non-Objectifs (Ce Que Nous NE Faisons PAS au MVP)

1. **Pas une app bancaire complète** : Uniquement l'onboarding, pas de gestion de compte, virements, paiements marchands
2. **Pas de remplacement des apps existantes** : BiPay et CRESCO continuent d'exister, cette plateforme leur fournit l'identité vérifiée
3. **Pas de support multi-banques** : Solution dédiée BICEC, pas une plateforme SaaS pour d'autres banques
4. **Pas de KYC pour personnes morales** : Uniquement personnes physiques majeures (18+), pas de comptes d'entreprises au MVP
5. **Pas de support offline** : L'onboarding nécessite une connexion internet stable (validation serveur + APIs externes obligatoires)
6. **Pas de white-label générique** : Interface aux couleurs BICEC uniquement, identité de marque forte
7. **Pas de chatbot ou support client intégré** : FAQ basique suffisant au MVP, escalade vers centre d'appel existant si nécessaire
8. **Pas de suppression automatique des images après traitement** : Conservation obligatoire pour conformité et validation humaine

---

## 7. Critères de Succès du MVP

### Métriques Quantitatives (Phase Pilote - 20-50 comptes)
- **Taux de complétion** : >75% des utilisateurs qui commencent vont jusqu'à la soumission finale
- **Temps moyen client** : <15 minutes (objectif optimisé : 11 minutes)
- **Taux de conformité** : >95% des dossiers validés par agents sont audit-ready (pas de document manquant ou incohérent détecté post-activation)
- **Taux d'erreur OCR nécessitant correction** : <10% (90% des champs extraits correctement du premier coup)
- **Faux positifs biométriques** : <2% (utilisateurs légitimes bloqués à tort par liveness ou face matching)
- **Détection fraude tentée** : >90% des documents frauduleux identifiés par IA ou agent avant activation
- **Délai de validation humaine** : <2h en heures ouvrables (de soumission client à décision agent)
- **Satisfaction client (CSAT)** : >4.2/5 (sondage post-onboarding auprès des 50 pilotes)
- **Zéro perte de données** : Aucun document capturé ne doit être perdu ou corrompu

### Métriques Qualitatives
- **Validation réglementaire** : 
  - Dossier de conformité complet préparé pour COBAC
  - Pas de non-conformité critique identifiée en pré-audit interne
  - Traçabilité audit-ready testée sur les 50 dossiers pilotes
- **Retour agents back-office** : 
  - Interface jugée intuitive et complète (feedback qualitatif positif)
  - Réduction >50% du temps de traitement vs processus papier actuel
  - Agents capables de détecter incohérences plus rapidement grâce aux outils visuels
- **Stabilité technique** : 
  - Zéro incident de sécurité critique (fuite de données, compromission biométrique)
  - Uptime >99% pendant la phase pilote
  - Aucune corruption de fichier chiffré

---

## 8. Risques Identifiés & Mitigations

### Risques Techniques

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Espace de stockage insuffisant pour conservation des images
| Élevé | Moyenne | Estimation préalable (15-20 MB/dossier × volume prévu), provisionnement infrastructure cloud/NAS avec encryption, archivage progressif |
| Performance OCR insuffisante sur anciennes CNI usées | Élevé | Élevée | Fine-tuning PaddleOCR sur dataset local de CNI camerounaises, fallback validation humaine systématique, amélioration itérative |
| Faux négatifs biométriques (rejet d'utilisateurs légitimes) | Moyen | Moyenne | Seuils ajustables, possibilité de retry avec meilleure guidance, escalade vers validation humaine |
| Indisponibilité prolongée API DGI | Moyen | Moyenne | Validation format NIU locale + vérification visuelle obligatoire de l'attestation par agent, file d'attente de réconciliation quand API revient |

### Risques Réglementaires

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Conservation des images jugée non-conforme RGPD/Loi 2024-017 | Élevé | Faible | Validation juridique préalable avec DPO, consentement explicite client, chiffrement fort, politique de rétention documentée |
| Audit COBAC négatif sur processus de validation | Élevé | Faible | Validation humaine obligatoire (pas de STP complet au MVP), audit trail exhaustif, tests en conditions réelles avec 50 pilotes |
| IBU non-fonctionnel en production | Moyen | Moyenne | Simulation réaliste au MVP, migration progressive vers vraie API BEAC en Phase 2, pas de blocage client |

### Risques Délais (3 mois)

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Sous-estimation complexité biométrie | Élevé | Élevée | Utilisation de bibliothèques open source éprouvées (DeepFace, MiniFASNet), POC rapide mois 1, réduction périmètre si nécessaire |
| Retards intégration Core Banking | Élevé | Moyenne | Mock/Stub pour développement parallèle, intégration réelle uniquement en mois 3, implication équipe IT dès mois 1 |
| Qualité dataset OCR insuffisante | Moyen | Moyenne | Constitution dataset dès mois 1 (collecter 500-1000 CNI anonymisées), crowdsourcing interne BICEC |

---

## 9. Références & Documents Sources

Ce document synthétise les informations des sources suivantes (consultables par le BA/PM pour approfondissement) :

### Documents Stratégiques
- **PRD détaillé** (`prd_kyc_ocr.md`) : Spécifications fonctionnelles complètes, user stories, success metrics
- **Plan d'Action Stratégique** : Vision business, architecture technique, roadmap 12 mois, KPIs, analyse compétitive, détails conformité

### Documents Techniques
- **Rapport d'Expertise Technique** : Stack technologique (PaddleOCR, MiniFASNet, DeepFace, Flutter, FastAPI), spécifications matérielles, plan de données/dataset, gestion stockage
- **Cadrage Réglementaire** : Détails conformité BEAC/COBAC, Loi 2024-017, validation NIU/IBU, mécanismes de fallback APIs externes, exigences conservation documentaire

### Benchmarks & Inspirations
- **Néobanques internationales** : Revolut, N26 (onboarding fluide, biométrie embarquée, design moderne)
- **Mobile Money local** : Wave, MTN MoMo, Orange Money (rapidité, accessibilité 24/7, UX simplifiée)
- **Banques digitales CEMAC** : Observer les initiatives existantes pour identifier les gaps et opportunités de différenciation

### Standards Techniques
- **ISO/IEC 19794-5** : Format de capture d'image faciale
- **ISO/IEC 30107** : Détection d'attaques par présentation (liveness)
- **RGPD/Loi 2024-017** : Privacy by design, minimisation des données, conservation sécurisée, consentement explicite
- **COBAC** : Normes de conservation documentaire KYC (10 ans minimum), audit trail, validation humaine

---

## 10. Prochaines Étapes Recommandées

Pour transformer ce document en PRD actionnable, le BA devra :

1. **Valider les hypothèses business** avec parties prenantes :
   - Direction BICEC : validation ROI, budget infrastructure stockage
   - Compliance/DPO : validation conservation images, consentement, audit trail
   - IT : faisabilité intégration Core Banking, capacité stockage, sécurité
   - Agences : validation besoins agents back-office, workflow actuel
   
2. **Affiner les user stories** : Décomposer chaque scénario en stories atomiques avec critères d'acceptation INVEST, notamment :
   - US1 : "En tant que client, je capture ma CNI avec guidage auto-cadrage..."
   - US2 : "En tant qu'agent, je visualise les documents originaux d'un dossier pour vérifier la cohérence OCR..."
   - US3 : "En tant que système, je stocke de façon chiffrée toutes les images capturées avec traçabilité d'accès..."

3. **Créer un backlog priorisé** : MoSCoW (Must/Should/Could/Won't) pour chaque fonctionnalité avec dépendances techniques identifiées

4. **Définir les wireframes critiques** : 
   - Parcours mobile : 8-10 écrans clés (login, capture CNI, selfie, NIU, signature, confirmation)
   - Back-office agent : 4-5 vues (dashboard, détail dossier avec galerie images, actions validation)

5. **Établir les règles métier détaillées** :
   - **Seuils biométriques** : Quand auto-suggérer validation (>95%), quand forcer revue manuelle (70-95%), quand rejeter automatiquement (<70%)
   - **Validation NIU** : Regex exacte, algorithme clé de contrôle (à documenter après reverse engineering), comportement si API DGI down
   - **Workflow validation** : SLA de traitement (ex: <2h en heures ouvrables), règles d'escalade superviseur
   - **Cohérence croisée** : Liste exhaustive des checks automatiques (nom CNI vs facture, date facture, format NIU, etc.)

6. **Spécifier les contrats d'API** : 
   - Endpoints REST, payloads JSON, codes erreur, authentification pour chaque intégration :
     * Mobile → Backend : upload image, status dossier
     * Backend → OCR : extraction champs
     * Backend → Biométrie : liveness check, face matching
     * Backend → DGI : validation NIU
     * Backend → IBU (factice) : check doublon
     * Backend → Core Banking : création compte

7. **Définir l'architecture de stockage sécurisé** :
   - Schéma base de données : tables (users, dossiers, documents, audit_logs)
   - Filesystem chiffré : structure dossiers, naming convention, encryption keys management
   - Politique de rétention : durée, archivage, purge éventuelle (après 10+ ans)
   - RBAC : qui peut accéder à quelles images (agents KYC, auditeurs, admin système)

8. **Planifier les sprints** (6 sprints de 2 semaines) :
   - **Sprint 1-2 (février)** : Setup + Parcours mobile capture (CNI, NIU, facture) + OCR basique
   - **Sprint 3-4 (mars)** : Biométrie (liveness + face matching) + Stockage sécurisé + Back-office v1
   - **Sprint 5-6 (avril)** : Intégrations (DGI, IBU, Core Banking) + Monitoring + Pilote 50 comptes

9. **Définir la stratégie de test** :
   - **Jeux de données** : 
     * 500-1000 CNI camerounaises anonymisées (anciennes + nouvelles)
     * 100 attestations NIU
     * 100 factures ENEO/CAMWATER
     * 50 vidéos selfie avec tentatives de spoofing
   - **Scénarios de test** :
     * Fonctionnels : parcours complet happy path, edge cases (retry, fallback API)
     * Performance : 100 dossiers soumis en 1h, latence <3s
     * Sécurité : tests pénétration, audit encryption, RBAC
     * Conformité : vérification audit trail, conservation documentaire, consentement
   - **Critères de recette** : checklist validation avant pilote (tous US validés, 0 bug critique, perf OK)

10. **Constituer le dataset d'entraînement** :
    - Collecter dès février 500-1000 CNI camerounaises via :
      * Crowdsourcing interne BICEC (employés volontaires)
      * Partenariats agences (clients existants consentants)
      * Génération synthétique si nécessaire (attention qualité)
    - Anonymisation obligatoire (floutage visages, masquage noms sur dataset public)
    - Labellisation : OCR manuel pour ground truth, catégorisation (ancienne/nouvelle CNI, qualité bonne/moyenne/mauvaise)

---

**Document préparé pour** : Mary (Business Analyst)  
**Objectif** : Base de cadrage pour rédaction du PRD complet  
**Version** : 1.1 - Corrections intégrées (conservation images, NIU séparé CNI, délai 3 mois, identité visuelle BICEC)  
**Date** : 7 février 2026  
**Prochaine revue** : Atelier de cadrage avec parties prenantes (semaine du 10 février)

---

# Document de Cadrage Projet : Plateforme KYC Digital Biométrique

## 1. Contexte & Vision

### Situation actuelle
La BICEC (et les banques de la zone CEMAC) utilisent un processus d'onboarding client entièrement papier qui prend **48 heures à 14 jours** pour ouvrir un compte. Les clients doivent se déplacer en agence pendant les heures ouvrables, remplir des formulaires manuels, et attendre une validation administrative lente. Ce modèle génère :
- Un backlog permanent de dossiers incomplets dans les agences
- Une expérience utilisateur frustrante comparée aux opérateurs Mobile Money (MTN, Orange, Wave)
- Des coûts d'acquisition client (CAC) élevés
- Une perte de parts de marché chez les jeunes (18-35 ans) qui préfèrent les solutions digitales

### Vision produit
Créer une **plateforme mobile-first d'onboarding digital 100% à distance** permettant d'ouvrir un compte bancaire en **moins de 15 minutes** (benchmark cible : 11 minutes), accessible 24/7 depuis un smartphone. Cette plateforme combine :
- Capture intelligente de documents d'identité (OCR + QR code)
- Vérification biométrique faciale avec détection de vivacité
- Validation automatique des données fiscales et de localisation
- Intégration temps réel avec le core banking
- Interface de démonstration des fonctionnalités bancaires selon le statut du compte

### Pourquoi c'est critique
- **Business** : Réduction du CAC par 3, accélération de la croissance client, compétitivité face aux néobanques et Mobile Money
- **Opérationnel** : Libération du personnel des tâches administratives pour se concentrer sur le conseil à forte valeur ajoutée
- **Stratégique** : Création d'un socle d'identité numérique réutilisable pour tous les services digitaux de la banque (paiements, crédits, etc.)
- **Réglementaire** : Conformité renforcée avec BEAC/COBAC grâce à l'automatisation et la traçabilité complète

---

## 2. Problèmes à Résoudre

**Problème principal** : Les clients potentiels abandonnent le processus d'ouverture de compte car il est trop long, contraignant et incompatible avec leurs modes de vie digitaux.

**Problèmes secondaires** :
1. **Friction temporelle** : Impossible d'ouvrir un compte en dehors des heures bancaires (soir, weekend)
2. **Qualité des données** : 30-40% des dossiers papier sont incomplets ou contiennent des erreurs de saisie, nécessitant des allers-retours
3. **Risque de fraude** : Difficulté à détecter les faux documents et les usurpations d'identité avec la validation manuelle
4. **Coûts opérationnels** : Le traitement manuel mobilise 15-20 minutes de temps agent par dossier, sans valeur ajoutée
5. **Conformité** : Difficulté à maintenir une traçabilité audit-ready pour les contrôles COBAC/BEAC
6. **Connectivité instable** : L'infrastructure internet au Cameroun est peu fiable, causant des interruptions fréquentes lors de processus en ligne

**Exemples concrets** :
- **Marie, entrepreneure à Douala** : Doit fermer sa boutique une demi-journée pour se rendre en agence, faire la queue 45 minutes, remplir des formulaires, puis revenir 3 jours plus tard car il manquait une pièce.
- **Agent en agence** : Passe 20 minutes à saisir manuellement les données d'une CNI usée, avec risque d'erreur de frappe, puis doit scanner 5 documents papier qui finissent dans un backlog de validation de 2 semaines.
- **Responsable conformité** : Reçoit des dossiers incomplets 48h après l'ouverture, doit relancer le client par téléphone, créant des délais supplémentaires et une mauvaise expérience.
- **Client avec connexion instable** : Perd sa progression après avoir capturé 3 documents car sa connexion 3G a coupé, doit tout recommencer depuis le début, abandon frustré.

---

## 3. Utilisateurs Cibles / Personas

### Persona 1 : Le Client Final (Nouveau)
- **Profil** : Marie, 24 ans, entrepreneure à Douala, utilisatrice active d'Orange Money et Instagram
- **Objectifs** : 
  - Ouvrir un compte professionnel rapidement sans perdre une journée de travail
  - Expérience simple et moderne comparable aux apps qu'elle utilise déjà
  - Sécurité de ses données personnelles et biométriques
  - Comprendre quelles fonctionnalités bancaires elle pourra utiliser selon son statut de validation
- **Frustrations actuelles** :
  - Horaires d'agence incompatibles avec son activité commerciale
  - Processus opaque : elle ne sait pas combien de temps ça va prendre
  - Déplacements multiples si un document manque
  - Connexion internet qui coupe régulièrement, perte de progression

### Persona 2 : L'Agent Back-Office / Compliance (Validation KYC)
- **Profil** : Jean, 32 ans, chargé de conformité KYC à l'agence Yaoundé-Centre
- **Objectifs** :
  - Valider rapidement les dossiers complets avec toutes les pièces requises
  - Visualiser les documents originaux capturés pour vérifier la cohérence avec les données extraites par OCR
  - Identifier facilement les cas suspects (PEP, sanctions, documents frauduleux)
  - Maintenir un taux de conformité >95% lors des audits COBAC
  - Approuver l'activation des comptes validés
- **Frustrations actuelles** :
  - 60% des dossiers arrivent incomplets, nécessitant des relances manuelles
  - Difficile de vérifier l'authenticité d'un document papier (faux, photocopies)
  - Pas de vue consolidée sur le pipeline de validation
  - Impossible de contrôler visuellement la qualité des captures sans avoir accès aux images originales

### Persona 3 : Le Responsable Opérations / Intégration Core Banking
- **Profil** : Thomas, 38 ans, responsable des opérations bancaires
- **Objectifs** :
  - Créer les comptes validés dans Sopra Banking Amplitude
  - Traiter par lots les dossiers approuvés par les agents KYC
  - Avoir une visibilité sur les comptes en attente de création dans Amplitude
  - Gérer les erreurs d'intégration (rejets Amplitude)
- **Frustrations actuelles** :
  - Processus manuel de création de compte dans le système legacy
  - Pas de traçabilité entre validation KYC et création effective dans Core Banking
  - Impossibilité de traiter en masse

### Persona 4 : Le Responsable d'Agence / Manager
- **Profil** : Sylvie, 40 ans, directrice d'agence régionale
- **Objectifs** :
  - Augmenter le nombre d'ouvertures de comptes mensuelles sans recruter
  - Réduire le temps de traitement et les erreurs
  - Avoir de la visibilité sur la performance (taux de conversion, points de blocage)
  - Désactiver des comptes frauduleux ou problématiques si nécessaire
- **Frustrations actuelles** :
  - Équipes surchargées par la saisie manuelle et la gestion papier
  - Perte de clients impatients qui vont chez la concurrence
  - Pas de métriques en temps réel pour piloter l'activité

---

## 4. Scénarios d'Usage Clés

### Scénario 1 : Onboarding client complet (Happy Path)
1. **Découverte** : Marie télécharge l'app suite à une recommandation d'amie
2. **Inscription initiale** : Elle entre son numéro de téléphone, reçoit un code SMS, crée un mot de passe
3. **Capture d'identité** : L'app la guide pour photographier sa CNI (recto + verso), lit automatiquement le QR code ou extrait le texte par OCR
4. **Vérification biométrique** : Elle enregistre un selfie vidéo de 3 secondes (cligne des yeux, tourne la tête vers position aléatoire indiquée), le système compare avec la photo de la CNI
5. **Données complémentaires** : 
   - Elle capture/saisit manuellement son NIU depuis son attestation DGI (document séparé de la CNI)
   - Upload d'une facture d'électricité/eau récente (ENEO/CAMWATER)
   - Autorisation de la géolocalisation GPS
6. **Validation et signature** : Elle révise les informations pré-remplies, accepte les conditions, signe électroniquement
7. **Résultat** : Elle reçoit une confirmation immédiate, son dossier entre en validation, compte activé sous 2-24h avec notification push
8. **Post-activation** : Elle accède à l'app et découvre les fonctionnalités disponibles selon son statut (compte actif avec NIU = accès complet, compte actif sans NIU = fonctionnalités limitées)

### Scénario 2 : Validation back-office KYC avec vérification visuelle
1. **Notification** : Jean reçoit une alerte qu'un nouveau dossier est prêt pour revue
2. **Consultation** : Il accède à un tableau de bord listant les dossiers par score de confiance (>95% = validation automatique suggérée, 70-95% = revue manuelle, <70% = rejet/reprise)
3. **Vérification croisée** : 
   - Il visualise **les photos originales** (CNI recto/verso, selfie, facture, attestation NIU)
   - Il compare visuellement les documents avec les données extraites par OCR
   - Il vérifie la cohérence : 
     * Photo CNI ↔ selfie
     * Nom CNI ↔ nom sur facture
     * Nom CNI ↔ nom sur attestation NIU (vérification que le NIU appartient bien à la personne identifiée)
     * NIU sur attestation ↔ NIU saisi
   - Il consulte les scores biométriques (liveness, face matching)
   - Il vérifie les résultats de screening PEP/sanctions
4. **Décision finale** : Jean **approuve le dossier** après vérification, le marquant comme "Validé - Prêt pour création compte"
5. **Notification client** : Marie reçoit une notification "Votre dossier est validé ! Votre compte sera activé sous peu."
6. **Archivage** : Le dossier passe dans la file d'attente pour création dans Amplitude

### Scénario 3 : Création de compte dans Core Banking (Opérations)
1. **Accès interface** : Thomas se connecte à l'interface web d'opérations bancaires
2. **File d'attente** : Il visualise la liste des comptes validés par les agents KYC mais **pas encore créés dans Sopra Banking Amplitude**
3. **Sélection par lots** : Il sélectionne 10-50 dossiers validés pour traitement en masse
4. **Lancement création** : Il lance le processus d'intégration directe dans Amplitude.
5. **Suivi** : Il voit en temps réel les statuts :
   - "En cours de création dans Amplitude..."
   - "Créé avec succès - Compte N° 1234567890"
   - "Erreur : champ manquant" (avec détails)
6. **Gestion erreurs** : Pour les échecs, il peut :
   - Corriger manuellement et relancer
   - Marquer pour investigation
   - Notifier l'équipe KYC si données manquantes
7. **Activation finale** : Une fois le compte créé dans Amplitude, le statut du dossier passe à "Compte actif", Marie reçoit notification push avec ses identifiants bancaires complets
8. **Traçabilité** : Tout est loggé (qui a créé quand, numéro de compte Amplitude, etc.)

### Scénario 4 : Gestion d'exception (liveness échouée 3 fois)
1. **Problème** : Le système détecte un éventuel spoofing lors du selfie de Marie
2. **Retry 1 & 2** : L'app lui donne des instructions plus claires après chaque échec
3. **Échec 3ème tentative** : Le système affiche : "Nous n'avons pas pu valider votre identité. Votre session a expiré. Veuillez recommencer le processus depuis le début."
4. **Suppression session** : Toutes les données capturées sont effacées, Marie doit créer une nouvelle inscription
5. **Alternative** : Un message propose "Vous rencontrez des difficultés ? Visitez une agence BICEC pour finaliser votre inscription"

### Scénario 5 : Rejet par agent avec recommencement
1. **Détection incohérence** : Jean identifie que la photo sur la CNI ne correspond clairement pas au selfie (score 45%), ou détecte un document frauduleux
2. **Rejet avec motif** : Il clique "Rejeter définitivement" et sélectionne le motif : "Incohérence photo CNI/selfie" ou "Document frauduleux suspecté"
3. **Notification client** : Marie reçoit une notification : "Votre demande n'a pas pu être validée. Raison : [motif]. Vous pouvez soumettre une nouvelle demande avec des documents valides."
4. **Effacement données** : Le dossier est marqué "Rejeté", les données sont conservées pour audit mais le compte n'est jamais créé
5. **Nouvelle tentative** : Marie doit recommencer entièrement le processus avec de nouveaux documents

### Scénario 6 : Connexion internet instable (résilience)
1. **Contexte** : Marie est en train de capturer sa facture, sa connexion 3G coupe pendant l'upload
2. **Sauvegarde locale** : L'app détecte la perte de connexion et sauvegarde localement (cache sécurisé sur l'appareil) :
   - La photo CNI déjà capturée
   - Le selfie déjà enregistré
   - Les données déjà saisies
3. **Reconnexion** : Quand la connexion revient (automatiquement détectée), l'app affiche : "Connexion rétablie. Reprise de l'envoi..."
4. **Reprise automatique** : L'app reprend l'upload depuis le dernier point d'interruption (upload de la facture)
5. **Upload progressif** : Barre de progression avec indication de fiabilité : "Envoi document 3/4... 75%"
6. **Confirmation** : Une fois tous les documents envoyés, Marie voit "Tous vos documents ont été reçus avec succès"
7. **Timeout** : Si la connexion ne revient pas après 5 minutes, l'app affiche : "Connexion interrompue. Vos données sont sauvegardées. Vous pouvez fermer l'app et revenir plus tard pour continuer."

### Scénario 7 : Découverte des fonctionnalités selon statut de compte
1. **Compte actif avec NIU validé** (statut : FULL_ACCESS) :
   - Marie se connecte, voit tableau de bord complet
   - Sections disponibles (même si prototypes non-fonctionnels) :
     * Consultation solde (fictif)
     * Virements IBAN/Mobile Money (UI présente, message "Fonctionnalité disponible prochainement")
     * Épargne / Placements (UI présente, taux affichés, simulateur)
     * Trading actions BVMAC (UI marché boursier, graphiques)
     * Demande de crédit (formulaire simulé)
   - Badge visible : "Compte vérifié ✓ - Accès complet"

2. **Compte actif SANS NIU validé** (statut : LIMITED_ACCESS) :
   - Marie se connecte, voit message d'avertissement en haut : "⚠️ Complétez votre NIU pour débloquer toutes les fonctionnalités"
   - Sections disponibles :
     * Consultation solde (fictif) ✓
     * Virements réception uniquement (peut recevoir, pas envoyer) ✓
     * Paramètres compte ✓
   - Sections BLOQUÉES (grayed out + cadenas) :
     * Virements sortants ❌ "NIU requis"
     * Épargne / Placements ❌ "NIU requis pour produits générateurs de revenus"
     * Trading ❌ "Conformité fiscale requise"
     * Crédit ❌ "NIU requis"
   - Bouton CTA : "Compléter mon profil fiscal" → Redirect vers upload attestation NIU

3. **Compte en attente de validation** (statut : PENDING) :
   - Marie se connecte, voit écran statut :
     * "Votre dossier est en cours de validation par nos équipes"
     * Timeline visuelle : Inscription ✓ → Documents envoyés ✓ → Validation ⏳ → Activation
     * Estimation : "Délai habituel : 2-24h"
   - Sections disponibles :
     * Informations produit (brochures, tarifs)
     * FAQ / Support
     * Possibilité d'ajouter documents complémentaires si demandés

### Scénario 8 : Désactivation de compte (Manager)
1. **Détection fraude** : Sylvie (manager) reçoit un signalement interne de fraude suspectée sur un compte client
2. **Accès interface admin** : Elle se connecte au portail manager
3. **Recherche compte** : Elle recherche le compte par numéro, nom ou NIU
4. **Vue détails** : Elle visualise l'historique complet (dossier KYC, transactions récentes si intégration future, alertes)
5. **Désactivation** : Elle clique "Désactiver compte" avec sélection de motif : "Fraude suspectée", "Compte dormant", "Demande client", "Décès"
6. **Confirmation** : Popup de confirmation avec champ commentaire obligatoire
7. **Effet** : Le compte passe en statut DISABLED :
   - Le client ne peut plus se connecter à l'app (message : "Votre compte a été désactivé. Contactez votre agence.")
   - Toutes opérations bloquées dans Amplitude (si intégration future)
   - Dossier marqué pour investigation compliance
8. **Traçabilité** : Action loggée avec timestamp, identité manager, motif

### Scénario 9 : Suivi de performance (Manager)
1. **Dashboard** : Sylvie se connecte au portail web manager et voit :
   - Nombre d'onboardings démarrés/complétés aujourd'hui
   - Taux de conversion par étape (inscription → capture CNI → NIU → liveness → signature)
   - Temps moyen de traitement (client + validation agent + création Amplitude)
   - Taux de rejet par motif
   - Charge de travail : 
     * Agents KYC : X dossiers en attente validation
     * Opérations : Y comptes validés en attente création Amplitude
   - Taux d'abandon par étape (identification des points de friction)
2. **Analyse** : Elle identifie que 25% des utilisateurs abandonnent à l'étape "upload facture" → décision d'améliorer les instructions
3. **Drill-down** : Elle clique sur "Échecs liveness" et voit que 60% surviennent entre 20h-22h (mauvais éclairage soirée)
4. **Reporting** : Elle exporte les données pour le comité de direction mensuel

---

## 5. Périmètre Fonctionnel Souhaité (MVP)

### Blocs fonctionnels INDISPENSABLES (P0 - MVP - 3 mois : février-avril 2026)

#### A. Parcours Client Mobile

##### A1. Inscription sécurisée
- Numéro téléphone + OTP SMS
- Création mot de passe (validation robustesse)
- Consentement explicite RGPD-like (Loi 2024-017) avec texte détaillé
- Device fingerprinting basique (ID appareil pour traçabilité)

##### A2. Capture CNI (recto + verso)
- Auto-cadrage avec guidage visuel en temps réel :
  * Cadre overlay pour positionner la CNI
  * Détection luminosité (trop sombre / éblouissement)
  * Détection stabilité (appareil bouge trop)
  * Validation qualité image avant acceptation (netteté, résolution)
- Lecture QR code (nouvelles CNI 2024 biométriques) en priorité
- Fallback OCR (anciennes CNI plastifiées) via PaddleOCR si QR absent/illisible
- Extraction automatique : nom, prénom, date naissance, numéro CNI, date délivrance, lieu délivrance
- **Stockage sécurisé des photos originales** (recto + verso) chiffrées AES-256
- Retry jusqu'à 3 tentatives, puis effacement session et recommencement

##### A3. Capture/Saisie NIU
- **Le NIU est un document séparé** géré par la DGI (pas sur la CNI)
- Option 1 : Photo de l'attestation d'immatriculation fiscale avec OCR du numéro
- Option 2 : Saisie manuelle du NIU avec masque de saisie (format : X0000000000000X)
- Validation format locale en temps réel (regex : ^[A-Z][0-9]{12}[A-Z]$)
- **Stockage de la photo de l'attestation NIU** pour vérification humaine
- Possibilité de "Sauter pour l'instant" avec avertissement : "Votre compte aura des restrictions sans NIU"

##### A4. Liveness Detection
- Vidéo-selfie 3-5 secondes avec instructions aléatoires affichées :
  * "Regardez la caméra"
  * "Clignez des yeux 2 fois"
  * "Tournez la tête vers la gauche/droite/haut" (position aléatoire)
- Détection anti-spoofing (photo, écran, masque) via MiniFASNet ou équivalent
- Feedback temps réel : "Parfait, restez ainsi...", "Trop sombre, rapprochez-vous d'une fenêtre..."
- **Stockage de la vidéo/photo de selfie** chiffrée
- Retry jusqu'à 3 tentatives, puis effacement session

##### A5. Face Matching
- Comparaison biométrique automatique selfie ↔ photo CNI
- Score de confiance calculé (0-100%), seuil >98.5% pour suggestion auto-validation
- Génération vecteurs mathématiques (embeddings) pour comparaison future
- Résultat caché au client (traité en backend)

##### A6. Justificatif de domicile
- Upload facture récente (ENEO électricité, CAMWATER eau)
- Guidage : "Facture de moins de 3 mois, votre nom doit être visible"
- OCR pour extraction automatique :
  * Date facture (validation < 3 mois)
  * Nom titulaire (comparaison avec nom CNI)
  * Adresse (extraction basique)
- **Stockage de la photo de facture** chiffrée
- Retry illimité (mais session peut expirer après 30 min inactivité)

##### A7. Géolocalisation GPS
- Capture automatique des coordonnées lors de l'étape adresse
- Demande de permission explicite : "BICEC souhaite accéder à votre localisation pour vérifier la cohérence de votre adresse"
- Validation cohérence basique : coordonnées au Cameroun (latitude/longitude dans range attendu)
- Affichage carte OpenStreetMap avec marqueur pour confirmation visuelle par client

##### A8. Signature électronique
- Récapitulatif de toutes les données saisies/capturées
- Affichage des conditions générales (CGU) et contrat d'ouverture de compte (scrollable, version PDF téléchargeable)
- Case à cocher : "J'accepte les conditions générales et le contrat d'ouverture de compte"
- Signature tactile (doigt ou stylet) sur zone dédiée
- Capture signature + timestamp

##### A9. Gestion de session et résilience réseau
- **Sauvegarde locale progressive** :
  * Chaque document capturé est sauvegardé en cache sécurisé local (chiffré sur l'appareil)
  * En cas de perte de connexion, les données ne sont pas perdues
  * Upload asynchrone avec retry automatique
- **Détection de connectivité** :
  * Monitoring continu de la connexion réseau
  * Affichage indicator : "Connexion stable ✓" / "Connexion faible ⚠️" / "Hors ligne ❌"
- **Upload progressif avec chunking** :
  * Envoi des images/vidéos par morceaux (chunks de 500 KB - 1 MB)
  * Reprise automatique en cas d'interruption (ne réenvoie que les chunks manquants)
  * Barre de progression par document : "Envoi CNI recto... 45%"
- **Timeout et récupération** :
  * Si connexion perdue > 5 minutes : message "Vos données sont sauvegardées. Vous pouvez fermer l'app et revenir quand votre connexion sera meilleure."
  * À la réouverture : "Reprendre là où vous vous êtes arrêté ?" → Oui/Non
  * Si "Non" ou session expirée (>24h) : effacement et recommencement
- **Validation backend progressive** :
  * Chaque document reçu est immédiatement acknowledgé : "✓ CNI recto reçue"
  * Le client peut continuer à capturer pendant que le backend traite en arrière-plan

##### A10. Statut temps réel et notifications
- Écran de statut dans l'app avec timeline visuelle :
  * Inscription ✓
  * Documents envoyés ✓
  * Validation en cours ⏳ / Validation complète ✓
  * Compte actif ✓
- Notifications push à chaque changement de statut :
  * "Vos documents ont été reçus avec succès"
  * "Votre dossier est en cours de validation"
  * "Votre compte est activé ! Bienvenue chez BICEC"
  * "Votre demande nécessite des informations complémentaires" (avec détails)
  * "Votre demande n'a pas pu être validée" (avec motif et possibilité de recommencer)

##### A11. Interface post-onboarding (Prototypes fonctionnalités bancaires)
**Objectif** : Démontrer l'expérience bancaire selon le statut du compte (FULL_ACCESS vs LIMITED_ACCESS vs PENDING)

- **Écran d'accueil avec statut compte** :
  * Badge visible : "Compte vérifié ✓" / "Compte restreint ⚠️ NIU manquant" / "En attente de validation ⏳"
  * Solde fictif affiché (ex: 0 FCFA au départ)
  
- **Navigation par onglets/menu** :
  * Accueil
  * Transactions (prototype)
  * Épargne & Placements (prototype)
  * Trading (prototype)
  * Crédit (prototype)
  * Paramètres

- **Fonctionnalités FULL_ACCESS (NIU validé)** :
  * **Accueil** : Résumé compte, solde, dernières transactions (données fictives)
  * **Transactions** :
    - Virements IBAN : Formulaire complet (bénéficiaire, montant, motif) → Au clic "Envoyer" : modal "Fonctionnalité disponible prochainement"
    - Mobile Money : Sélection opérateur (MTN, Orange), numéro, montant → Modal "Bientôt disponible"
    - Historique : Liste de transactions fictives avec filtres (date, type, montant)
  * **Épargne & Placements** :
    - Liste de produits d'épargne (Compte épargne classique 2.5%, Compte à terme 4.25%)
    - Simulateur de rendement : Saisie montant + durée → Calcul intérêts
    - Bouton "Souscrire" → Modal explicatif
  * **Trading BVMAC** :
    - Interface marché boursier : Liste d'actions avec cours en temps réel (données fictives ou API publique BVMAC si disponible)
    - Graphiques prix (bibliothèque charting)
    - Bouton "Passer un ordre" → Formulaire (action, quantité, prix limite) → Modal
  * **Crédit** :
    - Types de crédit disponibles (Crédit personnel, Auto, Immobilier)
    - Simulateur : Montant, durée → Calcul mensualités
    - Formulaire de demande → Modal "Votre demande sera traitée par un conseiller"
  * **Paramètres** : Profil, Sécurité, Notifications, Documents KYC (consultation)

- **Fonctionnalités LIMITED_ACCESS (Pas de NIU)** :
  * Bandeau persistant en haut : "⚠️ Complétez votre NIU pour accéder à toutes les fonctionnalités"
  * **Accueil** : Solde visible, mais alertes sur restrictions
  * **Transactions** :
    - Réception virements : ✓ Disponible (affichage IBAN du compte)
    - Émission virements : ❌ Cadenas + "NIU requis pour effectuer des virements sortants"
  * **Épargne, Trading, Crédit** : ❌ Sections entièrement grisées avec cadenas et message "NIU requis - Ces fonctionnalités génèrent des revenus soumis à déclaration fiscale"
  * **Paramètres** : Bouton CTA proéminent "Compléter mon profil fiscal" → Redirect vers upload attestation NIU avec instructions

- **Fonctionnalités PENDING (En attente validation)** :
  * Écran de statut avec illustration :
    - Timeline : Inscription ✓ → Documents ✓ → Validation ⏳
    - Message : "Votre dossierest en cours d'examen. Nos équipes reviendront vers vous sous 2 à 24 heures."
    - Estimation en heures : "Temps écoulé : 3h / Délai moyen : 12h"
  * Sections disponibles :
    - Informations produit (tarifs, brochures PDF)
    - FAQ
    - Support (chat ou formulaire contact)
    - Possibilité d'ajouter documents si demande agent

**Note importante** : Toutes ces interfaces sont des **prototypes visuels non-fonctionnels** au MVP. Les boutons déclenchent des modals explicatifs ("Cette fonctionnalité sera disponible dans une prochaine version") ou des animations de chargement. L'objectif est de démontrer l'expérience utilisateur future et valider l'UX, pas d'implémenter la logique métier complète.

#### B. Backend & Traitement IA

##### B1. API d'ingestion
- Endpoints REST sécurisés (TLS 1.3, authentification JWT)
- Upload multipart pour images/vidéos avec support chunking
- Validation format et taille fichiers (max 10 MB par fichier)
- Rate limiting par session (prévention abus)
- Acknowledgement immédiat de réception

##### B2. Moteur OCR
- PaddleOCR déployé en service (Docker container)
- Extraction structurée des champs :
  * **CNI** : Nom, prénom, date naissance, numéro CNI, date délivrance, lieu délivrance
  * **Attestation NIU** : Numéro NIU, nom titulaire, date émission
  * **Facture** : Date, nom titulaire, adresse, type facture
- Score de confiance par champ (0-100%)
- Données extraites stockées en base avec lien vers images originales
- API d'extraction : POST /api/ocr/extract avec payload image → JSON structuré

##### B3. Moteur biométrique
- **Détection de vivacité** :
  * MiniFASNet ou équivalent open source déployé
  * Analyse vidéo frame par frame
  * Détection mouvements attendus (clignement yeux, rotation tête)
  * Score liveness (0-100%), seuil >85% pour validation
- **Face matching** :
  * DeepFace, FaceNet ou similaire
  * Extraction embeddings (vecteurs 128-512 dimensions) de la photo CNI et du selfie
  * Calcul similarité cosine (0-100%)
  * Seuil >98.5% pour suggestion auto-validation
- **Stockage** :
  * **Conservation des images/vidéos originales** chiffrées AES-256
  * Embeddings stockés séparément pour recherche/comparaison rapide

##### B4. Stockage sécurisé documents
- **Architecture** :
  * Système de fichiers chiffré (EFS, Azure Files avec encryption at rest) OU
  * Object storage S3-compatible (MinIO, AWS S3) avec encryption
- **Organisation** :
  * Structure : /dossiers/{dossier_id}/{document_type}_{timestamp}.{ext}
  * Exemple : /dossiers/DSR20260207001/cni_recto_20260207143022.jpg.enc
- **Chiffrement** :
  * AES-256-GCM
  * Clés gérées par KMS (Key Management Service) ou Vault
  * Rotation clés régulière (tous les 90 jours)
- **Métadonnées en base de données** :
  * Table `documents` : id, dossier_id, type (cni_recto, cni_verso, niu, facture, selfie), filepath, hash_sha256, size_bytes, uploaded_at, ocr_data_json, ocr_confidence_score
  * Hash SHA-256 pour garantir intégrité (détection modification)
- **Rétention** :
  * Conservation minimum 10 ans (exigence COBAC)
  * Politique d'archivage : après 2 ans, migration vers stockage cold (moins cher)
- **RBAC** (Role-Based Access Control) :
  * Agents KYC : lecture seule sur dossiers assignés
  * Opérations : pas d'accès direct aux documents (uniquement métadonnées)
  * Auditeurs : lecture seule sur tous dossiers avec traçabilité accès
  * Admin système : accès complet avec double authentification
- **Audit trail accès** :
  * Table `document_access_logs` : document_id, user_id, action (view/download), timestamp, ip_address
  * Alerte si accès anormal (ex: même document consulté 50x par un agent)

##### B5. Workflow de validation et scoring
- **Calcul score de confiance global** (0-100%) basé sur :
  * Qualité OCR moyenne (tous champs) : 30%
  * Score liveness : 30%
  * Score face matching : 30%
  * Cohérence données croisées : 10%
  
- **Vérifications croisées automatiques** :
  * ✓ Format NIU valide (regex + clé de contrôle)
  * ✓ **Nom propriétaire NIU ↔ Nom CNI** (comparaison fuzzy matching, tolérance fautes de frappe)
  * ✓ Nom CNI ↔ Nom facture (fuzzy matching)
  * ✓ Date facture < 3 mois (validation temporelle)
  * ✓ Géolocalisation cohérente avec adresse (zone géographique)
  * ✓ Age client >= 18 ans (date naissance CNI)

- **Règles de routage** :
  * Score >= 95% : Statut "Validation suggérée" (vert), priorité normale
  * 70% <= Score < 95% : Statut "Revue manuelle" (orange), priorité normale
  * Score < 70% : Statut "Vérification approfondie" (rouge), priorité haute
  * Échec vérification critique (ex: NIU invalide, face matching <70%) : Flag spécial

- **États de dossier** :
  * DRAFT : En cours de saisie client
  * SUBMITTED : Soumis, en attente traitement backend
  * PROCESSING : Traitement OCR/biométrie en cours
  * PENDING_VALIDATION : Prêt pour validation agent KYC
  * VALIDATED : Validé par agent, en attente création compte
  * ACCOUNT_CREATED : Compte créé dans Amplitude
  * ACTIVE_FULL : Compte actif avec NIU (accès complet)
  * ACTIVE_LIMITED : Compte actif sans NIU (accès restreint)
  * REJECTED : Rejeté définitivement
  * EXPIRED : Session expirée (>24h sans finalisation)

- **Validation humaine OBLIGATOIRE** :
  * Même pour scores >95%, un agent KYC doit approuver
  * L'agent peut corriger des champs OCR erronés
  * L'agent doit cocher confirmation : "J'ai vérifié visuellement tous les documents"

##### B6. Intégrations externes

- **NIU (DGI)** :
  * Validation syntaxique locale (regex : ^[A-Z][0-9]{12}[A-Z]$)
  * Algorithme clé de contrôle (si reverse-engineering réussi) pour validation hors-ligne
  * Appel API DGI (si disponible) : POST /api/dgi/validate_niu avec payload {niu, nom, prenom} → {valid: true/false, details}
  * **Fallback si API indisponible** :
    - Validation format uniquement
    - Flag dossier : "NIU non vérifié API DGI"
    - Agent KYC doit **obligatoirement** vérifier visuellement l'attestation NIU uploadée
    - Réconciliation batch quotidienne quand API revient

- **IBU (BEAC)** :
  * **MVP : Simulation factice réaliste**
    - API mockée locale : POST /api/ibu/check avec payload {nom, prenom, date_naissance, sexe} → {ibu_exists: false, ibu_number: null} (pour nouveau client)
    - Génération IBU factice selon format réaliste : CMX26BICEC + numéro séquentiel + clé Modulo 97
    - Stockage en base locale des IBU générés
  * **Phase 2 (post-MVP)** : Intégration vraie API BEAC avec VPN sécurisé ou mTLS

- **Core Banking (Sopra Amplitude)** :
  * **MVP : Pas d'intégration automatique**
  * Les données validées sont stockées dans une **table intermédiaire** `accounts_pending_creation` avec tous les champs nécessaires pour Amplitude
  * Interface web séparée (voir section C2) permet à l'équipe Opérations de déclencher manuellement la création
  * **Phase 2-3 (post-MVP, autre équipe)** : Automatisation complète avec API Amplitude direct.

##### B7. API pour interfaces
- **Mobile app** :
  * POST /api/auth/register (inscription)
  * POST /api/auth/login (connexion)
  * POST /api/onboarding/documents/upload (upload document)
  * GET /api/onboarding/status (statut dossier)
  * GET /api/account/features (liste fonctionnalités disponibles selon statut)
  
- **Back-office KYC** :
  * GET /api/kyc/dossiers (liste dossiers avec filtres)
  * GET /api/kyc/dossiers/{id} (détail dossier)
  * PUT /api/kyc/dossiers/{id}/validate (approuver)
  * PUT /api/kyc/dossiers/{id}/reject (rejeter)
  * PUT /api/kyc/dossiers/{id}/request_info (demander complément)
  
- **Opérations (création comptes)** :
  * GET /api/operations/accounts/pending (liste comptes validés, en attente création)
  * POST /api/operations/accounts/create_batch (création par lots)
  * GET /api/operations/accounts/{id}/status (statut création)

#### C. Back-Office (Interfaces Web)

##### C1. Interface Agent KYC (Validation)

**Dashboard principal** :
- **Vue d'ensemble** :
  * Compteurs : X dossiers en attente, Y traités aujourd'hui, Z rejetés cette semaine
  * File d'attente personnalisée : Dossiers assignés à moi
  * File d'attente globale : Tous dossiers en attente
  
- **Liste dossiers** (tableau sortable/filtrable) :
  * Colonnes : ID dossier, Nom client, Date soumission, Score confiance (barre colorée), Statut, Flags, Actions
  * Tri : Par score (asc/desc), par date (ancien en premier/récent), par priorité
  * Filtres : Plage de scores, présence NIU (oui/non/non vérifié API), statut, date range
  * Flags visuels : 🚩 NIU non vérifié API, ⚠️ Face matching faible, 🔍 PEP potentiel

**Vue détaillée dossier** :
- **Panneau gauche : Galerie documents** (40% largeur écran)
  * Onglets : CNI Recto | CNI Verso | Attestation NIU | Facture | Selfie
  * Images zoomables (molette souris ou pinch), téléchargeables
  * Selfie vidéo : Lecteur vidéo avec contrôles (play/pause, vitesse 0.5x-2x, frame-by-frame)
  * Indicateur qualité image : Résolution, Netteté, Luminosité
  
- **Panneau central : Données extraites** (40% largeur)
  * **Section Identité (CNI)** :
    - Nom : [MBARGA] (Confiance OCR : 98%) [Icône édition si agent veut corriger]
    - Prénom : [Jean-Pierre] (Confiance : 95%)
    - Date naissance : [15/03/1995] (Confiance : 92%)
    - Numéro CNI : [123456789] (Confiance : 99%)
    - Lieu délivrance : [Yaoundé] (Confiance : 88%)
    - Date délivrance : [10/01/2023] (Confiance : 95%)
  * **Section NIU** :
    - Numéro NIU : [P123456789012A]
    - Format valide : ✅ Oui
    - Vérification API DGI : ✅ Validé / ⚠️ Non vérifié (API indisponible) / ❌ Erreur
    - Nom sur attestation : [MBARGA Jean-Pierre] (Confiance OCR : 96%)
    - **Cohérence nom NIU ↔ CNI** : ✅ Match (score 98%) / ⚠️ Différence mineure (score 85%) / ❌ Incohérent
  * **Section Domicile** :
    - Adresse facture : [12 Rue du Commerce, Douala]
    - Date facture : [15/01/2026] (✅ < 3 mois)
    - Nom sur facture : [MBARGA J.P.] (Cohérence CNI : ✅ 92%)
    - Géolocalisation : [4.0511° N, 9.7679° E] - Douala, Littoral
  * Bouton "Corriger manuellement" pour chaque champ si OCR erroné

- **Panneau droite : Indicateurs et checks** (20% largeur)
  * **Scores biométriques** :
    - Liveness : 94/100 (✅ Validé)
    - Face matching : 98.7/100 (✅ Excellent)
    - [Bouton "Voir détails" → Modal avec frames vidéo analysées, heatmap de points faciaux comparés]
  * **Vérifications croisées** :
    - ✅ Nom CNI ↔ Nom NIU
    - ✅ Nom CNI ↔ Nom facture
    - ✅ Date facture valide
    - ✅ Âge >= 18 ans
    - ✅ Géolocalisation Cameroun
  * **Checks réglementaires** :
    - PEP : ❌ Aucun match
    - Sanctions : ❌ Aucun match
    - IBU/Compte existant : ❌ Nouveau client
  * **Score confiance global** : 96/100 (Grande jauge circulaire verte)

**Actions agent** :
- **Bouton principal vert : "Approuver et marquer prêt pour création compte"**
  * Popup confirmation : "Confirmez-vous avoir vérifié visuellement tous les documents ?"
  * Checkbox obligatoire : "J'atteste que les documents sont authentiques et cohérents"
  * Champ commentaire optionnel
  * Action : Dossier passe à statut VALIDATED, notification client, ajout à file d'attente Opérations
  
- **Bouton orange : "Demander complément d'information"**
  * Sélection checkboxes : Document illisible (CNI/NIU/Facture), Incohérence détectée, Autre
  * Champ texte libre pour instructions au client
  * Action : Notification push client avec détails, dossier retourne à statut PENDING_INFO

- **Bouton rouge : "Rejeter définitivement"**
  * Sélection motif obligatoire (dropdown) :
    - Document frauduleux suspecté
    - Incohérence photo CNI/selfie
    - NIU invalide
    - Client mineur (<18 ans)
    - Refus PEP/Sanctions
    - Autre (préciser)
  * Champ commentaire obligatoire (min 20 caractères)
  * Popup confirmation critique : "Cette action est irréversible. Le client devra recommencer entièrement."
  * Action : Dossier → REJECTED, notification client, données conservées pour audit uniquement

- **Bouton gris : "Mettre en attente / Escalade"**
  * Motif : Besoin avis superviseur, Attente retour API externe, Cas complexe
  * Assignation : Sélection superviseur
  * Action : Statut → ON_HOLD, notification superviseur

**Traçabilité** :
- En bas de la vue détaillée : Historique des actions
  * Timeline : Soumission client (07/02 14:30) → Traitement IA (07/02 14:32) → Assigné à Jean (07/02 15:00) → Consulté par Jean (07/02 15:15) → ...
  * Chaque action : Timestamp, User, Action, Détails

##### C2. Interface Opérations (Création comptes Amplitude)

**Dashboard Opérations** :
- **Compteurs** :
  * X comptes validés en attente de création
  * Y comptes créés aujourd'hui
  * Z erreurs d'intégration à traiter
  
- **File d'attente : Comptes validés** (tableau)
  * Colonnes : ID dossier, Nom client, Date validation KYC, Statut NIU (Validé/Non), IBU, Actions
  * Sélection multiple (checkboxes) pour traitement par lots
  * Tri : Par date validation (FIFO par défaut)
  * Filtres : Avec/sans NIU, Plage de dates

**Actions** :
- **Bouton "Créer compte(s) sélectionné(s) dans Amplitude"**
  * Si 1 dossier : Création unitaire
  * Si multiple : Traitement par lots (jusqu'à 50 simultanément)
  * Action :
    - Récupération données dossier depuis `accounts_pending_creation`
    - **MVP : Pas d'appel réel à Amplitude**, mais simulation avec :
      * Génération numéro de compte factice (format réaliste : BICEC + 10 chiffres)
      * Délai artificiel 2-5 secondes par compte
      * Mise à jour statut : VALIDATED → ACCOUNT_CREATED
      * Mise à jour statut détaillé : ACTIVE_FULL (si NIU) ou ACTIVE_LIMITED (si pas NIU)
      * Log de l'action en base
  * Résultat : 
    - Modal récapitulatif : "✅ 45 comptes créés avec succès, ❌ 5 erreurs"
    - Notification push aux clients : "Votre compte BICEC N° 1234567890 est activé !"

**Vue détails dossier** (si clic sur une ligne) :
- **Panneau gauche : Données KYC validées**
  * Toutes les infos extraites et validées par agent KYC (lecture seule)
  * Lien vers dossier KYC complet (si besoin de revoir documents originaux → redirection vers interface KYC en mode consultation)
  
- **Panneau droite : Paramétrage compte**
  * Type de compte : Compte courant standard (pré-sélectionné)
  * Devise : XAF (pré-sélectionné)
  * Statut : ACTIVE_FULL / ACTIVE_LIMITED selon NIU
  * Options : Services bancaires en ligne (actif par défaut), Carte virtuelle (oui), etc.
  
- **Actions** :
  * Bouton "Créer ce compte dans Amplitude" (appel unitaire)
  * Bouton "Corriger données si erreur" → Édition limitée (adresse, téléphone), pas les données d'identité validées KYC

**Gestion d'erreurs** :
- **Vue "Erreurs d'intégration"** (onglet séparé)
  * Liste des comptes dont la création a échoué
  * Colonnes : ID dossier, Nom, Date tentative, Code erreur, Message, Actions
  * Actions :
    - "Relancer" : Nouvelle tentative de création
    - "Corriger et relancer" : Édition données puis nouvelle tentative
    - "Marquer pour investigation" : Escalade vers équipe IT
  * Exemples d'erreurs (simulées au MVP) :
    - "Timeout Core Banking"
    - "Champ 'Adresse' manquant dans Amplitude"
    - "Doublon détecté dans Amplitude" (NIU déjà existant)

**Traçabilité** :
- Historique complet de chaque tentative de création :
  * Timestamp, Opérateur, Action (create/retry), Payload envoyé (JSON), Réponse reçue, Durée
- Export CSV pour reporting

##### C3. Interface Manager (Supervision & Admin)

**Dashboard Manager** :
- **KPIs en temps réel** :
  * Onboardings aujourd'hui : Démarrés (X), Complétés (Y), Taux de conversion (Y/X%)
  * Délais moyens : Capture client (11 min), Validation KYC (1.5h), Création compte (8 min)
  * Files d'attente : KYC (X dossiers), Opérations (Y comptes)
  * Taux de rejet : Z% (avec évolution vs semaine précédente)
  
- **Graphiques** (Grafana embeddé ou Recharts) :
  * Funnel de conversion avec drop-off par étape
  * Distribution scores de confiance (histogramme)
  * Timeline onboardings complétés (par heure/jour)
  * Taux d'erreur OCR par document type
  * Performance agents KYC (dossiers traités, temps moyen, taux d'approbation)

**Gestion des comptes** :
- **Recherche universelle** :
  * Par : Nom, NIU, Numéro de compte, Email, Téléphone, ID dossier
  * Résultats : Liste avec statut compte (ACTIVE_FULL, ACTIVE_LIMITED, PENDING, REJECTED, DISABLED)
  
- **Vue détails compte client** :
  * Informations complètes (identité, coordonnées, statut compte)
  * Historique dossier KYC (accès lecture seule à tous les documents)
  * Timeline d'activité (création, modifications statut, transactions si intégration future)
  * Alertes/Flags : Fraude potentielle, Compte dormant, PEP
  
- **Action : Désactiver compte**
  * Bouton rouge "Désactiver compte"
  * Motifs (dropdown obligatoire) :
    - Fraude avérée/suspectée
    - Demande client
    - Compte dormant (inactif >2 ans)
    - Décès
    - Autre (préciser)
  * Champ commentaire obligatoire
  * Popup confirmation critique avec double vérification
  * Action :
    - Statut compte → DISABLED
    - Blocage connexion app mobile
    - Log avec raison et identité manager
    - (Phase 2) : Appel API Amplitude pour bloquer compte dans Core Banking

- **Action : Réactiver compte**
  * Pour comptes DISABLED avec motif non-définitif
  * Justification obligatoire
  * Validation double (manager + superviseur)

**Reporting & Analytics** :
- **Export de données** :
  * Période personnalisée
  * Formats : CSV, Excel, PDF
  * Contenu : Dossiers complets, KPIs agrégés, Performance agents
  
- **Alertes configurables** :
  * Taux de conversion <60% pendant 3 jours consécutifs
  * File d'attente KYC >100 dossiers
  * Taux de rejet >15%
  * Notification email/SMS au manager

#### D. Monitoring & Reporting

##### D1. Métriques techniques (Prometheus)
**Infrastructure** :
- `system_uptime_seconds` : Disponibilité système
- `api_request_duration_seconds{endpoint="/api/...", method="POST"}` : Latence par endpoint (p50, p95, p99)
- `api_request_total{endpoint, method, status_code}` : Volume de requêtes et codes retour
- `database_query_duration_seconds{query_type}` : Performance base de données
- `storage_usage_bytes{type="documents/database"}` : Espace disque utilisé

**Services IA** :
- `ocr_processing_duration_seconds{document_type="cni/niu/facture"}` : Temps traitement OCR
- `ocr_confidence_score{document_type, field}` : Distribution scores OCR par champ
- `liveness_detection_duration_seconds` : Temps détection vivacité
- `liveness_score_distribution` : Histogramme scores liveness
- `face_matching_duration_seconds` : Temps comparaison faciale
- `face_matching_score_distribution` : Histogramme scores face matching

**Intégrations externes** :
- `external_api_request_duration_seconds{service="dgi/ibu/amplitude"}` : Latence APIs tierces
- `external_api_errors_total{service, error_type}` : Erreurs par API
- `external_api_availability{service}` : Disponibilité (0 ou 1)

**Connectivité et résilience** :
- `mobile_upload_retry_total{reason="network_loss/timeout"}` : Nombre de retries uploads
- `mobile_session_recovery_total` : Nombre de sessions récupérées après coupure
- `mobile_upload_chunk_success_rate` : Taux de succès uploads par chunks

##### D2. Métriques business
**Funnel onboarding** :
- `onboarding_sessions_started_total` : Inscriptions démarrées
- `onboarding_sessions_completed_total` : Soumissions finalisées
- `onboarding_sessions_abandoned_total{step="inscription/cni/niu/liveness/facture/signature"}` : Abandons par étape
- `onboarding_conversion_rate{step}` : Taux de passage à l'étape suivante
- `onboarding_duration_seconds{step}` : Temps moyen par étape
- `onboarding_total_duration_seconds` : Temps total côté client (objectif <15 min)

**Validation et qualité** :
- `kyc_dossiers_pending_total` : Dossiers en attente validation KYC
- `kyc_validation_duration_seconds` : Temps moyen de traitement agent
- `kyc_dossiers_validated_total` : Dossiers approuvés
- `kyc_dossiers_rejected_total{reason}` : Rejets par motif
- `kyc_approval_rate` : Taux d'approbation global
- `ocr_manual_correction_rate{document_type}` : % de champs corrigés manuellement (indicateur qualité OCR)

**Création comptes** :
- `accounts_pending_creation_total` : Comptes validés, en attente création Amplitude
- `accounts_created_total{status="full_access/limited_access"}` : Comptes créés par type
- `account_creation_duration_seconds` : Temps de création dans Amplitude
- `account_creation_errors_total{error_type}` : Erreurs d'intégration

**Statut comptes** :
- `accounts_active_full_total` : Comptes actifs avec NIU
- `accounts_active_limited_total` : Comptes actifs sans NIU
- `accounts_disabled_total{reason}` : Comptes désactivés par motif

##### D3. Dashboards Grafana
**Dashboard 1 : Funnel & Conversion**
- Graphique funnel en temps réel avec pourcentages
- Timeline des onboardings complétés (par heure, dernières 24h)
- Heatmap des abandons : heure de la journée × étape (identifier patterns)
- Top 3 raisons d'abandon (analyse logs)

**Dashboard 2 : Santé Système**
- Latence APIs (gauges avec seuils : <1s vert, 1-3s orange, >3s rouge)
- Taux d'erreur par service (ligne de temps)
- Disponibilité APIs externes (indicateurs binaires : DGI, IBU, Amplitude)
- Espace de stockage restant (jauge avec prédiction de saturation)
- Uptime global (objectif 99.9%)

**Dashboard 3 : Qualité & Conformité**
- Distribution scores de confiance (histogramme : <70%, 70-95%, >95%)
- Taux de correction manuelle OCR (ligne de temps, objectif <10%)
- Distribution scores biométriques (liveness, face matching)
- Taux de rejet KYC par motif (camembert)
- First-time-right rate (% de dossiers validés sans modification)

**Dashboard 4 : Opérations & Charge**
- File d'attente KYC en temps réel (gauge avec alerte >50)
- File d'attente Création comptes (gauge avec alerte >20)
- Performance agents KYC :
  * Classement par volume traité (tableau)
  * Temps moyen par agent (bar chart)
  * Taux d'approbation par agent (scatter plot)
- SLA de traitement : % de dossiers traités sous 2h/4h/24h

**Dashboard 5 : Résilience Réseau (spécifique Cameroun)**
- Taux de tentatives de reconnexion (ligne de temps)
- Distribution durée des coupures réseau (histogramme)
- Taux de succès uploads après retry (%)
- Étapes les plus impactées par les coupures (bar chart)

---

## 6. Contraintes & Non-Objectifs

### Contraintes FORTES

#### Réglementaires & Sécurité
- **Conformité BEAC/COBAC** : Respect des règlements sur les services de paiement, IBU (Identifiant Bancaire Unique), AML/CFT
- **Loi camerounaise 2024-017** : Protection des données personnelles, consentement explicite, droit à l'oubli, minimisation de la collecte
- **Conservation documentaire** : 
  * **Toutes les images/vidéos capturées doivent être conservées** chiffrées (AES-256) pour audit COBAC et validation humaine
  * Durée de rétention : minimum 10 ans selon normes bancaires camerounaises
  * Accès restreint : uniquement agents KYC autorisés + auditeurs externes
  * Traçabilité des accès : qui a consulté quel dossier, quand
- **Normes biométriques** : Standards ISO pour la capture faciale
- **Audit trail complet** : Traçabilité de toutes les actions (capture, traitement, validation humaine, activation) pour audits COBAC
- **Validation humaine obligatoire** : Même avec IA, un humain doit visualiser les documents et approuver l'activation du compte
- **Sécurité données** : Aucune donnée sensible en clair dans les logs, chiffrement bout-en