import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { XCircle, ArrowRight, MessageCircle, RotateCcw } from 'lucide-react';

export default function RejectionScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { reviewStatus, resetKyc } = useKyc();

  const decision = reviewStatus?.decision;
  const reason = decision?.reason || t('rejection.noReason') || 'Aucun motif spécifié.';
  const decidedAt = decision?.decided_at
    ? new Date(decision.decided_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const handleRetry = () => {
    resetKyc();
    navigate('/kyc/intro');
  };

  return (
    <ScreenLayout title={t('rejection.title') || 'Dossier refusé'}>
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center border-4 border-red-100">
          <XCircle className="w-14 h-14 text-red-500" />
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800">
            {t('rejection.heading') || 'Votre dossier a été refusé'}
          </h2>
          <p className="text-muted-foreground mt-2 max-w-xs mx-auto">
            {t('rejection.subtitle') || 'Notre équipe de validation a examiné votre dossier et a pris la décision suivante.'}
          </p>
        </div>

        {/* Decision card */}
        <div className="w-full max-w-sm bg-red-50 border border-red-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm font-bold text-red-800">
              {t('rejection.decision') || 'Décision'}
            </span>
          </div>
          <p className="text-sm text-red-700 leading-relaxed">{reason}</p>
          {decidedAt && (
            <p className="text-xs text-red-400">
              {t('rejection.decidedAt') || 'Le'} {decidedAt}
            </p>
          )}
        </div>

        {/* What Marie can do */}
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={handleRetry}
            className="w-full flex items-center justify-center gap-3 bg-primary text-primary-foreground py-4 rounded-2xl font-semibold text-base shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
          >
            <RotateCcw className="w-5 h-5" />
            {t('rejection.retry') || 'Recommencer la procédure KYC'}
          </button>

          <button
            onClick={() => navigate('/support')}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 py-4 rounded-2xl font-medium active:scale-[0.98] transition-all"
          >
            <MessageCircle className="w-5 h-5" />
            {t('rejection.contactSupport') || 'Contacter le support'}
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground py-2"
          >
            {t('rejection.backDashboard') || 'Retour au tableau de bord'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center max-w-xs leading-relaxed">
          {t('rejection.help') || 'Si vous pensez qu\'il s\'agit d\'une erreur, contactez notre support ou rendez-vous en agence BICEC avec vos documents originaux.'}
        </p>
      </div>
    </ScreenLayout>
  );
}
