# Stitch Prompts — bicec-veripass

> Historical note, 2026-05-28: these prompts are old UI-generation material. They are not current product scope, architecture, or roadmap authority.

> **Instructions d'utilisation :**
> 1. Crée **3 projets séparés** dans Stitch : `bicec-veripass-mobile`, `bicec-veripass-backoffice`, `bicec-veripass-dashboard`
> 2. Dans chaque projet, commence par le **Prompt d'Initialisation** (Étape 0) avant de générer les écrans individuels
> 3. Génère les écrans **un à un**, dans l'ordre indiqué
> 4. Pour chaque écran : colle d'abord le prompt de création, puis utilise les prompts de raffinement si nécessaire
> 5. **Ne mélange jamais** plusieurs écrans dans un seul prompt

---

## PROJET 1 : bicec-veripass-mobile
### Plateforme : Mobile (Android)

---

### 🔧 ÉTAPE 0 — Initialisation du projet (à faire EN PREMIER)

```
A mobile banking app for BICEC Cameroon called VeriPass. Revolut-inspired premium neobank design. French language. Primary color #E37B03 (mango orange). Clean white backgrounds with orange accents. Sans-serif font Roboto. Fully rounded buttons (height 56px). Card layouts with soft shadows. Android mobile format.
```

---

### 📱 ÉCRAN A01 — Splash & Langue

```
Create a splash screen for VeriPass banking app. BICEC logo centered on white background. Below: language toggle with two pill buttons side by side: "Français" (selected, orange #E37B03 background white text) and "English" (unselected, white background gray text). Loading progress bar at bottom in orange. Minimal and premium design.
```

---

### 📱 ÉCRAN A02 — Welcome Value Prop ⭐ PRIORITAIRE

```
Create a welcome screen for VeriPass mobile banking app. Full-screen warm gradient background from #E37B03 orange at top to lighter #F5A623 at bottom. Top: small BICEC text logo in white. Center: a flat 2D illustration of a person holding a smartphone with a card floating around it, vibrant colors. Below illustration: bold white headline "Votre banque moderne, en 15 minutes" at 28px. Below headline: 3 stacked white semi-transparent pill cards, each with an icon on the left: (1) lightning bolt icon + "Ouverture rapide · 15 min chrono", (2) shield icon + "Sécurité bancaire de niveau 1", (3) sparkles icon + "Services modernes – Cartes, Épargne". Bottom: large white fully rounded button with orange text "Commencer". Below button: small light text "Déjà client ? Se connecter".
```

*Raffinement si nécessaire :*
```
Make the 3 white pill cards slightly transparent (85% opacity) with a subtle blur effect. Increase spacing between them to 12px.
```

---

### 📱 ÉCRAN A03 — Phone Entry

```
Create a phone number entry screen. White background. Top: back arrow in top left, step indicator "1 / 15" in top right gray. Large bold title "Votre numéro de téléphone" at 34px. Subtitle "Nous vous enverrons un code de vérification" in gray. Input field with "+237" locked prefix in gray box on left, then numeric input area, 56px height, light gray background, 12px rounded corners. Primary CTA button "Continuer" in orange #E37B03 at bottom, disabled (40% opacity) state since field is empty. Small link "Besoin d'aide ?" centered below button in blue. Numeric keypad visible at bottom.
```

---

### 📱 ÉCRAN A09 — What You Need (Checklist)

```
Create a pre-onboarding checklist screen. White background. Bold title "Ce dont vous aurez besoin" 28px. Subtitle "Préparez ces documents pour commencer" gray. 4 list items in a card, each with a colored icon on left, label and description on right: (1) green ID card icon "CNI ou Passeport · Recto et verso", (2) blue camera icon "Selfie · Vérification de vivacité", (3) orange document icon "Facture ENEO ou CAMWATER · Preuve d'adresse", (4) gray "#" icon "NIU fiscal · Optionnel". Orange pill badge at top right of card "~15 min". Large orange CTA button "C'est parti !" at bottom. Clean card with soft shadow.
```

