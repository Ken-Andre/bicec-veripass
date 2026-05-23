# BICEC VeriPass Mobile — Agent Guide

## Architecture de navigation

L'application mobile est structurée en **3 zones distinctes** :

```
┌─────────────────────────────────────────────────────────────┐
│  ZONE 1 : Splash / Auth                                     │
│  Routes : /, /auth/*                                        │
│  Layout : plein écran, pas de BottomNav                     │
│  But : onboarding, inscription, connexion, PIN              │
├─────────────────────────────────────────────────────────────┤
│  ZONE 2 : KYC Flow                                          │
│  Routes : /kyc/*                                            │
│  Layout : plein écran, pas de BottomNav                     │
│  But : capture CNI, OCR, liveness, adresse, consentement    │
├─────────────────────────────────────────────────────────────┤
│  ZONE 3 : Dashboard (post-auth)                             │
│  Routes : /dashboard, /cards, /transfers, /savings, ...     │
│  Layout : DashboardLayout (avec BottomNav globale)          │
│  But : services bancaires, paramètres, support              │
└─────────────────────────────────────────────────────────────┘
```

### DashboardLayout

`src/components/DashboardLayout.tsx` est le **layout global** pour toutes les routes post-authentification. Il :
- Structure en `h-[100dvh] flex flex-col` avec scroll interne sur `<main className="flex-1 overflow-y-auto">`
- Affiche la `BottomNav` en bas de page (fixed, glass-strong)
- Gère `pb-24` automatiquement pour éviter que le contenu soit caché
- Gère `safe-bottom` pour les téléphones avec notch
- Masque la BottomNav sur certains sous-écrans (`/transfers/send`, `/transfers/receive`, `/settings/delete-account`)

**Règle d'or** : aucun écran sous `/dashboard` ne doit importer `BottomNav` manuellement.

## Flow utilisateur Marie (du splash au compte actif)

```
/ (Splash 2.5s → Onboarding carousel)
  ↓ "Ouvrir mon compte"
/auth/phone?mode=signup
  ↓ OTP vérifié
/auth/email → /auth/email-otp
  ↓ (peut être skipped)
/auth/pin-setup
  ↓
/kyc/basic-profile
  ↓
/kyc/document-choice → /kyc/cni-intro → /kyc/cni-recto-capture → ...
  ↓
/kyc/review → /kyc/submit-success
  ↓
/dashboard
  ↓
[Cartes, Virements, Épargne, Plus] ← BottomNav toujours visible
```

## Design system

### Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--primary` | BICEC Orange `30 95% 46%` | idem | CTAs, active nav, accents |
| `--secondary` | Dark brown `24 60% 14%` | `24 20% 18%` | Headers, hero gradients |
| `--accent` | Blue `217 91% 53%` | idem | Liens, icônes ecosystem |
| `--success` | Green `160 84% 39%` | idem | Crédits, états positifs |
| `--warning` | Amber `38 92% 50%` | idem | Bannières limited/restricted |
| `--destructive` | Red `0 84% 60%` | idem | Erreurs, logout |

### Glassmorphism

```css
.glass {
  background: hsl(var(--glass-bg));
  backdrop-filter: blur(12px);
  border: 1px solid hsl(var(--glass-border));
  box-shadow: var(--glass-shadow);
}

.gradient-primary {
  background: linear-gradient(135deg, hsl(var(--primary)), hsl(24 60% 14%));
}
```

### Spacing & Layout
- Container mobile : `max-w-md mx-auto px-6`
- Cards radius : `rounded-2xl` (1rem)
- Bottom nav height + safe area : `pb-24`
- Hero header : `rounded-b-3xl` avec `gradient-primary`

## Composants réutilisables clés

| Composant | Rôle | Où l'utiliser |
|-----------|------|---------------|
| `ScreenLayoutV2` | **Layout standard** — scroll interne + AppBar + footer sticky CTA + safe areas | Tous les écrans plein écran (auth, KYC, sous-pages) |
| `DashboardLayout` | Wrapper global + BottomNav | Toutes les routes post-auth |
| `Button` (`components/ui/button.tsx`) | CTA unifié : variantes primary/secondary/ghost/danger/outline, loading, disabled, tailles sm/md/lg | Tous les boutons d'action |
| `Input` (`components/ui/input.tsx`) | Champ de saisie unifié : label, hint, error, iconLeft/Right | Tous les formulaires |
| `FormField` | Wrapper label + input + message d'erreur | Formulaires complexes |
| `AppBar` | Barre d'app sticky avec titre, bouton retour, actions secondaires | ScreenLayoutV2 |
| `LoadingState` / `ErrorState` / `EmptyState` | États de chargement, erreur et vide standardisés | Tous les écrans avec fetch |
| `GlassCard` / `.glass` | Carte glassmorphism | Dashboard, listes, quick actions |
| `BottomNav` | Navigation 4 onglets | Uniquement dans DashboardLayout |
| `ProgressStepper` | Indicateur d'étapes KYC | Parcours KYC |

