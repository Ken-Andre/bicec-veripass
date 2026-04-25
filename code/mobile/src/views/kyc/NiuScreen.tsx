import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { FileText, SkipForward, AlertTriangle } from 'lucide-react';
import { fetchWithCorrelation } from '../../services/apiClient';
import { enqueueOfflineNiu } from '../../services/kycSyncService';

export default function NiuScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { completeStep, sessionId, setSessionId } = useKyc();
  const [mode, setMode] = useState<'choose' | 'manual' | 'upload'>('choose');
  const [niuValue, setNiuValue] = useState('');

  const handleSubmit = async (niuType: string) => {
    const sid = sessionId || `offline-${Date.now()}`;
    if (!sessionId) setSessionId(sid);

    const online = typeof navigator !== 'undefined' && navigator.onLine;
    if (online) {
      try {
        await fetchWithCorrelation('/api/v1/kyc/niu/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ niu_type: niuType, niu_value: niuType === 'DECLARATIVE' ? niuValue : undefined }),
        });
      } catch {
        // Online failed — enqueue for later sync
        await enqueueOfflineNiu({ sessionId: sid, niuType, niuValue: niuType === 'DECLARATIVE' ? niuValue : null });
      }
    } else {
      // Offline — enqueue for sync on reconnect
      await enqueueOfflineNiu({ sessionId: sid, niuType, niuValue: niuType === 'DECLARATIVE' ? niuValue : null });
    }
    completeStep('niu');
    navigate('/kyc/consent');
  };

  return (
    <ScreenLayout title={t('niu.title')} showBack>
      <div className="flex flex-col gap-4 py-4">
        {mode === 'choose' && (
          <>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <p className="text-sm text-yellow-800">{t('niu.skip.warning')}</p>
            </div>

            <button onClick={() => setMode('upload')} className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
              <FileText className="w-6 h-6 text-primary" />
              <div className="text-left">
                <p className="font-medium">{t('niu.upload')}</p>
              </div>
            </button>

            <button onClick={() => setMode('manual')} className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
              <FileText className="w-6 h-6 text-primary" />
              <div className="text-left">
                <p className="font-medium">{t('niu.manual')}</p>
                <p className="text-xs text-muted-foreground">{t('niu.format.hint')}</p>
              </div>
            </button>

            <button onClick={() => handleSubmit('MISSING')} className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors text-muted-foreground">
              <SkipForward className="w-6 h-6" />
              <div className="text-left">
                <p className="font-medium">{t('niu.skip')}</p>
              </div>
            </button>
          </>
        )}

        {mode === 'manual' && (
          <>
            <p className="text-sm text-muted-foreground">{t('niu.enter')}</p>
            <p className="text-xs text-muted-foreground">{t('niu.format.hint')}</p>
            <input
              type="text"
              value={niuValue}
              onChange={e => setNiuValue(e.target.value.toUpperCase())}
              placeholder="M123456789012"
              className="w-full px-3 py-3 rounded-lg border bg-background text-lg font-mono tracking-wider"
              maxLength={15}
            />
            <button
              onClick={() => handleSubmit('DECLARATIVE')}
              disabled={!/^M\d{10,14}$/.test(niuValue)}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium disabled:opacity-50"
            >
              {t('common.continue')}
            </button>
          </>
        )}

        {mode === 'upload' && (
          <>
            <p className="text-sm text-muted-foreground">{t('niu.upload')}</p>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Camera ouverte pour photographier l'attestation NIU</p>
            </div>
            <button onClick={() => handleSubmit('UPLOADED')} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium">
              {t('common.continue')}
            </button>
          </>
        )}
      </div>
    </ScreenLayout>
  );
}