---

### 📱 ÉCRAN B02 — CNI Recto Capture ⭐ PRIORITAIRE

```
Create a document scanning camera screen for capturing a national ID card. Full-screen live camera view showing a hand placing a card on a dark surface. Semi-transparent dark overlay on top and bottom thirds. Center: clear transparent cutout rectangle in credit card proportions (3.37 x 2.125 ratio), with 4 orange glowing corner brackets (#E37B03) at each corner of the rectangle. Top of screen: white text "Recto du CNI". Bottom overlay card: tip text "Alignez la carte dans le cadre · Évitez les reflets" in white. Top left: white back arrow. Top right: orange progress pill "Étape 3 / 15".
```

*Raffinement si nécessaire :*
```
Add a subtle pulsing animation indicator: an orange dot next to the text "Auto-capture activé" in the bottom card.
```

---

### 📱 ÉCRAN B07 — OCR Processing (Loading)

```
Create a loading/processing screen. White background. Center: animated circular progress spinner in orange #E37B03. Below spinner: icon of a document with a magnifying glass flat illustration. Bold text "Analyse en cours..." at 22px. Subtitle in gray "Notre IA extrait vos informations automatiquement". Three small animated dots pulse below. At very bottom: small reassuring text "Cela prend généralement moins de 10 secondes".
```

---

### 📱 ÉCRAN B08 — OCR Review & Edit ⭐ PRIORITAIRE

```
Create a data review screen for AI-extracted ID card information. White background. Header: "Vérifiez vos informations" bold 24px, pencil edit icon on right. Scrollable list of data cards, each card has: field label in small gray text, extracted value in bold dark text, colored confidence badge on the right. Card 1: label "Nom", value "TCHAMBA Jean-Pierre", green badge with checkmark "Haute précision". Card 2: label "Prénom", value "MARIE-CLAIRE", green badge. Card 3: label "Date de naissance", value "12/08/1994", orange warning badge "Vérifier" with tap hint below in orange "Appuyez pour modifier". Card 4: label "Numéro CNI", value "— Non détecté —" in light gray, red alert badge "Correction requise" with mandatory edit hint. Bottom sticky area: disabled button "Confirmer et Continuer" at 40% opacity gray with note "Veuillez corriger les champs en rouge". Cards have soft shadows, 12px radius.
```

*Raffinement si nécessaire :*
```
Show the Card 3 (Date de naissance) in edit state: the value becomes an editable text field with orange border 2px, cursor blinking, keyboard hint visible.
```

---

### 📱 ÉCRAN B10_Fail — 3-Strike Lockout ⭐ PRIORITAIRE

```
Create a session lockout screen after failed facial verification. White background. Center: flat illustration of a gray/sad face inside a circle with a lock icon overlay. Below: bold title "Session terminée" in dark gray 24px. Block of body text in gray 16px line-height 1.6: "Désolé pour la gêne, mais pour des raisons techniques / de sécurité, nous sommes obligés de terminer cette session. Ne vous inquiétez pas, vous avez toujours la possibilité d'aller dans une agence locale proche de chez vous, ou de recommencer dès le début." Single large orange fully rounded button at bottom "Recommencer". No other buttons or links.
```

---

### 📱 ÉCRAN C02 — GPS Button (Simplifié)

```
Create an optional GPS location screen. White background. Bold title "Localisez votre domicile" 28px. Subtitle "Optionnel · Aide à vérifier votre adresse" in gray. Single prominent button with location pin icon on left, blue color #2563EB, text "Utiliser ma position actuelle", fully rounded, 56px height. Below button: small gray privacy notice text 13px: "Nous collectons votre position GPS uniquement pour vérifier votre adresse à des fins réglementaires KYC. Ces données sont cryptées." At very bottom: text link "Passer cette étape" in gray. No map embed. Clean minimal layout.
```

---

