# VeriPass - Dossier de buy-in pour parties prenantes BICEC

Date: 2026-05-30  
Objectif: préparer une présentation capable d'obtenir l'adhésion de décideurs BICEC sans dépendre de l'encadreur.

## 1. Thèse de présentation

Ne présente pas VeriPass comme "une application mobile". Présente-le comme un **rail KYC souverain** qui transforme l'ouverture de compte en preuve bancaire exploitable: acquisition plus rapide, contrôle mieux documenté, conformité plus lisible, et opérations back-office mesurables.

Phrase directrice:

> VeriPass ne remplace pas la banque ni ses agents. Il réduit la friction client, structure les preuves KYC et donne aux équipes BICEC une chaîne de validation traçable, sur site, pilotable et contrôlable.

Ce positionnement parle à la Direction Générale, à la Conformité, au Réseau, à la DSI, aux Risques, à l'Audit, à la Production Bancaire et à la Finance. Il évite aussi le piège du "prototype étudiant sympa" en montrant que le MVP sert un problème bancaire concret.

## 2. Ancrage BICEC à utiliser

Sources publiques officielles:

- Ne pas utiliser les chiffres internes BICEC comme ressort de persuasion devant un public BICEC. Ils les connaissent mieux que le présentateur; le deck PowerPoint final les retire pour se concentrer sur le bénéfice commercial, métier et décisionnel.
- L'organisation officielle expose les pôles et directions à adresser: Direction Générale, Pôle Entreprises, Pôle Support, Pôle Finances, Pôle Engagements, Banque de Détail, Risques et Contrôles, Audit Interne, Affaires Juridiques, Production Bancaire, Organisation Qualité et SI, Conformité, Directions Régionales: https://www.bicec.com/organisation-de-la-bicec.php
- Le parcours public "devenir client" reste centré sur l'agence: rendez-vous en agence, dépôt des pièces justificatives, versement initial, puis client BICEC: https://www.bicec.com/devenir-client/
- BI PAY montre que la BICEC possède déjà un produit mobile grand public; VeriPass peut être positionné comme une brique d'identité/KYC qui renforce les parcours digitaux existants: https://www.bicec.com/banque-a-distance/bipay-bicec/
- La DGI rappelle que l'immatriculation fiscale repose sur des informations exactes et des pièces authentiques/conformes, dont CNI, plan de localisation, RIB, facture ENEO selon les cas: https://www.impots.cm/fr/immatriculation

Angle stratégique:

La BICEC a déjà l'ambition digitale et le réseau. VeriPass s'insère entre les deux: il préqualifie et structure la relation à distance, tout en laissant la banque garder le contrôle final.

## 3. Ce qu'il faut vendre, et ce qu'il ne faut pas vendre

### À vendre

- Un système KYC complet: mobile client, API, back-office validation, conformité AML/CFT, audit, analytics, supervision.
- Une preuve de maîtrise: données sur site, OCR local/open-source, biométrie contrôlée, décision humaine obligatoire.
- Une réduction de friction: moins d'allers-retours client, moins de ressaisie, dossiers plus complets avant passage back-office/agence.
- Une capacité de pilotage: files d'attente, SLA, audit exportable, suivi des alertes, command center.
- Un MVP industrialisable par paliers: CNI Cameroun d'abord, autres pièces et pays ensuite.

### À ne pas vendre comme acquis

- Ne pas dire que le MVP remplace déjà le core banking ou Amplitude/Sopra en production.
- Ne pas promettre une ouverture de compte 100% automatique: le bon message est "préqualification digitale + décision humaine".
- Ne pas annoncer une précision biométrique production sans pilote de calibration sur données réelles.
- Ne pas présenter les objectifs internes comme des résultats déjà atteints.
- Ne pas sur-vendre le scope multi-pays: le MVP est volontairement cadré sur la CNI Cameroun.

## 4. Chiffres à utiliser avec prudence

| Type | Chiffre | Comment l'annoncer |
| --- | --- | --- |
| Contexte BICEC | Chiffres internes retirés du pitch | "Ne pas impressionner la BICEC avec ses propres chiffres; vendre plutôt ce que VeriPass change pour chaque décideur." |
| Parcours public actuel | Ouverture de compte orientée agence: dépôt de pièces, versement initial, accompagnement | "Le digital ne doit pas casser le réseau; il doit le préparer." |
| Objectif produit interne | Parcours client cible inférieur à 15 minutes, avec un objectif ambitieux de 11 minutes | "Cible MVP à valider en pilote, pas chiffre production." |
| Objectif opérationnel interne | 90% des validations sous 2h, 98% sous 4h | "SLA cible qui donne un contrat de service aux métiers." |
| Objectif conformité interne | Plus de 95% de dossiers audit-ready | "Ce que l'on veut mesurer dès le pilote." |
| Preuve technique locale | Tests mobiles et back-office passés; scénario happy path soumis puis approuvé; blocage AML démontré | "Le prototype exécute déjà les scénarios clés." |
| Preuve audit demo | Rapport COBAC demo avec 23 actions, 6 acteurs distincts, 9 décisions contrôlées | "La traçabilité existe déjà dans le MVP, même sur jeu de données de démonstration." |

