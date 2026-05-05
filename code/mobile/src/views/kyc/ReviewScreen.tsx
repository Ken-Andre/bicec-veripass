import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import type { KycStepType } from '../../types';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { ProgressStepper } from '../../components/ProgressStepper';
import { CheckCircle, FileText, User, MapPin, Shield, PenLine, Receipt, AlertCircle, ArrowRight, RotateCcw } from 'lucide-react';
import { getSubmissionBlockerStatus, runKycSyncNow } from '../../services/kycSyncService';
import { fetchWithCorrelation } from '../../services/apiClient';

// Map blocking reason keywords to corrective routes AND steps
const BLOCKING_REASON_ROUTES: Record<string, string> = {
  'CNI_RECTO': '/kyc/cni-recto-capture',
  'CNI_VERSO': '/kyc/cni-verso-capture',
  'SELFIE': '/kyc/liveness',
  'Liveness': '/kyc/liveness',
  'liveness': '/kyc/liveness',
  'OCR review': '/kyc/ocr-review',
  'Consent': '/kyc/consent',
  'consent': '/kyc/consent',
};

const BLOCKING_REASON_STEPS: Record<string, KycStepType> = {
  'CNI_RECTO': 'cni_recto',
  'CNI_VERSO': 'cni_verso',
  'SELFIE': 'liveness',
  'Liveness': 'liveness',
  'liveness': 'liveness',
  'OCR review': 'ocr_review',
  'Consent': 'consent',
  'consent': 'consent',
};

function getCorrectionRoute(reason: string): string | null {
  for (const [keyword, route] of Object.entries(BLOCKING_REASON_ROUTES)) {
    if (reason.includes(keyword)) return route;
  }
  return null;
}

function getCorrectionStep(reason: string): KycStepType | null {
  for (const [keyword, step] of Object.entries(BLOCKING_REASON_STEPS)) {
    if (reason.includes(keyword)) return step;
  }
  return null;
}

const KYC_STEPS = [
  { label: 'CNI' },
  { label: 'OCR' },
  { label: 'Visage' },
  { label: 'Adresse' },
  { label: 'Facture' },
  { label: 'NIU' },
  { label: 'Consent.' },
  { label: 'Signature' },
  { label: 'Revue' },
];

interface SessionData {
  status: string;
  documents: { doc_type: string }[];
  consent_record: { cgu_accepted: boolean } | null;
}

interface ReadinessData {
  can_submit: boolean;
  blocking_reasons: string[];
  warnings: string[];
  has_ocr_review: boolean;
  has_consent: boolean;
  has_biometric_result: boolean;
  has_bill_document: boolean;
  required_missing_documents: string[];
}

/**
 * Resolve a checklist value using backend-first logic:
 * - If backend is loaded and has an explicit flag → use it (true/false)
 * - If backend is loaded but has NO explicit flag → null ("Non vérifié")
 * - If backend is not loaded → fallback to local value
 */
function resolveChecklist(
  backendLoaded: boolean,
  backendValue: boolean | undefined,
  hasExplicitFlag: boolean,
  localFallback: boolean | undefined,
): boolean | null {
  if (!backendLoaded) return localFallback ?? null;
  if (hasExplicitFlag) return backendValue ?? false;
  return null; // No explicit flag → "Non vérifié"
}