### 📱 ÉCRAN E03 — Success Celebration ⭐ PRIORITAIRE

```
Create a success celebration screen for completed KYC application submission. White background with colorful confetti particles scattered across the screen (orange, green, blue, yellow). Center top: large green checkmark in a circle with scale animation suggestion (checkmark icon 80px). Bold headline "Félicitations !" in dark 32px. Subtitle "Votre dossier BICEC est soumis !" in 20px. Body text in gray: "Nous validons vos informations sous 24 à 48h. Vous recevrez une notification dès que votre compte est prêt." Below: card with light orange background "⏳ En cours de validation" status badge. Bottom: orange fully rounded button "Découvrir mes futurs services".
```

---

### 📱 ÉCRAN E06 — RESTRICTED_ACCESS Dashboard ⭐ PRIORITAIRE

```
Create a mobile banking home dashboard in "vitrine" (restricted) mode. Revolut-style layout. Top: greeting "Bonjour, Marie" with BICEC logo top right. Persistent amber warning banner below header: "⏳ Votre dossier est en cours de validation · Vous découvrez votre futur espace bancaire" with amber background. Main balance card: large "€ — —" masked balance, rounded white card with orange gradient edge, two buttons below "Ajouter" and "Retirer" both grayed out with lock icon. Below: 4 feature grid cards (2x2): "Virements", "Cartes", "Épargne", "Investissement" — all with gray overlay and padlock icon showing locked state. Bottom navigation bar with 5 icons: Home (active orange), Cards, Analytics, Settings, More.
```

*Raffinement si nécessaire :*
```
Add tooltips on the locked feature cards: small popover "Disponible après validation de votre dossier".
```

---

### 📱 ÉCRAN F02 — FULL_ACCESS Dashboard

```
Create a fully unlocked mobile banking home dashboard. Revolut-style layout. Top: greeting "Bonjour, Marie 👋" with avatar top right. No warning banner (account is active). Main balance card: "245 000 FCFA" shown in large bold white text on a rich orange #E37B03 gradient card, with 3 action buttons below: "Ajouter" (white icon), "Envoyer" (white icon), "Retirer" (white icon). Below: horizontal scrollable row of pocket cards (Épargne, Urgences). Below that: recent transactions list with icons, merchant names, and amounts. Bottom navigation bar: Home (active orange), Cards, Analytics, Profile, More.
```

---

## PROJET 2 : bicec-veripass-backoffice
### Plateforme : Desktop Web (1440px)

---

### 🔧 ÉTAPE 0 — Initialisation du projet

```
A web-based back-office portal for BICEC bank called VeriPass Agent Portal. Clean professional enterprise design. French language. Primary color #2563EB (blue) for agent actions. Secondary orange #E37B03 for alerts. White backgrounds with gray sidebar. Desktop layout 1440px. Sans-serif font Inter. Subtle card shadows. Data-dense but readable layout.
```

---

### 🖥 ÉCRAN J02 — Queue Dashboard (Jean - Validation Agent) ⭐ PRIORITAIRE

```
Create a desktop agent dashboard for document validation. Left sidebar: VeriPass logo top, navigation items (Tableau de bord active, Dossiers, Historique, Paramètres) with icons. Main area header: "File d'attente · Validation KYC" with counter badge "12 dossiers en attente". Filter bar: dropdown filters for Status (Tous / En attente / Urgent) and Date. Main content: data table with columns — Dossier ID, Nom du client, Date soumission, Délai restant (SLA), Confiance IA (%), Action. 3 rows visible: Row 1 in red highlight (SLA breach): "VKY-2847 · Amina BELLO · Il y a 2h · 🔴 Urgent · 73% · [Valider]". Row 2 normal: "VKY-2846 · Pierre NGUEMA · Il y a 1h · 🟡 Normal · 91% · [Valider]". Row 3 normal: "VKY-2845 · Marie TCHAMBA · Il y a 45min · 🟢 OK · 87% · [Valider]". Footer: pagination controls. Top right: agent info "Jean K. · Charge: 3/10 dossiers".
```

