import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { useKyc } from '../../contexts/KycContext';
import {
  Camera,
  Upload,
  AlertTriangle,
  X,
  CheckCircle,
  Loader2,
  FileImage,
  PenLine,
} from 'lucide-react';
import { captureKycException } from '../../services/sentry';
import { fetchWithCorrelation } from '../../services/apiClient';
import { enqueueOfflineSignature } from '../../services/kycSyncService';
import { compressForUpload } from '../../utils/imageCompression';

type ScreenState = 'instructions' | 'camera' | 'review' | 'uploading';

const MAX_FILE_SIZE_MB = 10;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
const UPLOAD_TIMEOUT_MS = 180_000;

export default function SignatureScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { completeStep, sessionId, setSessionId } = useKyc();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const capturedRef = useRef(false);

  const [state, setState] = useState<ScreenState>('instructions');
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const ensureSessionId = useCallback(() => {
    if (sessionId) return sessionId;
    const generated = `offline-${Date.now()}`;
    setSessionId(generated);
    return generated;
  }, [sessionId, setSessionId]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const computeSha256 = useCallback(async (blob: Blob): Promise<string | null> => {
    try {
      if (!globalThis.crypto?.subtle) return null;
      const bytes = await blob.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      return null;
    }
  }, []);

  const uploadSignatureSheet = useCallback(
    async (blob: Blob, dataUrl: string) => {
      const clientSha = await computeSha256(blob);
      const sid = ensureSessionId();
      const online = typeof navigator !== 'undefined' && navigator.onLine;

      if (online) {
        try {
          const formData = new FormData();
          formData.append('file', blob, 'signature_sheet.jpg');
          formData.append('doc_type', 'SIGNATURE_SHEET');
          if (sid) formData.append('session_id', sid);
          if (clientSha) formData.append('client_sha256', clientSha);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

          const uploadRes = await fetchWithCorrelation('/api/v1/kyc/document/upload', {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!uploadRes.ok) {
            if (uploadRes.status === 504) {
              captureKycException(
                new Error('signature_sheet_upload_504'),
                'upload_failure',
                { sessionId: sid, step: 'signature', operation: 'signature_sheet_upload_504' },
              );
              await enqueueOfflineSignature({ sessionId: sid, fileDataUrl: dataUrl });
              return;
            }
            throw new Error(`signature_sheet_upload_failed_${uploadRes.status}`);
          }

          const uploadData = await uploadRes.json();

          const submitRes = await fetchWithCorrelation('/api/v1/kyc/signature/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ document_id: uploadData.id }),
          });

          if (!submitRes.ok) {
            captureKycException(
              new Error(`signature_submit_failed_${submitRes.status}`),
              'upload_failure',
              { sessionId: sid, step: 'signature', operation: 'signature_submit' },
            );
            await enqueueOfflineSignature({ sessionId: sid, fileDataUrl: dataUrl });
            return;
          }

          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            captureKycException(
              new Error('signature_sheet_upload_timeout'),
              'upload_failure',
              { sessionId: sid, step: 'signature', operation: 'signature_sheet_upload_timeout' },
            );
            await enqueueOfflineSignature({ sessionId: sid, fileDataUrl: dataUrl });
            return;
          }
          captureKycException(err, 'upload_failure', {
            sessionId: sid,
            step: 'signature',
            operation: 'signature_sheet_upload',
          });
        }
      }

      await enqueueOfflineSignature({ sessionId: sid, fileDataUrl: dataUrl });
    },
    [computeSha256, ensureSessionId],
  );

  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available (requires HTTPS or localhost).');
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current
            ?.play()
            .then(() => setCameraReady(true))
            .catch(() => setCameraReady(true));
        };
        setTimeout(() => setCameraReady(true), 2000);
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      captureKycException(error, 'camera_error', {
        sessionId,
        step: 'signature',
        operation: 'signature_camera_init',
      });
      setError(`${t('capture.camera.error') || 'Erreur camera'} - ${error.message}`);
    }
  }, [t, sessionId]);

  const doCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || capturedRef.current) return;
    capturedRef.current = true;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d')!;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const rawBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((nextBlob) => resolve(nextBlob), 'image/jpeg', 0.9);
      });
      if (!rawBlob) {
        capturedRef.current = false;
        return;
      }

      const compressed = await compressForUpload(rawBlob);

      if (compressed.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(
          `Image trop volumineuse (${(compressed.size / 1024 / 1024).toFixed(1)} Mo). Max : ${MAX_FILE_SIZE_MB} Mo.`,
        );
        capturedRef.current = false;
        return;
      }

      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(compressed);
      });

      stopCamera();
      setCapturedImage(dataUrl);
      setCapturedBlob(compressed);
      setState('review');
    } catch (err) {
      captureKycException(err, 'upload_failure', {
        sessionId,
        step: 'signature',
        operation: 'signature_doCapture',
      });
      setError('Erreur lors de la capture. Veuillez reessayer.');
      capturedRef.current = false;
    }
  }, [stopCamera, sessionId]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError('');

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Format non supporte. Utilisez JPG ou PNG.');
        return;
      }

      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(
          `Le fichier est trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Taille maximale : ${MAX_FILE_SIZE_MB} Mo.`,
        );
        return;
      }

      const compressed = await compressForUpload(file);

      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(compressed);
      });

      setCapturedImage(dataUrl);
      setCapturedBlob(compressed);
      setState('review');
    },
    [],
  );

  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    setCapturedBlob(null);
    setState('instructions');
    setError('');
    capturedRef.current = false;
  }, []);

  const handleOpenCamera = useCallback(() => {
    setError('');
    capturedRef.current = false;
    setState('camera');
    void startCamera();
  }, [startCamera]);

  const handleConfirm = useCallback(async () => {
    if (!capturedBlob || !capturedImage) return;
    setState('uploading');
    setUploading(true);
    try {
      await uploadSignatureSheet(capturedBlob, capturedImage);
      completeStep('signature');
      navigate('/kyc/ocr-review');
    } catch (err) {
      captureKycException(err, 'upload_failure', {
        sessionId,
        step: 'signature',
        operation: 'signature_confirm',
      });
      completeStep('signature');
      navigate('/kyc/ocr-review');
    } finally {
      setUploading(false);
    }
  }, [capturedBlob, capturedImage, completeStep, navigate, uploadSignatureSheet, sessionId]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // --- Error state ---
  if (error && state !== 'camera') {
    return (
      <ScreenLayoutV2 title={t('signature.title') || 'Signature manuscrite'} showBack>
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <AlertTriangle className="w-12 h-12 text-destructive" />
          <p className="text-foreground">{error}</p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button onClick={() => { setError(''); setState('instructions'); }}>
              {t('signature.retake') || 'Reprendre'}
            </Button>
          </div>
        </div>
      </ScreenLayoutV2>
    );
  }

  // --- Camera state (full screen) ---
  if (state === 'camera') {
    if (error) {
      return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center text-white p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <p className="mb-6">{error}</p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={() => {
                setError('');
                capturedRef.current = false;
                void startCamera();
              }}
              className="w-full h-12 rounded-2xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors"
            >
              Reessayer
            </button>
            <button
              onClick={() => {
                stopCamera();
                setState('instructions');
                setError('');
              }}
              className="text-white/60 text-sm hover:text-white"
            >
              {t('common.back') || 'Retour'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="relative flex-1 overflow-hidden">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            autoPlay
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Overlay guidance */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-[90%] aspect-[3/4] border-4 border-white/60 rounded-lg">
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 rounded-tl-lg border-white/60" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 rounded-tr-lg border-white/60" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 rounded-bl-lg border-white/60" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 rounded-br-lg border-white/60" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black/50 px-4 py-2 rounded-lg text-center">
                  <p className="text-lg font-bold text-white">3 signatures + date</p>
                  <p className="text-white text-sm">
                    Placez la feuille dans le cadre
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="absolute bottom-24 left-0 right-0 flex flex-col items-center gap-4">
            {cameraReady && (
              <button
                onClick={doCapture}
                className="flex items-center gap-2 rounded-full bg-white px-8 py-4 text-slate-900 font-semibold shadow-lg active:scale-95 transition-transform"
              >
                <Camera className="w-5 h-5" />
                {t('signature.capture') || 'Capturer'}
              </button>
            )}
            {!cameraReady && (
              <div className="text-white text-lg font-medium">Demarrage de la camera...</div>
            )}
          </div>

          <div className="absolute top-4 left-4 safe-top">
            <button
              onClick={() => {
                stopCamera();
                setState('instructions');
              }}
              className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="absolute top-4 right-4 safe-top">
            {cameraReady ? (
              <CheckCircle className="w-6 h-6 text-green-500" />
            ) : (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            )}
          </div>
        </div>

        <div className="bg-black p-6 safe-bottom">
          <div className="text-center text-white/60 text-sm mb-4">
            {t('signature.camera_hint') ||
              'Prenez une photo claire de la feuille avec vos 3 signatures et la date.'}
          </div>
          <button
            onClick={() => {
              stopCamera();
              setState('instructions');
            }}
            className="text-white/60 text-sm w-full text-center hover:text-white"
          >
            {t('common.cancel') || 'Annuler'}
          </button>
        </div>
      </div>
    );
  }

  // --- Review state ---
  if (state === 'review' && capturedImage) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col text-white">
        <div className="absolute top-4 left-4 z-20 safe-top">
          <button
            onClick={handleRetake}
            disabled={uploading}
            className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white disabled:opacity-50"
            aria-label={t('signature.retake') || 'Reprendre'}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 pt-16 pb-4">
          <img
            src={capturedImage}
            alt="Feuille de signature"
            className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
          />
        </div>

        <div className="bg-black/90 p-6 safe-bottom">
          <p className="text-center text-sm text-white/70 mb-4">
            {t('signature.review_hint') ||
              'Verifiez que les 3 signatures et la date sont lisibles.'}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleConfirm}
              disabled={uploading}
              className="w-full h-12 rounded-2xl bg-white text-slate-950 font-bold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {uploading && <Loader2 className="w-5 h-5 animate-spin" />}
              {uploading
                ? t('signature.uploading') || 'Envoi...'
                : t('signature.confirm') || 'Confirmer'}
            </button>
            <button
              onClick={handleRetake}
              disabled={uploading}
              className="w-full h-12 rounded-2xl border border-white/25 text-white font-semibold disabled:opacity-60"
            >
              {t('signature.retake') || 'Reprendre la photo'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Uploading state ---
  if (state === 'uploading') {
    return (
      <ScreenLayoutV2 title={t('signature.title') || 'Signature manuscrite'} showBack>
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-foreground font-medium">
            {t('signature.uploading') || 'Envoi en cours...'}
          </p>
        </div>
      </ScreenLayoutV2>
    );
  }

  // --- Instructions state (default) ---
  return (
    <ScreenLayoutV2 title={t('signature.title') || 'Signature manuscrite'} showBack>
      <div className="flex flex-col gap-6 py-6 w-full max-w-sm mx-auto">
        <div className="text-center">
          <PenLine className="w-12 h-12 mx-auto text-primary mb-3" />
          <h2 className="text-xl font-bold text-foreground">
            {t('signature.title') || 'Signature manuscrite'}
          </h2>
        </div>

        <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
          <p className="text-sm text-accent">
            {t('signature.instruction') ||
              'Signez 3 fois sur une feuille blanche, ajoutez la date du jour, puis prenez-la en photo.'}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button onClick={handleOpenCamera} className="w-full gap-2">
            <Camera className="w-5 h-5" />
            {t('signature.capture') || 'Capturer'}
          </Button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl border-2 border-dashed border-border bg-muted/50 text-muted-foreground font-semibold hover:bg-muted transition-colors active:scale-[0.98]"
          >
            <Upload className="w-5 h-5" />
            {t('signature.choose_file') || 'Choisir un fichier'}
          </button>
        </div>

        <div className="flex items-start gap-3 bg-muted/50 text-muted-foreground p-4 rounded-xl text-sm">
          <FileImage className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p>Formats : JPG, PNG</p>
            <p>Les images sont compressees automatiquement.</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </ScreenLayoutV2>
  );
}
