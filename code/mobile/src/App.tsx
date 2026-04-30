import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { KycProvider } from './contexts/KycContext';
import { HomePage } from './views/HomePage';
import { DashboardPage } from './views/dashboard';
import { CardsScreen } from './views/dashboard';
import { TransfersScreen } from './views/dashboard';
import { TransferSendScreen } from './views/dashboard';
import { TransferReceiveScreen } from './views/dashboard';
import { SavingsScreen } from './views/dashboard';
import { TransactionHistoryScreen } from './views/dashboard';
import { SettingsScreen } from './views/dashboard';
import { NotificationsScreen } from './views/dashboard';
import { HelpScreen } from './views/dashboard';
import { SupportScreen } from './views/dashboard';
import { MoreScreen } from './views/dashboard';
import { NotFoundPage } from './views/NotFoundPage';
import { PinSetupScreen, PinLoginScreen, PhoneEntryScreen, OtpVerifyScreen, EmailEntryScreen, EmailOtpVerifyScreen, LockScreen, ForgotPinScreen } from './views/auth';
import { KycHydrationGate } from './components/KycHydrationGate';
import KycIntroScreen from './views/kyc/KycIntroScreen';
import BasicProfileScreen from './views/kyc/BasicProfileScreen';
import DocumentChoiceScreen from './views/kyc/DocumentChoiceScreen';
import CniIntroScreen from './views/kyc/CniIntroScreen';
import CniCaptureScreen from './views/kyc/CniCaptureScreen';
import CniRectoGuideScreen from './views/kyc/CniRectoGuideScreen';
import CniVersoGuideScreen from './views/kyc/CniVersoGuideScreen';
import OcrReviewScreen from './views/kyc/OcrReviewScreen';
import BiometricConsentScreen from './views/kyc/BiometricConsentScreen';
import LivenessScreen from './views/kyc/LivenessScreen';
import BillCaptureScreen from './views/kyc/BillCaptureScreen';
import BillTypeSelectScreen from './views/kyc/BillTypeSelectScreen';
import BillUploadScreen from './views/kyc/BillUploadScreen';
import AddressScreen from './views/kyc/AddressScreen';
import NiuScreen from './views/kyc/NiuScreen';
import ConsentScreen from './views/kyc/ConsentScreen';
import SignatureScreen from './views/kyc/SignatureScreen';
import ReviewScreen from './views/kyc/ReviewScreen';
import SubmitSuccessScreen from './views/kyc/SubmitSuccessScreen';
import DeleteAccountScreen from './views/settings/DeleteAccountScreen';
import { KycResumeBanner } from './components/KycResumeBanner';
import { OfflineBanner } from './components/OfflineBanner';

const queryClient = new QueryClient();

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
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/auth/phone" element={<PhoneEntryScreen />} />
                <Route path="/auth/otp" element={<OtpVerifyScreen />} />
                <Route path="/auth/email" element={<EmailEntryScreen />} />
                <Route path="/auth/email-otp" element={<EmailOtpVerifyScreen />} />
                <Route path="/auth/pin-setup" element={<PinSetupScreen />} />
                <Route path="/auth/pin-login" element={<PinLoginScreen />} />
                <Route path="/auth/lock" element={<LockScreen />} />
                <Route path="/auth/forgot-pin" element={<ForgotPinScreen />} />
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
                <Route path="/kyc/cni-intro" element={<LockGuard><KycHydrationGate><CniIntroScreen /></KycHydrationGate></LockGuard>} />
                <Route path="/kyc/cni-recto-guide" element={<LockGuard><KycHydrationGate><CniRectoGuideScreen /></KycHydrationGate></LockGuard>} />
                <Route path="/kyc/cni-recto-capture" element={<LockGuard><KycHydrationGate><CniRectoCapture /></KycHydrationGate></LockGuard>} />
                <Route path="/kyc/cni-verso-guide" element={<LockGuard><KycHydrationGate><CniVersoGuideScreen /></KycHydrationGate></LockGuard>} />
                <Route path="/kyc/cni-verso-capture" element={<LockGuard><KycHydrationGate><CniVersoCapture /></KycHydrationGate></LockGuard>} />
                <Route path="/kyc/cni-recto" element={<LockGuard><KycHydrationGate><CniRectoGuideScreen /></KycHydrationGate></LockGuard>} />
                <Route path="/kyc/cni-verso" element={<LockGuard><KycHydrationGate><CniVersoGuideScreen /></KycHydrationGate></LockGuard>} />
                {/* OCR Review → Liveness */}
                <Route path="/kyc/ocr-review" element={<LockGuard><KycHydrationGate><OcrReviewScreen /></KycHydrationGate></LockGuard>} />
                <Route path="/kyc/biometric-consent" element={<LockGuard><KycHydrationGate><BiometricConsentScreen /></KycHydrationGate></LockGuard>} />
                <Route path="/kyc/liveness" element={<LockGuard><KycHydrationGate><LivenessScreen /></KycHydrationGate></LockGuard>} />
                {/* Bill type select → Capture or Upload → Address → NIU → ... */}
                <Route path="/kyc/bill-select" element={<LockGuard><KycHydrationGate><BillTypeSelectScreen /></KycHydrationGate></LockGuard>} />
                <Route path="/kyc/bill-capture" element={<LockGuard><KycHydrationGate><BillCaptureScreen /></KycHydrationGate></LockGuard>} />
                <Route path="/kyc/bill-upload" element={<LockGuard><KycHydrationGate><BillUploadScreen /></KycHydrationGate></LockGuard>} />
                <Route path="/kyc/address" element={<LockGuard><KycHydrationGate><AddressScreen /></KycHydrationGate></LockGuard>} />
                <Route path="/kyc/niu" element={<LockGuard><KycHydrationGate><NiuScreen /></KycHydrationGate></LockGuard>} />
                <Route path="/kyc/consent" element={<LockGuard><KycHydrationGate><ConsentScreen /></KycHydrationGate></LockGuard>} />
                <Route path="/kyc/signature" element={<LockGuard><KycHydrationGate><SignatureScreen /></KycHydrationGate></LockGuard>} />
                <Route path="/kyc/review" element={<LockGuard><KycHydrationGate><ReviewScreen /></KycHydrationGate></LockGuard>} />
                <Route path="/kyc/submit-success" element={<LockGuard><KycHydrationGate><SubmitSuccessScreen /></KycHydrationGate></LockGuard>} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </KycProvider>
          </AuthProvider>
        </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
