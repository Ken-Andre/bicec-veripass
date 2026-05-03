import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { ProgressStepper } from '../../components/ProgressStepper';
import { Shield, Lock } from 'lucide-react';

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

export default function CniIntroScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <ScreenLayoutV2 title={t('cni.intro.title')} showBack>
      <ProgressStepper steps={KYC_STEPS} currentStep={0} className="mb-6" />
      <div className="flex flex-col items-center gap-6 py-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Shield className="w-10 h-10 text-primary" />
        </div>

        <div className="text-center space-y-3 max-w-sm">
          <h2 className="text-xl font-bold">{t('cni.intro.title')}</h2>
          <p className="text-muted-foreground text-sm">{t('cni.intro.why')}</p>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="w-4 h-4" />
          <span>{t('cni.intro.secure')}</span>
        </div>

        <Button onClick={() => navigate('/kyc/cni-recto')}>
          {t('capture.open.camera')}
        </Button>
      </div>
    </ScreenLayoutV2>
  );
}