Chiffres à demander à la BICEC avant le pitch final:

- Volume mensuel réel d'ouvertures de compte particuliers.
- Délai moyen actuel entre première demande et dossier validé.
- Taux de dossiers incomplets au premier dépôt.
- Temps moyen de ressaisie par dossier.
- Coût complet d'un dossier KYC traité manuellement.
- Taux de retours conformité et motifs principaux.
- Taux d'abandon avant ouverture effective.

Modèle ROI simple à présenter sans inventer:

```text
Gain opérationnel mensuel =
  dossiers/mois
  x minutes économisées par dossier
  x coût horaire complet agent
  / 60

Gain commercial =
  prospects additionnels convertis
  x valeur moyenne client activé

Gain risque/conformité =
  dossiers incomplets évités
  x coût moyen de reprise ou d'incident
```

Tu peux dire: "Je ne veux pas maquiller le business case. Le MVP permet justement de mesurer ces variables en pilote."

## 5. Cartographie des parties prenantes

| Partie prenante | Ce qu'elle veut vraiment | Crainte probable | Message buy-in | Preuve MVP à montrer |
| --- | --- | --- | --- | --- |
| DG / DGA / Comité de Direction | Croissance, maîtrise du risque, image d'innovation, ROI | "Encore un projet digital qui coûte et ne passe pas en production." | "On propose un pilote contrôlé qui mesure acquisition, conformité et productivité avant budget lourd." | Slide business case + démo end-to-end + KPI pilote |
| Banque de Détail / Réseau / Régions | Plus de comptes activés, moins de files et de dossiers incomplets | "Le digital va contourner l'agence." | "VeriPass prépare le dossier; l'agence garde la relation et l'activation finale si nécessaire." | Mobile client + file Jean + statut dossier |
| Conformité / AML-CFT | Dossiers complets, alertes suivies, preuves conservées, décisions justifiées | "Un algorithme va approuver des clients risqués." | "Aucune approbation automatique: alerte AML ouverte bloque l'approbation." | Écran dossier avec alerte AML + modal de blocage |
| Risques et Contrôles | Séparation des rôles, contrôle permanent, fraude réduite | "Les exceptions vont disparaître dans le système." | "Les exceptions deviennent visibles: score, motif, statut, acteur, horodatage." | Dossier avec risque biométrique + override obligatoire |
| Audit Interne | Journal exploitable, reconstitution des décisions | "Impossible de prouver qui a fait quoi." | "Chaque décision et correction produit une piste d'audit exportable." | Rapport COBAC / audit log |
| DSI / Organisation Qualité SI | Sécurité, intégration, maintenabilité, architecture claire | "Prototype fragile, cloud non maîtrisé, dépendances opaques." | "MVP on-prem, Docker Compose, PostgreSQL/Redis, API FastAPI, OCR local, rôles et audit." | Architecture + health/API + composants |
| Sécurité / Immobilier Logistique et Sécurité | Données sensibles, biométrie, accès, incidents | "Captures CNI/selfie mal protégées." | "Chiffrement local, contrôle d'accès par rôle, audit, stockage maîtrisé, pas de STP." | Architecture sécurité + offline encrypted queue |
| Production Bancaire | Dossiers propres, moins de ressaisie, exceptions claires | "Ça va créer une deuxième file non alignée avec le traitement bancaire." | "Le back-office structure les champs et signale ce qui doit être repris avant intégration." | OCR review + file validation |
| Juridique / Données personnelles | Consentement, base légale, minimisation, conservation | "Biométrie et documents d'identité = zone sensible." | "Le parcours collecte consentement explicite, limite le scope MVP et garde une décision humaine." | Écran consentement + scope CNI uniquement |
| Finances / Contrôle de gestion | Coût par dossier, arbitrage build/buy, capacité à mesurer | "On n'a pas de chiffres de rentabilité." | "Le pilote sert à calculer coût/dossier, temps gagné, taux de complétude et coût d'industrialisation." | Tableau KPI pilote |
| Marketing / Digital / CRM | Acquisition jeunes, parcours mobile, activation services | "Une démo KYC n'est pas un levier commercial." | "VeriPass devient la rampe d'entrée vers compte, BI PAY, cartes, épargne et offres jeunes." | Mobile dashboard + reprise d'activité |
| Capital Humain / Formation | Adoption agent, charge de formation, acceptabilité | "Les agents vont le percevoir comme une menace." | "Le système augmente la qualité de décision de l'agent; il ne le remplace pas." | Personas Jean/Thomas/Sylvie |

