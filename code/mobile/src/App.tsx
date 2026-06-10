import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { KycProvider } from "./contexts/KycContext";
import { KycHydrationGate } from "./components/KycHydrationGate";
import { KycStepGuard } from "./hooks/useKycFlow";
import { OfflineBanner } from "./components/OfflineBanner";
import { PageLoader } from "./components/PageLoader";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DashboardLayout } from "./components/DashboardLayout";
import { useServiceWorker } from "./hooks/use-service-worker";
import { setViewportChromeColor } from "./lib/appChrome";

const queryClient = new QueryClient();

// --- Auth screens ---
const PhoneEntryScreen = lazy(() =>
  import("./views/auth/PhoneEntryScreen").then((m) => ({ default: m.default })),
);
const AuthEntryScreen = lazy(() =>
  import("./views/auth/AuthEntryScreen").then((m) => ({ default: m.default })),
);
const OtpVerifyScreen = lazy(() =>
  import("./views/auth/OtpVerifyScreen").then((m) => ({ default: m.default })),
);
const EmailEntryScreen = lazy(() =>
  import("./views/auth/EmailEntryScreen").then((m) => ({ default: m.default })),
);
const EmailOtpVerifyScreen = lazy(() =>
  import("./views/auth/EmailOtpVerifyScreen").then((m) => ({
    default: m.default,
  })),
);
const PinSetupScreen = lazy(() =>
  import("./views/auth/PinSetupScreen").then((m) => ({ default: m.default })),
);
const PinLoginScreen = lazy(() =>
  import("./views/auth/PinLoginScreen").then((m) => ({ default: m.default })),
);
const ForgotPinScreen = lazy(() =>
  import("./views/auth/ForgotPinScreen").then((m) => ({ default: m.default })),
);
const LockScreen = lazy(() =>
  import("./views/auth/LockScreen").then((m) => ({ default: m.default })),
);
const BiometricOptInScreen = lazy(() =>
  import("./views/auth/BiometricOptInScreen").then((m) => ({
    default: m.default,
  })),
);
const ProgressTimelineScreen = lazy(() =>
  import("./views/auth/ProgressTimelineScreen").then((m) => ({
    default: m.default,
  })),
);

