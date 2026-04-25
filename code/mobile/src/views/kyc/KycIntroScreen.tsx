import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { FileText, Camera, CheckCircle, Shield } from 'lucide-react';
import { useKyc } from '../../contexts/KycContext';
import { fetchWithCorrelation } from '../../services/apiClient';

export default function KycIntroScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { setSessionId } = useKyc();
  const [starting, setStarting] = useState(false);

  const ensureKycSession = async () => {
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
      navigate('/kyc/cni-intro');
    }
  };

  return (
    <ScreenLayout title={t('kyc.progress.title')} showBack>
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">{t('kyc.whatYouNeed.title')}</h2>
          <p className="text-muted-foreground">{t('kyc.whatYouNeed.time')}</p>
        </div>

        <div className="w-full space-y-3">
          {t('kyc.whatYouNeed.cni') && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <FileText className="w-5 h-5 text-primary" />
              <span>{t('kyc.whatYouNeed.cni')}</span>
            </div>
          )}
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
            <Camera className="w-5 h-5 text-primary" />
            <span>{t('kyc.whatYouNeed.selfie')}</span>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
            <Shield className="w-5 h-5 text-primary" />
            <span>{t('kyc.whatYouNeed.address')}</span>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
            <CheckCircle className="w-5 h-5 text-primary" />
            <span>{t('kyc.whatYouNeed.niu')}</span>
          </div>
        </div>

        <button
          onClick={ensureKycSession}
          disabled={starting}
          className="w-full max-w-sm bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {t('kyc.whatYouNeed.ready')}
        </button>
      </div>
    </ScreenLayout>
  );
}
