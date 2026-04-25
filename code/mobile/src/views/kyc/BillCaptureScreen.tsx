import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKyc } from '../../contexts/KycContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Camera, AlertTriangle, X, CheckCircle, Loader2 } from 'lucide-react';
import { captureKycException } from '../../services/sentry';
import { fetchWithCorrelation } from '../../services/apiClient';
import { enqueueOfflineBill } from '../../services/kycSyncService';

type BillType = 'ENEO' | 'CAMWATER';

interface BillCaptureScreenProps {
  billType: BillType;
}

export default function BillCaptureScreen({ billType }: BillCaptureScreenProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { setBillCapture, completeStep, sessionId, setSessionId } = useKyc();

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
        if (sid) {
          formData.append('session_id', sid);
        }
        if (clientSha) {
          formData.append('client_sha256', clientSha);
        }

        const res = await fetchWithCorrelation('/api/v1/kyc/capture/bill', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`capture_bill_failed_${res.status}`);
        }
        return; // success
      } catch (err) {
        captureKycException(err, 'upload_failure', {
          sessionId: sid,
          step: 'utility_bill',
          operation: 'capture_bill_upload',
          extra: { bill_type: billType },
        });
        // Fall through to offline enqueue
      }
    }
    // Offline or online failed — enqueue for sync on reconnect
    await enqueueOfflineBill({
      sessionId: sid,
      billType: billType,
      fileDataUrl: dataUrl,
      clientSha256: clientSha,
    });
  }, [billType, computeSha256, ensureSessionId]);

  const doCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || capturedRef.current) return;
    capturedRef.current = true;
    setCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setBillCapture(dataUrl);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((nextBlob) => resolve(nextBlob), 'image/jpeg', 0.85);
    });

    if (blob) {
      setUploading(true);
      await uploadBill(blob, dataUrl);
      setUploading(false);
    }

    completeStep('utility_bill');
    stopCamera();
    navigate('/kyc/niu');
  }, [navigate, setBillCapture, completeStep, stopCamera, uploadBill]);

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
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const billLabel = billType === 'ENEO' ? 'ENEO (electricité)' : 'CAMWATER (eau)';
  const billColor = billType === 'ENEO' ? 'text-yellow-600' : 'text-blue-600';

  if (error) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center text-white p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="mb-4">{error}</p>
        <button onClick={() => navigate(-1)} className="text-primary underline">
          {t('common.back') || 'Retour'}
        </button>
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
          Prenez une photo claire de votre facture {billLabel} pour prouver votre résidence
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
