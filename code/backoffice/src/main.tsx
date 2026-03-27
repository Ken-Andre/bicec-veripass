import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from "@sentry/react"
import { AuthProvider } from './contexts/AuthContext'
import App from './App'
import './index.css'

// Sentry Init
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1.0, // Set to 100% temporarily for verification
    environment: import.meta.env.MODE,
  });
  
  // Verification message to wake up Sentry
  Sentry.captureMessage("Sentry Backoffice initialized: VeriPass Backoffice 0.1.0");
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/back-office">
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)