// --- Dashboard screens ---
const HomePage = lazy(() =>
  import("./views/HomePage").then((m) => ({ default: m.HomePage })),
);
const DashboardPage = lazy(() =>
  import("./views/dashboard/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);
const CardsScreen = lazy(() =>
  import("./views/dashboard/CardsScreen").then((m) => ({
    default: m.CardsScreen,
  })),
);
const AtmFinderScreen = lazy(() =>
  import("./views/dashboard/AtmFinderScreen").then((m) => ({
    default: m.AtmFinderScreen,
  })),
);
const TransfersScreen = lazy(() =>
  import("./views/dashboard/TransfersScreen").then((m) => ({
    default: m.TransfersScreen,
  })),
);
const TransferSendScreen = lazy(() =>
  import("./views/dashboard/TransferSendScreen").then((m) => ({
    default: m.TransferSendScreen,
  })),
);
const TransferReceiveScreen = lazy(() =>
  import("./views/dashboard/TransferReceiveScreen").then((m) => ({
    default: m.TransferReceiveScreen,
  })),
);
const SavingsScreen = lazy(() =>
  import("./views/dashboard/SavingsScreen").then((m) => ({
    default: m.SavingsScreen,
  })),
);
const TransactionHistoryScreen = lazy(() =>
  import("./views/dashboard/TransactionHistoryScreen").then((m) => ({
    default: m.TransactionHistoryScreen,
  })),
);
const SettingsScreen = lazy(() =>
  import("./views/dashboard/SettingsScreen").then((m) => ({
    default: m.SettingsScreen,
  })),
);
const NotificationsScreen = lazy(() =>
  import("./views/dashboard/NotificationsScreen").then((m) => ({
    default: m.NotificationsScreen,
  })),
);
const HelpScreen = lazy(() =>
  import("./views/dashboard/HelpScreen").then((m) => ({
    default: m.HelpScreen,
  })),
);
const SupportScreen = lazy(() =>
  import("./views/dashboard/SupportScreen").then((m) => ({
    default: m.SupportScreen,
  })),
);
const MoreScreen = lazy(() =>
  import("./views/dashboard/MoreScreen").then((m) => ({
    default: m.MoreScreen,
  })),
);

// --- KYC screens ---
const KycIntroScreen = lazy(() => import("./views/kyc/KycIntroScreen"));
const BasicProfileScreen = lazy(() => import("./views/kyc/BasicProfileScreen"));
const DocumentChoiceScreen = lazy(
  () => import("./views/kyc/DocumentChoiceScreen"),
);
const CniIntroScreen = lazy(() => import("./views/kyc/CniIntroScreen"));
const CniCaptureScreen = lazy(() => import("./views/kyc/CniCaptureScreen"));
const CniRectoGuideScreen = lazy(
  () => import("./views/kyc/CniRectoGuideScreen"),
);
const CniVersoGuideScreen = lazy(
  () => import("./views/kyc/CniVersoGuideScreen"),
);
const OcrProcessingScreen = lazy(
  () => import("./views/kyc/OcrProcessingScreen"),
);
const OcrReviewScreen = lazy(() => import("./views/kyc/OcrReviewScreen"));
const LivenessIntroScreen = lazy(
  () => import("./views/kyc/LivenessIntroScreen"),
);
const BiometricConsentScreen = lazy(
  () => import("./views/kyc/BiometricConsentScreen"),
);
const LivenessScreen = lazy(() => import("./views/kyc/LivenessScreen"));
const BillTypeSelectScreen = lazy(
  () => import("./views/kyc/BillTypeSelectScreen"),
);
const BillCaptureScreen = lazy(() => import("./views/kyc/BillCaptureScreen"));
const BillUploadScreen = lazy(() => import("./views/kyc/BillUploadScreen"));
const AddressScreen = lazy(() => import("./views/kyc/AddressScreen"));
const NiuScreen = lazy(() => import("./views/kyc/NiuScreen"));
const ConsentScreen = lazy(() => import("./views/kyc/ConsentScreen"));
const SignatureScreen = lazy(() => import("./views/kyc/SignatureScreen"));
const ReviewScreen = lazy(() => import("./views/kyc/ReviewScreen"));
const SubmitSuccessScreen = lazy(
  () => import("./views/kyc/SubmitSuccessScreen"),
);
const RejectionScreen = lazy(() => import("./views/kyc/RejectionScreen"));
const InfoRequestedScreen = lazy(
  () => import("./views/kyc/InfoRequestedScreen"),
);

// --- Settings screens ---
const DeleteAccountScreen = lazy(
  () => import("./views/settings/DeleteAccountScreen"),
);
const LegalDocumentsScreen = lazy(
  () => import("./views/settings/LegalDocumentsScreen"),
);

// --- 404 ---
const NotFoundPage = lazy(() =>
  import("./views/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
);

// Composant AuthenticatedKycProvider qui ne se monte que si l'utilisateur a un token valide
function AuthenticatedKycProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth(); // hook de AuthContext

  // KycProvider ne se monte que si l'utilisateur a un token valide
  if (!isAuthenticated) return <>{children}</>;
  return <KycProvider>{children}</KycProvider>;
}

function LockGuard({ children }: { children: React.ReactNode }) {
  const { isLocked } = useAuth();
  const sessionLocked = sessionStorage.getItem("vp_is_locked") === "true";
  if (isLocked && sessionLocked) return <Navigate to="/auth/lock" replace />;
  return <>{children}</>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <LockGuard>{children}</LockGuard>;
}

function CniRectoCapture() {
  return <CniCaptureScreen side="recto" nextRoute="/kyc/cni-verso" />;
}

function CniVersoCapture() {
  return <CniCaptureScreen side="verso" nextRoute="/kyc/ocr-review" />;
}

function MetaThemeColor() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    if (path === "/") return;

    const color = path.includes("capture")
      ? "#000000"
      : path === "/dashboard"
        ? "#E37B03"
        : "#FBF8F3";
    setViewportChromeColor(color);
  }, [location.pathname]);

  return null;
}

