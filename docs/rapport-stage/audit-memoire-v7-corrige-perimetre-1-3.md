# Audit corrige du memoire v7, perimetre introduction et chapitres 1 a 3

Date : 31 mai 2026

Document audite : `docs/rapport-stage/memoire-stage-andre-yoann-kenmogne-v7.docx`

Perimetre : liminaires, introduction generale, chapitre 1, chapitre 2, chapitre 3.

Exclusions volontaires : chapitres 4 et 5, conclusion generale, bibliographie finale et annexes finales. Ces parties ne sont pas evaluees ici, car elles ne constituent pas encore le travail a juger.

## 1. Rectification du cadrage

Le premier audit avait un defaut de cadrage : il penalise les chapitres 4 et 5 alors qu'ils etaient volontairement laisses comme reperes de structure. Ce document corrige cette erreur. Il juge uniquement les parties deja travaillees et cherche a dire comment les rendre plus fortes avant de poursuivre la redaction.

Sur ce perimetre, le memoire n'est pas vide ni incoherent. Il contient une base serieuse : le contexte BICEC est pose, la problematique KYC est claire, le chapitre 2 identifie le besoin et les donnees, et le chapitre 3 presente une architecture credible. Le risque actuel n'est pas l'absence de matiere. Le risque est que certaines parties restent trop narratives, trop declaratives, ou insuffisamment rattachees aux preuves du depot.

## 2. Niveau actuel des parties evaluees

Evaluation severe mais juste : les parties introduction, chapitres 1, 2 et 3 se situent autour de 13 a 15 sur 20 si elles etaient jugees seules. Le fond est coherent, mais il manque encore la densite attendue d'un memoire d'ingenieur data et IA.

Points forts :

1. Le sujet est bien positionne : digitalisation de l'onboarding client, exigence KYC, concurrence fintech, controle documentaire, auditabilite et validation humaine.

2. La logique metier est pertinente : l'OCR aide a extraire, la biometrie aide a verifier, le back office reste responsable de la decision.

3. Le chapitre 3 contient deja les bons blocs techniques : PWA React/Vite, API FastAPI, workers Celery, Redis, PostgreSQL, stockage documentaire, OCR, liveness, comparaison faciale et audit.

4. Le choix de ne pas presenter l'IA comme une decision automatique est solide. Pour un contexte bancaire, l'angle "aide a la decision avec revue humaine" est defendable.

5. La modelisation autour de `kyc_sessions`, `documents`, `ocr_fields`, `biometric_results`, `validation_decisions`, `aml_alerts` et `audit_log` donne une vraie base data engineering.

Faiblesses :

1. Trop de formulations generales : "ecosysteme intelligent", "automatisation controlee", "reduire la friction", "mecanismes avances", "experience fluide". Ces expressions doivent etre remplacees par des operations concretes.

2. Certains chiffres sont trop forts s'ils ne sont pas sources ou calcules : delai en minutes, cout d'acquisition divise, retour sur investissement rapide, cout serveur, taille de dataset, seuils biometrie. Ils doivent devenir des hypotheses, des objectifs de pilote, ou des resultats preuves.

3. Le chapitre 2 manque d'une matrice d'exigences avec identifiants, priorites, criteres d'acceptation, composants et preuves attendues.

4. Le chapitre 3 decrit les technologies, mais il doit encore mieux justifier les arbitrages : pourquoi PWA, pourquoi FastAPI, pourquoi Celery, pourquoi PostgreSQL, pourquoi stockage documentaire separe, pourquoi revue humaine finale.

5. La gouvernance des donnees est encore trop discrete. Pour un sujet KYC, il faut parler de finalite, acces, conservation, correction, audit, suppression et donnees sensibles.

## 3. Ce qui sonne generique et comment le corriger

