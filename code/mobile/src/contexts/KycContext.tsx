import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import type {
  KycStepType,
  KycStatus,
  AccessTier,
  OcrField,
  AddressData,
  BasicProfileData,
  DocumentChoiceData,
} from '../types';
import {
  clearPersistedKycState,
  loadPersistedKycState,
  persistKycState,
} from '../services/kycOfflineStore';
import { fetchWithCorrelation } from '../services/apiClient';
import { getAuthToken } from '../services/authTokenStorage';
import { ensureDeviceRegistered } from '../services/deviceRegistrationService';

/** Status de réconciliation backend → local */
export type ReconciliationStatus = 'pending' | 'done' | 'skipped' | 'failed';

/** Données session backend (/session/current) */
export interface BackendSessionData {
  id: string;
  status: KycStatus;
  access_level: AccessTier;
  last_step_completed: string;
  documents: { doc_type: string; id: string }[];
  biometric_result: { result: string; score: number } | null;
  consent_record: { cgu_accepted: boolean; data_consent_accepted: boolean; privacy_consent_accepted: boolean } | null;
}

/** Données readiness backend (/readiness) */
export interface BackendReadinessData {
  can_submit: boolean;
  blocking_reasons: string[];
  warnings: string[];
  has_ocr_review: boolean;
  has_ocr_review_confirmed: boolean;
  has_consent: boolean;
  has_biometric_result: boolean;
  has_bill_document: boolean;
  required_missing_documents: string[];
}

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

interface BackendReviewStatus {
  status: KycStatus;
  access_level?: AccessTier;
  accessLevel?: AccessTier;
  submitted_at?: string | null;
  submittedAt?: string | null;
  completed_at?: string | null;
  completedAt?: string | null;
  decision: ReviewStatus['decision'];
  unread_notifications?: ReviewStatusNotification[];
  unreadNotifications?: ReviewStatusNotification[];
}

function normalizeReviewStatus(response: BackendReviewStatus): ReviewStatus {
  return {
    status: response.status,
    accessLevel: response.accessLevel ?? response.access_level ?? 'GUEST',
    submittedAt: response.submittedAt ?? response.submitted_at ?? null,
    completedAt: response.completedAt ?? response.completed_at ?? null,
    decision: response.decision ?? null,
    unreadNotifications: response.unreadNotifications ?? response.unread_notifications ?? [],
  };
}

const REVIEW_POLLABLE_STATUSES: KycStatus[] = [
  'SUBMITTED',
  'PENDING',
  'PENDING_AGENT_REVIEW',
  'PENDING_KYC',
  'PENDING_INFO',
];

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
  basicProfile: BasicProfileData | null;
  documentChoice: DocumentChoiceData | null;
  biometricConsentAccepted: boolean;
  // ADR-001: Review status from backend
  reviewStatus: ReviewStatus | null;
}

interface KycContextType extends KycState {
  hydrated: boolean;
  reconciliationStatus: ReconciliationStatus;
  editStep: KycStepType | null;
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
  setBasicProfile: (profile: BasicProfileData) => void;
  setDocumentChoice: (choice: DocumentChoiceData) => void;
  setBiometricConsentAccepted: (accepted: boolean) => void;
  setAccessLevel: (level: AccessTier) => void;
  setStatus: (status: KycStatus) => void;
  setReviewStatus: (status: ReviewStatus | null) => void;
  setEditStep: (step: KycStepType | null) => void;
  /** Reset only temporary UI/form data (captures, OCR, consent). Preserves status/accessLevel/reviewStatus/sessionId. */
  resetKycForm: () => void;
  /** Full reset: clears persisted state, resets all fields including status to initial. Use when starting a new KYC. */
  resetKycFull: () => Promise<void>;
  /** Controlled fresh start: clears persisted state, resets all fields, marks as reconciled. */
  startFreshKyc: () => Promise<void>;
  /** Reconcile local state with backend truth. Call after fetching /session/current + /readiness. */
  hydrateKycFromBackend: (session: BackendSessionData, readiness: BackendReadinessData | null) => void;
  /** @deprecated Use resetKycForm() or resetKycFull() instead */
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
  status: 'DRAFT',
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
  basicProfile: null,
  documentChoice: null,
  biometricConsentAccepted: false,
  reviewStatus: null,
};

const KycContext = createContext<KycContextType>({} as KycContextType);

