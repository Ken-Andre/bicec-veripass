import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import * as Sentry from "@sentry/react";
import './index.css';
import App from './App.tsx';

// Sentry Init
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1, // Don't overdo it in dev
    environment: import.meta.env.MODE,
  });
}

// Dark mode init AVANT le render
const saved = localStorage.getItem('vp_theme');
if (saved === 'dark') {
  document.documentElement.classList.add('dark');
}

// Enregistrement SW via vite-plugin-pwa virtual module
registerSW({
  onRegistered(r) {
    console.log('Service Worker registered:', r);
  },
  onRegisterError(error) {
    console.error('Service Worker registration failed:', error);
  },
  onInstalled() {
    console.log('App is ready for offline use.');
  },
  onUpdated() {
    console.log('New content available, please refresh.');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
