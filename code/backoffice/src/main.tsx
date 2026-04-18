import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import App from './App'
import './index.css'
import { initBackofficeSentry } from './services/sentry'

// Sentry Init
initBackofficeSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/back-office">
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
