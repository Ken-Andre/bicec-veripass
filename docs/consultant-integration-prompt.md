# Prompt d'Intégration - Projet Mobile BICEC-Veripass

**Date:** 2026-03-30  
**Destinataire:** Consultant externe  
**Contexte:** Harmonisation du travail du consultant avec l'architecture existante du projet

---

## 🎯 Objectif

Votre travail sur le projet **biveripass** (dossier `docs/test_tmp_trash/black_hole_not_tocommit/biveripass`) présente une base solide d'interface utilisateur et de composants. Cependant, pour une intégration harmonieuse dans le projet BICEC-Veripass existant, plusieurs adaptations sont nécessaires pour respecter l'architecture, les conventions et les contraintes techniques du projet.

---

## 📋 Analyse Comparative

### Structure Actuelle du Projet

**Projet Principal (`code/mobile/`):**
- Stack: React 19 + TypeScript + Vite 8 + Tailwind CSS 4
- Architecture: PWA avec Service Worker (vite-plugin-pwa)
- Monitoring: Sentry intégré
- Structure: `views/` (pages) au lieu de `pages/`
- Composants UI: Minimalistes, quelques composants shadcn/ui de base
- Gestion d'état: Contexts (Auth, KYC, Language)
- Routes: Basename `/mobile` pour intégration avec backend

**Votre Travail (`biveripass/`):**
- Stack: React 18 + TypeScript + Vite 5 + Tailwind CSS 3
- Composants UI: Suite complète shadcn/ui avec @radix-ui
- Structure: `pages/` au lieu de `views/`
- Composants additionnels: BottomNav, CelebrationOverlay, ConfidenceBadge, GlassCard, ProgressStepper
- Services: mediapipeService (MediaPipe pour liveness)
- Tests: Vitest configuré avec setup

---

## 🔧 Adaptations Requises

### 1. **Architecture et Stack Technique**

#### Mise à niveau des dépendances
```json
{
  "vite": "^8.0.0",             // Au lieu de ^5.4.19
  "tailwindcss": "^4.2.1",      // Au lieu de ^3.4.17
  "typescript": "~5.9.3"        // Au lieu de ^5.8.3
}
```

**Raison:** Le projet principal utilise les dernières versions stables pour bénéficier des optimisations de performance et des nouvelles fonctionnalités.

#### Configuration Tailwind CSS v4
Tailwind CSS 4 utilise une nouvelle approche de configuration:
- Remplacer `tailwind.config.ts` par `tailwind.config.js`
- Utiliser `@tailwindcss/postcss` au lieu de l'ancien plugin
- Adapter les imports CSS pour la v4

#### Intégration PWA
Ajouter la configuration vite-plugin-pwa:
```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'BICEC VeriPass',
        short_name: 'VeriPass',
        // ... configuration complète
      }
    })
  ]
});
```

### 2. **Structure de Dossiers**

#### Renommage requis
```
src/pages/          → src/views/
src/pages/auth/     → src/views/auth/
src/pages/kyc/      → src/views/kyc/
src/pages/dashboard/ → src/views/dashboard/
src/pages/discovery/ → src/views/discovery/
```

**Raison:** Convention établie dans le projet principal pour distinguer clairement les vues (pages complètes) des composants réutilisables.

### 3. **Composants shadcn/ui**

#### Stratégie d'intégration
Votre travail contient une suite complète de composants shadcn/ui (@radix-ui). Le projet principal n'en utilise que quelques-uns de base.

**Recommandation:**
1. **Conserver** vos composants shadcn/ui dans `src/components/ui/`
2. **Ajouter** les dépendances manquantes au `package.json` principal:
   ```json
   {
     "@radix-ui/react-accordion": "^1.2.11",
     "@radix-ui/react-alert-dialog": "^1.1.14",
     "@radix-ui/react-avatar": "^1.1.10",
     "@radix-ui/react-checkbox": "^1.3.2",
     "@radix-ui/react-dialog": "^1.1.14",
     "@radix-ui/react-dropdown-menu": "^2.1.15",
     "@radix-ui/react-progress": "^1.1.7",
     "@radix-ui/react-select": "^2.2.5",
     "@radix-ui/react-tabs": "^1.1.12",
     "@radix-ui/react-toast": "^1.2.14",
     "class-variance-authority": "^0.7.1",
     "cmdk": "^1.1.1",
     "sonner": "^1.7.4"
   }
   ```
3. **Vérifier** la compatibilité avec votre React (certains composants @radix-ui peuvent nécessiter des mises à jour)

### 4. **Composants Métier Spécifiques**

#### Composants à intégrer
Vos composants métier apportent une vraie valeur:

**À conserver et adapter:**
- `BottomNav.tsx` - Navigation mobile
- `CelebrationOverlay.tsx` - Feedback visuel de succès
- `ConfidenceBadge.tsx` - Indicateur de confiance OCR
- `GlassCard.tsx` - Effet glassmorphism
- `ProgressStepper.tsx` - Indicateur de progression KYC
- `OfflineBanner.tsx` - Déjà présent, vérifier les différences

