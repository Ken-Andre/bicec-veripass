import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { fetchWithCorrelation } from '../../services/apiClient';
import { enqueueOfflineConsent } from '../../services/kycSyncService';
import { CheckSquare, Square, FileText } from 'lucide-react';

type ConsentKey = 'cgu' | 'privacy' | 'data';

type Consents = Record<ConsentKey, boolean>;

function ConsentRow({
  keyName,
  title,
  showDoc = false,
  checked,
  onToggle,
  t,
}: {
  keyName: ConsentKey;
  title: string;
  showDoc?: boolean;
  checked: boolean;
  onToggle: (key: ConsentKey) => void;
  t: (key: string) => string;
}) {
  return (
    <label
      data-testid="consent-row"
      className="relative flex items-start gap-3 p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors cursor-pointer"
    >
      <input
        type="checkbox"
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        checked={checked}
        onChange={() => onToggle(keyName)}
      />
      {checked ? (
        <CheckSquare className="w-6 h-6 text-primary shrink-0" />
      ) : (
        <Square className="w-6 h-6 text-muted-foreground shrink-0" />
      )}
      <div className="text-left flex-1">
        <p className="font-medium text-foreground">{title}</p>
        {showDoc && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <FileText className="w-3 h-3" /> {t('consent.readDoc')}
          </p>
        )}
      </div>
    </label>
  );
}

export default function ConsentScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { completeStep, sessionId, setSessionId } = useKyc();
  const [consents, setConsents] = useState<Consents>({ cgu: false, privacy: false, data: false });
  const [submitting, setSubmitting] = useState(false);

  const allAccepted = consents.cgu && consents.privacy && consents.data;

  const toggle = (key: ConsentKey) => {
    setConsents(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async () => {
    if (!allAccepted) return;
    setSubmitting(true);
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
        await enqueueOfflineConsent({
          sessionId: sid,
          cguAccepted: true,
          privacyAccepted: true,
          dataProcessingAccepted: true,
        });
      }
    } else {
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
    <ScreenLayoutV2 title={t('consent.title')} showBack>
      <div className="flex flex-col gap-4 py-4">
        <ConsentRow keyName="cgu" title={t('consent.cgu')} showDoc checked={consents.cgu} onToggle={toggle} t={t} />
        <ConsentRow keyName="privacy" title={t('consent.privacy')} showDoc checked={consents.privacy} onToggle={toggle} t={t} />
        <ConsentRow keyName="data" title={t('consent.data')} checked={consents.data} onToggle={toggle} t={t} />

        <div className="pt-4">
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={!allAccepted}
          >
            {t('consent.submit')}
          </Button>
        </div>
      </div>
    </ScreenLayoutV2>
  );
}
