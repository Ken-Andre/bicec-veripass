# BICEC VeriPass — Mobile PWA

Application KYC mobile pour l'onboarding digital des clients BICEC (Persona: Marie). 
Plateforme souveraine basée sur une Progressive Web App React.

## 🚀 Stack Technique

- **Framework** : React 18 + TypeScript strict
- **Build & Dev** : Vite + `vite-plugin-pwa` (Workbox GenerateSW)
- **Styling** : Tailwind CSS + variantes Dark Mode (`.dark`)
- **Routing** : `react-router-dom` v6
- **Data Fetching** : `@tanstack/react-query`
- **Utilitaires** : `clsx` + `tailwind-merge` + `lucide-react`
- **Package Manager** : Bun

## 🛠️ Lancement Local

1. Installez les dépendances :
   ```bash
   bun install
   ```

2. Lancez le serveur de développement :
   ```bash
   bun run dev
   ```

## 📁 Structure des fichiers

- `public/` : Assets statiques (manifest.json, icônes)
- `src/components/` : Composants UI réutilisables (ScreenLayout, OfflineBanner)
- `src/contexts/` : Providers React (AuthContext, KycContext)
- `src/hooks/` : Hooks personnalisés (useTheme, useMobile)
- `src/services/` : Couche d'accès API et mock data
- `src/store/` : State management global (futur)
- `src/types/` : Définitions TypeScript globales
- `src/views/` : Pages et écrans organisés par domaine
- `src/lib/` : Utilitaires (ex: `cn()` pour Tailwind)

## 🧪 Vérification PWA

Pour vérifier le fonctionnement du Service Worker et du manifest :
- Ouvrir Chrome DevTools > Application > Service Workers (Doit être actif)
- Ouvrir Chrome DevTools > Application > Manifest (Doit afficher "biveripass")

## 🚫 Hors-scope du ticket INFRA-03
- Design final des composants (`shadcn/ui`)
- Implémentation réelle de la capture d'images (Caméra/MediaPipe)
- Appel effectif à l'API Backend
- Configuration avancée InjectManifest (Offline-10)

## 📌 Issues Dépendantes
- **[AUTH-01]** Flux d'authentification OTP/PIN
- **[CAPTURE-01]** Accès caméra MediaPipe WASM
- **[OFFLINE-01]** App shell & Service Worker strategy avancée