**Adaptation requise:**
- Utiliser les hooks du projet (`use-service-worker.ts` au lieu de logique custom)
- S'assurer de la compatibilité avec le LanguageContext existant
- Respecter les conventions de nommage (PascalCase pour les composants)

### 5. **Services et Intégration Backend**

#### MediaPipe Service
Votre `mediapipeService.ts` pour la détection de liveness est un ajout précieux.

**Adaptations:**
1. **Vérifier** la compatibilité avec la contrainte de 16GB RAM (voir PRD §7)
2. **Optimiser** pour CPU (pas de GPU) conformément à l'ADR-001
3. **Intégrer** avec le `apiClient.ts` existant pour l'upload des résultats
4. **Documenter** les seuils de confiance (alignés avec ADR-003: 0.85 minimum)

#### API Client
Votre `apiClient.ts` doit être fusionné avec celui existant:
```typescript
// Ajouter le basename
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const MOBILE_BASENAME = '/mobile';

// Intégrer avec Sentry pour le monitoring
import * as Sentry from "@sentry/react";
```

### 6. **Routing et Navigation**

#### Basename et Routes
Le projet principal utilise un basename `/mobile`:
```typescript
<BrowserRouter basename="/mobile">
```

**Adaptation requise:**
- Tous vos chemins de routes doivent être relatifs (sans `/` initial pour les sous-routes)
- Exemple: `/kyc/cni-intro` devient `kyc/cni-intro` dans les `<Route path>`

#### Structure de Routes
Votre structure de routes est excellente et très complète. À conserver avec ces ajustements:
- Grouper les routes par feature (auth, kyc, dashboard, discovery)
- Utiliser des layouts partagés pour éviter la duplication
- Implémenter des guards de route pour la protection (AuthContext)

### 7. **Gestion d'État et Contexts**

#### Contexts Existants
Le projet a déjà:
- `AuthContext` - Authentification utilisateur
- `KycContext` - État du parcours KYC
- `LanguageContext` - Internationalisation

**Votre travail:**
- Vos contexts semblent similaires mais peuvent avoir des différences d'implémentation
- **Action requise:** Comparer ligne par ligne et fusionner les fonctionnalités manquantes
- **Priorité:** Conserver la logique de persistance locale (localStorage) du projet principal

### 8. **Tests**

#### Configuration Vitest
Votre configuration de tests est un plus:
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

**À intégrer** dans le projet principal qui n'a pas encore de tests configurés.

### 9. **Contraintes Techniques Critiques**

#### Conformité avec le PRD (§7)
Votre code doit respecter:

**Contrainte RAM (16GB total, 8GB pour Docker):**
- MediaPipe doit tourner en mode CPU uniquement
- Optimiser les images avant traitement (compression, resize)
- Implémenter un système de queue pour éviter les traitements concurrents

**Contrainte Stockage (200GB max):**
- Implémenter une politique de nettoyage des images temporaires
- Compresser les images avant stockage local
- Documenter la taille moyenne d'un dossier KYC complet

**Offline-First:**
- Votre `OfflineBanner` est un bon début
- Ajouter la persistance des images capturées (IndexedDB via idb)
- Implémenter la synchronisation différée (upload progressif)

### 10. **Conformité Réglementaire**

#### COBAC et Audit Trail
Selon le PRD §5, chaque action doit être tracée:

**À implémenter dans vos composants:**
```typescript
// Exemple pour CniCaptureScreen
const handleCapture = async (imageData: string) => {
  // 1. Horodatage précis
  const timestamp = new Date().toISOString();
  
  // 2. Hash de l'image pour intégrité
  const imageHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(imageData)
  );
  
  // 3. Métadonnées de capture
  const metadata = {
    timestamp,
    imageHash: Array.from(new Uint8Array(imageHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
    deviceInfo: navigator.userAgent,
    // ... autres métadonnées
  };
  
  // 4. Envoi au backend avec métadonnées
  await apiClient.post('/kyc/capture', {
    image: imageData,
    metadata
  });
};
```

---

## 📦 Plan d'Intégration Recommandé

### Phase 1: Préparation (1-2 jours)
1. ✅ Créer une branche `feature/consultant-integration`
2. ✅ Mettre à jour les dépendances vers les versions du projet principal
3. ✅ Migrer Tailwind CSS v3 → v4
4. ✅ Renommer `pages/` → `views/`
5. ✅ Configurer vite-plugin-pwa

### Phase 2: Composants UI (2-3 jours)
1. ✅ Copier les composants shadcn/ui manquants
2. ✅ Tester la compatibilité avec React 19
3. ✅ Intégrer les composants métier (BottomNav, CelebrationOverlay, etc.)
4. ✅ Adapter les styles pour Tailwind v4