function App() {
  const { needsRefresh, updateSW, dismiss } = useServiceWorker();

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <BrowserRouter basename="/mobile">
          <MetaThemeColor />
          <AuthProvider>
            <AuthenticatedKycProvider>
              <OfflineBanner />
              {needsRefresh && (
                <div className="fixed inset-x-4 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-[100] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-white px-4 py-3 text-sm shadow-xl">
                  <span className="font-semibold text-foreground">Nouvelle version disponible</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={dismiss} className="text-xs font-bold text-muted-foreground">
                      Plus tard
                    </button>
                    <button type="button" onClick={() => updateSW()} className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                      Recharger
                    </button>
                  </div>
                </div>
              )}
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/auth" element={<AuthEntryScreen />} />
                    <Route path="/auth/phone" element={<PhoneEntryScreen />} />
                    <Route path="/auth/otp" element={<OtpVerifyScreen />} />
                    <Route path="/auth/email" element={<EmailEntryScreen />} />
                    <Route
                      path="/auth/email-otp"
                      element={<EmailOtpVerifyScreen />}
                    />
                    <Route
                      path="/auth/pin-setup"
                      element={<PinSetupScreen />}
                    />
                    <Route
                      path="/auth/pin-login"
                      element={<PinLoginScreen />}
                    />
                    <Route
                      path="/auth/forgot-pin"
                      element={<ForgotPinScreen />}
                    />
                    <Route path="/auth/lock" element={<LockScreen />} />
                    <Route
                      path="/auth/biometric"
                      element={<BiometricOptInScreen />}
                    />
                    <Route
                      path="/kyc/progress"
                      element={<ProgressTimelineScreen />}
                    />
                    {/* Dashboard routes with global BottomNav */}
                    <Route
                      element={
                        <AuthGuard>
                          <DashboardLayout />
                        </AuthGuard>
                      }
                    >
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/cards" element={<CardsScreen />} />
                      <Route path="/cards/atm-finder" element={<AtmFinderScreen />} />
                      <Route path="/transfers" element={<TransfersScreen />} />
                      <Route
                        path="/transfers/send"
                        element={<TransferSendScreen />}
                      />
                      <Route
                        path="/transfers/receive"
                        element={<TransferReceiveScreen />}
                      />
                      <Route path="/savings" element={<SavingsScreen />} />
                      <Route
                        path="/transactions"
                        element={<TransactionHistoryScreen />}
                      />
                      <Route path="/more" element={<MoreScreen />} />
                      <Route path="/settings" element={<SettingsScreen />} />
                      <Route
                        path="/settings/legal"
                        element={<LegalDocumentsScreen />}
                      />
                      <Route
                        path="/notifications"
                        element={<NotificationsScreen />}
                      />
                      <Route path="/help" element={<HelpScreen />} />
                      <Route path="/support" element={<SupportScreen />} />
                      <Route
                        path="/settings/delete-account"
                        element={<DeleteAccountScreen />}
                      />
                    </Route>
                    <Route
                      path="/kyc/basic-profile"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <BasicProfileScreen />
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/document-choice"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <DocumentChoiceScreen />
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    {/* === Marie Journey: KYC Flow === */}
                    <Route
                      path="/kyc/intro"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycIntroScreen />
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/cni-intro"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <CniIntroScreen />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/cni-recto-guide"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <CniRectoGuideScreen />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/cni-recto-capture"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <CniRectoCapture />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/cni-verso-guide"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <CniVersoGuideScreen />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/cni-verso-capture"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <CniVersoCapture />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/ocr-processing"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <OcrProcessingScreen />
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/liveness-intro"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <LivenessIntroScreen />
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/cni-recto"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <CniRectoGuideScreen />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/cni-verso"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <CniVersoGuideScreen />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    {/* OCR Review → Liveness */}
                    <Route
                      path="/kyc/ocr-review"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <OcrReviewScreen />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/biometric-consent"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <BiometricConsentScreen />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/liveness"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <LivenessScreen />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    {/* Bill type select → Capture or Upload → Address → NIU → ... */}
                    <Route
                      path="/kyc/bill-select"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <BillTypeSelectScreen />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/bill-capture"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <BillCaptureScreen />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/bill-upload"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <BillUploadScreen />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/address"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <AddressScreen />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/niu"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <NiuScreen />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/consent"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <ConsentScreen />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/signature"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <SignatureScreen />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/review"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <KycStepGuard>
                              <ReviewScreen />
                            </KycStepGuard>
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/submit-success"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <SubmitSuccessScreen />
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/rejected"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <RejectionScreen />
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/kyc/info-requested"
                      element={
                        <AuthGuard>
                          <KycHydrationGate>
                            <InfoRequestedScreen />
                          </KycHydrationGate>
                        </AuthGuard>
                      }
                    />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </AuthenticatedKycProvider>
          </AuthProvider>
        </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
