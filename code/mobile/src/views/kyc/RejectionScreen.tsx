import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
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
    <ScreenLayoutV2 title={t('rejection.title') || 'Dossier refusé'}>
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center border-4 border-destructive/20">
          <XCircle className="w-14 h-14 text-destructive" />
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">
            {t('rejection.heading') || 'Votre dossier a été refusé'}
          </h2>
          <p className="text-muted-foreground mt-2 max-w-xs mx-auto">
            {t('rejection.subtitle') || 'Notre équipe de validation a examiné votre dossier et a pris la décision suivante.'}
          </p>
        </div>

        {/* Decision card */}
        <div className="w-full max-w-sm bg-destructive/10 border border-destructive/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-destructive" />
            <span className="text-sm font-bold text-destructive">
              {t('rejection.decision') || 'Décision'}
            </span>
          </div>
          <p className="text-sm text-destructive/80 leading-relaxed">{reason}</p>
          {decidedAt && (
            <p className="text-xs text-destructive/50">
              {t('rejection.decidedAt') || 'Le'} {decidedAt}
            </p>
          )}
        </div>

        {/* What Marie can do */}
        <div className="w-full max-w-sm space-y-3">
          <Button onClick={handleRetry}>
            <RotateCcw className="w-5 h-5" />
            {t('rejection.retry') || 'Recommencer la procédure KYC'}
          </Button>

          <Button variant="secondary" onClick={() => navigate('/support')}>
            <MessageCircle className="w-5 h-5" />
            {t('rejection.contactSupport') || 'Contacter le support'}
          </Button>

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
    </ScreenLayoutV2>
  );
}
