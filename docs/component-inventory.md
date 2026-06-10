# Component Inventory

Updated: 2026-05-28

This inventory helps maintainers locate UI and shared frontend code quickly. It is not a Storybook replacement; it maps implemented screens, shells, services, and reusable components.

## Mobile PWA

Root: `code/mobile`

### Providers And Guards

| Component | Path | Purpose |
| --- | --- | --- |
| `App` | `src/App.tsx` | Route map, providers, lazy screens |
| `AuthProvider` | `src/contexts/AuthContext.tsx` | Client auth state, token handling, lock handling |
| `KycProvider` | `src/contexts/KycContext.tsx` | Current KYC session and backend reconciliation |
| `LanguageProvider` | `src/contexts/LanguageContext.tsx` | App language and translations |
| `AuthGuard` | `src/App.tsx` | Redirect unauthenticated clients |
| `LockGuard` | `src/App.tsx` | Redirect locked sessions to PIN lock screen |
| `KycHydrationGate` | `src/components/KycHydrationGate.tsx` | Wait for current KYC state before rendering step |
| `KycStepGuard` | `src/hooks/useKycFlow.tsx` | Prevent invalid step order and self-loop redirects |

### Mobile Routes

| Route group | Screens |
| --- | --- |
| `/` | `HomePage` |
| `/auth/*` | `AuthEntryScreen`, `PhoneEntryScreen`, `OtpVerifyScreen`, `EmailEntryScreen`, `EmailOtpVerifyScreen`, `PinSetupScreen`, `PinLoginScreen`, `ForgotPinScreen`, `LockScreen`, `BiometricOptInScreen` |
| `/kyc/progress` | `ProgressTimelineScreen` |
| Dashboard routes | `DashboardPage`, `CardsScreen`, `AtmFinderScreen`, `TransfersScreen`, `TransferSendScreen`, `TransferReceiveScreen`, `SavingsScreen`, `TransactionHistoryScreen`, `MoreScreen`, `SettingsScreen`, `NotificationsScreen`, `HelpScreen`, `SupportScreen`, `DeleteAccountScreen` |
| KYC preparation | `BasicProfileScreen`, `DocumentChoiceScreen`, `KycIntroScreen` |
| CNI capture | `CniIntroScreen`, `CniRectoGuideScreen`, `CniCaptureScreen`, `CniVersoGuideScreen`, `OcrProcessingScreen`, `OcrReviewScreen` |
| Liveness | `LivenessIntroScreen`, `BiometricConsentScreen`, `LivenessScreen` |
| Proof/address/NIU | `BillTypeSelectScreen`, `BillCaptureScreen`, `BillUploadScreen`, `AddressScreen`, `NiuScreen` |
| Final submission | `ConsentScreen`, `SignatureScreen`, `ReviewScreen`, `SubmitSuccessScreen`, `RejectionScreen`, `InfoRequestedScreen` |
| fallback | `NotFoundPage` |

### Mobile Reusable Components

| Category | Components |
| --- | --- |
| Layout/navigation | `DashboardLayout`, `BottomNav`, `AppBar`, `ScreenLayoutV2` |
| Feedback | `OfflineBanner`, `KycResumeBanner`, `CelebrationOverlay`, `ProgressStepper`, `PageLoader`, `Skeleton`, `LoadingState`, `ErrorState`, `EmptyState`, `ErrorBoundary` |
| Data confidence | `ConfidenceBadge` |
| UI primitives | `button`, `card`, `input`, `label`, `badge`, `toast`, `toaster`, `sonner` |

### Mobile Services

| Service | Purpose |
| --- | --- |
| `apiClient.ts` | JSON client, raw fetch wrapper, correlation IDs, auth and device headers |
| `kycOfflineStore.ts` | IndexedDB queue and persisted KYC state |
| `kycSyncService.ts` | Replays offline KYC mutations and blocks submit if pending data exists |
| `deviceRegistrationService.ts` | Builds fingerprint metadata and registers device tag |
| `passkeyService.ts` | WebAuthn registration/authentication client |
| `pushNotificationService.ts` | Push subscription management |
| `atmLocator.ts` | ATM list/location helpers |
| `cniValidator.ts` | CNI validation helpers |
| `imageCompression.ts` | Client-side compression |
| `mediapipeService.ts` | MediaPipe liveness helper |
| `sentry.ts` | Frontend Sentry initialization through backend proxy |

### Mobile Test Areas

