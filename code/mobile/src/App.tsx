import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { KycProvider } from './contexts/KycContext';
import { HomePage } from './views/HomePage';
import { DashboardPage } from './views/dashboard';
import { NotFoundPage } from './views/NotFoundPage';
import { PinSetupScreen, PinLoginScreen, PhoneEntryScreen, OtpVerifyScreen, EmailEntryScreen, EmailOtpVerifyScreen, LockScreen, ForgotPinScreen } from './views/auth';
import KycIntroScreen from './views/kyc/KycIntroScreen';
import CniIntroScreen from './views/kyc/CniIntroScreen';
import CniCaptureScreen from './views/kyc/CniCaptureScreen';
import OcrReviewScreen from './views/kyc/OcrReviewScreen';
import LivenessScreen from './views/kyc/LivenessScreen';
import AddressScreen from './views/kyc/AddressScreen';
import NiuScreen from './views/kyc/NiuScreen';
import ConsentScreen from './views/kyc/ConsentScreen';
import ReviewScreen from './views/kyc/ReviewScreen';
import DeleteAccountScreen from './views/settings/DeleteAccountScreen';

const queryClient = new QueryClient();

function LockGuard({ children }: { children: React.ReactNode }) {
  const { isLocked } = useAuth();
  if (isLocked) return <Navigate to="/auth/lock" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <BrowserRouter basename="/mobile">
          <AuthProvider>
            <KycProvider>
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
                <Route path="/settings/delete-account" element={<LockGuard><DeleteAccountScreen /></LockGuard>} />
                <Route path="/kyc/intro" element={<LockGuard><KycIntroScreen /></LockGuard>} />
                <Route path="/kyc/cni-intro" element={<LockGuard><CniIntroScreen /></LockGuard>} />
                <Route path="/kyc/cni-recto" element={<LockGuard><CniCaptureScreen /></LockGuard>} />
                <Route path="/kyc/cni-verso" element={<LockGuard><CniCaptureScreen /></LockGuard>} />
                <Route path="/kyc/ocr-review" element={<LockGuard><OcrReviewScreen /></LockGuard>} />
                <Route path="/kyc/liveness" element={<LockGuard><LivenessScreen /></LockGuard>} />
                <Route path="/kyc/address" element={<LockGuard><AddressScreen /></LockGuard>} />
                <Route path="/kyc/niu" element={<LockGuard><NiuScreen /></LockGuard>} />
                <Route path="/kyc/consent" element={<LockGuard><ConsentScreen /></LockGuard>} />
                <Route path="/kyc/review" element={<LockGuard><ReviewScreen /></LockGuard>} />
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
