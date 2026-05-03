import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { CelebrationOverlay } from '../../components/CelebrationOverlay';
import { CheckCircle, Clock, FileCheck, Building2, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function SubmitSuccessScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [showCelebration, setShowCelebration] = useState(true);

  // Auto-redirect to dashboard after 8s (user can click button for immediate navigation)
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 8000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <>
      <CelebrationOverlay
        show={showCelebration}
        title={t('celebration.title')}
        message={t('celebration.message')}
        onComplete={() => setShowCelebration(false)}
        autoHide={4000}
      />
      <ScreenLayoutV2 title={t('submit.success.title') || 'Dossier soumis'}>
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="w-24 h-24 bg-success/10 rounded-full flex items-center justify-center border-4 border-success/20">
            <CheckCircle className="w-14 h-14 text-success" />
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">
              {t('submit.success.heading') || 'Dossier soumis avec succes'}
            </h2>
            <p className="text-muted-foreground mt-2 max-w-xs mx-auto">
              {t('submit.success.message') || 'Votre dossier KYC a été soumis avec succès. Notre équipe va maintenant l\'examiner.'}
            </p>
          </div>

          <div className="w-full max-w-sm space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Clock className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{t('submit.success.timeline.review') || 'Revue en agence'}</p>
                <p className="text-xs text-muted-foreground">PENDING_KYC puis READY_FOR_OPS</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <FileCheck className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{t('submit.success.timeline.validation') || 'Validation & provisioning'}</p>
                <p className="text-xs text-muted-foreground">{'PROVISIONING -> VALIDATED_PENDING_AGENCY'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Building2 className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{t('submit.success.timeline.activation') || 'Activation des acces'}</p>
                <p className="text-xs text-muted-foreground">ACTIVATED_LIMITED ou ACTIVATED_PRE_FULL/FULL selon NIU</p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm space-y-3 mt-4">
            <Button onClick={() => navigate('/dashboard')}>
              {t('submit.success.goDashboard') || 'Aller au tableau de bord'}
              <ArrowRight className="w-4 h-4" />
            </Button>

            <Button variant="secondary" onClick={() => navigate('/')}>
              {t('common.backHome') || 'Retour à l\'accueil'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Un récapitulatif de votre dossier vous a été envoyé par email. Vous pouvez consulter l\'état de votre dossier à tout moment depuis votre tableau de bord.
          </p>
        </div>
      </ScreenLayoutV2>
    </>
  );
}