export function KycProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<KycState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [reconciliationStatus, setReconciliationStatus] = useState<ReconciliationStatus>('pending');
  const [editStep, setEditStep] = useState<KycStepType | null>(null);

  // Restore an existing KYC draft (if any) from IndexedDB on mount.
  // reconciliationStatus stays 'pending' until hydrateKycFromBackend() is called
  // or 'skipped' if offline/failed.
  useEffect(() => {
    let active = true;
    void (async () => {
      let persisted: Awaited<ReturnType<typeof loadPersistedKycState>> = null;
      try {
        persisted = await loadPersistedKycState();
        if (active && persisted) {
          setState({
            ...initialState,
            ...persisted,
            basicProfile: persisted.basicProfile ?? null,
            documentChoice: persisted.documentChoice ?? null,
            biometricConsentAccepted: persisted.biometricConsentAccepted ?? false,
          });
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

  /** Map backend session data to local completedSteps. */
  const mapSessionToCompletedSteps = useCallback((
    session: BackendSessionData,
    readiness: BackendReadinessData | null,
  ): KycStepType[] => {
    const steps: KycStepType[] = [];
    const docTypes = session.documents.map(d => d.doc_type);

    if (docTypes.includes('CNI_RECTO')) steps.push('cni_recto');
    if (docTypes.includes('CNI_VERSO')) steps.push('cni_verso');
    if (readiness?.has_ocr_review_confirmed ?? false) steps.push('ocr_review');
    if (readiness?.has_biometric_result ?? session.biometric_result !== null) steps.push('liveness');
    if (readiness?.has_bill_document ?? docTypes.some(d => d.startsWith('BILL_'))) steps.push('utility_bill');
    // Address: pas de flag backend explicite -> on ne déduit pas depuis blocking_reasons.
    // On garde le local si le backend ne dit rien.
    if (readiness?.has_consent ?? session.consent_record?.cgu_accepted ?? false) steps.push('consent');
    // Signature: pas de flag backend explicite -> idem.

    return steps;
  }, []);

  /** Reconcile local state with backend truth. */
  const hydrateKycFromBackend = useCallback((
    session: BackendSessionData,
    readiness: BackendReadinessData | null,
  ) => {
    const backendSteps = mapSessionToCompletedSteps(session, readiness);
    const isFreshDraft = session.status === 'DRAFT' && session.documents.length === 0;

    setState(s => {
      if (isFreshDraft) {
        // Backend says fresh start -> wipe local stale data.
        return {
          ...initialState,
          sessionId: session.id,
          status: session.status,
          accessLevel: session.access_level,
          completedSteps: [],
        };
      }

      // Merge: backend truth for completedSteps, keep local wizard state for in-progress captures.
      const mergedSteps = [...new Set([...backendSteps, ...s.completedSteps])];
      // Remove steps that backend says are NOT done (backend prime).
      const reconciledSteps = mergedSteps.filter(step => backendSteps.includes(step));

      return {
        ...s,
        sessionId: session.id ?? s.sessionId,
        status: session.status ?? s.status,
        accessLevel: session.access_level ?? s.accessLevel,
        completedSteps: reconciledSteps,
        // Clear local captures that backend doesn't know about.
        ...(session.biometric_result === null ? { } : {}),
        ...(session.consent_record === null ? { consentCgu: false, consentPrivacy: false, consentData: false } : {}),
      };
    });

    setReconciliationStatus('done');
  }, [mapSessionToCompletedSteps]);

  // ─── AUTO-RECONCILIATION ──────────────────────────────────────────────────
  // Runs once after hydration to align local state with backend.
  // Sets reconciliationStatus to 'done' (backend session found, reconciled)
  // or 'skipped' (no backend session, stale wiped / network error → offline).
  // Without this, KycStepGuard Phase 2 blocks all guarded routes.
  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    void (async () => {
      try {
        const token = getAuthToken();
        if (!token) {
          if (active) setReconciliationStatus('skipped');
          return;
        }
        if (!localStorage.getItem('vp_device_tag')) {
          try {
            await ensureDeviceRegistered();
          } catch (err) {
            console.warn('Skipping KYC reconciliation until device registration succeeds', err);
            if (active) setReconciliationStatus('skipped');
            return;
          }
        }
        const res = await fetchWithCorrelation('/api/v1/kyc/session/current');
        if (!active) return;
        if (res.status === 401) {
          // Token removal and redirect are handled centrally by apiClient / AuthContext.
          // Avoid duplicate redirects or full page reloads.
          return;
        }
        if (res.status === 403) {
          if (active) {
            setReconciliationStatus('skipped');
          }
          return;
        }
        if (res.ok) {
          const session = await res.json() as BackendSessionData;
          if (session.id) {
            let readiness: BackendReadinessData | null = null;
            try { const r = await fetchWithCorrelation('/api/v1/kyc/readiness'); if (r.ok) readiness = await r.json(); } catch { /* readiness is best effort */ }
            if (active) {
              hydrateKycFromBackend(session, readiness);
            }
            return;
          }
        }
        if (active) {
          setState(s => {
            const hasStale = s.completedSteps.length > 0 || s.sessionId !== null;
            if (!hasStale) return s;
            return { ...initialState, completedSteps: [] };
          });
          setReconciliationStatus('skipped');
        }
      } catch {
        if (active) setReconciliationStatus('skipped');
      }
    })();
    return () => { active = false; };
  }, [hydrated, hydrateKycFromBackend]);
  // ─── END AUTO-RECONCILIATION ───────────────────────────────────────────────

  // ADR-001: Poll review status if PENDING or SUBMITTED
  useEffect(() => {
    if (!REVIEW_POLLABLE_STATUSES.includes(state.status)) return;
    if (!state.sessionId) return;

    let active = true;
    const poll = async () => {
      try {
        const { apiClient } = await import('../services/apiClient');
        const response = await apiClient.get<BackendReviewStatus>('/kyc/review-status');
        const reviewStatus = normalizeReviewStatus(response);
        
        if (active) {
          setState(s => {
            if (s.status === reviewStatus.status && s.accessLevel === reviewStatus.accessLevel) return s;
            return { ...s, status: reviewStatus.status, accessLevel: reviewStatus.accessLevel, reviewStatus };
          });
        }
      } catch (err) {
        console.warn('Polling review status failed', err);
      }
    };

    // Initial poll
    void poll();

    const interval = setInterval(poll, 10000); // 10 seconds
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [state.status, state.sessionId]);

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

  const setBasicProfile = useCallback((basicProfile: BasicProfileData) =>
    setState(s => ({ ...s, basicProfile })), []);

  const setDocumentChoice = useCallback((documentChoice: DocumentChoiceData) =>
    setState(s => ({ ...s, documentChoice })), []);

  const setBiometricConsentAccepted = useCallback((biometricConsentAccepted: boolean) =>
    setState(s => ({ ...s, biometricConsentAccepted })), []);

  const setAccessLevel = useCallback((accessLevel: AccessTier) => 
    setState(s => ({ ...s, accessLevel })), []);

  const setStatus = useCallback((status: KycStatus) => 
    setState(s => ({ ...s, status })), []);

  const setReviewStatus = useCallback((reviewStatus: ReviewStatus | null) => 
    setState(s => ({ ...s, reviewStatus })), []);

  const resetKycForm = useCallback(() => {
    setState(s => ({
      ...s,
      // Reset UI/form data only
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
      basicProfile: null,
      documentChoice: null,
      biometricConsentAccepted: false,
      completedSteps: [],
      currentStep: 'cni_recto',
      // Preserve: sessionId, status, accessLevel, reviewStatus
    }));
  }, []);

  const resetKycFull = useCallback(async () => {
    await clearPersistedKycState().catch((err) => {
      console.warn('Failed to clear persisted KYC state', err);
    });
    setState(initialState);
    setReconciliationStatus('pending');
    setEditStep(null);
  }, []);

  /** Controlled fresh start: clears everything, marks as reconciled. */
  const startFreshKyc = useCallback(async () => {
    await clearPersistedKycState().catch((err) => {
      console.warn('Failed to clear persisted KYC state', err);
    });
    setState(initialState);
    setReconciliationStatus('done');
    setEditStep(null);
  }, []);

  /** @deprecated Use resetKycForm() or resetKycFull() instead */
  const resetKyc = useCallback(() => {
    resetKycFull();
  }, [resetKycFull]);

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
    hydrated,
    reconciliationStatus,
    editStep,
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
    setBasicProfile,
    setDocumentChoice,
    setBiometricConsentAccepted,
    setAccessLevel,
    setStatus,
    setReviewStatus,
    setEditStep,
    resetKycForm,
    resetKycFull,
    startFreshKyc,
    hydrateKycFromBackend,
    resetKyc,
    step,
    setStep: () => { /* no-op */ },
    kycData,
    updateKycData: () => { /* no-op */ },
  }), [
    state,
    hydrated,
    reconciliationStatus,
    editStep,
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
    setBasicProfile,
    setDocumentChoice,
    setBiometricConsentAccepted,
    setAccessLevel,
    setStatus,
    setReviewStatus,
    setEditStep,
    resetKycForm,
    resetKycFull,
    startFreshKyc,
    hydrateKycFromBackend,
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
