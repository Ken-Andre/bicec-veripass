import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { ProgressStepper } from '../../components/ProgressStepper';
import { ArrowRight, Clock } from 'lucide-react';

const KYC_PHASES = [
  { label: 'Identité', sublabel: 'CNI + Selfie', duration: '~5 min' },
  { label: 'Adresse', sublabel: 'Justificatif + GPS', duration: '~3 min' },
  { label: 'Consentement', sublabel: 'CGU + Signature', duration: '~1 min' },
  { label: 'Soumission', sublabel: 'Revue + Envoi', duration: '~1 min' },
];

export default function ProgressTimelineScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <ScreenLayout title={t('kyc.progress.title') || 'Ouverture de compte'}>
      <div className="flex flex-col gap-8 py-4">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-slate-800">
            {t('kyc.progress.heading') || 'Votre parcours'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('kyc.progress.subtitle') || 'Voici les étapes à compléter pour ouvrir votre compte.'}
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Clock className="w-4 h-4" />
            {t('kyc.progress.duration') || '~10 minutes'}
          </div>
        </div>

        <ProgressStepper
          steps={KYC_PHASES}
          currentStep={0}
          variant="vertical"
        />

        <button
          onClick={() => navigate('/kyc/cni-intro')}
          className="w-full flex items-center justify-center gap-3 bg-primary text-primary-foreground py-4 rounded-2xl font-semibold text-base shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
        >
          {t('kyc.progress.start') || 'Commencer'}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </ScreenLayout>
  );
}
