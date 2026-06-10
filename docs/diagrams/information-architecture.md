# Architecture d'information — version courante

> **Note d'autorité, 2026-06-02 :** ce document remplace `diagrams/architecture/information-architecture.md` (déplacé dans `docs/diagrams/_obsolete/`). Il décrit l'architecture d'information **actuelle** basée sur React/Vite (PWA mobile + SPA backoffice), pas sur Flutter ni sur une "Grafana Phase 2" qui n'est pas dans le périmètre de VeriPass.
>
> **Document maître :** [`../../BICEC-VERIPASS-VUE-ENSEMBLE.md`](../../BICEC-VERIPASS-VUE-ENSEMBLE.md) § 3.4, § 3.5.
>
> **Détail exhaustif :** [`../component-inventory.md`](../component-inventory.md).

## Périmètre actuel

VeriPass est composé de **deux frontends** :

1. **PWA Mobile** (Marie) — React 19 + TypeScript + Vite, servie par Nginx statique sous `/mobile/`.
2. **SPA Backoffice** (Jean / Thomas / Sylvie / Admin IT) — React 19 + TypeScript + Vite, servie par Nginx statique sous `/back-office/`.

Il n'y a **pas** d'application Flutter. Il n'y a **pas** de Grafana "Phase 2" ; les analytics passent par les routes `/api/v1/analytics/*` et sont rendues dans la SPA backoffice.

## 1. PWA Mobile (Marie)

### Hiérarchie

```
BICEC VeriPass Mobile
│
├── /auth/
│   ├── AuthEntry
│   ├── PhoneEntry
│   ├── OtpVerify
│   ├── EmailEntry
│   ├── EmailOtpVerify
│   ├── PinSetup
│   ├── PinLogin
│   ├── ForgotPin
│   ├── LockScreen
│   └── BiometricOptIn
│
├── /kyc/
│   ├── BasicProfile
│   ├── DocumentChoice
│   ├── KycIntro
│   ├── CniIntro / CniRectoGuide / CniCapture
│   ├── CniVersoGuide / OcrProcessing / OcrReview
│   ├── LivenessIntro / BiometricConsent / LivenessScreen
│   ├── BillTypeSelect / BillCapture / BillUpload
│   ├── Address / Niu
│   ├── Consent / Signature
│   ├── Review / SubmitSuccess / Rejection / InfoRequested
│   └── ProgressTimeline
│
├── /dashboard
├── /cards, /transfers, /savings, /transactions
├── /notifications, /support
├── /settings, /more
└── /atm-finder
```

### Patterns de navigation

- **Onboarding KYC** : linéaire, avec garde de séquence `useKycFlow`.
- **Post-activation** : navigation tabulaire (BottomNav) + routes profondes.
- **Mode offline** : queue IndexedDB + replay `kycSyncService`.

## 2. SPA Backoffice (Jean / Thomas / Sylvie / Admin IT)

### Hiérarchie

```
BICEC VeriPass Backoffice
│
├── /login
├── /unauthorized
├── /profile
│
├── /validation (JEAN)
│   ├── ValidationQueuePage
│   └── EvidenceViewerPage (JEAN, THOMAS)
│
├── /compliance (THOMAS)
│   ├── ComplianceDashboard
│   ├── AmlAlertDetailPage
│   └── ConflictResolverPage
│
├── /command-center (SYLVIE)
│   └── CommandCenterPage
│
├── /analytics (SYLVIE, THOMAS, ADMIN_IT)
│   └── AnalyticsPage
│
├── /admin (ADMIN_IT)
│   ├── AdminPage (agents, ATMs)
│   └── SystemLogsPage (audit, COBAC)
│
└── / (RoleRedirect) — landing automatique selon rôle
```

### Patterns de navigation

- **Jean** : `Queue → Dossier → Evidence → Décision → Queue`.
- **Thomas** : `Dashboard → AML alert | Conflit NIU | Agences | Batch → Dashboard`.
- **Sylvie** : `Command Center → Analytics | Audit → Command Center`.
- **Admin IT** : `Agents → ATM → Audit → Profil`.

## 3. Profondeur et conventions

| Surface | Profondeur max | Convention de nommage |
| --- | --- | --- |
| PWA Mobile | 3 niveaux (Module → Écran → Modal) | kebab-case pour les routes, PascalCase pour les composants |
| Backoffice | 2 niveaux (Page → Onglet) | kebab-case pour les routes, PascalCase pour les composants |
| API | 2 niveaux (préfixe module → endpoint) | snake_case |

## 4. Points de sortie

- **PWA** : logout, session timeout (15 min), lockout liveness (3 strikes, cooldown 60s), suppression de compte.
- **Backoffice** : logout, session timeout (30 min), bannière d'avertissement.

## Hors périmètre

- ❌ **Application Flutter** (mentionnée dans l'ancien document). Le mobile est une PWA React/Vite.
- ❌ **Grafana Phase 2** (mentionnée dans l'ancien document). Les analytics sont dans la SPA backoffice, pas dans Grafana.
- ❌ **DGI / Sopra Amplitude** : aucune vue, aucun écran, aucune page backoffice pour ces intégrations.
- ❌ **Provisioning core banking** : aucune page "Activations agence" ou "Provisioning Amplitude" — ces concepts n'existent pas dans le système.
