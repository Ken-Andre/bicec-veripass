import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { CheckCircle, FileText, User, MapPin, Shield, Loader2, PenLine, Receipt } from 'lucide-react';
import { getSubmissionBlockerStatus, runKycSyncNow } from '../../services/kycSyncService';
import { fetchWithCorrelation } from '../../services/apiClient';

interface SessionData {
  status: string;
  documents: { doc_type: string }[];
  consent_record: { cgu_accepted: boolean } | null;
}

interface ReadinessData {
  can_submit: boolean;
  blocking_reasons: string[];
  warnings: string[];
}

export default function ReviewScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { address, signatureData, billCapture } = useKyc();
  const [session, setSession] = useState<SessionData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitBlockedReason, setSubmitBlockedReason] = useState<string | null>(null);
  const [backendReadinessWarning, setBackendReadinessWarning] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        await runKycSyncNow();
        const res = await fetchWithCorrelation('/api/v1/kyc/session/current');
        if (res.ok) {
          const data = await res.json();
          setSession(data);
        }
      } catch (error) {
        console.error('Failed to fetch session:', error);
      }
    };

    const refreshSubmissionGate = async () => {
      try {
        const offlineStatus = await getSubmissionBlockerStatus();
        const readinessRes = await fetchWithCorrelation('/api/v1/kyc/readiness');
        const readinessBody = readinessRes.ok
          ? (await readinessRes.json() as ReadinessData)
          : null;

        const backendBlockReason =
          readinessBody && !readinessBody.can_submit
            ? readinessBody.blocking_reasons?.[0] || 'Dossier incomplet pour soumission.'
            : null;
        const offlineBlockReason = offlineStatus.canSubmit ? null : offlineStatus.blockingReason;

        setSubmitBlockedReason(offlineBlockReason || backendBlockReason);
        setBackendReadinessWarning(readinessBody?.warnings?.[0] || null);
      } catch (error) {
        console.error('Failed to compute offline submission gate:', error);
      }
    };

    void fetchSession();
    void refreshSubmissionGate();
  }, []);

  const docTypes = session?.documents?.map(d => d.doc_type) || [];
  const hasCni = docTypes.includes('CNI_RECTO') && docTypes.includes('CNI_VERSO');
  const hasSelfie = docTypes.includes('SELFIE');
  const hasBill = docTypes.some(d => d.startsWith('BILL_')) || !!billCapture;
  const hasConsent = session?.consent_record?.cgu_accepted;
  const hasSignature = !!signatureData;
  const hasAddress = !!address;
  const canSubmitOnlineChecklist = Boolean(hasCni && hasSelfie && hasConsent && hasBill && hasSignature);
  const canSubmit = canSubmitOnlineChecklist && !submitBlockedReason;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const offlineStatus = await getSubmissionBlockerStatus();
      const readinessRes = await fetchWithCorrelation('/api/v1/kyc/readiness');
      const readinessBody = readinessRes.ok
        ? (await readinessRes.json() as ReadinessData)
        : null;

      if (!offlineStatus.canSubmit) {
        setSubmitBlockedReason(offlineStatus.blockingReason);
        return;
      }
      if (readinessBody && !readinessBody.can_submit) {
        setSubmitBlockedReason(readinessBody.blocking_reasons?.[0] || 'Dossier incomplet pour soumission.');
        return;
      }

      const res = await fetchWithCorrelation('/api/v1/kyc/submit', {
        method: 'POST',
      });
      if (res.ok) {
        navigate('/kyc/submit-success');
      } else {
        const body = await res.json().catch(() => null);
        setSubmitBlockedReason(
          body?.detail || 'La soumission a echoue. Verifiez les etapes precedentes.',
        );
      }
    } catch (error) {
      console.error('Failed to submit KYC:', error);
      setSubmitBlockedReason('La soumission a echoue. Verifiez la connexion et reessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenLayout title={t('review.title')} showBack>
      <div className="flex flex-col gap-4 py-4">
        <h2 className="text-lg font-bold">{t('review.title')}</h2>
        <p className="text-sm text-muted-foreground">Vérifiez votre dossier avant soumission</p>

        <div className="space-y-3">
          {/* Identity */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <User className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t('review.identity') || 'Identité'}</p>
              <p className="text-xs text-muted-foreground">
                {hasCni ? '✓ CNI recto/verso' : '✗ CNI manquant'}
                {hasSelfie ? ' · ✓ Selfie' : ' · ✗ Selfie manquant'}
              </p>
            </div>
          </div>

          {/* Bill */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Receipt className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Justificatif de domicile</p>
              <p className="text-xs text-muted-foreground">
                {hasBill ? '✓ Facture (ENEO/CAMWATER)' : '✗ Facture manquante'}
              </p>
            </div>
          </div>

          {/* Address */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <MapPin className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t('review.address') || 'Adresse'}</p>
              <p className="text-xs text-muted-foreground">
                {hasAddress
                  ? `${address?.quartier}, ${address?.city}${address?.gps_lat ? ' · ✓ GPS' : ''}`
                  : '✗ Adresse non renseignée'}
              </p>
            </div>
          </div>

          {/* NIU */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <FileText className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">NIU</p>
              <p className="text-xs text-muted-foreground">
                {docTypes.includes('NIU') ? t('review.niu.yes') || '✓ NIU fourni' : t('review.niu.no') || 'Optionnel · non fourni'}
              </p>
            </div>
          </div>

          {/* Consent */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Shield className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t('review.consent') || 'Consentements'}</p>
              <p className="text-xs text-muted-foreground">
                {hasConsent ? t('review.consent.cgu') || '✓ CGU acceptées' : '✗ CGU non acceptées'}
              </p>
            </div>
          </div>

          {/* Signature */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <PenLine className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Signature électronique</p>
              <p className="text-xs text-muted-foreground">
                {hasSignature ? '✓ Signée électroniquement' : '✗ Signature manquante'}
              </p>
            </div>
            {signatureData && (
              <div className="w-12 h-8 bg-white border rounded overflow-hidden">
                <img src={signatureData} alt="Signature" className="w-full h-full object-contain" />
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
          {t('review.submit') || 'Soumettre le dossier KYC'}
        </button>
        {submitBlockedReason ? (
          <p className="text-xs text-red-600 mt-2 bg-red-50 px-3 py-2 rounded-lg">{submitBlockedReason}</p>
        ) : null}
        {!submitBlockedReason && backendReadinessWarning ? (
          <p className="text-xs text-amber-600 mt-2 bg-amber-50 px-3 py-2 rounded-lg">{backendReadinessWarning}</p>
        ) : null}
      </div>
    </ScreenLayout>
  );
}
