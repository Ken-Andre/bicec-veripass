import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { KycProvider } from './contexts/KycContext';
import { KycHydrationGate } from './components/KycHydrationGate';
import { KycStepGuard } from './hooks/useKycFlow';
import { KycResumeBanner } from './components/KycResumeBanner';
import { OfflineBanner } from './components/OfflineBanner';
import { PageLoader } from './components/PageLoader';

const queryClient = new QueryClient();

// --- Auth screens ---
const PhoneEntryScreen = lazy(() =>
  import('./views/auth/PhoneEntryScreen').then(m => ({ default: m.default }))
);
const OtpVerifyScreen = lazy(() =>
  import('./views/auth/OtpVerifyScreen').then(m => ({ default: m.default }))
);
const EmailEntryScreen = lazy(() =>
  import('./views/auth/EmailEntryScreen').then(m => ({ default: m.default }))
);
const EmailOtpVerifyScreen = lazy(() =>
  import('./views/auth/EmailOtpVerifyScreen').then(m => ({ default: m.default }))
);
const PinSetupScreen = lazy(() =>
  import('./views/auth/PinSetupScreen').then(m => ({ default: m.default }))
);
const PinLoginScreen = lazy(() =>
  import('./views/auth/PinLoginScreen').then(m => ({ default: m.default }))
);
const BiometricOptInScreen = lazy(() =>
  import('./views/auth/BiometricOptInScreen').then(m => ({ default: m.default }))
);
const ProgressTimelineScreen = lazy(() =>
  import('./views/auth/ProgressTimelineScreen').then(m => ({ default: m.default }))
);
const LockScreen = lazy(() =>
  import('./views/auth/LockScreen').then(m => ({ default: m.default }))
);
const ForgotPinScreen = lazy(() =>
  import('./views/auth/ForgotPinScreen').then(m => ({ default: m.default }))
);