## 6. Narratif recommandé

### Titre

VeriPass: transformer l'ouverture de compte en preuve bancaire.

### Ouverture 30 secondes

> La BICEC a le réseau, la marque et les produits digitaux. Le point de friction n'est pas l'envie du client d'ouvrir un compte; c'est la capacité à transformer rapidement ses pièces, son identité et son éligibilité en un dossier fiable, contrôlable et validable. VeriPass est le MVP de ce rail KYC: il réduit l'effort client, prépare le travail des agents, et donne à la conformité une preuve structurée au lieu d'un dossier dispersé.

### Histoire en 5 actes

1. **Contexte**: BICEC a une échelle nationale et une ambition de meilleure expérience client.
2. **Tension**: Le parcours d'ouverture reste fortement physique, alors que le client et les équipes attendent vitesse, clarté et traçabilité.
3. **Réponse**: VeriPass capture les preuves côté client, structure le dossier, et orchestre la validation humaine.
4. **Preuve**: Le MVP exécute le parcours mobile, l'OCR CNI, la liveness, l'alerte AML, le back-office, l'audit et les dashboards.
5. **Demande**: Autoriser un pilote limité pour mesurer coût/dossier, délai, complétude, qualité OCR/biométrie et charge conformité.

### Phrase de fermeture

> Le bon résultat du MVP n'est pas "une app qui marche". Le bon résultat est une décision BICEC plus rapide, mieux prouvée et moins risquée.

## 7. Plan de deck recommandé

### Slide 1 - Promesse

Titre: **VeriPass - KYC digital souverain pour l'ouverture de compte BICEC**  
Message: de la capture client à la décision bancaire traçable.  
Visuel: montage sobre mobile + back-office + audit.

### Slide 2 - Pourquoi maintenant

Message: BICEC a l'échelle et l'ambition digitale; le KYC est le point de passage obligé.  
Chiffres internes BICEC: à éviter dans le deck de buy-in.  
Raison: ils ne créent pas de surprise et peuvent détourner le débat vers la précision des données au lieu de la valeur du pilote.

### Slide 3 - Le problème métier

Avant:

- Pièces déposées physiquement.
- Dossiers incomplets.
- Ressaisie.
- Relances client.
- Décisions difficiles à reconstituer.

Après:

- Captures guidées.
- OCR et contrôles de complétude.
- File back-office.
- Blocage conformité.
- Journal d'audit.

### Slide 4 - Le produit en une image

Schéma simple:

Client mobile -> API KYC -> OCR/biométrie -> Jean validation -> Thomas conformité -> Sylvie pilotage/audit -> décision.

Message: chaque rôle reçoit exactement ce qu'il doit contrôler.

### Slide 5 - Scope MVP maîtrisé

Message: CNI Cameroun d'abord; autres pièces/pays désactivés/futurs.  
Visuel: `docs/test-evidence/latest/kyc-compliance-demo/screens/11-mobile-document-scope-cni-only-disabled-options.png`  
Pourquoi c'est fort: montre que le MVP ne prétend pas tout couvrir.

### Slide 6 - Parcours client

Message: le client reprend là où il s'est arrêté, voit ce qui manque, et avance sans jargon bancaire.  
Visuel: `docs/test-evidence/latest/mobile/screens/live-client-after-login.png`

### Slide 7 - Travail agent augmenté

Message: Jean ne lit pas un dossier brut; il valide un dossier structuré avec preuves, OCR, historique et actions.  
Visuel: écran dossier back-office.  
Attention: choisir une capture propre si possible, ou expliquer la capture risque si elle sert le propos.

### Slide 8 - Contrôle conformité réel

Message: même si l'agent veut approuver, une alerte AML ouverte bloque la décision.  
Visuels:

- `docs/test-evidence/latest/kyc-compliance-demo/screens/08-jean-dossier-biometric-risk-and-aml-alert.png`
- `docs/test-evidence/latest/kyc-compliance-demo/screens/10-jean-approval-blocked-by-open-aml-alert.png`

### Slide 9 - Audit et COBAC-ready

