import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import type { KycStepType, KycStatus, AccessTier, OcrField, AddressData } from '../types';
import {
  clearPersistedKycState,
  loadPersistedKycState,
  persistKycState,
} from '../services/kycOfflineStore';

// ADR-001: Review status from backend /review-status endpoint
export interface ReviewStatusNotification {
  id: string;
  type: string;
  message: string;
  sent_at: string | null;
}

export interface ReviewStatus {
  status: KycStatus;
  accessLevel: AccessTier;
  submittedAt: string | null;
  completedAt: string | null;
  decision: {
    decision: string;
    agent_role: string;
    reason: string | null;
    decided_at: string;
  } | null;
  unreadNotifications: ReviewStatusNotification[];
}

interface KycState {
  sessionId: string | null;
  status: KycStatus;
  currentStep: KycStepType;
  completedSteps: KycStepType[];
  accessLevel: AccessTier;
  cniRectoCapture: string | null;
  cniVersoCapture: string | null;
  ocrFields: OcrField[];
  livenessAttempts: number;
  address: AddressData | null;
  billCapture: string | null;
  niuCapture: string | null;
  niuManual: string | null;
  consentCgu: boolean;
  consentPrivacy: boolean;
  consentData: boolean;
  signatureData: string | null;
  selectedPlan: string | null;
  interests: string[];
  // ADR-001: Review status from backend
  reviewStatus: ReviewStatus | null;
}

interface KycContextType extends KycState {
  setSessionId: (id: string) => void;
  setCurrentStep: (step: KycStepType) => void;
  completeStep: (step: KycStepType) => void;
  setCniCapture: (side: 'recto' | 'verso', data: string) => void;
  setOcrFields: (fields: OcrField[]) => void;
  incrementLivenessAttempt: () => void;
  resetLivenessAttempts: () => void;
  setAddress: (address: AddressData) => void;
  setBillCapture: (data: string) => void;
  setNiuCapture: (data: string | null) => void;
  setNiuManual: (niu: string | null) => void;
  setConsent: (key: 'consentCgu' | 'consentPrivacy' | 'consentData', val: boolean) => void;
  setSignature: (data: string) => void;
  setSelectedPlan: (plan: string) => void;
  setInterests: (interests: string[]) => void;
  setAccessLevel: (level: AccessTier) => void;
  setStatus: (status: KycStatus) => void;
  setReviewStatus: (status: ReviewStatus | null) => void;
  resetKyc: () => void;

  // Backward compatibility with old KycContext
  /** @deprecated Use currentStep instead */
  step: number;
  /** @deprecated Use setCurrentStep instead */
  setStep: (n: number) => void;
  /** @deprecated Use individual setters instead */
  kycData: Partial<import('../types').KycData>;
  /** @deprecated Use individual setters instead */
  updateKycData: (data: Partial<import('../types').KycData>) => void;
}

const initialState: KycState = {
  sessionId: null,
  status: 'IN_PROGRESS',
  currentStep: 'cni_recto',
  completedSteps: [],
  accessLevel: 'GUEST',
  cniRectoCapture: null,
  cniVersoCapture: null,
  ocrFields: [],
  livenessAttempts: 0,
  address: null,
  billCapture: null,
  niuCapture: null,
  niuManual: null,
  consentCgu: false,
  consentPrivacy: false,
  consentData: false,
  signatureData: null,
  selectedPlan: null,
  interests: [],
  reviewStatus: null,
};

const KycContext = createContext<KycContextType>({} as KycContextType);

