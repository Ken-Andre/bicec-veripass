import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKyc } from '../../contexts/KycContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { computeLaplacianVariance } from '../../services/mediapipeService';
import { evaluateCni } from '../../services/cniValidator';
import { Camera, AlertTriangle, CheckCircle, X, Loader2, ChevronLeft, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { enqueueOfflineCniCapture, runKycSyncNow } from '../../services/kycSyncService';
import { fetchWithCorrelation } from '../../services/apiClient';
import { captureKycException, captureKycMessage } from '../../services/sentry';

type QualityStatus = 'checking' | 'good' | 'blurry' | 'dark' | 'glare' | 'cni_fail';
type CameraState = 'loading' | 'ready' | 'error';
type ScreenState = 'camera' | 'review' | 'uploading' | 'error';

interface CniCaptureScreenProps {
  side: 'recto' | 'verso';
  nextRoute: string;
}

const BLUR_THRESHOLD = 100;
const DARK_THRESHOLD = 40;
const GLARE_THRESHOLD = 245;
const CAMERA_INIT_TIMEOUT_MS = 5000;
const UPLOAD_TIMEOUT_MS = 90_000;

const UPLOAD_TIPS = [
  'Analyse en cours…',
  'Vérification des données…',
  'Extraction des informations…',
  'Validation du document…',
  'Presque terminé…',
];

export default function CniCaptureScreen({ side, nextRoute }: CniCaptureScreenProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { setCniCapture, completeStep, sessionId, setSessionId } = useKyc();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [quality, setQuality] = useState<QualityStatus>('checking');
  const [error, setError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraState, setCameraState] = useState<CameraState>('loading');
  const [screenState, setScreenState] = useState<ScreenState>('camera');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const capturedRef = useRef(false);
  const initTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setCameraState('loading');
    if (initTimerRef.current) {
      clearTimeout(initTimerRef.current);
      initTimerRef.current = null;
    }
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

  const uploadDocument = useCallback(async (blob: Blob, dataUrl: string): Promise<'success' | 'offline' | 'error'> => {
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
      return 'success';
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
        console.warn('CNI upload timed out after 90s — saved offline for later sync.');
        return 'offline';
      } else {
        console.warn('Upload error, queued offline replay:', err);
        return 'error';
      }
    }
  }, [side, sessionId, computeSha256, ensureSessionId]);

  /* ── Robust stream attachment ───────────────────────────────────────────────
     Attaches a MediaStream to the <video> element, retrying via rAF if the
     ref is not yet mounted (fixes race condition in Strict Mode / fast nav).
  ──────────────────────────────────────────────────────────────────────────── */
  const attachStream = useCallback((stream: MediaStream) => {
    const attachWhenReady = () => {
      const video = videoRef.current;
      if (!video) {
        requestAnimationFrame(attachWhenReady);
        return;
      }
      video.srcObject = stream;
      const markReady = () => setCameraReady(true);
      video.onloadedmetadata = () => {
        video.play().then(markReady).catch(markReady);
      };
      video.onplaying = markReady;
      // Safety net: force ready after timeout so user is never stuck
      initTimerRef.current = setTimeout(markReady, CAMERA_INIT_TIMEOUT_MS);
    };
    attachWhenReady();
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setCameraState('loading');
      setCameraReady(false);
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
      attachStream(stream);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Camera access error:', error);
      captureKycException(error, 'camera_error', {
        sessionId,
        step: side === 'recto' ? 'cni_recto' : 'cni_verso',
        operation: 'capture_cni_camera_init',
        extra: { side: side.toUpperCase() },
      });
      setCameraState('error');
      setError(`${t('capture.camera.error')} - ${error.message}`);
    }
  }, [t, sessionId, side, attachStream]);

  const doCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || capturedRef.current) return;
    capturedRef.current = true;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const cw = video.clientWidth || vw;
    const ch = video.clientHeight || vh;

    // Capture de la frame complète
    canvas.width = vw;
    canvas.height = vh;
    ctx.drawImage(video, 0, 0, vw, vh);

    // --- FIX MOBILE: Recadrage exact sur le rectangle vert de l'UI ---
    // La vidéo est affichée en 'object-cover', donc elle est redimensionnée 
    // et coupée par le navigateur pour remplir l'écran. 
    // Il faut retrouver les coordonnées du rectangle vert dans la vidéo ORIGINALE.
    const scale = Math.max(cw / vw, ch / vh);
    const dw = vw * scale; // Largeur vidéo affichée
    const dh = vh * scale; // Hauteur vidéo affichée
    const ox = (cw - dw) / 2; // Décalage (négatif) dû au cover
    const oy = (ch - dh) / 2;

    // Le rectangle vert à l'écran (85% largeur, ratio 1.586)
    const rectW = cw * 0.85;
    const rectH = rectW / 1.586;
    const rectX = (cw - rectW) / 2;
    const rectY = (ch - rectH) / 2;

    // Mapping exact vers les coordonnées de la vidéo d'origine (intrinsèques)
    const cropX = Math.round((rectX - ox) / scale);
    const cropY = Math.round((rectY - oy) / scale);
    const cropW = Math.round(rectW / scale);
    const cropH = Math.round(rectH / scale);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext('2d')!;
    // Extraction précise de la zone délimitée
    cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const croppedDataUrl = cropCanvas.toDataURL('image/jpeg', 0.90);

    // Mettre à jour la preview et l'état
    setCniCapture(side, croppedDataUrl);
    setCapturedImage(croppedDataUrl);

    // Préparer le Blob pour l'upload
    const blob = await new Promise<Blob | null>((resolve) => {
      cropCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.90);
    });
    // --- FIN FIX MOBILE ---


    if (!blob) {
      captureKycMessage('Failed to create image blob from CNI capture canvas', 'upload_failure', {
        sessionId,
        step: side === 'recto' ? 'cni_recto' : 'cni_verso',
        operation: 'capture_cni_blob_generation',
      });
      setError("Impossible de créer l'image. Veuillez réessayer.");
      capturedRef.current = false;
      return;
    }

    setCapturedBlob(blob);
    stopCamera();
    setScreenState('review');
  }, [side, setCniCapture, stopCamera, sessionId]);

  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    setCapturedBlob(null);
    capturedRef.current = false;
    setScreenState('camera');
    startCamera();
  }, [startCamera]);

  const handleConfirm = useCallback(async () => {
    if (!capturedBlob || !capturedImage) return;
    setScreenState('uploading');

    const uploadStatus = await uploadDocument(capturedBlob, capturedImage);

    if (uploadStatus === 'success') {
      completeStep(side === 'recto' ? 'cni_recto' : 'cni_verso');
      navigate(nextRoute);
    } else if (uploadStatus === 'offline') {
      setErrorMsg('Connexion instable. La photo a été sauvegardée localement et sera envoyée automatiquement dès que possible.');
      setScreenState('error');
    } else {
      setErrorMsg("Échec de l'envoi. Veuillez réessayer.");
      setScreenState('error');
    }
  }, [capturedBlob, capturedImage, side, nextRoute, completeStep, navigate, uploadDocument]);

  const handleRetryUpload = useCallback(() => {
    setScreenState('review');
  }, []);

  const handleContinueOffline = useCallback(() => {
    completeStep(side === 'recto' ? 'cni_recto' : 'cni_verso');
    navigate(nextRoute);
  }, [side, completeStep, navigate, nextRoute]);

  useEffect(() => {
    if (!cameraReady) return;
    const readyTimer = window.setTimeout(() => setCameraState('ready'), 0);

    const interval = setInterval(() => {
      if (!videoRef.current || !canvasRef.current || capturedRef.current) return;
      const video = videoRef.current;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) { setQuality('good'); return; }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
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
        const offCtx = offscreen.getContext('2d', { willReadFrequently: true })!;
        offCtx.drawImage(video, 0, 0, smallW, smallH);

        const variance = computeLaplacianVariance(offCtx, smallW, smallH);

        if (variance < BLUR_THRESHOLD) {
          setQuality('blurry');
          return;
        }

        const cniResult = evaluateCni({
          width: vw,
          height: vh,
          sharpness: variance,
          avgBrightness: avgBrightness,
          maxBrightness: maxBrightness,
        }, true);

        if (!cniResult.ok) {
          setQuality('cni_fail');
          return;
        }

        setQuality('good');
      } catch {
        setQuality('good');
      }
    }, 800);

    return () => {
      clearTimeout(readyTimer);
      clearInterval(interval);
    };
  }, [cameraReady]);

  useEffect(() => {
    const startTimer = window.setTimeout(() => {
      void startCamera();
    }, 0);
    return () => {
      clearTimeout(startTimer);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Animated tips during upload
  useEffect(() => {
    if (screenState !== 'uploading') return;
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % UPLOAD_TIPS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [screenState]);

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

  /* ── Camera error state ──────────────────────────────────────────────────── */
  if (error || cameraState === 'error') {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center text-white p-6 text-center safe-bottom safe-top">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="mb-6 text-lg font-medium leading-relaxed">{error || t('capture.camera.error')}</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button
            onClick={() => { setError(''); setCameraState('loading'); startCamera(); }}
          >
            {t('common.retry') || 'Réessayer'}
          </Button>
          <button
            onClick={() => { stopCamera(); navigate(-1); }}
            className="text-white/70 text-sm font-medium hover:text-white transition-colors"
          >
            {t('common.back') || 'Retour'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Camera viewport */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Loading overlay — prevents blank screen during init */}
        {cameraState === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-white/90 text-sm font-medium">
              {t('capture.initializing') || 'Initialisation de la caméra…'}
            </p>
          </div>
        )}

        {/* Review screen — confirm / retake */}
        {screenState === 'review' && capturedImage && (
          <div className="absolute inset-0 bg-black z-30 flex flex-col">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 safe-top">
              <button
                onClick={handleRetake}
                className="flex items-center gap-1 text-white/80 text-sm font-medium hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                Reprendre
              </button>
              <p className="text-white font-semibold text-sm">
                {side === 'recto' ? 'Recto' : 'Verso'}
              </p>
              <div className="w-16" />
            </div>
            {/* Image preview */}
            <div className="flex-1 flex items-center justify-center p-6 pt-16 pb-4">
              <img
                src={capturedImage}
                alt="CNI preview"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            </div>
            {/* Bottom actions */}
            <div className="p-6 safe-bottom bg-black/80 backdrop-blur-sm">
              <p className="text-white/80 text-sm text-center mb-4">
                Vérifiez que le document est bien lisible et complet avant de confirmer.
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={handleConfirm} className="w-full">
                  Confirmer
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRetake}
                  className="w-full border-white/30 text-white hover:bg-white/10 hover:text-white"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reprendre la photo
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Uploading overlay — spinner + animated tips */}
        {screenState === 'uploading' && (
          <div className="absolute inset-0 bg-black/95 z-40 flex flex-col items-center justify-center text-white p-6 text-center">
            <Loader2 className="w-14 h-14 text-primary animate-spin mb-8" />
            <p className="text-xl font-semibold mb-3 transition-opacity duration-500">
              {UPLOAD_TIPS[currentTipIndex]}
            </p>
            <p className="text-white/50 text-sm">
              Ne fermez pas cette page
            </p>
          </div>
        )}

        {/* Error overlay — retry / continue offline */}
        {screenState === 'error' && (
          <div className="absolute inset-0 bg-black/95 z-40 flex flex-col items-center justify-center text-white p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-lg font-medium mb-2">Problème de connexion</p>
            <p className="text-white/70 text-sm mb-8 max-w-xs">
              {errorMsg}
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button onClick={handleRetryUpload} className="w-full">
                Réessayer
              </Button>
              <Button
                variant="outline"
                onClick={handleContinueOffline}
                className="w-full border-white/30 text-white hover:bg-white/10 hover:text-white"
              >
                Continuer hors ligne
              </Button>
            </div>
          </div>
        )}

        {/* Document frame overlay — only visible in camera mode */}
        {screenState === 'camera' && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={`relative w-[85%] aspect-[1.586/1] border-4 ${borderColor()} rounded-lg transition-colors duration-300`}
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

            {/* Bottom controls */}
            <div className="absolute bottom-24 left-0 right-0 flex flex-col items-center gap-3 z-10">
              <div className={`rounded-full px-4 py-2 text-sm font-medium ${qualityColor()}`}>
                {qualityLabel()}
              </div>

              {quality === 'good' && (
                <button
                  onClick={doCapture}
                  className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-white font-semibold text-sm shadow-lg active:scale-95 transition-transform"
                >
                  <Camera className="h-5 w-5" />
                  {t('capture.manual')}
                </button>
              )}

              {quality !== 'good' && (
                <div className="text-white/80 text-sm text-center px-6">
                  {t('capture.adjust')}
                </div>
              )}
            </div>

            {/* Top-left close */}
            <div className="absolute top-4 left-4 z-10 safe-top">
              <button
                onClick={() => { stopCamera(); navigate(-1); }}
                className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white active:scale-90 transition-transform"
                aria-label={t('common.close') || 'Fermer'}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Top-right quality indicator */}
            <div className="absolute top-4 right-4 z-10 safe-top">
              {quality === 'good' ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-orange-500" />
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer tip + cancel — only visible in camera mode */}
      {screenState === 'camera' && (
        <div className="bg-black p-6 safe-bottom">
          <div className="text-center text-white/60 text-sm mb-4">
            {side === 'recto' ? t('cni.recto.tip') : t('cni.verso.tip')}
          </div>
          <button
            onClick={() => { stopCamera(); navigate(-1); }}
            className="text-white/60 text-sm w-full text-center hover:text-white transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}
    </div>
  );
}
