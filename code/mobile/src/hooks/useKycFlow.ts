/**
 * KYC step ordering and navigation helpers.
 *
 * Defines the canonical order of KYC steps and provides:
 * - KycStepGuard: prevents navigating to a step before prerequisites are met
 * - useKycBack: computes the previous step in the flow
 */

import { Navigate } from 'react-router-dom';
import { useKyc } from '../contexts/KycContext';
import type { KycStepType } from '../types';

// Canonical step order — each step requires all previous steps to be completed
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
export function getRouteForMissingStep(completedSteps: KycStepType[]): string {
  const missing = findFirstMissingStep(completedSteps);
  if (!missing) return '/dashboard';
  return STEP_TO_FIRST_ROUTE[missing] || '/dashboard';
}

/**
 * Get the previous step route for back navigation.
 */
export function getPreviousStepRoute(currentPath: string): string {
  const currentStep = ROUTE_TO_STEP[currentPath];
  if (!currentStep) return '/dashboard';

  const idx = KYC_STEP_ORDER.indexOf(currentStep);
  if (idx <= 0) return '/dashboard';

  const prevStep = KYC_STEP_ORDER[idx - 1];
  return STEP_TO_FIRST_ROUTE[prevStep] || '/dashboard';
}

/**
 * Guard component: redirects to the first missing step if prerequisites aren't met.
 * Wraps KYC route elements to enforce step ordering.
 */
export function KycStepGuard({ children }: { children: React.ReactNode }) {
  const { completedSteps, hydrated } = useKyc();

  if (!hydrated) return <>{children}</>;

  const missingStep = findFirstMissingStep(completedSteps);
  if (missingStep) {
    const redirectPath = STEP_TO_FIRST_ROUTE[missingStep];
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}

/**
 * Hook: navigate to the previous step in the KYC flow.
 */
export function useKycBack() {
  const { completedSteps } = useKyc();

  const goBack = (currentPath: string) => {
    const prev = getPreviousStepRoute(currentPath);
    return prev;
  };

  return { goBack };
}
