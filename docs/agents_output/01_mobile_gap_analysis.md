# 📱 Mobile Gap Analysis

## 📋 Prototype Mobile (black_hole/biveripass)

### Architecture Fonctionnelle
- **Framework** : React 19 + TypeScript + Vite 8
- **State Management** : React Context (AuthContext, KycContext)
- **Routing** : React Router v7
- **API** : TanStack Query v5
- **UI** : TailwindCSS v4 + shadcn/ui
- **Components** : 50+ composants UI shadcn

### Routes dans App.tsx
```
Auth Flow:
/ → SplashScreen
/welcome → WelcomeScreen
/auth/phone → PhoneEntryScreen
/auth/otp → OtpVerifyScreen
/auth/email → EmailEntryScreen
/auth/email-verify → EmailVerifyScreen
/auth/pin → PinSetupScreen
/auth/pin-login → PinLoginScreen
/auth/biometric → BiometricOptInScreen
/kyc/what-you-need → WhatYouNeedScreen
/kyc/progress → ProgressTimelineScreen

KYC - Identity:
/kyc/cni-intro → CniIntroScreen
/kyc/cni-recto-guide → CniRectoGuideScreen
/kyc/cni-recto-capture → CniRectoCaptureScreen
/kyc/capture-success-recto → CaptureSuccessRecto
/kyc/cni-verso-guide → CniVersoGuideScreen
/kyc/cni-verso-capture → CniVersoCaptureScreen
/kyc/capture-success-verso → CaptureSuccessVerso
/kyc/ocr-processing → OcrProcessingScreen
/kyc/ocr-review → OcrReviewScreen
/kyc/liveness-intro → LivenessIntroScreen
/kyc/liveness-challenge → LivenessChallengeScreen
/kyc/liveness-success → LivenessSuccessScreen
/kyc/liveness-fail → LivenessFailScreen

KYC - Address & Fiscal:
/kyc/address → AddressScreen
/kyc/utility-intro → UtilityIntroScreen
/kyc/utility-capture → UtilityCaptureScreen
/kyc/niu-choice → NiuChoiceScreen
/kyc/niu-manual → NiuManualScreen
/kyc/niu-capture → NiuCaptureScreen

KYC - Consent & Submission:
/kyc/consent → ConsentScreen
/kyc/signature → SignatureScreen
/kyc/review → ReviewScreen
/kyc/upload → UploadScreen
/kyc/celebration → CelebrationScreen

Dashboard:
/dashboard → DashboardScreen
/cards → CardsScreen
/transfers → TransfersScreen
/transfers/send → TransferSendScreen
/transfers/receive → TransferReceiveScreen
/savings → SavingsScreen
/transactions → TransactionHistoryScreen
/more → MoreScreen
/settings → SettingsScreen
/help → HelpScreen
/notifications → NotificationsScreen
/support → SupportScreen
/rejection → RejectionScreen
/linked-accounts → LinkedAccountsScreen
```

### Appels API dans services/
- **apiClient.ts** : Gestion des tokens, fallback vers mocks
- **passkeyService.ts** : Authentification biométrique
- **mockData.ts** : Données de test

### Delta des Types et Contextes
**KycContext** (black_hole):
```typescript
interface KycState {
  sessionId: string | null;
  status: KycStatus; // IN_PROGRESS, COMPLETED, FAILED
  currentStep: KycStep; // cni_recto, cni_verso, liveness, address, etc.
  completedSteps: KycStep[];
  accessLevel: AccessLevel; // RESTRICTED_ACCESS, FULL_ACCESS
  cniRectoCapture: string | null;
  cniVersoCapture: string | null;
  ocrFields: OcrField[];
  livenessAttempts: number;
  address: AddressData | null;
  billCapture: string | null;
  niuCapture: string | null;
  niuManual: string | null;
  consentCgu: boolean;
  consentPrivacy: boolean;
  consentData: boolean;
  signatureData: string | null;
  selectedPlan: string | null;
  interests: string[];
}
```

**Delta avec code/mobile/src/**:
- Le prototype utilise des types plus complets
- Gestion des états KYC plus granulaire
- Support pour les plans et intérêts

### Fichiers à réécrire pour matcher la stack stricte
1. **App.tsx** : Routes à aligner avec le routing de production
2. **AuthContext.tsx** : Gestion des tokens à standardiser
3. **KycContext.tsx** : États à synchroniser avec backend
4. **apiClient.ts** : Suppression des mocks, intégration réelle
5. **Tous les services** : Adaptation aux endpoints réels

### Chemins des fichiers analysés
- `docs/test_tmp_trash/black_hole_not_tocommit/biveripass/src/App.tsx`
- `docs/test_tmp_trash/black_hole_not_tocommit/biveripass/src/contexts/AuthContext.tsx`
- `docs/test_tmp_trash/black_hole_not_tocommit/biveripass/src/contexts/KycContext.tsx`
- `docs/test_tmp_trash/black_hole_not_tocommit/biveripass/src/services/apiClient.ts`
- `docs/test_tmp_trash/black_hole_not_tocommit/biveripass/src/services/passkeyService.ts`
- `docs/test_tmp_trash/black_hole_not_tocommit/biveripass/src/services/mockData.ts`

---

## 🕵️ AUGMENTATION — Scan du Code Actuel (2026-04-05)

### 📁 État de `code/mobile/src/views/`
Le code actuel implémente maintenant :
- **Authentification (8 écrans)** : `PhoneEntryScreen`, `OtpVerifyScreen`, `EmailEntryScreen`, `EmailOtpVerifyScreen`, `PinSetupScreen`, `PinLoginScreen`, `ForgotPinScreen`, `LockScreen`.
- **KYC** : aucune implémentation à ce jour.
- **Contextes overhaulés** : `AuthContext` (auto-lock, session management).

### 🛣️ Delta de Navigation (App.tsx)
- **Actuel** : 15+ routes (Auth complet + lock guard + protected routes).
- **Prototype** : 50+ routes (KYC complet, Dashboard complet).
- **Action** : L'intégration doit porter les 35+ routes manquantes (KYC, Dashboard, Discovery) tout en conservant le `basename="/mobile"`.

### 🔐 AuthContext (2026-04-05 — nouvelles fonctionnalités)
- Inactivity timer avec auto-lock (5 min prod / 25 s dev)
- Session locking UI state (`isLocked`, `lock`, `unlock`)
- Delete account support
- Passkey integration via `passkeyService.ts` (**non testé**)
- LockGuard component interceptant la navigation