import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { AlertTriangle, FileText, Loader2, SkipForward, Upload } from 'lucide-react';
import { fetchWithCorrelation } from '../../services/apiClient';
import { enqueueOfflineNiu } from '../../services/kycSyncService';

export default function NiuScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { completeStep, sessionId, setSessionId } = useKyc();
  const [mode, setMode] = useState<'choose' | 'manual' | 'upload'>('choose');
  const [niuValue, setNiuValue] = useState('');
  const [niuFile, setNiuFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDeclarativeNiuValid = /^[A-Z0-9]{14}$/.test(niuValue);

  const normalizeNiuValue = (value: string): string =>
    value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14);

  const toHex = (buffer: ArrayBuffer): string =>
    Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

  const computeSha256 = async (blob: Blob): Promise<string | null> => {
    try {
      if (!globalThis.crypto?.subtle) return null;
      const bytes = await blob.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return toHex(digest);
    } catch {
      return null;
    }
  };

  const handleSubmit = async (niuType: string) => {
    const sid = sessionId || `offline-${Date.now()}`;
    if (!sessionId) setSessionId(sid);
    setError(null);

    const online = typeof navigator !== 'undefined' && navigator.onLine;
    if (online) {
      try {
        const response = await fetchWithCorrelation('/api/v1/kyc/niu/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ niu_type: niuType, niu_value: niuType === 'DECLARATIVE' ? niuValue : undefined }),
        });
        if (!response.ok) {
          throw new Error(`niu_submit_failed_${response.status}`);
        }
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

  const handleUploadSubmit = async () => {
    if (!niuFile) {
      setError('Selectionnez une attestation NIU avant de continuer.');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('Connexion requise pour envoyer une attestation NIU.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', niuFile, niuFile.name || 'attestation_niu.jpg');
      formData.append('doc_type', 'NIU');
      const clientSha = await computeSha256(niuFile);
      if (clientSha) {
        formData.append('client_sha256', clientSha);
      }

      const uploadResponse = await fetchWithCorrelation('/api/v1/kyc/document/upload', {
        method: 'POST',
        body: formData,
      });
      if (!uploadResponse.ok) {
        const detail = await uploadResponse.json().catch(() => null);
        const detailRecord = detail && typeof detail === 'object' ? detail as Record<string, unknown> : {};
        const nested = detailRecord.detail && typeof detailRecord.detail === 'object'
          ? detailRecord.detail as Record<string, unknown>
          : {};
        const code = detailRecord.code || nested.code;
        if (code !== 'DUPLICATE_DOCUMENT') {
          throw new Error(`niu_upload_failed_${uploadResponse.status}`);
        }
      }

      await handleSubmit('UPLOADED');
    } catch {
      setError('Attestation NIU non acceptee. Verifiez le fichier et reessayez.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScreenLayoutV2 title={t('niu.title')} showBack>
      <div className="flex flex-col gap-4 py-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <AlertTriangle className="w-5 h-5 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

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
              onChange={e => setNiuValue(normalizeNiuValue(e.target.value))}
              placeholder="M012345678901A"
              className="w-full px-3 py-3 rounded-lg border bg-background text-lg font-mono tracking-wider"
              maxLength={14}
              inputMode="text"
              autoCapitalize="characters"
            />
            <Button
              onClick={() => handleSubmit('DECLARATIVE')}
              disabled={!isDeclarativeNiuValid}
            >
              {t('common.continue')}
            </Button>
          </>
        )}

        {mode === 'upload' && (
          <>
            <p className="text-sm text-muted-foreground">{t('niu.upload')}</p>
            <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-3">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Ajoutez une photo ou un PDF de votre attestation NIU.</p>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(event) => setNiuFile(event.target.files?.[0] ?? null)}
                className="w-full text-sm"
              />
              {niuFile && (
                <p className="text-xs text-muted-foreground truncate">{niuFile.name}</p>
              )}
            </div>
            <Button onClick={handleUploadSubmit} disabled={!niuFile || uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t('common.continue')}
            </Button>
          </>
        )}
      </div>
    </ScreenLayoutV2>
  );
}
