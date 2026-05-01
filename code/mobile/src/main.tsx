import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App.tsx';
import { initMobileSentry } from './services/sentry';

// Sentry Init
initMobileSentry();

// Dark mode init AVANT le render
const saved = localStorage.getItem('vp_theme');
if (saved === 'dark') {
  document.documentElement.classList.add('dark');
}

// Enregistrement SW via vite-plugin-pwa virtual module
// autoUpdate: true → skipWaiting + reload automatically when new SW is available
registerSW({
  immediate: true,
  onRegistered(r) {
    console.log('Service Worker registered:', r);
    if (r) {
      setInterval(() => r.update(), 60 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.error('Service Worker registration failed:', error);
  },
  onInstalled() {
    console.log('App is ready for offline use.');
  },
  onUpdated() {
    console.log('New content available, reloading...');
    window.location.reload();
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