| Formulation a eviter | Remplacement attendu | Raison |
| --- | --- | --- |
| Ecosysteme intelligent d'acquisition client | Plateforme d'onboarding KYC composee d'une PWA mobile, d'une API, de traitements OCR et biometriques, et d'un back office de validation | Plus technique et moins marketing |
| Reduire la friction client | Reduire les reprises de saisie, les relances pour pieces illisibles et le temps d'attente avant revue | Rend l'objectif observable |
| Mecanismes avances de verification | OCR, controle qualite image, preuve de vie, comparaison faciale, journalisation des decisions | Nomme les mecanismes reels |
| La solution garantit | Le prototype met en place, ou les tests devront confirmer | Evite une promesse non prouvee |
| Le CAC est divise par 3 | Une hypothese de reduction du cout d'acquisition devra etre mesuree en pilote | Evite une affirmation economique fragile |
| Volume Docker chiffre AES 256 | Le prototype isole le stockage documentaire; le chiffrement au repos dependra de l'hebergement retenu | Conforme a ce que le depot prouve mieux |

## 4. Corrections par partie

### 4.1 Liminaires

Constat : les liminaires donnent une base propre, mais la table des matieres et les listes doivent devenir finales au moment du rendu.

Actions :

1. Supprimer toute trace de sommaire provisoire.

2. Generer une vraie table des matieres Word avec pages.

3. Mettre a jour la liste des tableaux et figures apres insertion definitive.

4. Controler les styles : Arial 12, interligne 1,5, titres coherents, figures avec titre en bas, tableaux avec titre en haut.

### 4.2 Introduction generale

Constat : l'introduction est claire et bien structuree, mais elle est trop lisse. Elle annonce correctement le sujet, mais manque encore de faits initiaux.

Actions :

1. Ajouter deux ou trois indicateurs sources : delai observe, nombre d'etapes du processus, volume ou charge approximative, irritants metier.

2. Remplacer les formulations abstraites par des objectifs mesurables.

3. Dire explicitement que VeriPass est un prototype de fin d'etudes, pas un deploiement bancaire certifie.

4. Conserver la problematique, car elle est bonne : automatiser sans affaiblir la conformite et sans retirer la decision humaine.

### 4.3 Chapitre 1

Constat : le cadre institutionnel et reglementaire est solide, mais il melange parfois constat, hypothese et promesse.

Actions :

1. Garder BICEC a environ 600 collaborateurs, selon la fiche de validation du sujet.

2. Remplacer les citations vagues par des sources identifiables : site BICEC, fiche de validation du stage, COBAC R 2023/01, loi camerounaise sur les donnees personnelles.

3. Traduire la reglementation en exigences projet : identification, verification, conservation, audit, vigilance, tracabilite.

4. Reformuler les gains economiques comme des hypotheses a valider en pilote.

5. Faire le lien entre organisation BICEC et architecture : departement etude et developpement, agents KYC, analyste AML/CFT, responsable conformite, administrateur IT.

### 4.4 Chapitre 2

Constat : le chapitre 2 pose les acteurs, le besoin et les donnees, mais il doit devenir plus ingenieur.

Actions :

1. Ajouter une matrice d'exigences.

Colonnes conseillees : identifiant, besoin, priorite, critere d'acceptation, composant, preuve attendue.

2. Ajouter un vrai lignage des donnees.

Chaine attendue : capture mobile, stockage documentaire, metadonnees PostgreSQL, OCR fields, correction humaine, score liveness, decision back office, audit log.

3. Ajouter une section qualite des donnees.

Cas a traiter : flou, reflet, mauvais cadrage, champ absent, date incoherente, recto ou verso illisible, visage non detecte, score incertain.

4. Renforcer l'etat de l'art.

Attendus : OCR de documents d'identite, detection de vivacite, comparaison faciale, biais et limites de la biometrie, KYC digital en Afrique ou pays en developpement.

5. Rendre la methode moins plaquee.

Formulation recommandee : approche mixte, cycle en V pour formaliser les exigences et la validation, increments agiles pour integrer les retours terrain et les contraintes techniques.

### 4.5 Chapitre 3

Constat : le chapitre 3 est le plus fort techniquement, mais il doit passer de la description d'architecture a la demonstration d'architecture.

Actions :

1. Ajouter une table de decisions d'architecture.

Exemples : PWA plutot que application native, FastAPI pour API typée et documentation OpenAPI, Celery pour traitements longs, PostgreSQL pour coherence transactionnelle et audit, Redis pour files et verrous, stockage documentaire separe pour les fichiers.

2. Ajouter la machine d'etats reelle.

Etats a utiliser : `DRAFT`, `PENDING_AGENT_REVIEW`, `PENDING_INFO`, `APPROVED`, `REJECTED`, `FRAUD_SUSPECT`.

