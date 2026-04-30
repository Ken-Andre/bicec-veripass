import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKyc } from '../../contexts/KycContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { computeLaplacianVariance } from '../../services/mediapipeService';
import { evaluateCni } from '../../services/cniValidator';
import { Camera, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { enqueueOfflineCniCapture, runKycSyncNow } from '../../services/kycSyncService';
import { fetchWithCorrelation } from '../../services/apiClient';
import { captureKycException, captureKycMessage } from '../../services/sentry';

type QualityStatus = 'checking' | 'good' | 'blurry' | 'dark' | 'glare' | 'cni_fail';

interface CniCaptureScreenProps {
  side: 'recto' | 'verso';
  nextRoute: string;
}

const BLUR_THRESHOLD = 100;
const DARK_THRESHOLD = 40;
const GLARE_THRESHOLD = 245;

export default function CniCaptureScreen({ side, nextRoute }: CniCaptureScreenProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { setCniCapture, completeStep, sessionId, setSessionId } = useKyc();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [quality, setQuality] = useState<QualityStatus>('checking');
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
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

  const toHex = (buffer: ArrayBuffer): string =>
    Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

  const computeSha256 = useCallback(async (blob: Blob): Promise<string | null> => {
    try {
      if (!globalThis.crypto?.subtle) return null;
      const bytes = await blob.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return toHex(digest);
    } catch {
      return null;
    }
  }, []);

  const UPLOAD_TIMEOUT_MS = 20_000;

  const uploadDocument = useCallback(async (blob: Blob, dataUrl: string) => {
    const clientSha = await computeSha256(blob);
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), UPLOAD_TIMEOUT_MS);

    try {
      const formData = new FormData();
      formData.append('file', blob, `cni_${side}.jpg`);
      formData.append('side', side.toUpperCase());
      if (sessionId) {
        formData.append('session_id', sessionId);
      }
      if (clientSha) {
        formData.append('client_sha256', clientSha);
      }

      const res = await fetchWithCorrelation('/api/v1/kyc/capture/cni', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`capture_cni_failed_${res.status}`);
      }

      await runKycSyncNow();
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'));
      const stableSessionId = ensureSessionId();
      captureKycException(err, 'upload_failure', {
        sessionId: stableSessionId,
        step: side === 'recto' ? 'cni_recto' : 'cni_verso',
        operation: 'capture_cni_direct_upload',
        extra: { side: side.toUpperCase(), queued_offline: true, timed_out: isTimeout },
      });
      await enqueueOfflineCniCapture({
        sessionId: stableSessionId,
        side: side.toUpperCase() as 'RECTO' | 'VERSO',
        step: side === 'recto' ? 'cni_recto' : 'cni_verso',
        fileDataUrl: dataUrl,
        clientSha256: clientSha,
      });
      if (isTimeout) {
        console.warn('CNI upload timed out after 20s — saved offline for later sync.');
      } else {
        console.warn('Upload error, queued offline replay:', err);
      }
    }
  }, [side, sessionId, computeSha256, ensureSessionId]);

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
    setCniCapture(side, dataUrl);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((nextBlob) => resolve(nextBlob), 'image/jpeg', 0.85);
    });
    if (blob) {
      await uploadDocument(blob, dataUrl);
    } else {
      captureKycMessage('Failed to create image blob from CNI capture canvas', 'upload_failure', {
        sessionId,
        step: side === 'recto' ? 'cni_recto' : 'cni_verso',
        operation: 'capture_cni_blob_generation',
      });
    }

    completeStep(side === 'recto' ? 'cni_recto' : 'cni_verso');
    setCapturing(false);
    stopCamera();
    navigate(nextRoute);
  }, [side, nextRoute, setCniCapture, completeStep, stopCamera, navigate, uploadDocument]);

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
      } catch (err) {
        console.warn('Environment camera failed, trying user camera', err);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const markReady = () => setCameraReady(true);
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(markReady).catch(markReady);
        };
        videoRef.current.onplaying = markReady;
        setTimeout(markReady, 2000);
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Camera access error:', error);
      captureKycException(error, 'camera_error', {
        sessionId,
        step: side === 'recto' ? 'cni_recto' : 'cni_verso',
        operation: 'capture_cni_camera_init',
        extra: { side: side.toUpperCase() },
      });
      setError(`${t('capture.camera.error')} - ${error.message}`);
    }
  }, [t, sessionId, side]);

  useEffect(() => {
    if (!cameraReady) return;

    const interval = setInterval(() => {
      if (!videoRef.current || !canvasRef.current || capturedRef.current) return;
      const video = videoRef.current;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) { setQuality('good'); return; }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = vw;
      canvas.height = vh;
      ctx.drawImage(video, 0, 0);

      try {
        const imageData = ctx.getImageData(0, 0, vw, vh);
        const data = imageData.data;
        let totalBrightness = 0;
        let maxBrightness = 0;
        const step = 32;
        let samples = 0;
        for (let i = 0; i < data.length; i += step * 4) {
          const b = (data[i] + data[i + 1] + data[i + 2]) / 3;
          totalBrightness += b;
          if (b > maxBrightness) maxBrightness = b;
          samples++;
        }
        const avgBrightness = totalBrightness / samples;

        if (avgBrightness < DARK_THRESHOLD) {
          setQuality('dark');
          return;
        }
        if (maxBrightness > GLARE_THRESHOLD && avgBrightness > 200) {
          setQuality('glare');
          return;
        }

        const smallW = Math.min(vw, 320);
        const smallH = Math.round((smallW / vw) * vh);
        const offscreen = document.createElement('canvas');
        offscreen.width = smallW;
        offscreen.height = smallH;
        const offCtx = offscreen.getContext('2d')!;
        offCtx.drawImage(video, 0, 0, smallW, smallH);

        const variance = computeLaplacianVariance(offCtx, smallW, smallH);

        if (variance < BLUR_THRESHOLD) {
          setQuality('blurry');
          return;
        }

        // Additional CNI-specific quality gate
        const cniResult = evaluateCni({
          width: vw,
          height: vh,
          sharpness: variance,
          avgBrightness: avgBrightness,
          maxBrightness: maxBrightness,
        });

        if (!cniResult.ok) {
          setQuality('cni_fail');
          return;
        }

        setQuality('good');
      } catch {
        setQuality('good');
      }
    }, 800);

    return () => clearInterval(interval);
  }, [cameraReady]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const qualityLabel = () => {
    switch (quality) {
      case 'good': return t('capture.quality.good');
      case 'blurry': return t('capture.quality.blurry');
      case 'dark': return t('capture.quality.dark');
      case 'glare': return t('capture.quality.glare');
      case 'cni_fail': return t('capture.quality.cni_fail') || 'Qualité insuffisante';
      default: return t('capture.quality.analyzing');
    }
  };

  const qualityColor = () => {
    switch (quality) {
      case 'good': return 'bg-green-500 text-white';
      case 'blurry': return 'bg-orange-500 text-white';
      case 'dark': return 'bg-blue-500 text-white';
      case 'glare': return 'bg-yellow-500 text-black';
      case 'cni_fail': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const borderColor = () => {
    switch (quality) {
      case 'good': return 'border-green-500';
      case 'blurry': return 'border-orange-500';
      case 'dark': return 'border-blue-500';
      case 'glare': return 'border-yellow-500';
      case 'cni_fail': return 'border-red-500';
      default: return 'border-white/50';
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center text-white p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="mb-4">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="text-primary underline"
        >
          {t('common.back')}
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

        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`relative w-[85%] aspect-[1.586/1] border-4 ${borderColor()} rounded-lg`}
            style={{
              boxShadow: quality === 'good' ? '0 0 20px rgba(34, 197, 94, 0.5)' : '0 0 20px rgba(249, 115, 22, 0.5)'
            }}
          >
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 rounded-tl-lg" style={{ borderColor: 'inherit' }} />
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 rounded-tr-lg" style={{ borderColor: 'inherit' }} />
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 rounded-bl-lg" style={{ borderColor: 'inherit' }} />
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 rounded-br-lg" style={{ borderColor: 'inherit' }} />
          </div>
        </div>

        <div className="absolute bottom-24 left-0 right-0 flex flex-col items-center gap-3">
          <div className={`rounded-full px-4 py-2 text-sm font-medium ${qualityColor()}`}>
            {qualityLabel()}
          </div>

          {!capturing && quality === 'good' && (
            <button
              onClick={doCapture}
              className="flex items-center gap-2 rounded-full bg-green-500 px-6 py-3 text-white font-semibold text-sm shadow-lg"
            >
              <Camera className="h-5 w-5" />
              {t('capture.manual')}
            </button>
          )}

          {quality !== 'good' && !capturing && (
            <div className="text-white/80 text-sm text-center">
              {t('capture.adjust')}
            </div>
          )}

          {capturing && (
            <div className="flex items-center gap-2 text-white text-sm font-medium animate-pulse">
              <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Traitement en cours…
            </div>
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

        <div className="absolute top-4 right-4 flex items-center gap-2">
          {quality === 'good' ? (
            <CheckCircle className="w-6 h-6 text-green-500" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-orange-500" />
          )}
        </div>
      </div>

      <div className="bg-black p-6">
        <div className="text-center text-white/60 text-sm mb-4">
          {side === 'recto' ? t('cni.recto.tip') : t('cni.verso.tip')}
        </div>
        <button
          onClick={() => { stopCamera(); navigate(-1); }}
          className="text-white/60 text-sm w-full text-center hover:text-white"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