Message: chaque action devient une preuve.  
Visuels:

- `docs/test-evidence/latest/backoffice/screens/cobac-audit-report-ui-final.png`
- `docs/test-evidence/latest/backoffice/screens/cobac-audit-report-document-final.png`

### Slide 10 - Pilotage manager

Message: Sylvie voit la charge, les SLA, les agents et les exports.  
Visuel: `docs/test-evidence/latest/backoffice/screens/role-sylvie-command-center.png`

### Slide 11 - Business case pilote

Message: on ne demande pas un déploiement national; on demande un pilote mesurable.  
KPI à mesurer:

- Délai moyen prospect -> dossier soumis.
- Délai dossier soumis -> décision.
- Taux de dossier complet au premier passage.
- Temps agent par dossier.
- Taux de retours conformité.
- Taux d'abandon.
- Coût complet par dossier.
- Qualité OCR CNI.
- Taux de liveness à reprendre.

### Slide 12 - Demande de décision

Demande:

- Sponsor métier: Banque de Détail / Réseau.
- Sponsor risque: Conformité ou Risques.
- Sponsor technique: Organisation Qualité SI / DSI.
- Périmètre: 20 à 50 dossiers de test contrôlés.
- Durée: 2 à 4 semaines.
- Sortie: rapport KPI + risques + budget industrialisation.

## 8. Scénario de démo

Durée cible: 7 à 10 minutes.

### Préparation

- Avoir 3 dossiers préparés:
  - Dossier propre approuvable.
  - Dossier avec information manquante.
  - Dossier avec risque biométrique + alerte AML.
- Avoir les comptes prêts:
  - Jean: validation KYC.
  - Thomas: conformité AML.
  - Sylvie: command center/audit.
- Prévoir un fallback screenshots si le réseau, Docker ou le navigateur ralentit.

### Démo live

1. **Mobile client - 90 secondes**
   - Montrer reprise d'activité.
   - Montrer scope CNI uniquement.
   - Expliquer: "Le client est guidé; la banque garde le contrôle."

2. **Capture et dossier structuré - 90 secondes**
   - Montrer OCR CNI et champs revus.
   - Expliquer: "On réduit la ressaisie, mais on garde la correction humaine."

3. **Jean valide - 120 secondes**
   - Montrer file de dossiers.
   - Ouvrir le dossier.
   - Montrer preuves, OCR, biométrie, historique.
   - Faire une action simple: demande d'information ou approbation.

4. **Thomas bloque le risque - 120 secondes**
   - Montrer import AML/dry-run si utile.
   - Montrer alerte AML ouverte.
   - Montrer approbation bloquée.
   - Expliquer: "Le MVP prouve qu'on ne sacrifie pas la conformité pour aller vite."

5. **Sylvie pilote - 90 secondes**
   - Montrer SLA, charge, agents disponibles.
   - Montrer audit log / export COBAC.
   - Expliquer: "Le manager ne découvre pas le risque à la fin; il le suit en continu."

6. **Conclusion - 60 secondes**
   - Revenir à la demande de pilote.
   - Dire quels chiffres seront mesurés.

## 9. Objections à anticiper

| Objection | Réponse recommandée |
| --- | --- |
| "Ce n'est qu'un prototype." | "Oui, c'est un MVP. Sa valeur est d'avoir déjà relié client, validation, conformité, audit et pilotage. La prochaine étape n'est pas un lancement national, c'est un pilote mesuré." |
| "La biométrie est risquée juridiquement." | "C'est justement pour cela que le MVP impose consentement, décision humaine, scope contrôlé et preuve d'audit. Le pilote doit inclure Juridique/DPO." |
| "Et si l'OCR se trompe ?" | "Le MVP ne donne pas une confiance aveugle à l'OCR. Il structure, pré-remplit, signale et laisse l'agent corriger." |
| "Est-ce connecté au core banking ?" | "Le MVP prouve la chaîne KYC et prépare l'intégration. L'écriture en production doit rester une phase séparée avec DSI et Production Bancaire." |
| "Les agents vont perdre leur rôle." | "Leur rôle devient plus qualitatif: traiter les exceptions, valider les preuves, décider avec contexte." |
| "Pourquoi ne pas acheter une solution ?" | "Le pilote donne les métriques pour arbitrer build, buy ou hybridation. Sans métriques internes, l'achat serait aussi spéculatif." |
| "Est-ce assez sécurisé ?" | "Le MVP est pensé on-prem, avec rôles, audit, stockage contrôlé et pas d'approbation automatique. La sécurité doit être auditée avant industrialisation." |

## 10. Angle marketing par public

