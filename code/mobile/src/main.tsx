import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App.tsx';

// Dark mode init AVANT le render
const saved = localStorage.getItem('vp_theme');
if (saved === 'dark') {
  document.documentElement.classList.add('dark');
}

// Enregistrement SW via vite-plugin-pwa virtual module
const updateSW = registerSW({
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