- Component and view unit tests live next to source files.
- KYC flow reconciliation tests live in `src/hooks/__tests__/`.
- Offline sync tests live in `src/services/kycSyncService.test.ts`.
- Playwright flows live in `code/mobile/tests/e2e/`.

## Backoffice SPA

Root: `code/backoffice`

### Providers And Guards

| Component | Path | Purpose |
| --- | --- | --- |
| `App` | `src/App.tsx` | Role-protected route map |
| `AuthProvider` | `src/contexts/AuthContext.tsx` | Agent login/session/refresh handling |
| `ToastProvider` | `src/contexts/ToastContext.tsx` | Toast state |
| `ProtectedRoute` | `src/components/auth/ProtectedRoute.tsx` | Authentication and role enforcement |
| `RoleRedirect` | `src/components/auth/RoleRedirect.tsx` | Landing redirect by agent role |
| `MainLayout` | `src/components/layout/MainLayout.tsx` | Backoffice shell |

### Backoffice Routes

| Route | Page | Roles |
| --- | --- | --- |
| `/login` | `LoginPage` | unauthenticated |
| `/` | `RoleRedirect` | authenticated |
| `/validation` | `ValidationQueuePage` | `JEAN` |
| `/validation/dossier/:id` | `EvidenceViewerPage` | `JEAN`, `THOMAS` |
| `/compliance` | `ComplianceDashboard` | `THOMAS` |
| `/compliance/alert/:id` | `AmlAlertDetailPage` | `THOMAS` |
| `/compliance/duplicates` | `ConflictResolverPage` | `THOMAS` |
| `/command-center` | `CommandCenterPage` | `SYLVIE` |
| `/analytics` | `AnalyticsPage` | `SYLVIE`, `THOMAS`, `ADMIN_IT` |
| `/admin` | `AdminPage` | `ADMIN_IT` |
| `/admin/audit` | `SystemLogsPage` | `ADMIN_IT`, `SYLVIE` |
| `/profile` | `ProfilePage` | authenticated |
| `/unauthorized` | `UnauthorizedPage` | authenticated but forbidden |

### Backoffice Reusable Components

| Category | Components |
| --- | --- |
| Layout | `Header`, `Sidebar`, `MainLayout`, `SessionWarningBanner`, `NavLink` |
| Evidence/dossier | `AddressCoherencePanel`, `ConfidenceBar`, `DossierTimeline`, `FaceComparisonCard`, `FlagBadge`, `ImageViewer`, `RequestInfoModal`, `StatusChip` |
| UI primitives | `Avatar`, `Badge`, `Button`, `Card`, `Checkbox`, `Dialog`, `Input`, `label`, `Progress`, `Select`, `Table`, `Tabs`, `Textarea`, `ToastContainer` |
| Loading/error | `PageLoader`, `NotFoundPage`, `UnauthorizedPage` |

### Backoffice Services

| Service | Purpose |
| --- | --- |
| `api-client.ts` | Fetch wrappers for JSON, blob downloads, patch/delete/post |
| `dossier-service.ts` | Queue, dossier detail, review, assignment, analytics dashboard |
| `aml-service.ts` | AML alerts, NIU conflicts, agencies, batch jobs, document expiry |
| `sentry.ts` | Frontend Sentry initialization through backend proxy |
| `mock-data.ts` | Legacy/demo data helpers |

### Backoffice Types

| File | Purpose |
| --- | --- |
| `types/auth.ts` | Agent/user/role contracts |
| `types/kyc.ts` | Dossier, document, OCR, queue state |
| `types/aml.ts` | Alerts, conflicts, agencies, batch jobs |
| `types/audit.ts` | Audit log contracts |
| `types/index.ts` | Shared exports |

## Design System Notes

- Both frontends use local UI primitives rather than a fully external component kit.
- Icons come from `lucide-react`.
- React Query is used for server data, but some pages still use direct `fetch` or local service wrappers.
- Screens are lazy-loaded from route maps to keep bundles smaller.
- The mobile PWA and backoffice use separate API clients and token keys. Do not mix them.

## Maintenance Rules

1. When backend response fields change, update frontend TypeScript types in the affected app.
2. When a route changes, update `App.tsx`, tests, and docs.
3. When a role changes, update both frontend route guard rules and backend `require_agent_role` usage.
4. When a KYC step changes, update mobile screen, `useKycFlow`, offline sync handling, readiness logic, and tests together.
5. When a shared component changes, run the local unit tests for the owning frontend and inspect the relevant Playwright evidence path if it affects a demo route.