### Direction Générale

Promesse: "Un pilote qui transforme l'innovation en décision mesurable."  
Preuve: démo bout-en-bout + KPI + scope limité.  
À éviter: parler trop vite d'algorithmes.

### Conformité

Promesse: "La vitesse ne contourne pas le contrôle; elle l'équipe."  
Preuve: alerte AML ouverte bloque l'approbation.  
À éviter: "automatiser la conformité".

### DSI

Promesse: "Une architecture lisible, sur site, intégrable par paliers."  
Preuve: FastAPI, PostgreSQL, Redis, Celery, Docker Compose, rôles, audit.  
À éviter: présenter les modèles IA comme boîtes noires miracles.

### Réseau / Banque de Détail

Promesse: "Moins de dossiers incomplets, plus de temps relationnel."  
Preuve: parcours client guidé + file agent.  
À éviter: donner l'impression que le mobile remplace les agences.

### Finance

Promesse: "Un pilote pour obtenir le vrai coût par dossier."  
Preuve: modèle ROI + KPIs à mesurer.  
À éviter: inventer des économies non validées.

### Audit / Risques

Promesse: "Une décision reconstituable et contrôlable."  
Preuve: audit log + export.  
À éviter: parler uniquement UX.

## 11. Ce qu'il faut préparer avant la soutenance interne

Priorité haute:

- Créer une démo seedée avec dossiers plus réalistes que les données vides actuelles.
- Préparer une version "slides seulement" si Docker ralentit.
- Capturer une vidéo courte de secours du parcours complet.
- Clarifier oralement que les objectifs de vitesse, coût d'acquisition et réduction de charge opérationnelle sont des hypothèses produit à mesurer, pas des résultats certifiés.
- Préparer une slide "limites MVP" pour gagner la confiance des profils risque/DSI.

Priorité moyenne:

- Ajouter des chiffres internes réels si disponibles.
- Préparer un mini calcul coût/dossier avec hypothèses modifiables.
- Préparer une matrice RACI pilote.
- Préparer une feuille de questions-réponses.

## 12. Demande finale à faire aux décideurs

Formulation recommandée:

> Je ne demande pas une mise en production nationale aujourd'hui. Je demande l'autorisation d'un pilote contrôlé, sponsorisé par métier, conformité et DSI, pour mesurer sur 20 à 50 dossiers: délai, complétude, temps agent, taux de reprise, qualité OCR/biométrie, charge conformité et coût par dossier. À la fin du pilote, la BICEC aura les données pour décider d'industrialiser, d'acheter, d'hybrider ou d'arrêter.

Cette demande est crédible car elle limite le risque politique. Chaque partie prenante obtient quelque chose:

- Direction: une décision d'investissement éclairée.
- Réseau: moins de friction client.
- Conformité: contrôle conservé.
- DSI: phase d'intégration maîtrisée.
- Finance: coûts mesurables.
- Audit/Risques: preuves exploitables.
- Marketing/Digital: rampe vers services mobiles.

## 13. Sources et preuves internes

Planning:

- `_bmad-output/planning-artifacts/product-brief-bicec-veripass-2026-02-07.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture-bicec-veripass.md`
- `_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-07.md`

Code:

- `code/backend/app/main.py`
- `code/backend/app/api/v1/router.py`
- `code/backend/app/modules/kyc/`
- `code/backend/app/modules/backoffice/`
- `code/backend/app/modules/aml/`
- `code/backend/app/modules/analytics/`
- `code/mobile/src/`
- `code/backoffice/src/`

Preuves demo:

- `docs/test-evidence/latest/mobile/.last-run.json`
- `docs/test-evidence/latest/backoffice/.last-run.json`
- `docs/test-evidence/latest/kyc-happy-path/README.md`
- `docs/test-evidence/latest/kyc-compliance-demo/README.md`

Captures recommandées:

- `docs/test-evidence/latest/mobile/screens/live-client-after-login.png`
- `docs/test-evidence/latest/kyc-compliance-demo/screens/11-mobile-document-scope-cni-only-disabled-options.png`
- `docs/test-evidence/latest/kyc-compliance-demo/screens/08-jean-dossier-biometric-risk-and-aml-alert.png`
- `docs/test-evidence/latest/kyc-compliance-demo/screens/10-jean-approval-blocked-by-open-aml-alert.png`
- `docs/test-evidence/latest/backoffice/screens/role-sylvie-command-center.png`
- `docs/test-evidence/latest/backoffice/screens/cobac-audit-report-ui-final.png`
- `docs/test-evidence/latest/backoffice/screens/cobac-audit-report-document-final.png`