---

### 🖥 ÉCRAN J08 — Side-by-Side Evidence Viewer ⭐ PRIORITAIRE

```
Create a desktop document validation screen with split-panel layout. Left panel (50% width): "Pièces justificatives" title. Tabbed carousel at top: "CNI Recto | CNI Verso | Selfie | Facture". Active tab shows large high-resolution image of a Cameroonian national ID card. Below image: image controls (zoom in/out, rotate, download icons). Zoom-on-hover enabled (magnifier cursor icon). Right panel (50% width): "Données extraites" title. List of extracted fields in cards: Nom, Prénom, Date de naissance, Numéro CNI — each with orange/green/red confidence badges. Below list: editable notes field "Observations de l'agent". At very bottom of right panel: two large action buttons side by side: [✅ Approuver] in green, [❌ Rejeter] in red with mandatory dropdown "Raison du rejet" appearing on click. Load balancing badge top right: "Charge: 5/10".
```

*Raffinement si nécessaire :*
```
Add an audit trail panel below the action buttons: collapsible section "Journal d'audit" showing timestamped list of actions taken on this dossier.
```

---

### 🖥 ÉCRAN T02 — Provisioning Queue (Thomas) 

```
Create a desktop provisioning dashboard for account creation agent Thomas. Similar layout to J02 but columns are: Dossier ID, Client, Validé par, Date validation, Conflit détecté (oui/non), Action. Row with conflict: "VKY-2840 · Sara MVONDO · Jean K. · 20/02 · 🔴 Doublon détecté · [Résoudre]". Normal row: "VKY-2839 · Paul ATEBA · Jean K. · 19/02 · ✅ Aucun conflit · [Provisionner]". Header: "File d'attente · Provisionnement" with badge "8 dossiers". Top right: "Thomas M. · Comptes créés aujourd'hui: 14".
```

---

### 🖥 ÉCRAN T08 — Conflict Resolution Panel

```
Create a duplicate account conflict resolution screen. Side-by-side comparison. Title: "⚠️ Doublon détecté — Action requise". Left card "Compte existant": client profile summary with account number, status (Inactive), last activity, photo thumbnail. Right card "Nouveau dossier": new KYC submission summary with submitted date, CNI match score 94%. Below: 3 action buttons stacked: [🔄 Réactiver le compte existant] blue, [➕ Créer un nouveau compte] orange, [📤 Escalader au manager] gray. Each button has a small explanation text below it in gray. Confirmation modal hint on button click.
```

---

## PROJET 3 : bicec-veripass-dashboard
### Plateforme : Desktop Web — Style Grafana (Dark Mode)

---

### 🔧 ÉTAPE 0 — Initialisation du projet

```
An operational monitoring dashboard for a bank manager called Sylvie. Grafana-inspired dark theme. Dark background #1A1F2E. Panel cards with slightly lighter background #252B3B. White and gray text. Colored metrics: green #10B981, amber #F59E0B, red #EF4444, blue #3B82F6. French language. Data visualization focused. Desktop 1440px layout.
```

---

### 🖥 ÉCRAN S02 — Manager Command Center ⭐ PRIORITAIRE

```
Create a Grafana-style dark operational monitoring dashboard for bank manager Sylvie. Dark background #1A1F2E. Top header: "VeriPass · Centre de Pilotage" white title, date "20 Feb 2026 · 05:49" on right, refresh button. Row 1 (KPI big numbers): 4 metric cards side by side — (1) "Temps Validation Moy." value "2h 14min" in green (under 4h SLA), (2) "Taux de Succès 1ère Soumission" value "73%" in amber, (3) "Dossiers en File" value "12" in blue, (4) "Agents Actifs" value "2/3" in white. Row 2: Left panel (60%) "Entonnoir d'Onboarding" funnel chart showing drop-off rates at each module A→B→C→D→E with % values. Right panel (40%) "Santé Système" with 3 colored status rows — 🟢 OCR Service: Opérationnel, 🟡 API Liveness: Dégradé (87%), 🟢 Base de données: OK. Row 3: "Performance Agents" table with Jean and Thomas metrics.
```

