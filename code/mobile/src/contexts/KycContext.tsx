import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import type { KycStepType, KycStatus, AccessLevel, OcrField, AddressData } from '../types';
import {
  clearPersistedKycState,
  loadPersistedKycState,
  persistKycState,
} from '../services/kycOfflineStore';

interface KycState {
  sessionId: string | null;
  status: KycStatus;
  currentStep: KycStepType;
  completedSteps: KycStepType[];
  accessLevel: AccessLevel;
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
  setAccessLevel: (level: AccessLevel) => void;
  setStatus: (status: KycStatus) => void;
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
  accessLevel: 'RESTRICTED_ACCESS',
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
};

const KycContext = createContext<KycContextType>({} as KycContextType);

export function KycProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<KycState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  // Compute derived fields using useMemo to avoid recomputation on every render
  const step = useMemo(() => state.completedSteps.length, [state.completedSteps]);

  // Memoized kycData object for backward compatibility
  const kycData = useMemo(() => ({
    idDocumentFront: undefined,
    idDocumentBack: undefined,
    livenessScore: undefined,
  }), []);

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

  return (
    <KycContext.Provider value={{
      ...state,

      // Core setters
      setSessionId: (sessionId) => setState(s => ({ ...s, sessionId })),
      setCurrentStep: (currentStep) => setState(s => ({ ...s, currentStep })),
      completeStep: (step) => setState(s => ({
        ...s,
        completedSteps: [...new Set([...s.completedSteps, step])],
      })),
      setCniCapture: (side, data) => setState(s => ({
        ...s,
        [side === 'recto' ? 'cniRectoCapture' : 'cniVersoCapture']: data,
      })),
      setOcrFields: (ocrFields) => setState(s => ({ ...s, ocrFields })),
      incrementLivenessAttempt: () => setState(s => ({
        ...s,
        livenessAttempts: s.livenessAttempts + 1,
      })),
      resetLivenessAttempts: () => setState(s => ({ ...s, livenessAttempts: 0 })),
      setAddress: (address) => setState(s => ({ ...s, address })),
      setBillCapture: (billCapture) => setState(s => ({ ...s, billCapture })),
      setNiuCapture: (niuCapture) => setState(s => ({ ...s, niuCapture })),
      setNiuManual: (niuManual) => setState(s => ({ ...s, niuManual })),
      setConsent: (key, val) => setState(s => ({ ...s, [key]: val })),
      setSignature: (signatureData) => setState(s => ({ ...s, signatureData })),
      setSelectedPlan: (selectedPlan) => setState(s => ({ ...s, selectedPlan })),
      setInterests: (interests) => setState(s => ({ ...s, interests })),
      setAccessLevel: (accessLevel) => setState(s => ({ ...s, accessLevel })),
      setStatus: (status) => setState(s => ({ ...s, status })),
      resetKyc: () => {
        setState(initialState);
        void clearPersistedKycState().catch((err) => {
          console.warn('Failed to clear persisted KYC state', err);
        });
      },

      // Backward compatibility - computed from state, not using 'this'
      step,
      setStep: () => { /* no-op, use setCurrentStep */ },
      kycData,
      updateKycData: () => { /* no-op, use individual setters */ },
    }}>
      {children}
    </KycContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useKyc() {
  return useContext(KycContext);
}
