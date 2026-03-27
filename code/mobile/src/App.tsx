import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { KycProvider } from './contexts/KycContext';
import { HomePage } from './views/HomePage';
import { NotFoundPage } from './views/NotFoundPage';
import { PinSetupScreen, PinLoginScreen, PhoneEntryScreen, OtpVerifyScreen, EmailEntryScreen, EmailOtpVerifyScreen } from './views/auth';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </KycProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
