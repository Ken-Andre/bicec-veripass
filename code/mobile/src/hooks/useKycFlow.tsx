/**
 * KYC step ordering and navigation helpers.
 *
 * Defines the canonical order of KYC steps and provides:
 * - KycStepGuard: prevents navigating to a step before prerequisites are met
 * - useKycBack: computes the previous step in the flow
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useKyc } from '../contexts/KycContext';
import { LoadingState } from '../components/ui/LoadingState';
import type { KycStepType } from '../types';

// Canonical step order — each step requires all previous steps to be completed
// eslint-disable-next-line react-refresh/only-export-components
export const KYC_STEP_ORDER: KycStepType[] = [
  'cni_recto',
  'cni_verso',
  'ocr_review',
  'liveness',
  'utility_bill',
  'address',
  'niu',
  'consent',
  'signature',
  'submission',
];

// Map routes to their required KYC step
const ROUTE_TO_STEP: Record<string, KycStepType> = {
  '/kyc/cni-intro': 'cni_recto',
  '/kyc/cni-recto-guide': 'cni_recto',
  '/kyc/cni-recto-capture': 'cni_recto',
  '/kyc/cni-recto': 'cni_recto',
  '/kyc/cni-verso-guide': 'cni_verso',
  '/kyc/cni-verso-capture': 'cni_verso',
  '/kyc/cni-verso': 'cni_verso',
  '/kyc/ocr-review': 'ocr_review',
  '/kyc/biometric-consent': 'liveness',
  '/kyc/liveness': 'liveness',
  '/kyc/bill-select': 'utility_bill',
  '/kyc/bill-capture': 'utility_bill',
  '/kyc/bill-upload': 'utility_bill',
  '/kyc/address': 'address',
  '/kyc/niu': 'niu',
  '/kyc/consent': 'consent',
  '/kyc/signature': 'signature',
  '/kyc/review': 'submission',
  '/kyc/submit-success': 'submission',
};

// Map KycStepType to ALL routes belonging to that step (for editStep bypass)
const STEP_TO_ROUTES: Record<KycStepType, string[]> = {
  cni_recto: ['/kyc/cni-intro', '/kyc/cni-recto-guide', '/kyc/cni-recto-capture', '/kyc/cni-recto'],
  cni_verso: ['/kyc/cni-verso-guide', '/kyc/cni-verso-capture', '/kyc/cni-verso'],
  ocr_review: ['/kyc/ocr-review'],
  liveness: ['/kyc/biometric-consent', '/kyc/liveness'],
  utility_bill: ['/kyc/bill-select', '/kyc/bill-capture', '/kyc/bill-upload'],
  address: ['/kyc/address'],
  niu: ['/kyc/niu'],
  consent: ['/kyc/consent'],
  signature: ['/kyc/signature'],
  submission: ['/kyc/review', '/kyc/submit-success'],
};

// Map KycStepType to the first route of that step
const STEP_TO_FIRST_ROUTE: Record<KycStepType, string> = {
  cni_recto: '/kyc/cni-recto-capture',
  cni_verso: '/kyc/cni-verso-capture',
  ocr_review: '/kyc/ocr-review',
  liveness: '/kyc/liveness',
  utility_bill: '/kyc/bill-select',
  address: '/kyc/address',
  niu: '/kyc/niu',
  consent: '/kyc/consent',
  signature: '/kyc/signature',
  submission: '/kyc/review',
};

/**
 * Find the first incomplete step in the KYC flow.
 * Returns null if all steps are completed.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function findFirstMissingStep(completedSteps: KycStepType[]): KycStepType | null {
  for (const step of KYC_STEP_ORDER) {
    if (!completedSteps.includes(step)) {
      return step;
    }
  }
  return null;
}

/**
 * Get the route for the first missing step.
 * Returns '/dashboard' if all steps are completed.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getRouteForMissingStep(completedSteps: KycStepType[]): string {
  const missing = findFirstMissingStep(completedSteps);
  if (!missing) return '/dashboard';
  return STEP_TO_FIRST_ROUTE[missing] || '/dashboard';
}

/**
 * Get the previous step route for back navigation.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getPreviousStepRoute(currentPath: string): string {
  const currentStep = ROUTE_TO_STEP[currentPath];
  if (!currentStep) return '/dashboard';

  const idx = KYC_STEP_ORDER.indexOf(currentStep);
  if (idx <= 0) return '/dashboard';

  const prevStep = KYC_STEP_ORDER[idx - 1];
  return STEP_TO_FIRST_ROUTE[prevStep] || '/dashboard';
}

/**
 * Guard component with 4-phase logic:
 *
 * Phase 1: Not hydrated → neutral loading state (no navigation)
 * Phase 2: Hydrated but not reconciled with backend → syncing state
 * Phase 3: editStep set → bypass guard for the targeted step's routes only
 * Phase 4: Normal guard → redirect to first missing step
 */
export function KycStepGuard({ children }: { children: React.ReactNode }) {
  const { completedSteps, hydrated, reconciliationStatus, editStep, setEditStep } = useKyc();
  const location = useLocation();

  // Phase 1: Not yet hydrated from IndexedDB → neutral state
  if (!hydrated) {
    return <LoadingState message="Chargement..." />;
  }

  // Phase 2: Hydrated but backend reconciliation pending → neutral state
  // 'skipped' and 'failed' pass through (offline mode or error fallback)
  if (reconciliationStatus === 'pending') {
    return <LoadingState message="Synchronisation..." />;
  }

  // Phase 3: Edit mode — only allow the targeted step's routes
  if (editStep) {
    // If the edit step is now completed, clear edit mode and redirect to review
    if (completedSteps.includes(editStep)) {
      setEditStep(null);
      if (location.pathname !== '/kyc/review') {
        return <Navigate to="/kyc/review" replace />;
      }
    } else {
      const allowedRoutes = STEP_TO_ROUTES[editStep] || [];
      if (allowedRoutes.includes(location.pathname)) {
        return <>{children}</>;
      }
      // On a route not belonging to the edit step → redirect to edit step's first route
      const editRoute = STEP_TO_FIRST_ROUTE[editStep];
      if (editRoute && location.pathname !== editRoute) {
        return <Navigate to={editRoute} replace />;
      }
    }
  }

  // Phase 4: Normal guard — allow any route belonging to the missing step,
  // otherwise redirect to the first route of that step.
  const missingStep = findFirstMissingStep(completedSteps);
  const allowedRoutesForMissing = missingStep ? STEP_TO_ROUTES[missingStep] || [] : [];
  const isOnAllowedRoute = allowedRoutesForMissing.includes(location.pathname);
  if (missingStep && !isOnAllowedRoute) {
    const redirectPath = STEP_TO_FIRST_ROUTE[missingStep];
    if (location.pathname !== redirectPath) {
      return <Navigate to={redirectPath} replace />;
    }
  }

  return <>{children}</>;
}

/**
 * Hook: navigate to the previous step in the KYC flow.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useKycBack() {
  const goBack = (currentPath: string) => {
    return getPreviousStepRoute(currentPath);
  };

  return { goBack };
}
