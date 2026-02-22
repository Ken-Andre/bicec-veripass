# UX/UI Inventory & Stitch Prompts - bicec-veripass

## 1. Décisions & Hypothèses (Max 15 points)

1. **Auto-extraction Paradigm**: L'utilisateur (Marie) ne remplit **aucun** formulaire vide manuellement. L'IA extrait d'abord les données, et elle se contente de confirmer ou corriger les champs (avec code couleur : vert, orange, rouge selon la confiance OCR).
2. **Résilience & Offline-first**: Le parcours mobile est conçu pour surmonter les délestages (Cameroun). Un cache local (SQLite) garde l'état de la session (chunked uploads) pour permettre de reprendre exactement là où la connexion a coupé, sans perte de données.
3. **Abandon des "Wet Signatures" sur Mobile**: La capture de signature manuscrite a été retirée du MVP mobile pour respecter les contraintes réglementaires BEAC (elle sera faite physiquement en agence lors de l'activation finale).
4. **Localisation Simplifiée**: Exit la carte OSM lourde. Un simple bouton "Me localiser" utilise le GPS du device en arrière-plan (optimisation bande passante et UX).
5. **Principe des 3-Strikes Liveness**: Au bout de 3 échecs biométriques, l'app ne crashe ni ne wipe automatiquement. Un écran explicite avec un bouton "Recommencer" (Fresh Start) invite l'utilisateur à vider le cache et retenter.
6. **États d'accès progressif (Vitrine vs App)**: Le statut définit l'UI : *RESTRICTED_ACCESS* (compte en création, UI limitée à un dashboard de suivi), *LIMITED_ACCESS* (validé mais sans NIU, plafonds réduits), *FULL_ACCESS*.
7. **Back-office Evidence-first (Split View)**: Pour Jean (Validateur), l'écran Desktop doit **toujours** afficher la preuve (photo document/selfie) à gauche et les données extraites à droite (Cognitive ease : 50/50 split).
8. **Audit Trail Implicite**: Au Back-Office, tout rejet ou modification (override) d'un champ par un agent (Jean/Thomas) exige la sélection d'une "Reason" obligatoire dans un menu déroulant pour la compliance.
9. **Supervision Agnostique**: Les maquettes de supervision (pour Sylvie) se concentrent sur *ce qu'il faut afficher* (Funnel R/Y/G, OCR confidence, SLA), sans s'enfermer dans l'UI native d'un outil comme Grafana. L'idée est d'avoir l'UX cible d'un Command Center.
10. **Dual-Auth Recovery**: Les numéros de téléphone et emails sont capturés tôt. L'UI doit gérer les fallbacks si l'un ou l'autre OTP échoue.
11. **Esthétique Officielle BICEC**: Palette institutionnelle : Orange Primaire `#E37B03` (Cercle logo), Brun Foncé `#4A2205` (Cheval logo), et Bleu d'Action `#2563EB`. Exit le neobank generic blue.
12. **Composants Prototype Réels**: Les prompts Stitch doivent refléter les patterns implémentés : logos carrés aux coins arrondis, listes de contrôle avec icônes Lucide, et inputs OTP segmentés.
13. **Routing ENEO (Ops)**: Thomas voit des données contextualisées selon la région ENEO extraite du reçu, ce qui facilite l'affectation territoriale.
14. **Hypothèse UX - Push Notifications**: On suppose que le système peut relancer les utilisateurs en drop-off via Push (mobile) ou SMS. L'UI des paramètres gère ces permissions.
15. **Différence Diagrammes UX vs Architecture tech**:
    - **Diagrammes UX/UI (User Journeys, Flowmaps, State Machines)** : Décrivent *l'expérience utilisateur*, ce qui est affiché à l'écran, les transitions de vue en vue, les embranchements (succès vs erreur), et les comportements UI de base.
    - **Diagrammes Architecturaux (C4, Séquence, Contrats API)** : Décrivent comment le *Backend* (FastAPI), la base de données (PostgreSQL), et les services tiers (Cognito, Amplitude) traitent techniquement la donnée générée par l'app. Ne pas mélanger : l'UX montre le "Bouton Confirmer", l'Archi montre la requête "POST /kyc/confirm".


---

## 2. Inventaire des Écrans — Mobile (Marie)

### Tableau Récapitulatif

| ID | Nom écran | Objectif | Composants UI clés | Actions | États & erreurs | Données affichées | Navigation (next/prev) | Prompt Stitch ( résumé ) |
|---|---|---|---|---|---|---|---|---|
| **M-A01** | Splash/Welcome | Accueillir, rassurer, lancer | 3D Hero/Graphic, Primary CTA, Carrousel auto | `Commencer` | Loading, Offline alert | UVP text | -> M-A02 | *Premium vibrant neobank welcome...* |
| **M-A02** | OTP Phone Setup | Lier le device au numéro | Numpad riche, Champ num + Prefix, Lien "Email au lieu ?" | `Envoyer le code` | Erreur format, Retry timeout | Numéro saisi | <- M-A01 / -> M-A03 | *Minimalist phone input, soft shadows...* |
| **M-B02** | CNI Capture | Guider la photo CNI Recto | Camera full screen, masque d'alignement (coins) | `Auto-capture` ou `Manuel` | Flou, Mauvaise lumière | N/A | <- M-A04 / -> M-B03 | *Camera overlay, dark mask, guidance...* |
| **M-B08** | OCR Review | Validation IA par l'humain | Cartes de champs, Badges de confiance (Vert/Orange/Rouge) | `Corriger`, `Valider tout` | Validation locale erreur | Nom, Prénom, CNI, Expiration | <- M-B07 / -> M-B09 | *Data review list, confidence colored tags...* |
| **M-B10** | Liveness Check | Anti-spoofing via selfie | Ovale caméra 3D, Instructions visuelles | `Commencer le test` | Trop sombre, 3-strikes fail | N/A | <- M-B08 / -> M-B11 | *Selfie overlay oval, bright interface...* |
| **M-B11** | Fresh Start (Fail Liveness) | Gérer l'échec 3-strikes | Bottom sheet d'erreur, Bouton rouge de restart | `Recommencer (Wipe)` | État final erreur | Raison d'échec | <- M-B10 / -> M-A01 | *Error bottom sheet, destructive button...* |
| **M-C02** | ENEO Capture | Capturer la preuve d'adresse | Upload widget, "Locate Me" button GPS | `Scanner` ou `Locate` | GPS denied, PDF trop lourd | Fichier uploade | <- M-C01 / -> M-E01 | *Document upload card, location button...* |
| **M-E06** | Dashboard (Restricted) | Attente validation Back-office | Stepper vertical (En cours), Empty state solde | `Menu`, `Support` | Loading refresh | État du dossier | <- M-E05 | *Vertical status stepper, locked dashboard...* |

### Détails Écran par Écran & Prompts Stitch

#### M-A01 : Splash/Welcome
- **Contenu** : Illustration 3D minimaliste ou abstract vector, Titre accrocheur, Carrousel des valeurs (Rapide, Sécurisé, Cameroun), Bouton primaire fixe en bas.
- **Règles UX** : Le bouton est large (thumb-friendly). Vérification transparente de la connexion réseau.
- **Microcopy** : *FR: "Votre banque, en 15 minutes. Prêt ?" / EN: "Your bank, in 15 mins. Ready?"*
- **Prompt Stitch** : 
  > *A mobile app welcome screen for BICEC VeriPass. Use a #E37B03 orange brand color for the main identity. The logo is a square with rounded corners (3xl) with a gradient from #E37B03 to #4A2205. Below the title, a vertical list of benefits using Lucide 'check' icons in small gray cards (bg-slate-50). At the bottom, a large fixed primary button in orange #E37B03. Font: Inter/Sans-serif.*

#### M-B02 : CNI Capture (Recto)
- **Contenu** : Interface appareil photo plein écran. Un masque sombre avec un rectangle transparent au centre. Les coins de ce rectangle sont mis en évidence. Instructions superposées. Action flottante (Fab) si l'auto-capture échoue.
- **Règles UX** : L'IA détecte la netteté en temps réel (offline/device). Un contour vert apparaît si c'est bon.
- **Microcopy** : *FR: "Cadrez votre CNI ici. Évitez les reflets." / EN: "Frame your ID here. Avoid glare."*
- **Prompt Stitch** : 
  > *A mobile app ID scanning screen. Full screen camera view with a dark translucent overlay. In the center, a clear rounded-rectangle cutout the size of an ID card. The four corners of the cutout emphasize focus with thick white borders. A small, elegant instruction text floats above the cutout. Minimalist UI. Flat icons. A subtle close button top left.*

#### M-B08 : OCR Review (Auto-extraction confirmation)
- **Contenu** : Mise en page "Liste de variables". Chaque ligne affiche un label (ex: "Nom"), la valeur lue par l'IA, et un petit badge (pastille) de couleur selon la confiance (Vert = >90%, Orange = <90% -> modifiable immédiatement).
- **Règles UX** : L'utilisateur n'a pas à taper son nom s'il est correct. Un tap sur une ligne orange ouvre un bottom-sheet de correction.
- **Microcopy** : *FR: "Vérifiez ces informations extraites de votre carte." / EN: "Review the details extracted from your ID."*
- **Prompt Stitch** : 
  > *A mobile data verification screen. List of cards for extracted fields (Nom, Prénom, N° CNI). Each card shows the label in small text and the value in bold. Include a status badge (Vert/Orange) for confidence. Large orange #E37B03 button fixed at the bottom. Background is #FAFAFA. Clean rounded corners (xl).*

#### M-B11 : Fresh Start (Liveness Failed)
- **Contenu** : Écran d'erreur bloquante ou Bottom Sheet couvrant 60% d'un fond flouté. Icône d'alerte. Explication claire de l'échec. Bouton principal pour réinitialiser.
- **Règles UX** : Action destructive stricte. Supprime le cache local pour repasser au début par sécurité (3-strikes rule).
- **Microcopy** : *FR: "Validation échouée 3 fois. Pour votre sécurité, nous devons recommencer." / EN: "Validation failed 3 times. For your security, please restart."*
- **Prompt Stitch** : 
  > *A mobile app error bottom sheet overlaid on a blurred background. The sheet has rounded top corners. At the top of the sheet, a prominent red exclamation or shield icon. Below, bold assertive typography explaining an error. The primary call-to-action button is red (error state), bold, and spans the width. The overall vibe is reassuring but serious.*

#### M-E06 : Dashboard (Restricted - En validation)
- **Contenu** : Un layout de Dashboard classique (Header avec nom, solde flouté à "0 FCFA"), mais la moitié inférieure de l'écran est occupée par une "Card de progression" verticale.
- **Règles UX** : Fonctionnalités (virements, cartes) grisées avec de petits cadenas. L'utilisateur est rassuré par une timeline claire ("Votre dossier est chez Jean").
- **Microcopy** : *FR: "Compte en création. Étape : Vérification par un agent." / EN: "Account pending. Step: Agent verification."*
- **Prompt Stitch** : 
  > *A mobile dashboard in 'Restricted' state. Top header has an orange gradient brand block. Below, a section titled 'Disponible' shows a list of white cards with green checkmarks. A second section 'Bloqué' shows cards with gray ban icons. Clicks on blocked items trigger a 'Validation en cours' notification. Navigation bar at the bottom with grayed-out locked icons.*


---

## 3. Inventaire des Écrans — Back-Office Desktop

### A. Authentification & Accès (Login)

| ID | Nom vue | Objectif | Composants UI clés | Actions | Données | Prompt Stitch |
|---|---|---|---|---|---|---|
| **A-L01** | Back-Office Login | Identifier le persona (Démo) | 3 Cartes interactives (Jean, Thomas, Sylvie) | `Se connecter entant que...` | Rôles et descriptions | *Back-office persona selection screen...* |

#### A-L01 : Back-Office Login (Multi-Persona)
- **Contenu** : Écran épuré avec logo BICEC. Titre : "Portail Interne VeriPass". 3 grandes cartes verticales pour Jean (Validateur), Thomas (AML/Ops), et Sylvie (Direction).
- **Branding** : Utilisation du Orange `#E37B03` pour l'accentuation et du Brun `#4A2205` pour la profondeur.
- **Prompt Stitch** : 
  > *A professional back-office portal login screen. Clean white background with a subtle geometric pattern. Center-aligned BICEC VeriPass logo. Title: 'Accès Collaborateurs'. Three vertical interactive cards representing roles: 1. Jean (Validation KYC), 2. Thomas (AML & Fraude), 3. Sylvie (Direction & Metrics). Each card has a different Lucide icon (UserCheck, ShieldAlert, BarChart). Hover effect on cards using #E37B03 orange borders. Modern, premium enterprise look.*

### B. Espace de Validation KYC (Jean)

| ID | Nom vue | Objectif | Composants UI clés | Actions | Données | Prompt Stitch |
|---|---|---|---|---|---|---|
| **A-J02** | Validation Queue | Liste des dossiers à traiter | Data table claire, Filtres (Status, SLA), Tag "High Priority" | `Review` | Nom, Date, SLA countdown, Score de risque | *Desktop web admin panel...* |
| **A-J08** | Side-by-Side Review | Faciliter la décision OCR/Humain | Layout 50/50. Gauche : Image zoomable / Droite : Formulaire JSON | `Approve field`, `Overwrite`, `Reject with reason` | Preuves vs Données extraites | *Desktop dual-pane review...* |

#### A-J08 : Side-by-Side Review
- **Contenu** : Panneau gauche fixe contenant l'image scannée avec des contrôles de zoom/rotation. Panneau droit scrolable avec le formulaire des données OCR. Chaque champ a un bouton (✓) et (X). Si (X), un dropdown apparaît obligatoirement pour la Raison ("Blurry", "Mismatch", etc.).
- **Règles UX** : Pas de validation globale possible si un champ avec une faible confiance AI n'a pas été manuellement approuvé.
- **Microcopy** : *FR: "Raison du rejet requise" / EN: "Rejection reason required"*
- **Prompt Stitch** : 
  > *A desktop web application screen for document verification. Split view layout, exactly 50/50. The left pane shows a high-resolution scanned ID card with zoom controls overlaid. The right pane displays a long, stacked form containing extracted text fields. Next to every input field, there are two small square buttons: a green checkmark and a gray edit pen. Clean enterprise UI, minimalist fonts, soft gray borders, high contrast.*

### B. Espace Provisioning (Thomas)

| ID | Nom vue | Objectif | Composants UI clés | Actions | Données | Prompt Stitch |
|---|---|---|---|---|---|---|
| **A-T02** | Ops Queue | Dédoublonneur, Création Amplitude | Tableau, Alertes de doublon, Info Amplitude Core | `Process`, `Resolve Conflict` | Amplitude ID, Match % | *Admin table layout...* |
| **A-T13** | Conflict Resolver | Traiter les alertes de fraude/doublon | Vue comparative (Nouveau profil vs Ancien profil), Heatmap des similarités | `Merge`, `Reject as Fraud` | Score de similitude facial/nom | *Desktop comparison grid...* |

#### A-T13 : Conflict Resolver (Duplicate detection)
- **Contenu** : Deux colonnes principales de données superposées. Les mots ou photos identiques entre le "Nouveau Client" et l'"Ancien Client" sont surlignés en rouge pour sauter aux yeux.
- **Règles UX** : L'alerte de match doit dépasser un seuil (ex: 80%). Boutons d'escalation vers Superviseur obligatoires si incertitude.
- **Prompt Stitch** : 
  > *A desktop web app screen for fraud resolution. Main area consists of two side-by-side profile cards comparing two users. Highlight matching text fields with a subtle orange background. Show two faces side-by-side with a similarity percentage badge between them. At the top right, a prominent 'Escalate Issue' button next to a 'Reject Duplicate' button. Enterprise SaaS aesthetics, structured and dense data display.*


---

## 4. Inventaire des Vues — Supervision (Sylvie & Agents)

L'objectif de Sylvie est de voir les goulots d'étranglement, pas de régler des dossiers un par un. On s'éloigne du Back-Office transactionnel pour un "Command Center".

| ID | Nom du Dashboard | Objectif | Composants UI clés | Actions | Données / KPI | Prompt Stitch |
|---|---|---|---|---|---|---|
| **S-S02** | Command Center | Santé globale en un coup d'œil | 3 Big numbers cards, 1 Funnel Chart géant, Bandeau R/Y/G AI Services | `Filtrer par date/agence` | Drop-off % par étape (OCR vs Selfie vs Form) | *Analytics dashboard, dark mode...* |
| **S-S06** | Agent Load Balancing | Voir qui est sous l'eau | Bar charts horizontaux (Agents), Heatmap des temps de traitement | `Reassign tasks` | Queue depth/agent, Average Handle Time | *Admin capacity dashboard...* |
| **S-J25** | My Performance (Agent) | Motiver l'agent (Jean) | Speedometer (Dossiers/h), Liste des dossiers récents, FTR (First Time Right) | N/A | Dossiers validés aujourd'hui, Temps cible vs réel | *Personal KPI dashboard web...* |

#### S-S02 : Command Center (Sylvie)
- **Contenu** : Dashboard orienté données. En haut : alertes système ("OCR Service : Degraded"). Au centre : Le Funnel d'onboarding (Visiteurs -> CNI -> Liveness -> Validés). On y observe les drop-offs.
- **Règles UX** : Les couleurs des charts ont des significations d'alarme (Bleu = Normal, Rouge = Seuil critique atteint). L'UI permet le drill-down en cliquant sur la barre "Drop-off CNI".
- **Prompt Stitch** : 
  > *A desktop web analytics dashboard screen for a supervisor. Dark mode theme with sleek neon accents. The header displays real-time system status badges (Green, Yellow, Red dots) for different APIs. The central content is a large, beautiful funnel chart showing user conversion drop-offs. Below the chart, data cards showing numbers like 'Approval Time' and 'Queue Depth'. High contrast, futuristic yet professional SaaS design.*

#### S-J25 : My Performance (Vue Agent individuelle)
- **Contenu** : Interface motivante et claire. Un jauge circulaire (Ring chart) montrant l'objectif quotidien de dossiers vs réalisé. Un graphique en ligne du "First Time Right" ratio.
- **Règles UX** : Gamification très légère (vertige vs récompense) mais focus professionnel.
- **Prompt Stitch** : 
  > *A desktop web app dashboard for a single employee's daily metrics. Clean white background. A centered large circular progress ring displaying 'tasks completed'. To the right, a minimal line graph showing productivity trend over the week. Light gray borders, rounded corners, #E37B03 primary color for highlights. Very airy and spacious layout.*

---
**Note Finale pour exécution Architecturale** :
Ce document verrouille l'aspect "Ce que voit l'utilisateur" (Le Front-end, les composants, la logique de navigation). Les prochaines étapes via l'architecte consisteront à mapper ces écrans :
1. Aux Tunnels API (ex: M-B10 -> AWS Rekognition).
2. Aux schémas de BDD (Où stockons-nous l'état d'avancement du Stepper M-E06 ?).
3. Aux webhooks (Comment Jean A-J08 dit à Marie M-E06 "C'est validé" en temps réel).
