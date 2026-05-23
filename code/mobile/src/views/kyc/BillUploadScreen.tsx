import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { Upload, FileImage, AlertCircle, Loader2, CheckCircle, XCircle, WifiOff } from 'lucide-react';
import { captureKycException } from '../../services/sentry';
import { fetchWithCorrelation } from '../../services/apiClient';
import { enqueueOfflineBill } from '../../services/kycSyncService';
import { compressForUpload } from '../../utils/imageCompression';

type BillType = 'ENEO' | 'CAMWATER';

const MAX_FILE_SIZE_MB = 1;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
const UPLOAD_TIMEOUT_MS = 180_000; // 3 minutes

export default function BillUploadScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setBillCapture, completeStep, sessionId, setSessionId } = useKyc();

  const billType: BillType = (location.state as { billType?: BillType })?.billType ?? 'ENEO';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const ensureSessionId = useCallback(() => {
    if (sessionId) return sessionId;
    const generated = `offline-${Date.now()}`;
    setSessionId(generated);
    return generated;
  }, [sessionId, setSessionId]);

  const computeSha256 = useCallback(async (blob: Blob): Promise<string | null> => {
    try {
      if (!globalThis.crypto?.subtle) return null;
      const bytes = await blob.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return null;
    }
  }, []);

  // Elapsed timer during upload
  useEffect(() => {
    if (!uploading) return;
    const resetTimer = window.setTimeout(() => setElapsed(0), 0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      clearTimeout(resetTimer);
      clearInterval(timer);
    };
  }, [uploading]);

  const uploadBill = useCallback(async (blob: Blob, dataUrl: string) => {
    const clientSha = await computeSha256(blob);
    const sid = ensureSessionId();
    const online = typeof navigator !== 'undefined' && navigator.onLine;

    if (online) {
      try {
        const formData = new FormData();
        formData.append('file', blob, `bill_${billType.toLowerCase()}.jpg`);
        formData.append('bill_type', billType);
        if (sid) formData.append('session_id', sid);
        if (clientSha) formData.append('client_sha256', clientSha);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

        const res = await fetchWithCorrelation('/api/v1/kyc/capture/bill', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          if (res.status === 504) {
            // Gateway timeout — backend is still processing, queue offline
            captureKycException(new Error('bill_upload_504_gateway_timeout'), 'upload_failure', {
              sessionId: sid,
              step: 'utility_bill',
              operation: 'upload_bill_504',
              extra: { bill_type: billType },
            });
            await enqueueOfflineBill({ sessionId: sid, billType, fileDataUrl: dataUrl, clientSha256: clientSha });
            return;
          }
          throw new Error(`upload_bill_failed_${res.status}`);
        }
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Client-side timeout — queue offline
          captureKycException(new Error('bill_upload_client_timeout'), 'upload_failure', {
            sessionId: sid,
            step: 'utility_bill',
            operation: 'upload_bill_timeout',
            extra: { bill_type: billType, elapsed_s: elapsed },
          });
          await enqueueOfflineBill({ sessionId: sid, billType, fileDataUrl: dataUrl, clientSha256: clientSha });
          return;
        }
        captureKycException(err, 'upload_failure', {
          sessionId: sid,
          step: 'utility_bill',
          operation: 'upload_bill',
          extra: { bill_type: billType },
        });
      }
    }

    await enqueueOfflineBill({ sessionId: sid, billType, fileDataUrl: dataUrl, clientSha256: clientSha });
  }, [billType, computeSha256, ensureSessionId, elapsed]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Format non supporte. Utilisez JPG, PNG ou PDF.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`Le fichier est trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Taille maximale : ${MAX_FILE_SIZE_MB} Mo.`);
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);

    if (file.type === 'application/pdf') {
      setPreview(null);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }

    setUploading(true);
    try {
      const compressed = await compressForUpload(file);
      setCompressedSize(compressed.size);

      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(compressed);
      });

      await uploadBill(compressed, dataUrl);
      setUploadDone(true);

      setBillCapture(dataUrl);
      completeStep('utility_bill');

      setTimeout(() => navigate('/kyc/niu'), 800);
    } catch (err) {
      setError('Erreur lors de l\'envoi. Veuillez reessayer.');
      captureKycException(err, 'upload_failure', {
        sessionId,
        step: 'utility_bill',
        operation: 'upload_bill_process',
      });
    } finally {
      setUploading(false);
    }
  }, [uploadBill, setBillCapture, completeStep, navigate, sessionId]);

  const billLabel = billType === 'ENEO' ? 'ENEO (electricite)' : 'CAMWATER (eau)';

  return (
    <ScreenLayoutV2 title="Facture" showBack>
      <div className="flex flex-col gap-6 py-6 w-full max-w-sm mx-auto">
        {/* Header */}
        <div className="text-center">
          <FileImage className="w-12 h-12 mx-auto text-primary mb-3" />
          <h2 className="text-xl font-bold text-foreground">Importer votre facture</h2>
          <p className="text-sm text-muted-foreground mt-1">{billLabel}</p>
        </div>

        {/* Size limits info */}
        <div className="flex items-start gap-3 bg-accent/10 text-accent p-4 rounded-xl border border-accent/20">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Taille maximale : {MAX_FILE_SIZE_MB} Mo</p>
            <p className="text-accent mt-1">Formats : JPG, PNG, PDF</p>
            <p className="text-accent">Les images sont compressees automatiquement pour un envoi rapide.</p>
          </div>
        </div>

        {/* Upload button */}
        {!preview && !uploadDone && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-4 w-full h-48 rounded-2xl border-2 border-dashed border-border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors active:scale-[0.98]"
          >
            {uploading ? (
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            ) : (
              <Upload className="w-10 h-10 text-muted-foreground" />
            )}
            <div className="text-center">
              <p className="font-bold">{uploading ? 'Envoi en cours...' : 'Choisir un fichier'}</p>
              {uploading ? (
                <p className="text-sm text-muted-foreground mt-1">Depuis {elapsed}s — patientez</p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">Appuyez pour parcourir vos fichiers</p>
              )}
            </div>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Preview */}
        {preview && (
          <div className="relative rounded-2xl overflow-hidden border border-border">
            <img src={preview} alt="Apercu facture" className="w-full h-auto max-h-64 object-contain bg-muted" />
            {uploadDone && (
              <div className="absolute inset-0 bg-success/20 flex items-center justify-center">
                <CheckCircle className="w-16 h-16 text-success" />
              </div>
            )}
          </div>
        )}

        {/* File info */}
        {fileName && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl text-sm">
            <FileImage className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{fileName}</p>
              <p className="text-muted-foreground">
                {(fileSize / 1024 / 1024).toFixed(2)} Mo
                {compressedSize !== null && compressedSize !== fileSize && (
                  <span className="text-success ml-2">
                    → {(compressedSize / 1024).toFixed(0)} Ko
                  </span>
                )}
              </p>
            </div>
            {uploadDone && <CheckCircle className="w-5 h-5 text-success" />}
          </div>
        )}

        {/* Uploading feedback */}
        {uploading && (
          <div className="flex items-start gap-3 bg-warning/10 text-warning p-4 rounded-xl border border-warning/20">
            <Loader2 className="w-5 h-5 shrink-0 mt-0.5 animate-spin" />
            <div className="text-sm">
              <p className="font-semibold">Envoi en cours... ({elapsed}s)</p>
              <p className="text-warning mt-1">La facture est envoyee et analysee. Ceci peut prendre un moment sur connexion lente.</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 bg-destructive/10 text-destructive p-4 rounded-xl border border-destructive/20">
            {error.includes('synchronisee') ? (
              <WifiOff className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Retry on error */}
        {error && !uploading && (
          <Button
            onClick={() => { setError(''); fileInputRef.current?.click(); }}
            className="w-full"
          >
            Reessayer
          </Button>
        )}
      </div>
    </ScreenLayoutV2>
  );
}