### Phase 3: Services et Logique (3-4 jours)
1. ✅ Intégrer mediapipeService avec optimisations CPU
2. ✅ Fusionner apiClient avec le client existant
3. ✅ Harmoniser les Contexts (Auth, KYC, Language)
4. ✅ Implémenter la persistance locale (IndexedDB)

### Phase 4: Routes et Navigation (2 jours)
1. ✅ Adapter toutes les routes au basename `/mobile`
2. ✅ Implémenter les guards de route
3. ✅ Tester la navigation complète

### Phase 5: Tests et Validation (2-3 jours)
1. ✅ Configurer Vitest dans le projet principal
2. ✅ Écrire des tests pour les composants critiques
3. ✅ Tester sur contraintes réelles (16GB RAM, CPU only)
4. ✅ Valider l'offline-first et la résilience

### Phase 6: Documentation et Audit (1-2 jours)
1. ✅ Documenter les nouveaux composants
2. ✅ Vérifier la conformité COBAC (audit trail)
3. ✅ Créer un guide de migration pour l'équipe
4. ✅ Pull Request avec revue de code

---

## 🚨 Points d'Attention Critiques

### 1. Performance et Ressources
- **MediaPipe:** Doit tourner en <2GB RAM, CPU uniquement
- **Images:** Compression obligatoire avant stockage (max 500KB par image)
- **Batch Processing:** Éviter les traitements concurrents (queue FIFO)

### 2. Sécurité et Conformité
- **Chiffrement:** AES-256 pour les données biométriques locales
- **Audit Trail:** SHA-256 hash + timestamp pour chaque capture
- **RGPD/COBAC:** Consentement explicite avant chaque capture

### 3. UX et Résilience
- **Offline-First:** Toutes les captures doivent fonctionner sans réseau
- **Feedback Visuel:** Indicateurs de progression clairs (ProgressStepper)
- **Gestion d'Erreur:** Messages d'erreur en français, contextuels

### 4. Compatibilité
- **React:** Vérifier tous les composants @radix-ui
- **Tailwind v4:** Adapter les classes custom (si utilisées)
- **TypeScript:** Strict mode activé, pas de `any`

---

## 📚 Références Techniques

### Documents à Consulter
1. **PRD** (`_bmad-output/planning-artifacts/prd.md`) - Spécifications fonctionnelles
2. **Architecture** (`_bmad-output/planning-artifacts/coarchitecture-bicec-veripass.md`) - Architecture technique
3. **ADR-001** - Choix de la stack PWA React/TypeScript
4. **ADR-003** - Seuils de confiance OCR (0.85 minimum)
5. **State Machine** (`docs/diagrams/state-machine-kyc-v3-updated.md`) - États du parcours KYC

### Conventions de Code
- **Nommage:** PascalCase pour composants, camelCase pour fonctions
- **Imports:** Absolus avec alias `@/` (déjà configuré)
- **Types:** Interfaces pour les props, Types pour les unions
- **Commentaires:** JSDoc pour les fonctions publiques

---

## 🤝 Support et Communication

### Questions Fréquentes

**Q: Puis-je utiliser des dépendances supplémentaires?**  
R: Oui, mais elles doivent être justifiées et approuvées. Privilégier les bibliothèques légères et bien maintenues.

**Q: Comment gérer les conflits de merge?**  
R: Toujours privilégier la logique du projet principal. En cas de doute, demander une revue.

**Q: Les tests sont-ils obligatoires?**  
R: Oui, au minimum pour les composants critiques (capture, liveness, upload).

**Q: Que faire si MediaPipe dépasse 2GB RAM?**  
R: Implémenter un fallback vers une solution plus légère ou optimiser les modèles.

### Contact
Pour toute question technique, contacter l'équipe via:
- **Slack:** #bicec-veripass-dev
- **Email:** dev@bicec-veripass.cm
- **Issues:** GitHub repository

---

## ✅ Checklist Finale

Avant de soumettre votre Pull Request, vérifier:

- [ ] Toutes les dépendances sont à jour (React 19, Vite 8, Tailwind 4)
- [ ] La structure `pages/` a été renommée en `views/`
- [ ] Les routes utilisent le basename `/mobile`
- [ ] Les composants shadcn/ui sont compatibles React 19
- [ ] MediaPipe tourne en mode CPU avec <2GB RAM
- [ ] L'audit trail est implémenté (SHA-256 + timestamp)
- [ ] Les tests Vitest passent tous
- [ ] La documentation est à jour
- [ ] Le code respecte les conventions du projet
- [ ] L'offline-first fonctionne (test avec DevTools Network offline)
- [ ] Les images sont compressées (<500KB)
- [ ] Pas de console.log en production
- [ ] Les types TypeScript sont stricts (pas de `any`)
- [ ] Les messages d'erreur sont en français
- [ ] Le PWA manifest est configuré
- [ ] Sentry est intégré pour le monitoring

---

**Bon courage pour l'intégration! 🚀**

*Ce document est un guide vivant. N'hésitez pas à proposer des améliorations.*