*Raffinement si nécessaire :*
```
In the funnel chart, add drop-off percentage labels on the right side of each funnel step, in red text to highlight where users abandon.
```

---

### 🖥 ÉCRAN S08 — Funnel Analytics Detail

```
Create a detailed funnel analytics panel in dark Grafana style. Dark background. Title "Analyse d'Entonnoir — Parcours Marie". Bar chart showing onboarding completion by module: Module A (Authentification) 100%, Module B (Identité + Liveness) 74% with red drop-off indicator -26%, Module C (Adresse + Fiscal) 61% -13%, Module D (Consentement) 58% -3%, Module E (Soumission) 56% -2%. Each bar is horizontal, green for high completion, amber for medium, red for critical drop. Right side panel: top 3 drop-off reasons list with icons and counts. Bottom: time range selector tabs (Aujourd'hui / 7 jours / 30 jours).
```

---

### 🖥 ÉCRAN S16 — Agent Performance Table

```
Create an agent performance monitoring panel in dark Grafana style. Dark background. Title "Performance des Agents". Data table with columns: Agent, Dossiers Traités, Temps Validation Moy., Taux 1ère Décision, Charge Actuelle, Statut. Row Jean: "Jean K. · 8 aujourd'hui · 1h 52min · 89% FTR · 5/10 · 🟢 Disponible". Row Thomas: "Thomas M. · 14 comptes créés · 22min/dossier · 0 conflit · 3/8 · 🟢 Disponible". Below table: Load balancing visual — horizontal capacity bars for each agent, green/amber/red based on load percentage. Alert if agent > 80% capacity.
```

---

## 📋 RÉCAPITULATIF — Ordre de génération recommandé

| Priorité | Écran | Projet | Impact Présentation |
|----------|-------|--------|---------------------|
| 1 | A02 Welcome Value Prop | Mobile | ⭐⭐⭐ |
| 2 | B08 OCR Review | Mobile | ⭐⭐⭐ |
| 3 | E03 Success Celebration | Mobile | ⭐⭐⭐ |
| 4 | E06 RESTRICTED Dashboard | Mobile | ⭐⭐⭐ |
| 5 | J08 Side-by-Side Viewer | Back-Office | ⭐⭐⭐ |
| 6 | S02 Command Center | Dashboard | ⭐⭐⭐ |
| 7 | B10_Fail Lockout | Mobile | ⭐⭐ |
| 8 | B02 CNI Capture | Mobile | ⭐⭐ |
| 9 | J02 Agent Queue | Back-Office | ⭐⭐ |
| 10 | C02 GPS Button | Mobile | ⭐ |
| 11 | F02 FULL_ACCESS Dashboard | Mobile | ⭐ |
| 12 | T02 Provisioning Queue | Back-Office | ⭐ |
| 13 | S08 Funnel Analytics | Dashboard | ⭐ |

## 🎨 Charte Graphique de Référence (à garder sous la main)

| Élément | Valeur |
|---------|--------|
| Couleur primaire | `#E37B03` (Mango Orange) |
| Couleur action (liens) | `#2563EB` (Link Blue) |
| Succès | `#10B981` (Emerald) |
| Alerte | `#F59E0B` (Amber) |
| Erreur | `#EF4444` (Red) |
| Fond (dark mode) | `#1A1F2E` |
| Badge 🟢 Haute précision | > 85% confiance IA |
| Badge 🟠 Vérifier | 50–85% confiance IA |
| Badge 🔴 Correction requise | < 50% confiance IA |
| Rayon boutons | 28px (fully rounded) |
| Hauteur bouton principal | 56px |
| Police Mobile | Roboto (Android) |
| Police Back-Office | Inter (Web) |
