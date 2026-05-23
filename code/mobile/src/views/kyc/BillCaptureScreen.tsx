import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useKyc } from '../../contexts/KycContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Camera, AlertTriangle, X, CheckCircle, Loader2 } from 'lucide-react';
import { captureKycException } from '../../services/sentry';
import { fetchWithCorrelation } from '../../services/apiClient';
import { enqueueOfflineBill } from '../../services/kycSyncService';
import { compressForUpload } from '../../utils/imageCompression';

type BillType = 'ENEO' | 'CAMWATER';

const MAX_FILE_SIZE_MB = 10;

interface BillCaptureScreenProps {
  billType?: BillType;
}

const UPLOAD_TIMEOUT_MS = 180_000; // 3 minutes

export default function BillCaptureScreen({ billType: propBillType }: BillCaptureScreenProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { setBillCapture, completeStep, sessionId, setSessionId } = useKyc();

  const billType: BillType = (location.state as { billType?: BillType })?.billType ?? propBillType ?? 'ENEO';

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const capturedRef = useRef(false);

  const ensureSessionId = useCallback(() => {
    if (sessionId) return sessionId;
    const generated = `offline-${Date.now()}`;
    setSessionId(generated);
    return generated;
  }, [sessionId, setSessionId]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

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
            captureKycException(new Error('bill_capture_504_gateway_timeout'), 'upload_failure', {
              sessionId: sid,
              step: 'utility_bill',
              operation: 'capture_bill_504',
              extra: { bill_type: billType },
            });
            await enqueueOfflineBill({ sessionId: sid, billType, fileDataUrl: dataUrl, clientSha256: clientSha });
            return;
          }
          throw new Error(`capture_bill_failed_${res.status}`);
        }
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          captureKycException(new Error('bill_capture_client_timeout'), 'upload_failure', {
            sessionId: sid,
            step: 'utility_bill',
            operation: 'capture_bill_timeout',
            extra: { bill_type: billType },
          });
          await enqueueOfflineBill({ sessionId: sid, billType, fileDataUrl: dataUrl, clientSha256: clientSha });
          return;
        }
        captureKycException(err, 'upload_failure', {
          sessionId: sid,
          step: 'utility_bill',
          operation: 'capture_bill_upload',
          extra: { bill_type: billType },
        });
      }
    }

    await enqueueOfflineBill({ sessionId: sid, billType, fileDataUrl: dataUrl, clientSha256: clientSha });
  }, [billType, computeSha256, ensureSessionId]);

  const doCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || capturedRef.current) return;
    capturedRef.current = true;
    setCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d')!;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const rawBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((nextBlob) => resolve(nextBlob), 'image/jpeg', 0.90);
      });
      if (!rawBlob) {
        setCapturing(false);
        capturedRef.current = false;
        return;
      }

      const compressed = await compressForUpload(rawBlob);

      if (compressed.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`Image trop volumineuse (${(compressed.size / 1024 / 1024).toFixed(1)} Mo). Max : ${MAX_FILE_SIZE_MB} Mo.`);
        setCapturing(false);
        capturedRef.current = false;
        return;
      }

      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(compressed);
      });
      setBillCapture(dataUrl);

      setUploading(true);
      await uploadBill(compressed, dataUrl);
      setUploading(false);

      completeStep('utility_bill');
      stopCamera();
      navigate('/kyc/niu');
    } catch (err) {
      captureKycException(err, 'upload_failure', {
        sessionId,
        step: 'utility_bill',
        operation: 'capture_bill_doCapture',
      });
      setError('Erreur lors de la capture. Veuillez reessayer.');
      setCapturing(false);
      capturedRef.current = false;
    }
  }, [navigate, setBillCapture, completeStep, stopCamera, uploadBill, sessionId]);

  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available in this browser context (requires HTTPS or localhost).');
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
          videoRef.current?.play().then(() => setCameraReady(true)).catch(() => setCameraReady(true));
        };
        setTimeout(() => setCameraReady(true), 2000);
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Camera access error:', error);
      captureKycException(error, 'camera_error', {
        sessionId,
        step: 'utility_bill',
        operation: 'capture_bill_camera_init',
        extra: { bill_type: billType },
      });
      setError(`${t('capture.camera.error') || 'Erreur camera'} - ${error.message}`);
    }
  }, [t, sessionId, billType]);

  useEffect(() => {
    const startTimer = window.setTimeout(() => {
      void startCamera();
    }, 0);
    return () => {
      clearTimeout(startTimer);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const billLabel = billType === 'ENEO' ? 'ENEO (electricité)' : 'CAMWATER (eau)';
  const billColor = billType === 'ENEO' ? 'text-yellow-600' : 'text-blue-600';

  if (error) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center text-white p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="mb-6">{error}</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => { setError(''); capturedRef.current = false; startCamera(); }}
            className="w-full h-12 rounded-2xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors"
          >
            Reessayer
          </button>
          <button onClick={() => navigate(-1)} className="text-white/60 text-sm hover:text-white">
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
              <div className="bg-black/50 px-4 py-2 rounded-lg">
                <p className={`text-lg font-bold ${billColor}`}>{billLabel}</p>
                <p className="text-white text-sm text-center">Placez la facture dans le cadre</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-24 left-0 right-0 flex flex-col items-center gap-4">
          {!capturing && cameraReady && (
            <button
              onClick={doCapture}
              disabled={uploading}
              className="flex items-center gap-2 rounded-full bg-white px-8 py-4 text-slate-900 font-semibold shadow-lg active:scale-95 transition-transform"
            >
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
              {uploading ? 'Envoi...' : 'Capturer la facture'}
            </button>
          )}
          {capturing && !uploading && (
            <div className="text-white text-lg font-medium">Capture en cours...</div>
          )}
        </div>

        <div className="absolute top-4 left-4">
          <button
            onClick={() => { stopCamera(); navigate(-1); }}
            className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="absolute top-4 right-4">
          {cameraReady ? (
            <CheckCircle className="w-6 h-6 text-green-500" />
          ) : (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          )}
        </div>
      </div>

      <div className="bg-black p-6">
        <div className="text-center text-white/60 text-sm mb-4">
          Prenez une photo claire de votre facture {billLabel} pour prouver votre residence.
          <br />L'image sera optimisee automatiquement pour un envoi rapide.
        </div>
        <button
          onClick={() => { stopCamera(); navigate(-1); }}
          className="text-white/60 text-sm w-full text-center hover:text-white"
        >
          {t('common.cancel') || 'Annuler'}
        </button>
      </div>
    </div>
  );
}
