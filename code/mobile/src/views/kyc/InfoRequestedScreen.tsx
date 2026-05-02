import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { apiClient } from '../../services/apiClient';
import { Info, ArrowRight, MessageCircle, CheckCircle, Loader2 } from 'lucide-react';

export default function InfoRequestedScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { reviewStatus, setStatus, setAccessLevel } = useKyc();
  const [resubmitting, setResubmitting] = useState(false);

  const decision = reviewStatus?.decision;
  const reason = decision?.reason || t('infoRequested.noReason') || 'Informations complémentaires requises.';
  const decidedAt = decision?.decided_at
    ? new Date(decision.decided_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const handleResubmit = async () => {
    setResubmitting(true);
    try {
      // Start a new KYC session for resubmission
      const res = await apiClient.post<{ session_id: string }, Record<string, never>>('/kyc/session/start', {});
      if (res?.session_id) {
        setStatus('IN_PROGRESS');
        setAccessLevel('GUEST');
        navigate('/kyc/cni-intro');
      }
    } catch {
      // Fallback: just navigate to restart the flow
      navigate('/kyc/cni-intro');
    } finally {
      setResubmitting(false);
    }
  };

  return (
    <ScreenLayout title={t('infoRequested.title') || 'Informations requises'}>
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center border-4 border-amber-100">
          <Info className="w-14 h-14 text-amber-500" />
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800">
            {t('infoRequested.heading') || 'Informations complémentaires requises'}
          </h2>
          <p className="text-muted-foreground mt-2 max-w-xs mx-auto">
            {t('infoRequested.subtitle') || 'Notre équipe de validation a besoin d\'informations supplémentaires pour traiter votre dossier.'}
          </p>
        </div>

        {/* Agent request card */}
        <div className="w-full max-w-sm bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-bold text-amber-800">
              {t('infoRequested.agentRequest') || 'Demande de l\'agent'}
            </span>
          </div>
          <p className="text-sm text-amber-700 leading-relaxed">{reason}</p>
          {decidedAt && (
            <p className="text-xs text-amber-400">
              {t('infoRequested.requestedAt') || 'Demandé le'} {decidedAt}
            </p>
          )}
        </div>

        {/* What Marie should do */}
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={handleResubmit}
            disabled={resubmitting}
            className="w-full flex items-center justify-center gap-3 bg-primary text-primary-foreground py-4 rounded-2xl font-semibold text-base shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {resubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            {resubmitting
              ? (t('infoRequested.resubmitting') || 'Préparation...')
              : (t('infoRequested.resubmit') || 'Fournir les informations')}
          </button>

          <button
            onClick={() => navigate('/support')}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 py-4 rounded-2xl font-medium active:scale-[0.98] transition-all"
          >
            <MessageCircle className="w-5 h-5" />
            {t('infoRequested.contactSupport') || 'Contacter le support'}
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground py-2"
          >
            {t('infoRequested.backDashboard') || 'Retour au tableau de bord'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center max-w-xs leading-relaxed">
          {t('infoRequested.help') || 'Vous pouvez fournir les documents manquants directement depuis l\'application ou vous rendre en agence BICEC.'}
        </p>
      </div>
    </ScreenLayout>
  );
}