export default function ReviewScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { address, signatureData, billCapture, completeStep, setEditStep } = useKyc();
  const [session, setSession] = useState<SessionData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [backendReadiness, setBackendReadiness] = useState<ReadinessData | null>(null);
  const [offlineBlocked, setOfflineBlocked] = useState<string | null>(null);
  const [loadingReadiness, setLoadingReadiness] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoadingReadiness(true);
      try {
        await runKycSyncNow();

        const sessionRes = await fetchWithCorrelation('/api/v1/kyc/session/current');
        if (sessionRes.ok) {
          const data = await sessionRes.json();
          setSession(data);
        }

        const readinessRes = await fetchWithCorrelation('/api/v1/kyc/readiness');
        if (readinessRes.ok) {
          setBackendReadiness(await readinessRes.json() as ReadinessData);
        }

        const offlineStatus = await getSubmissionBlockerStatus();
        setOfflineBlocked(offlineStatus.canSubmit ? null : offlineStatus.blockingReason);
      } catch (error) {
        console.error('Failed to load review data:', error);
      } finally {
        setLoadingReadiness(false);
      }
    };

    void load();
  }, []);

  const canSubmit = Boolean(backendReadiness?.can_submit) && !offlineBlocked && !loadingReadiness;

  const docTypes = session?.documents?.map(d => d.doc_type) || [];
  const backendLoaded = !loadingReadiness && backendReadiness !== null;

  // Backend-first checklist resolution
  const hasCni = resolveChecklist(
    backendLoaded,
    backendReadiness ? !backendReadiness.blocking_reasons.some(r => r.includes('CNI_RECTO') || r.includes('CNI_VERSO')) : undefined,
    backendLoaded, // Always explicit from blocking_reasons
    docTypes.includes('CNI_RECTO') && docTypes.includes('CNI_VERSO'),
  );

  const hasSelfie = resolveChecklist(
    backendLoaded,
    backendReadiness?.has_biometric_result,
    backendLoaded && backendReadiness !== undefined, // has_biometric_result is explicit
    docTypes.includes('SELFIE'),
  );

  const hasBill = resolveChecklist(
    backendLoaded,
    backendReadiness?.has_bill_document,
    backendLoaded && backendReadiness !== undefined, // has_bill_document is explicit
    docTypes.some(d => d.startsWith('BILL_')) || !!billCapture,
  );

  const hasConsent = resolveChecklist(
    backendLoaded,
    backendReadiness?.has_consent,
    backendLoaded && backendReadiness !== undefined, // has_consent is explicit
    !!session?.consent_record?.cgu_accepted,
  );

  const hasOcrReview = resolveChecklist(
    backendLoaded,
    backendReadiness?.has_ocr_review,
    backendLoaded && backendReadiness !== undefined, // has_ocr_review is explicit
    undefined, // No local fallback for OCR review
  );

  // Address: no explicit backend flag → "Non vérifié" when backend loaded
  const hasAddress: boolean | null = backendLoaded ? null : !!address;

  // Signature: no explicit backend flag → "Non vérifié" when backend loaded
  const hasSignature: boolean | null = backendLoaded ? null : !!signatureData;

  const handleCorrect = (route: string, step: KycStepType | null) => {
    if (step) {
      setEditStep(step);
    }
    navigate(route);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const offlineStatus = await getSubmissionBlockerStatus();
      if (!offlineStatus.canSubmit) {
        setSubmitError(offlineStatus.blockingReason);
        return;
      }

      const res = await fetchWithCorrelation('/api/v1/kyc/submit', {
        method: 'POST',
      });

      if (res.ok) {
        completeStep('submission');
        setEditStep(null);
        navigate('/kyc/submit-success');
      } else {
        const body = await res.json().catch(() => null);
        setSubmitError(
          body?.detail || 'La soumission a échoué. Vérifiez les étapes précédentes.',
        );
      }
    } catch (error) {
      console.error('Failed to submit KYC:', error);
      setSubmitError('La soumission a échoué. Vérifiez la connexion et réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  const CheckItem = ({
    icon,
    label,
    detail,
    ok,
    children,
  }: {
    icon: React.ReactNode;
    label: string;
    detail?: string;
    ok: boolean | null | undefined;
    children?: React.ReactNode;
  }) => (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className="text-primary">{icon}</div>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      {children}
      {ok === null ? (
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-muted text-muted-foreground">
          ?
        </div>
      ) : (
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${ok ? 'bg-success text-white' : 'bg-destructive/10 text-destructive'}`}>
          {ok ? '✓' : '✗'}
        </div>
      )}
    </div>
  );

  return (
    <ScreenLayoutV2 title={t('review.title')} showBack>
      <ProgressStepper steps={KYC_STEPS} currentStep={8} className="mb-4" />
      <div className="flex flex-col gap-4 py-2">
        <h2 className="text-lg font-bold">{t('review.title')}</h2>
        <p className="text-sm text-muted-foreground">Vérifiez votre dossier avant soumission</p>

        {/* Checklist — backend-first: explicit backend flags take priority */}
        <div className="space-y-3">
          <CheckItem
            icon={<User className="w-5 h-5" />}
            label={t('review.identity') || 'Identité'}
            detail={
              hasCni === null
                ? 'Non vérifié'
                : `${hasCni ? '✓ CNI recto/verso' : '✗ CNI manquant'}${hasSelfie ? ' · ✓ Selfie' : hasSelfie === false ? ' · ✗ Selfie manquant' : ''}`
            }
            ok={hasCni === null ? null : hasCni && (hasSelfie ?? false)}
          />

          <CheckItem
            icon={<Receipt className="w-5 h-5" />}
            label="Justificatif de domicile"
            detail={hasBill === null ? 'Non vérifié' : hasBill ? '✓ Facture (ENEO/CAMWATER)' : '✗ Facture manquante'}
            ok={hasBill}
          />

          <CheckItem
            icon={<MapPin className="w-5 h-5" />}
            label={t('review.address') || 'Adresse'}
            detail={
              hasAddress === null
                ? 'Non vérifié'
                : address
                  ? `${address.quartier}, ${address.city}${address.gps_lat ? ' · ✓ GPS' : ''}`
                  : (t('review.address.missing') || 'Non renseigné')
            }
            ok={hasAddress}
          />

          <CheckItem
            icon={<FileText className="w-5 h-5" />}
            label="NIU"
            detail={docTypes.includes('NIU') ? t('review.niu.yes') || '✓ NIU fourni' : t('review.niu.no') || 'Optionnel · non fourni'}
            ok={true}
          />

          <CheckItem
            icon={<Shield className="w-5 h-5" />}
            label={t('review.consent') || 'Consentements'}
            detail={hasConsent === null ? 'Non vérifié' : hasConsent ? t('review.consent.cgu') || '✓ CGU acceptées' : '✗ CGU non acceptées'}
            ok={hasConsent}
          />

          <CheckItem
            icon={<PenLine className="w-5 h-5" />}
            label="OCR & Identité vérifiée"
            detail={hasOcrReview === null ? 'Non vérifié' : hasOcrReview ? '✓ Champs vérifiés' : '✗ Revue OCR non effectuée'}
            ok={hasOcrReview}
          />

          <CheckItem
            icon={<PenLine className="w-5 h-5" />}
            label="Signature électronique"
            detail={hasSignature === null ? 'Non vérifié' : hasSignature ? '✓ Signée électroniquement' : '✗ Signature manquante'}
            ok={hasSignature}
          >
            {signatureData && (
              <div className="w-12 h-8 bg-card border rounded overflow-hidden">
                <img src={signatureData} alt="Signature" className="w-full h-full object-contain" />
              </div>
            )}
          </CheckItem>
        </div>

        {/* Warnings from backend */}
        {backendReadiness?.warnings?.map((w, i) => (
          <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertCircle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
            <p className="text-xs text-warning">{w}</p>
          </div>
        ))}

        {/* Blocking reasons from backend with corrective actions */}
        {backendReadiness && !backendReadiness.can_submit && backendReadiness.blocking_reasons.length > 0 && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
            <p className="text-xs font-semibold text-destructive">Dossier incomplet :</p>
            {backendReadiness.blocking_reasons.map((r, i) => {
              const route = getCorrectionRoute(r);
              const step = getCorrectionStep(r);
              return (
                <div key={i} className="flex items-center justify-between gap-2">
                  <p className="text-xs text-destructive flex-1">• {r}</p>
                  {route && (
                    <button
                      onClick={() => handleCorrect(route, step)}
                      className="flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 px-2 py-1 rounded shrink-0 transition-colors"
                    >
                      Corriger <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Offline blocker */}
        {offlineBlocked && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
            <p className="text-xs text-warning">⚠ {offlineBlocked}</p>
          </div>
        )}

        {/* Submit error */}
        {submitError && (
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{submitError}</p>
        )}

        {/* Submit button — driven by backend readiness */}
        <Button
          onClick={handleSubmit}
          loading={submitting || loadingReadiness}
          disabled={submitting || !canSubmit}
          className="mt-2"
        >
          {loadingReadiness && !submitting ? (
            <>
              <RotateCcw className="w-5 h-5 animate-spin" />
              Vérification…
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              {t('review.submit') || 'Soumettre le dossier KYC'}
            </>
          )}
        </Button>

        {loadingReadiness && (
          <p className="text-xs text-center text-muted-foreground">Chargement du statut du dossier…</p>
        )}
      </div>
    </ScreenLayoutV2>
  );
}
