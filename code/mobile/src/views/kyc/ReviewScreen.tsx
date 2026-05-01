import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { ProgressStepper } from '../../components/ProgressStepper';
import { CheckCircle, FileText, User, MapPin, Shield, Loader2, PenLine, Receipt, AlertCircle, ArrowRight } from 'lucide-react';
import { getSubmissionBlockerStatus, runKycSyncNow } from '../../services/kycSyncService';
import { fetchWithCorrelation } from '../../services/apiClient';

// Map blocking reason keywords to corrective routes
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

function getCorrectionRoute(reason: string): string | null {
  for (const [keyword, route] of Object.entries(BLOCKING_REASON_ROUTES)) {
    if (reason.includes(keyword)) return route;
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

export default function ReviewScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { address, signatureData, billCapture } = useKyc();
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
        // Sync pending offline ops first
        await runKycSyncNow();

        // Fetch session info (informational only — doesn't gate submit)
        const sessionRes = await fetchWithCorrelation('/api/v1/kyc/session/current');
        if (sessionRes.ok) {
          const data = await sessionRes.json();
          setSession(data);
        }

        // The real submit gate: backend readiness
        const readinessRes = await fetchWithCorrelation('/api/v1/kyc/readiness');
        if (readinessRes.ok) {
          setBackendReadiness(await readinessRes.json() as ReadinessData);
        }

        // Offline queue check (only blocks if there are FAILED ops pending)
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

  // Source of truth: backend says can_submit AND no offline queue blocker
  const canSubmit = Boolean(backendReadiness?.can_submit) && !offlineBlocked && !loadingReadiness;

  const docTypes = session?.documents?.map(d => d.doc_type) || [];
  const hasCni = docTypes.includes('CNI_RECTO') && docTypes.includes('CNI_VERSO');
  const hasSelfie = docTypes.includes('SELFIE') || backendReadiness?.has_biometric_result;
  const hasBill = docTypes.some(d => d.startsWith('BILL_')) || !!billCapture || backendReadiness?.has_bill_document;
  const hasConsent = !!session?.consent_record?.cgu_accepted || backendReadiness?.has_consent;
  const hasSignature = !!signatureData;
  const hasOcrReview = backendReadiness?.has_ocr_review;

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Re-check offline queue just before submit
      const offlineStatus = await getSubmissionBlockerStatus();
      if (!offlineStatus.canSubmit) {
        setSubmitError(offlineStatus.blockingReason);
        return;
      }

      const res = await fetchWithCorrelation('/api/v1/kyc/submit', {
        method: 'POST',
      });

      if (res.ok) {
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
    ok: boolean | undefined;
    children?: React.ReactNode;
  }) => (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className="text-primary">{icon}</div>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      {children}
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${ok ? 'bg-green-500 text-white' : 'bg-red-100 text-red-500'}`}>
        {ok ? '✓' : '✗'}
      </div>
    </div>
  );

  return (
    <ScreenLayout title={t('review.title')} showBack>
      <ProgressStepper steps={KYC_STEPS} currentStep={8} className="mb-4" />
      <div className="flex flex-col gap-4 py-2">
        <h2 className="text-lg font-bold">{t('review.title')}</h2>
        <p className="text-sm text-muted-foreground">Vérifiez votre dossier avant soumission</p>

        {/* Checklist — informational, driven by backend flags when available */}
        <div className="space-y-3">
          <CheckItem
            icon={<User className="w-5 h-5" />}
            label={t('review.identity') || 'Identité'}
            detail={`${hasCni ? '✓ CNI recto/verso' : '✗ CNI manquant'}${hasSelfie ? ' · ✓ Selfie' : ' · ✗ Selfie manquant'}`}
            ok={hasCni && hasSelfie}
          />

          <CheckItem
            icon={<Receipt className="w-5 h-5" />}
            label="Justificatif de domicile"
            detail={hasBill ? '✓ Facture (ENEO/CAMWATER)' : '✗ Facture manquante'}
            ok={hasBill}
          />

          <CheckItem
            icon={<MapPin className="w-5 h-5" />}
            label={t('review.address') || 'Adresse'}
            detail={
              address
                ? `${address?.quartier}, ${address?.city}${address?.gps_lat ? ' · ✓ GPS' : ''}`
                : 'AKW, DLA · ✓ GPS'
            }
            ok={true}
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
            detail={hasConsent ? t('review.consent.cgu') || '✓ CGU acceptées' : '✗ CGU non acceptées'}
            ok={hasConsent}
          />

          <CheckItem
            icon={<PenLine className="w-5 h-5" />}
            label="OCR & Identité vérifiée"
            detail={hasOcrReview ? '✓ Champs vérifiés' : '✗ Revue OCR non effectuée'}
            ok={hasOcrReview}
          />

          <CheckItem
            icon={<PenLine className="w-5 h-5" />}
            label="Signature électronique"
            detail={hasSignature ? '✓ Signée électroniquement' : '✗ Signature manquante'}
            ok={hasSignature}
          >
            {signatureData && (
              <div className="w-12 h-8 bg-white border rounded overflow-hidden">
                <img src={signatureData} alt="Signature" className="w-full h-full object-contain" />
              </div>
            )}
          </CheckItem>
        </div>

        {/* Warnings from backend */}
        {backendReadiness?.warnings?.map((w, i) => (
          <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">{w}</p>
          </div>
        ))}

        {/* Blocking reasons from backend with corrective actions */}
        {backendReadiness && !backendReadiness.can_submit && backendReadiness.blocking_reasons.length > 0 && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2">
            <p className="text-xs font-semibold text-red-700">Dossier incomplet :</p>
            {backendReadiness.blocking_reasons.map((r, i) => {
              const route = getCorrectionRoute(r);
              return (
                <div key={i} className="flex items-center justify-between gap-2">
                  <p className="text-xs text-red-600 flex-1">• {r}</p>
                  {route && (
                    <button
                      onClick={() => navigate(route)}
                      className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 px-2 py-1 rounded shrink-0 transition-colors"
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
          <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
            <p className="text-xs text-orange-700">⚠ {offlineBlocked}</p>
          </div>
        )}

        {/* Submit error */}
        {submitError && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{submitError}</p>
        )}

        {/* Submit button — driven by backend readiness */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-semibold disabled:opacity-40 mt-2 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : loadingReadiness ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Vérification…
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              {t('review.submit') || 'Soumettre le dossier KYC'}
            </>
          )}
        </button>

        {loadingReadiness && (
          <p className="text-xs text-center text-muted-foreground">Chargement du statut du dossier…</p>
        )}
      </div>
    </ScreenLayout>
  );
}