export function KycProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<KycState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  // Restore an existing KYC draft (if any) from IndexedDB on mount.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const persisted = await loadPersistedKycState();
        if (active && persisted) {
          setState(persisted);
        }
      } catch (err) {
        console.warn('Failed to restore KYC draft from IndexedDB', err);
      } finally {
        if (active) {
          setHydrated(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Persist current KYC state after hydration so users can resume offline.
  useEffect(() => {
    if (!hydrated) return;
    void persistKycState(state).catch((err) => {
      console.warn('Failed to persist KYC draft to IndexedDB', err);
    });
  }, [state, hydrated]);

  // Core setters wrapped in useCallback
  const setSessionId = useCallback((sessionId: string) => 
    setState(s => s.sessionId === sessionId ? s : ({ ...s, sessionId })), []);

  const setCurrentStep = useCallback((currentStep: KycStepType) => 
    setState(s => s.currentStep === currentStep ? s : ({ ...s, currentStep })), []);

  const completeStep = useCallback((step: KycStepType) => 
    setState(s => ({
      ...s,
      completedSteps: s.completedSteps.includes(step) ? s.completedSteps : [...s.completedSteps, step],
    })), []);

  const setCniCapture = useCallback((side: 'recto' | 'verso', data: string) => 
    setState(s => ({
      ...s,
      [side === 'recto' ? 'cniRectoCapture' : 'cniVersoCapture']: data,
    })), []);

  const setOcrFields = useCallback((ocrFields: OcrField[]) => 
    setState(s => ({ ...s, ocrFields })), []);

  const incrementLivenessAttempt = useCallback(() => 
    setState(s => ({ ...s, livenessAttempts: s.livenessAttempts + 1 })), []);

  const resetLivenessAttempts = useCallback(() => 
    setState(s => ({ ...s, livenessAttempts: 0 })), []);

  const setAddress = useCallback((address: AddressData) => 
    setState(s => ({ ...s, address })), []);

  const setBillCapture = useCallback((billCapture: string) => 
    setState(s => ({ ...s, billCapture })), []);

  const setNiuCapture = useCallback((niuCapture: string | null) => 
    setState(s => ({ ...s, niuCapture })), []);

  const setNiuManual = useCallback((niuManual: string | null) => 
    setState(s => ({ ...s, niuManual })), []);

  const setConsent = useCallback((key: 'consentCgu' | 'consentPrivacy' | 'consentData', val: boolean) => 
    setState(s => ({ ...s, [key]: val })), []);

  const setSignature = useCallback((signatureData: string) => 
    setState(s => ({ ...s, signatureData })), []);

  const setSelectedPlan = useCallback((selectedPlan: string) => 
    setState(s => ({ ...s, selectedPlan })), []);

  const setInterests = useCallback((interests: string[]) => 
    setState(s => ({ ...s, interests })), []);

  const setAccessLevel = useCallback((accessLevel: AccessTier) => 
    setState(s => ({ ...s, accessLevel })), []);

  const setStatus = useCallback((status: KycStatus) => 
    setState(s => ({ ...s, status })), []);

  const setReviewStatus = useCallback((reviewStatus: ReviewStatus | null) => 
    setState(s => ({ ...s, reviewStatus })), []);

  const resetKyc = useCallback(() => {
    setState(initialState);
    void clearPersistedKycState().catch((err) => {
      console.warn('Failed to clear persisted KYC state', err);
    });
  }, []);

  // Compute derived fields using useMemo to avoid recomputation on every render
  const step = useMemo(() => state.completedSteps.length, [state.completedSteps]);

  // Memoized kycData object for backward compatibility
  const kycData = useMemo(() => ({
    idDocumentFront: undefined,
    idDocumentBack: undefined,
    livenessScore: undefined,
  }), []);

  // Memoize context value
  const contextValue = useMemo(() => ({
    ...state,
    setSessionId,
    setCurrentStep,
    completeStep,
    setCniCapture,
    setOcrFields,
    incrementLivenessAttempt,
    resetLivenessAttempts,
    setAddress,
    setBillCapture,
    setNiuCapture,
    setNiuManual,
    setConsent,
    setSignature,
    setSelectedPlan,
    setInterests,
    setAccessLevel,
    setStatus,
    resetKyc,
    step,
    setStep: () => { /* no-op */ },
    kycData,
    updateKycData: () => { /* no-op */ },
  }), [
    state,
    setSessionId,
    setCurrentStep,
    completeStep,
    setCniCapture,
    setOcrFields,
    incrementLivenessAttempt,
    resetLivenessAttempts,
    setAddress,
    setBillCapture,
    setNiuCapture,
    setNiuManual,
    setConsent,
    setSignature,
    setSelectedPlan,
    setInterests,
    setAccessLevel,
    setStatus,
    setReviewStatus,
    resetKyc,
    step,
    kycData,
  ]);

  return (
    <KycContext.Provider value={contextValue}>
      {children}
    </KycContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useKyc() {
  return useContext(KycContext);
}
