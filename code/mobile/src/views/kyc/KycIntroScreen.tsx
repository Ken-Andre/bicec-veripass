import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { ProgressStepper } from '../../components/ProgressStepper';
import { FileText, Camera, CheckCircle, Shield } from 'lucide-react';
import { useKyc } from '../../contexts/KycContext';
import { fetchWithCorrelation } from '../../services/apiClient';

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

export default function KycIntroScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { setSessionId, basicProfile, documentChoice } = useKyc();
  const [starting, setStarting] = useState(false);

  const ensureKycSession = async () => {
    if (!basicProfile) {
      navigate('/kyc/basic-profile');
      return;
    }
    if (!documentChoice) {
      navigate('/kyc/document-choice');
      return;
    }
    if (starting) return;
    setStarting(true);
    try {
      const res = await fetchWithCorrelation('/api/v1/kyc/session/start', {
        method: 'POST',
      });
      if (res.ok) {
        const data = (await res.json()) as { session_id?: string };
        if (data.session_id) {
          setSessionId(data.session_id);
        }
      }
    } catch {
      setSessionId(`offline-${Date.now()}`);
    } finally {
      setStarting(false);
      navigate('/kyc/document-choice');
    }
  };

  return (
    <ScreenLayoutV2 title={t('kyc.progress.title')} showBack>
      <ProgressStepper steps={KYC_STEPS} currentStep={0} className="mb-6" />
      <div className="flex flex-col items-center gap-6 py-4">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">{t('kyc.whatYouNeed.title')}</h2>
          <p className="text-muted-foreground">{t('kyc.whatYouNeed.time')}</p>
        </div>

        <div className="w-full space-y-3">
          {t('kyc.whatYouNeed.cni') && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
              <FileText className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">{t('kyc.whatYouNeed.cni')}</span>
            </div>
          )}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
            <Camera className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">{t('kyc.whatYouNeed.selfie')}</span>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
            <Shield className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">{t('kyc.whatYouNeed.address')}</span>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
            <CheckCircle className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">{t('kyc.whatYouNeed.niu')}</span>
          </div>
        </div>

        <Button
          onClick={ensureKycSession}
          loading={starting}
          disabled={starting}
        >
          {t('kyc.whatYouNeed.ready')}
        </Button>
      </div>
    </ScreenLayoutV2>
  );
}
