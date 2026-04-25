import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { fetchWithCorrelation } from '../../services/apiClient';
import { enqueueOfflineConsent } from '../../services/kycSyncService';
import { CheckSquare, Square, FileText } from 'lucide-react';

const Checkbox = ({ checked, onClick }: { checked: boolean; onClick: () => void }) => (
  <button onClick={onClick} className="flex-shrink-0">
    {checked ? <CheckSquare className="w-6 h-6 text-primary" /> : <Square className="w-6 h-6 text-muted-foreground" />}
  </button>
);

export default function ConsentScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { completeStep, sessionId, setSessionId } = useKyc();
  const [consents, setConsents] = useState({ cgu: false, privacy: false, data: false });

  const allAccepted = consents.cgu && consents.privacy && consents.data;

  const toggle = (key: keyof typeof consents) => {
    setConsents(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async () => {
    if (!allAccepted) return;
    const sid = sessionId || `offline-${Date.now()}`;
    if (!sessionId) setSessionId(sid);

    const online = typeof navigator !== 'undefined' && navigator.onLine;
    if (online) {
      try {
        await fetchWithCorrelation('/api/v1/kyc/consent/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cgu_accepted: true,
            privacy_accepted: true,
            data_processing_accepted: true,
          }),
        });
      } catch (error) {
        console.error('Failed to submit consent:', error);
        // Online failed — enqueue for later sync
        await enqueueOfflineConsent({
          sessionId: sid,
          cguAccepted: true,
          privacyAccepted: true,
          dataProcessingAccepted: true,
        });
      }
    } else {
      // Offline — enqueue for sync on reconnect
      await enqueueOfflineConsent({
        sessionId: sid,
        cguAccepted: true,
        privacyAccepted: true,
        dataProcessingAccepted: true,
      });
    }
    completeStep('consent');
    navigate('/kyc/signature');
  };

  return (
    <ScreenLayout title={t('consent.title')} showBack>
      <div className="flex flex-col gap-4 py-4">
        <button onClick={() => toggle('cgu')} className="flex items-start gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
          <Checkbox checked={consents.cgu} onClick={() => toggle('cgu')} />
          <div className="text-left">
            <p className="font-medium">{t('consent.cgu')}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <FileText className="w-3 h-3" /> {t('consent.readDoc')}
            </p>
          </div>
        </button>

        <button onClick={() => toggle('privacy')} className="flex items-start gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
          <Checkbox checked={consents.privacy} onClick={() => toggle('privacy')} />
          <div className="text-left">
            <p className="font-medium">{t('consent.privacy')}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <FileText className="w-3 h-3" /> {t('consent.readDoc')}
            </p>
          </div>
        </button>

        <button onClick={() => toggle('data')} className="flex items-start gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
          <Checkbox checked={consents.data} onClick={() => toggle('data')} />
          <div className="text-left">
            <p className="font-medium">{t('consent.data')}</p>
          </div>
        </button>

        <button
          onClick={handleSubmit}
          disabled={!allAccepted}
          className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium disabled:opacity-50 mt-4"
        >
          {t('consent.submit')}
        </button>
      </div>
    </ScreenLayout>
  );
}