### Migration terminée

- **Tous les écrans** (auth, KYC, dashboard, et sous-pages) ont été migrés vers `ScreenLayoutV2` + `<Button>` + `<Input>`.
- L'ancien `ScreenLayout.tsx` a été supprimé.
- Les classes CSS legacy `.bicec-button` et `.premium-input` ont été supprimées de `index.css`.
- **DashboardLayout** utilise désormais un scroll interne (`h-[100dvh] flex flex-col`, `<main className="flex-1 overflow-y-auto">`) pour éviter le scroll global du body.

## Conventions de code

1. **Pas de mock data** — jamais. Les états possibles sont : `loading` (skeleton) → `data` → `empty`.
2. **BottomNav uniquement dans DashboardLayout** — aucun import manuel dans les écrans.
3. **Appels API via `apiClient`** — pas de `fetch` bruts. Le client injecte automatiquement `Authorization` et `X-Correlation-ID`.
4. **Types stricts** — toutes les entités API doivent être typées dans `src/types/index.ts`.
5. **Dark mode first-class** — toutes les couleurs utilisent les CSS variables avec variantes `.dark`.
6. **Safe areas** — utiliser `.safe-top` et `.safe-bottom` sur les éléments fixed/sticky.
7. **Pas de composants définis à l'intérieur d'autres composants** — extraire les sous-composants au niveau du module pour éviter les remontages React (ex: `ConsentRow` extrait de `ConsentScreen`).

## Gate qualite local

- Avant tout commit ou push, verifier que les hooks locaux sont actifs et non contournes. Si `core.hooksPath` vaut `/dev/null`, le signaler et ne pas supposer que les hooks tourneront.
- Avant de rendre un changement mobile, lancer au minimum `npm --prefix code/mobile run lint` et `npm --prefix code/mobile run build`, ou expliquer clairement pourquoi ce n'etait pas possible.
- Si le changement touche aussi le backend ou la CI, lancer les checks backend equivalents avant push afin d'eviter de consommer inutilement des minutes GitHub Actions.

## Endpoints backend utilisés par le mobile

| Endpoint | Utilisé dans | Description |
|----------|--------------|-------------|
| `GET /banking/account` | DashboardPage | Solde, IBAN, holder_name, access_level |
| `GET /banking/cards` | CardsScreen | Liste des cartes |
| `POST /banking/cards/{id}/freeze` | CardsScreen | Geler/dégeler |
| `GET /banking/transactions` | DashboardPage, TransactionHistoryScreen | Historique |
| `GET /banking/savings/pockets` | DashboardPage, SavingsScreen | Poches épargne |
| `POST /banking/savings/pockets` | SavingsScreen | Créer une poche |
| `POST /banking/transfers/send` | TransferSendScreen | Virement ISO 20022 |
| `GET /kyc/review-status` | DashboardPage (poll) | Statut KYC et access tier |
| `GET /notifications` | NotificationsScreen | Notifications utilisateur |
| `POST /notifications/read` | NotificationsScreen | Marquer des notifications comme lues |
| `GET /notifications/subscriptions` | SettingsScreen / PWA push | Abonnements push du device |
| `POST /notifications/subscriptions` | SettingsScreen / PWA push | Enregistrer un abonnement push |
| `GET /support/threads/current` | SupportScreen | Fil support courant |
| `GET /support/threads/{id}/messages` | SupportScreen | Messages support |
| `POST /support/threads/{id}/messages` | SupportScreen | Envoyer un message support |
| `POST /support/attachments` | SupportScreen | Envoyer une piece complementaire |

## Fichiers critiques à ne pas casser

- `src/App.tsx` — Le routing avec `DashboardLayout` est la colonne vertébrale de la navigation.
- `src/components/DashboardLayout.tsx` — Ne jamais y ajouter de logique métier lourde.
- `src/index.css` — Les tokens CSS sont utilisés dans toute l'app.
- `src/contexts/AuthContext.tsx` — Gère le cycle de vie session/JWT.
- `src/contexts/KycContext.tsx` — Gère la progression KYC et le polling statut.
