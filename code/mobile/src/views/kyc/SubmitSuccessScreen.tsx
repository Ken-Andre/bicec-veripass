import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { CheckCircle, Clock, FileCheck, Building2, ArrowRight } from 'lucide-react';
import { useKyc } from '../../contexts/KycContext';
import { useEffect } from 'react';

export default function SubmitSuccessScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { resetKyc } = useKyc();

  useEffect(() => {
    // Clear KYC state after successful submission
    const timer = setTimeout(() => {
      resetKyc();
    }, 500);
    return () => clearTimeout(timer);
  }, [resetKyc]);

  return (
    <ScreenLayout title={t('submit.success.title') || 'Dossier soumis'}>
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center border-4 border-green-100">
          <CheckCircle className="w-14 h-14 text-green-500" />
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800">
            {t('submit.success.heading') || 'Félicitations Marie !'}
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
              <p className="text-xs text-muted-foreground">24-48 heures ouvrées</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
            <FileCheck className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium">{t('submit.success.timeline.validation') || 'Validation finale'}</p>
              <p className="text-xs text-muted-foreground">Notification par SMS/email</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
            <Building2 className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium">{t('submit.success.timeline.activation') || 'Activation du compte'}</p>
              <p className="text-xs text-muted-foreground">Accès complet ou limité selon validation</p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-3 mt-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-lg font-medium"
          >
            {t('submit.success.goDashboard') || 'Aller au tableau de bord'}
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => navigate('/')}
            className="w-full py-3 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
          >
            {t('common.backHome') || 'Retour à l\'accueil'}
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Un récapitulatif de votre dossier vous a été envoyé par email. Vous pouvez consulter l\'état de votre dossier à tout moment depuis votre tableau de bord.
        </p>
      </div>
    </ScreenLayout>
  );
}