// --- Dashboard screens ---
const HomePage = lazy(() =>
  import('./views/HomePage').then(m => ({ default: m.HomePage }))
);
const DashboardPage = lazy(() =>
  import('./views/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage }))
);
const CardsScreen = lazy(() =>
  import('./views/dashboard/CardsScreen').then(m => ({ default: m.CardsScreen }))
);
const TransfersScreen = lazy(() =>
  import('./views/dashboard/TransfersScreen').then(m => ({ default: m.TransfersScreen }))
);
const TransferSendScreen = lazy(() =>
  import('./views/dashboard/TransferSendScreen').then(m => ({ default: m.TransferSendScreen }))
);
const TransferReceiveScreen = lazy(() =>
  import('./views/dashboard/TransferReceiveScreen').then(m => ({ default: m.TransferReceiveScreen }))
);
const SavingsScreen = lazy(() =>
  import('./views/dashboard/SavingsScreen').then(m => ({ default: m.SavingsScreen }))
);
const TransactionHistoryScreen = lazy(() =>
  import('./views/dashboard/TransactionHistoryScreen').then(m => ({ default: m.TransactionHistoryScreen }))
);
const SettingsScreen = lazy(() =>
  import('./views/dashboard/SettingsScreen').then(m => ({ default: m.SettingsScreen }))
);
const NotificationsScreen = lazy(() =>
  import('./views/dashboard/NotificationsScreen').then(m => ({ default: m.NotificationsScreen }))
);
const HelpScreen = lazy(() =>
  import('./views/dashboard/HelpScreen').then(m => ({ default: m.HelpScreen }))
);
const SupportScreen = lazy(() =>
  import('./views/dashboard/SupportScreen').then(m => ({ default: m.SupportScreen }))
);
const MoreScreen = lazy(() =>
  import('./views/dashboard/MoreScreen').then(m => ({ default: m.MoreScreen }))
);

// --- KYC screens ---
const KycIntroScreen = lazy(() => import('./views/kyc/KycIntroScreen'));
const BasicProfileScreen = lazy(() => import('./views/kyc/BasicProfileScreen'));
const DocumentChoiceScreen = lazy(() => import('./views/kyc/DocumentChoiceScreen'));
const CniIntroScreen = lazy(() => import('./views/kyc/CniIntroScreen'));
const CniCaptureScreen = lazy(() => import('./views/kyc/CniCaptureScreen'));
const CniRectoGuideScreen = lazy(() => import('./views/kyc/CniRectoGuideScreen'));
const CniVersoGuideScreen = lazy(() => import('./views/kyc/CniVersoGuideScreen'));
const OcrProcessingScreen = lazy(() => import('./views/kyc/OcrProcessingScreen'));
const OcrReviewScreen = lazy(() => import('./views/kyc/OcrReviewScreen'));
const LivenessIntroScreen = lazy(() => import('./views/kyc/LivenessIntroScreen'));
const BiometricConsentScreen = lazy(() => import('./views/kyc/BiometricConsentScreen'));
const LivenessScreen = lazy(() => import('./views/kyc/LivenessScreen'));
const BillTypeSelectScreen = lazy(() => import('./views/kyc/BillTypeSelectScreen'));
const BillCaptureScreen = lazy(() => import('./views/kyc/BillCaptureScreen'));
const BillUploadScreen = lazy(() => import('./views/kyc/BillUploadScreen'));
const AddressScreen = lazy(() => import('./views/kyc/AddressScreen'));
const NiuScreen = lazy(() => import('./views/kyc/NiuScreen'));
const ConsentScreen = lazy(() => import('./views/kyc/ConsentScreen'));
const SignatureScreen = lazy(() => import('./views/kyc/SignatureScreen'));
const ReviewScreen = lazy(() => import('./views/kyc/ReviewScreen'));
const SubmitSuccessScreen = lazy(() => import('./views/kyc/SubmitSuccessScreen'));
const RejectionScreen = lazy(() => import('./views/kyc/RejectionScreen'));
const InfoRequestedScreen = lazy(() => import('./views/kyc/InfoRequestedScreen'));

// --- Settings screens ---
const DeleteAccountScreen = lazy(() => import('./views/settings/DeleteAccountScreen'));

// --- 404 ---
const NotFoundPage = lazy(() =>
  import('./views/NotFoundPage').then(m => ({ default: m.NotFoundPage }))
);

function LockGuard({ children }: { children: React.ReactNode }) {
  const { isLocked } = useAuth();
  if (isLocked) return <Navigate to="/auth/lock" replace />;
  return <>{children}</>;
}

function CniRectoCapture() {
  return <CniCaptureScreen side="recto" nextRoute="/kyc/cni-verso" />;
}

function CniVersoCapture() {
  return <CniCaptureScreen side="verso" nextRoute="/kyc/ocr-review" />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <BrowserRouter basename="/mobile">
          <AuthProvider>
            <KycProvider>
              <OfflineBanner />
              <KycResumeBanner />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/auth/phone" element={<PhoneEntryScreen />} />
                  <Route path="/auth/otp" element={<OtpVerifyScreen />} />
                  <Route path="/auth/email" element={<EmailEntryScreen />} />
                  <Route path="/auth/email-otp" element={<EmailOtpVerifyScreen />} />
                  <Route path="/auth/pin-setup" element={<PinSetupScreen />} />
                  <Route path="/auth/pin-login" element={<PinLoginScreen />} />
                  <Route path="/auth/biometric" element={<BiometricOptInScreen />} />
                  <Route path="/auth/progress" element={<ProgressTimelineScreen />} />
                  <Route path="/auth/lock" element={<LockScreen />} />
                  <Route path="/auth/forgot-pin" element={<ForgotPinScreen />} />
                  <Route path="/auth/biometric" element={<BiometricOptInScreen />} />
                  <Route path="/kyc/progress" element={<ProgressTimelineScreen />} />
                  <Route path="/dashboard" element={<LockGuard><DashboardPage /></LockGuard>} />
                  <Route path="/cards" element={<LockGuard><CardsScreen /></LockGuard>} />
                  <Route path="/transfers" element={<LockGuard><TransfersScreen /></LockGuard>} />
                  <Route path="/transfers/send" element={<LockGuard><TransferSendScreen /></LockGuard>} />
                  <Route path="/transfers/receive" element={<LockGuard><TransferReceiveScreen /></LockGuard>} />
                  <Route path="/savings" element={<LockGuard><SavingsScreen /></LockGuard>} />
                  <Route path="/transactions" element={<LockGuard><TransactionHistoryScreen /></LockGuard>} />
                  <Route path="/more" element={<LockGuard><MoreScreen /></LockGuard>} />
                  <Route path="/settings" element={<LockGuard><SettingsScreen /></LockGuard>} />
                  <Route path="/notifications" element={<LockGuard><NotificationsScreen /></LockGuard>} />
                  <Route path="/help" element={<LockGuard><HelpScreen /></LockGuard>} />
                  <Route path="/support" element={<LockGuard><SupportScreen /></LockGuard>} />
                  <Route path="/settings/delete-account" element={<LockGuard><DeleteAccountScreen /></LockGuard>} />
                  <Route path="/kyc/basic-profile" element={<LockGuard><KycHydrationGate><BasicProfileScreen /></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/document-choice" element={<LockGuard><KycHydrationGate><DocumentChoiceScreen /></KycHydrationGate></LockGuard>} />
                  {/* === Marie Journey: KYC Flow === */}
                  <Route path="/kyc/intro" element={<LockGuard><KycHydrationGate><KycIntroScreen /></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/cni-intro" element={<LockGuard><KycHydrationGate><KycStepGuard><CniIntroScreen /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/cni-recto-guide" element={<LockGuard><KycHydrationGate><KycStepGuard><CniRectoGuideScreen /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/cni-recto-capture" element={<LockGuard><KycHydrationGate><KycStepGuard><CniRectoCapture /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/cni-verso-guide" element={<LockGuard><KycHydrationGate><KycStepGuard><CniVersoGuideScreen /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/cni-verso-capture" element={<LockGuard><KycHydrationGate><KycStepGuard><CniVersoCapture /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/ocr-processing" element={<LockGuard><KycHydrationGate><OcrProcessingScreen /></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/liveness-intro" element={<LockGuard><KycHydrationGate><LivenessIntroScreen /></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/cni-recto" element={<LockGuard><KycHydrationGate><KycStepGuard><CniRectoGuideScreen /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/cni-verso" element={<LockGuard><KycHydrationGate><KycStepGuard><CniVersoGuideScreen /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  {/* OCR Review → Liveness */}
                  <Route path="/kyc/ocr-processing" element={<LockGuard><KycHydrationGate><OcrProcessingScreen /></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/ocr-review" element={<LockGuard><KycHydrationGate><KycStepGuard><OcrReviewScreen /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/liveness-intro" element={<LockGuard><KycHydrationGate><LivenessIntroScreen /></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/biometric-consent" element={<LockGuard><KycHydrationGate><KycStepGuard><BiometricConsentScreen /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/liveness" element={<LockGuard><KycHydrationGate><KycStepGuard><LivenessScreen /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  {/* Bill type select → Capture or Upload → Address → NIU → ... */}
                  <Route path="/kyc/bill-select" element={<LockGuard><KycHydrationGate><KycStepGuard><BillTypeSelectScreen /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/bill-capture" element={<LockGuard><KycHydrationGate><KycStepGuard><BillCaptureScreen /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/bill-upload" element={<LockGuard><KycHydrationGate><KycStepGuard><BillUploadScreen /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/address" element={<LockGuard><KycHydrationGate><KycStepGuard><AddressScreen /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/niu" element={<LockGuard><KycHydrationGate><KycStepGuard><NiuScreen /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/consent" element={<LockGuard><KycHydrationGate><KycStepGuard><ConsentScreen /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/signature" element={<LockGuard><KycHydrationGate><KycStepGuard><SignatureScreen /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/review" element={<LockGuard><KycHydrationGate><KycStepGuard><ReviewScreen /></KycStepGuard></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/submit-success" element={<LockGuard><KycHydrationGate><SubmitSuccessScreen /></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/rejected" element={<LockGuard><KycHydrationGate><RejectionScreen /></KycHydrationGate></LockGuard>} />
                  <Route path="/kyc/info-requested" element={<LockGuard><KycHydrationGate><InfoRequestedScreen /></KycHydrationGate></LockGuard>} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </KycProvider>
          </AuthProvider>
        </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
