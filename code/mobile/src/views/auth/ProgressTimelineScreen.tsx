import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
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
    <ScreenLayoutV2 title={t('kyc.progress.title') || 'Ouverture de compte'}>
      <div className="flex flex-col gap-8 py-4">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-foreground">
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

        <Button onClick={() => navigate('/kyc/cni-intro')}>
          {t('kyc.progress.start') || 'Commencer'}
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </ScreenLayoutV2>
  );
}