3. Distinguer implemente, partiel, cible.

Exemples : PaddleOCR et post traitement sont implementes; GLM-OCR est un fallback de traitement; MiniFASNet ne doit pas etre presente comme realise sans preuve locale; fine tuning PaddleOCR ne doit pas etre affirme sans preuve.

4. Preciser le pipeline OCR.

Etapes : upload CNI, stockage, hash, PaddleOCR, extraction de champs, score de confiance, statut OCR, revue et correction humaine, fallback si confiance insuffisante.

5. Preciser le pipeline biometrique.

Etapes : challenge actif cote PWA, landmarks MediaPipe, soumission liveness, score serveur, selfie, comparaison faciale avec DeepFace quand disponible, statut et escalade humaine.

6. Renforcer la gouvernance des donnees.

Points a couvrir : finalite, minimisation, acces par role, trace d'audit, conservation, sauvegarde, donnees biométriques sensibles, risques residuels.

## 5. Preuves locales a injecter maintenant

1. Architecture : `docs/architecture.md`.

2. API KYC : `docs/api-contracts.md`, section KYC API.

3. Modele de donnees : `docs/data-models.md`, section KYC Tables.

4. Conteneurs : `code/docker-compose.yml`, services API, PostgreSQL, Redis, workers Celery, volumes documents et modeles.

5. OCR : `code/backend/app/services/ocr_service.py` et `code/backend/app/modules/kyc/service.py`.

6. Liveness mobile : `code/mobile/src/views/kyc/LivenessScreen.tsx` et `code/mobile/src/views/kyc/livenessChallenge.ts`.

7. MediaPipe : `code/mobile/src/services/mediapipeService.ts`.

8. RBAC : `code/backend/app/modules/auth/models.py` et `code/backend/tests/unit/test_rbac_unit.py`.

9. Hash documentaire : `code/backend/app/core/hashing.py`.

10. Preuve OCR a annoncer sans la developper trop tot : `docs/test-evidence/ocr-beta-loop/report.md`, avec 60 CNI ayant au moins une passe OCR applicative reussie.

## 6. Tableau a ajouter dans la v8

Tableau propose : statut de maturite des affirmations techniques.

| Affirmation | Statut | Preuve | Traitement dans le memoire |
| --- | --- | --- | --- |
| Capture CNI recto verso via API KYC | Prouve | Contrats API et code KYC | Presenter comme implemente |
| OCR local avec PaddleOCR | Prouve | Service OCR et architecture | Presenter comme implemente |
| Correction humaine des champs OCR | Prouve | API OCR review et back office | Presenter comme controle humain |
| GLM-OCR fallback | Partiel ou conditionnel | Architecture et worker OCR | Presenter avec conditions |
| Fine tuning PaddleOCR local | Non prouve | Aucune preuve suffisante | Retirer ou presenter comme perspective |
| MiniFASNet | Non prouve localement | Aucune preuve suffisante | Retirer sauf preuve a ajouter |
| Parcours sous 15 minutes | A mesurer | Preuves API partielles | Presenter comme objectif de pilote |
| ROI rapide | A calculer | Hypotheses economiques manquantes | Reformuler en impact attendu |

## 7. Priorite de reecriture

Ordre de travail recommande :

1. Nettoyer les promesses et chiffres fragiles dans l'introduction et le chapitre 1.

2. Transformer le chapitre 2 en chapitre d'exigences et de donnees, avec matrice de tracabilite.

3. Densifier le chapitre 3 avec decisions d'architecture, machine d'etats, pipeline data et gouvernance des donnees.

4. Mettre a jour les listes de figures et tableaux seulement apres stabilisation du contenu.

5. Ensuite seulement, rediger les chapitres 4 et 5 en s'appuyant sur cette base.

## 8. Regle de qualite a appliquer a partir de maintenant

Chaque paragraphe doit apporter au moins un des elements suivants :

1. Une contrainte BICEC, COBAC ou projet.

2. Une decision d'architecture.

3. Une exigence verifiable.

4. Une preuve issue du depot.

5. Un compromis d'ingenierie.

6. Une limite assumee.

Tout paragraphe qui ne fait que dire que la solution est moderne, fluide, intelligente ou performante doit etre coupe ou reecrit.

