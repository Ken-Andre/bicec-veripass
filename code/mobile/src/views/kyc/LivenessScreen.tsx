import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { CheckCircle, XCircle, Loader2, Camera } from 'lucide-react';
import { initFaceLandmarker, detectForVideo, isFacePresent } from '../../services/mediapipeService';
import type { LivenessResult } from '../../types';
import { enqueueOfflineLivenessCapture, runKycSyncNow, safeSubmitLiveness } from '../../services/kycSyncService';
import { fetchWithCorrelation } from '../../services/apiClient';
import { captureKycException, captureKycMessage } from '../../services/sentry';
import {
  CHALLENGES,
  HOLD_FRAMES,
  MIN_CHALLENGE_VISIBLE_MS,
  createBlinkValidationState,
  evaluateChallenge,
  type BlinkValidationState,
  type ChallengeType,
} from './livenessChallenge';

type SelfieUploadResult = {
  ok: boolean;
  networkLike: boolean;
  message?: string;
};

const NO_FACE_TIMEOUT_MS = 5000;
const MAX_LANDMARK_FRAMES = 48;

export default function LivenessScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const {
    resetLivenessAttempts,
    incrementLivenessAttempt,
    livenessAttempts,
    completeStep,
    sessionId,
    setSessionId,
  } = useKyc();

  const [status, setStatus] = useState<'loading' | 'ready' | 'challenge' | 'success' | 'fail' | 'locked'>('loading');
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const holdCountRef = useRef(0);
  const [challengeProgress, setChallengeProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [guidance, setGuidance] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [validationPulse, setValidationPulse] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastFaceTimeRef = useRef<number>(0);
  const capturedLandmarksRef = useRef<Array<Record<string, unknown>>>([]);
  const selfieCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const selfieDataUrlRef = useRef<string | null>(null);
  const challengeCompleteRef = useRef(false);
  const sessionIdRef = useRef(sessionId);
  const challengeStartedAtRef = useRef(0);
  const blinkStateRef = useRef<BlinkValidationState>(createBlinkValidationState());
  const guidanceRef = useRef('');
  const validationPulseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const setGuidanceIfChanged = useCallback((nextGuidance: string) => {
    if (guidanceRef.current === nextGuidance) return;
    guidanceRef.current = nextGuidance;
    setGuidance(nextGuidance);
  }, []);

  const resetChallengeTracking = useCallback(() => {
    holdCountRef.current = 0;
    setChallengeProgress(0);
    blinkStateRef.current = createBlinkValidationState();
    challengeStartedAtRef.current = performance.now();
    setValidationPulse(false);
    setGuidanceIfChanged('');
  }, [setGuidanceIfChanged]);

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

  const isNetworkLikeError = (err: unknown): boolean => {
    return err instanceof TypeError
      || (err instanceof Error && (
        err.message.toLowerCase().includes('fetch')
        || err.name === 'AbortError'
        || err.message.toLowerCase().includes('abort')
        || err.message.toLowerCase().includes('network')
      ));
  };

  /** Capture a selfie frame from the video stream (front-facing, neutral face). */
  const captureSelfieFrame = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = selfieCanvasRef.current || document.createElement('canvas');
    selfieCanvasRef.current = canvas;
    // Use video native resolution (front camera is typically 640×480)
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d')!;
    // Mirror horizontally to match the selfie preview the user sees
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    selfieDataUrlRef.current = canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  /** Upload selfie as a SELFIE document to the backend so face matching works. */
  const uploadSelfie = useCallback(async (): Promise<SelfieUploadResult> => {
    const dataUrl = selfieDataUrlRef.current;
    if (!dataUrl) {
      captureKycMessage('No selfie frame captured, skipping selfie upload', 'upload_failure', {
        sessionId,
        step: 'liveness',
        operation: 'selfie_upload_no_frame',
      });
      return {
        ok: false,
        networkLike: false,
        message: 'Selfie non capturé. Veuillez recommencer la vérification.',
      };
    }

    // Convert data URL to Blob
    const [meta, content] = dataUrl.split(',');
    const mimeMatch = /data:(.*?);base64/.exec(meta || '');
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binary = atob(content || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const clientSha = await computeSha256(blob);

    // Inline session-id resolution (avoid referencing ensureSessionId before its definition)
    const stableSessionId = sessionId ?? `offline-${Date.now()}`;

    try {
      const formData = new FormData();
      formData.append('file', blob, 'selfie.jpg');
      formData.append('doc_type', 'SELFIE');
      if (clientSha) {
        formData.append('client_sha256', clientSha);
      }
      const res = await fetchWithCorrelation('/api/v1/kyc/document/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        return {
          ok: false,
          networkLike: res.status >= 500,
          message: `selfie_upload_failed_${res.status}: ${JSON.stringify(detail)}`,
        };
      }
      return { ok: true, networkLike: false };
    } catch (err) {
      // Queue for offline retry — store selfie in liveness offline payload
      captureKycException(err, 'upload_failure', {
        sessionId: stableSessionId,
        step: 'liveness',
        operation: 'selfie_upload',
        extra: { queued_offline: true },
      });
      // Fall through — liveness submit will include selfie in offline queue
      return {
        ok: false,
        networkLike: isNetworkLikeError(err),
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }, [computeSha256, sessionId]);

  const getChallengeInstruction = (type: ChallengeType) => {
    switch (type) {
      case 'smile': return t('liveness.challenge.smile') !== 'liveness.challenge.smile' ? t('liveness.challenge.smile') : 'Souriez naturellement';
      case 'blink': return t('liveness.challenge.blink') !== 'liveness.challenge.blink' ? t('liveness.challenge.blink') : 'Clignez des yeux';
      case 'turn_left': return t('liveness.challenge.turn_left') !== 'liveness.challenge.turn_left' ? t('liveness.challenge.turn_left') : 'Tournez la tête à gauche';
      case 'turn_right': return t('liveness.challenge.turn_right') !== 'liveness.challenge.turn_right' ? t('liveness.challenge.turn_right') : 'Tournez la tête à droite';
    }
  };

  const translateGuidance = useCallback((key: string) => {
    const translated = t(key);
    if (translated !== key) return translated;
    switch (key) {
      case 'liveness.guidance.blink':
        return 'Gardez les yeux ouverts, puis clignez une fois.';
      case 'liveness.guidance.turn.left':
        return 'Tournez la tête vers votre gauche.';
      case 'liveness.guidance.turn.more':
        return 'Encore un peu vers votre gauche.';
      case 'liveness.guidance.turn.other_side':
        return "Tournez de l'autre côté, vers votre gauche.";
      case 'liveness.guidance.validating':
        return "Validation de l'action en cours...";
      default:
        return '';
    }
  }, [t]);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (validationPulseTimerRef.current) {
      window.clearTimeout(validationPulseTimerRef.current);
      validationPulseTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setStatus('loading');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API non disponible (HTTPS requis)');
      }
      await initFaceLandmarker();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      streamRef.current = stream;
      setStatus('challenge');
      setCurrentChallenge(0);
      holdCountRef.current = 0;
      setChallengeProgress(0);
      blinkStateRef.current = createBlinkValidationState();
      challengeStartedAtRef.current = performance.now();
      setValidationPulse(false);
      challengeCompleteRef.current = false;
      setMessage('');
      setGuidanceIfChanged('');
      lastFaceTimeRef.current = Date.now();
      capturedLandmarksRef.current = [];
      selfieDataUrlRef.current = null;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Camera access error:', error);
      captureKycException(error, 'camera_error', {
        sessionId: sessionIdRef.current,
        step: 'liveness',
        operation: 'liveness_camera_init',
      });
      setMessage(`${t('liveness.camera.error') !== 'liveness.camera.error' ? t('liveness.camera.error') : 'Erreur caméra'} - ${error.message}`);
      setStatus('fail');
    }
  }, [t, setGuidanceIfChanged]);

  const submitLiveness = useCallback(async (
    landmarks: Array<Record<string, unknown>>,
    challengeType: ChallengeType,
  ): Promise<LivenessResult> => {
    return await safeSubmitLiveness(
      { landmarks_json: landmarks, challenge_type: challengeType },
    );
  }, []);

  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (status !== 'challenge') return;

    const detect = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      try {
        const result = detectForVideo(videoRef.current, performance.now());
        const hasFace = isFacePresent(result.faceLandmarks);
        setFaceDetected(hasFace);

        if (hasFace) {
          lastFaceTimeRef.current = Date.now();
          setMessage('');
          const landmarks = result.faceLandmarks[0];
          const normalizedLandmarks = Array.isArray(landmarks)
            ? landmarks.map((point: unknown) => {
              const candidate = point as { x?: number; y?: number; z?: number };
              return {
                x: Number(candidate?.x ?? 0),
                y: Number(candidate?.y ?? 0),
                z: Number(candidate?.z ?? 0),
              };
            })
            : [];
          if (normalizedLandmarks.length > 0) {
            capturedLandmarksRef.current.push({
              timestamp: Date.now(),
              landmarks: normalizedLandmarks,
            });
            if (capturedLandmarksRef.current.length > MAX_LANDMARK_FRAMES) {
              capturedLandmarksRef.current = capturedLandmarksRef.current.slice(-MAX_LANDMARK_FRAMES);
            }
          }
          const type = CHALLENGES[currentChallenge];

          const challengeVisibleLongEnough = performance.now() - challengeStartedAtRef.current >= MIN_CHALLENGE_VISIBLE_MS;
          const nowMs = performance.now();
          const { evaluation, blinkState } = evaluateChallenge(type, landmarks, blinkStateRef.current, nowMs);
          blinkStateRef.current = blinkState;
          setChallengeProgress(evaluation.progress);

          if (type === 'blink') {
            setGuidanceIfChanged(translateGuidance('liveness.guidance.blink'));
          } else if (evaluation.guidanceKey) {
            setGuidanceIfChanged(translateGuidance(evaluation.guidanceKey));
          } else {
            setGuidanceIfChanged('');
          }

          if (challengeVisibleLongEnough && evaluation.matched && !validationPulseTimerRef.current) {
            holdCountRef.current += 1;
            if (holdCountRef.current >= HOLD_FRAMES) {
              setValidationPulse(true);
              if (validationPulseTimerRef.current) window.clearTimeout(validationPulseTimerRef.current);
              if (currentChallenge < CHALLENGES.length - 1) {
                validationPulseTimerRef.current = window.setTimeout(() => {
                  validationPulseTimerRef.current = null;
                  setCurrentChallenge(c => c + 1);
                  resetChallengeTracking();
                }, 220);
              } else if (!challengeCompleteRef.current) {
                // All challenges done — capture selfie and stop camera (once)
                challengeCompleteRef.current = true;
                captureSelfieFrame();
                setStatus('success');
                stopCamera();
              }
            }
          } else {
            holdCountRef.current = Math.max(0, holdCountRef.current - 1);
          }
        } else {
          holdCountRef.current = 0;
          setChallengeProgress(0);
          blinkStateRef.current = createBlinkValidationState();
          if (lastFaceTimeRef.current !== 0 && Date.now() - lastFaceTimeRef.current > NO_FACE_TIMEOUT_MS) {
            setMessage(t('liveness.face.not_detected') !== 'liveness.face.not_detected' ? t('liveness.face.not_detected') : "Visage non détecté. Placez-vous dans l'ovale.");
          }
          setGuidanceIfChanged('');
        }
      } catch {
        // Mediapipe not ready or frame skipped
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };

    animFrameRef.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [status, currentChallenge, stopCamera, t, captureSelfieFrame, resetChallengeTracking, setGuidanceIfChanged, translateGuidance]);

  useEffect(() => {
    if (status === 'challenge') {
      challengeStartedAtRef.current = performance.now();
    }
  }, [status, currentChallenge]);

  useEffect(() => {
    const startTimer = window.setTimeout(() => {
      void startCamera();
    }, 0);
    return () => {
      clearTimeout(startTimer);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (status !== 'locked' || cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [status, cooldownSeconds]);

  const handleSubmit = async () => {
    const payload = capturedLandmarksRef.current.slice(-40);
    if (payload.length === 0) {
      setMessage('Aucune donnée biométrique capturée. Veuillez recommencer la vérification.');
      setStatus('fail');
      return;
    }

    // Upload selfie BEFORE liveness submit so the backend has the SELFIE
    // document available for the backend face-match computation.
    const selfieUpload = await uploadSelfie();
    if (!selfieUpload.ok) {
      if (selfieUpload.networkLike) {
        await enqueueOfflineLivenessCapture({
          sessionId: ensureSessionId(),
          challengeType: CHALLENGES[Math.min(currentChallenge, CHALLENGES.length - 1)],
          landmarks: payload,
          selfieDataUrl: selfieDataUrlRef.current ?? undefined,
        });
        completeStep('liveness');
        resetLivenessAttempts();
        setMessage('Connexion indisponible. La vérification sera synchronisée automatiquement au retour réseau.');
        navigate('/kyc/address');
        return;
      }
      setMessage('Selfie non accepté. Veuillez recommencer la vérification faciale.');
      setStatus('fail');
      return;
    }

    try {
      const finalChallenge = CHALLENGES[Math.min(currentChallenge, CHALLENGES.length - 1)];
      const result = await submitLiveness(payload, finalChallenge);

      if (result.is_locked || result.strikes_remaining === 0) {
        setCooldownSeconds(result.cooldown_seconds ?? 60);
        setMessage('Session verrouillée temporairement après 3 échecs. Vous pouvez recommencer ou aller en agence.');
        setStatus('locked');
        stopCamera();
        return;
      }

      completeStep('liveness');
      resetLivenessAttempts();
      if (result.face_match_status !== 'PASSED') {
        captureKycMessage('Liveness completed with non-passing face match status', 'liveness_failure', {
          sessionId,
          step: 'liveness',
          operation: 'liveness_face_match_status',
          extra: {
            face_match_status: result.face_match_status,
            face_match_reason: result.face_match_reason,
          },
        });
      }
      navigate('/kyc/address');
      await runKycSyncNow();
    } catch (err) {
      const networkLike = isNetworkLikeError(err);
      if (networkLike) {
        await enqueueOfflineLivenessCapture({
          sessionId: ensureSessionId(),
          challengeType: CHALLENGES[Math.min(currentChallenge, CHALLENGES.length - 1)],
          landmarks: payload,
        });
        completeStep('liveness');
        resetLivenessAttempts();
        setMessage('Connexion indisponible. La vérification sera synchronisée automatiquement au retour réseau.');
        navigate('/kyc/address');
        return;
      }
      captureKycException(err, 'match_error', {
        sessionId,
        step: 'liveness',
        operation: 'liveness_submit',
      });
      setMessage('Erreur lors de la vérification liveness. Veuillez réessayer.');
      setStatus('fail');
    }
  };

  const handleRetry = async () => {
    incrementLivenessAttempt();
    if (livenessAttempts >= 3) {
      setMessage('Plusieurs tentatives échouées. Vérifiez votre connexion ou continuez en agence.');
    }

    setMessage('Tentative relancée. Veuillez recommencer le challenge.');
    capturedLandmarksRef.current = [];
    startCamera();
    await runKycSyncNow().catch(() => {
      // Best effort sync on retry restart.
    });
  };

  const handleRestartSession = async () => {
    try {
      localStorage.removeItem('vp_kyc_cache');
      sessionStorage.removeItem('vp_kyc_cache');
      await fetchWithCorrelation('/api/v1/kyc/session/start', {
        method: 'POST',
      });
    } catch {
      // Best effort reset.
    } finally {
      resetLivenessAttempts();
      navigate('/kyc/cni-intro');
    }
  };

  const handleGoToBranch = () => {
    window.location.href = 'tel:+237612345678';
  };

  const getOvalBorderColor = () => {
    if (!faceDetected) return 'border-destructive';
    if (validationPulse) return 'border-success';
    return 'border-warning';
  };

  const holdProgressPercent = validationPulse ? 100 : Math.min(challengeProgress * 100, 100);
  const currentStepNumber = currentChallenge + 1;
  const totalStepCount = CHALLENGES.length;
  const ensureSessionId = () => {
    if (sessionId) return sessionId;
    const generated = `offline-${Date.now()}`;
    setSessionId(generated);
    return generated;
  };

  return (
    <ScreenLayoutV2 title={t('liveness.intro.title') !== 'liveness.intro.title' ? t('liveness.intro.title') : 'Vérification de vie'} showBack>
      <div className="flex flex-col items-center gap-6 py-6 w-full max-w-sm mx-auto h-full justify-center">

        {(status === 'loading' || status === 'ready') && (
          <div className="flex flex-col items-center justify-center gap-6 py-12 animate-in fade-in duration-500">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
            <p className="text-lg text-muted-foreground font-medium text-center">Initialisation de la caméra<br />et du modèle biométrique...</p>
          </div>
        )}

        {status === 'challenge' && (
          <div className="w-full flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
            <div className={`relative w-[280px] h-[360px] rounded-[140px] overflow-hidden border-[6px] transition-colors duration-300 ${getOvalBorderColor()} shadow-[0_0_30px_rgba(0,0,0,0.15)]`}>
              <video
                ref={videoCallbackRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <canvas ref={(node) => { selfieCanvasRef.current = node; }} className="hidden" />
              <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.4)] pointer-events-none rounded-[140px]"></div>

              {!faceDetected && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
                  <div className="w-40 h-56 border-2 border-dashed border-white/50 rounded-[100px]"></div>
                </div>
              )}
            </div>

            <div className="bg-primary/5 px-8 py-4 rounded-2xl border border-primary/20 w-full shadow-sm">
              <p className="text-xl font-bold text-primary text-center">
                {getChallengeInstruction(CHALLENGES[currentChallenge])}
              </p>
            </div>

            <div className="flex gap-3 mt-2" aria-label={`Étape ${currentStepNumber} sur ${totalStepCount}`}>
              {CHALLENGES.map((challenge, i) => (
                <div
                  key={challenge}
                  aria-label={`${getChallengeInstruction(challenge)} - ${i < currentChallenge ? 'validée' : i === currentChallenge ? 'en cours' : 'à venir'}`}
                  className={`w-4 h-4 rounded-full transition-all duration-300 ${i < currentChallenge ? 'bg-success scale-110' : i === currentChallenge ? 'bg-primary ring-4 ring-primary/30' : 'bg-muted'}`}
                />
              ))}
            </div>

            <div
              className="w-full h-3 bg-muted rounded-full overflow-hidden mt-2 border border-black/5"
              role="progressbar"
              aria-label={translateGuidance('liveness.guidance.validating')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(holdProgressPercent)}
            >
              <div
                className="h-full bg-success transition-all duration-200"
                style={{ width: `${holdProgressPercent}%` }}
              ></div>
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              {validationPulse
                ? t('liveness.guidance.step_validated') !== 'liveness.guidance.step_validated'
                  ? t('liveness.guidance.step_validated')
                  : 'Étape validée'
                : `Étape ${currentStepNumber}/${totalStepCount} · ${Math.round(holdProgressPercent)}%`}
            </p>

            {message && (
              <div className="animate-in slide-in-from-bottom flex items-start gap-2 bg-destructive/10 text-destructive px-4 py-3 rounded-xl text-sm font-semibold text-left border border-destructive/20 shadow-sm w-full">
                <XCircle className="w-5 h-5 shrink-0" />
                <p>{message}</p>
              </div>
            )}
            {!message && guidance && faceDetected && (
              <div className="animate-in slide-in-from-bottom bg-primary/10 text-primary px-4 py-3 rounded-xl text-sm font-semibold text-center border border-primary/20 shadow-sm w-full">
                {guidance}
              </div>
            )}
            {!message && !faceDetected && (
              <p className="text-sm text-muted-foreground animate-pulse">Positionnez votre visage dans l'ovale</p>
            )}
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center justify-center gap-6 py-12 animate-in fade-in zoom-in duration-500 w-full">
            <div className="w-28 h-28 bg-success/10 rounded-full flex items-center justify-center border-4 border-success/20">
              <CheckCircle className="w-16 h-16 text-success" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">
                {t('liveness.success.title') !== 'liveness.success.title' ? t('liveness.success.title') : 'Vérification réussie'}
              </h2>
              <p className="text-muted-foreground mt-2">
                {t('liveness.success.subtitle') !== 'liveness.success.subtitle' ? t('liveness.success.subtitle') : 'Votre identité a été confirmée.'}
              </p>
            </div>
            <Button onClick={handleSubmit} className="w-full h-14 mt-8">
              Continuer
            </Button>
          </div>
        )}

        {status === 'fail' && (
          <div className="flex flex-col items-center justify-center gap-6 py-12 w-full animate-in fade-in zoom-in">
            <div className="w-28 h-28 bg-destructive/10 rounded-full flex items-center justify-center border-4 border-destructive/20">
              <XCircle className="w-16 h-16 text-destructive" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Échec</h2>
              <p className="text-sm text-destructive font-medium mt-2 max-w-[250px]">{message}</p>
            </div>
            <Button onClick={handleRetry} variant="secondary" className="w-full h-14 mt-8 gap-2">
              <Camera className="w-5 h-5" />
              Réessayer
            </Button>
          </div>
        )}

        {status === 'locked' && (
          <div className="flex flex-col items-center justify-center gap-6 py-12 w-full animate-in fade-in zoom-in">
            <div className="w-28 h-28 bg-destructive/10 rounded-full flex items-center justify-center border-4 border-destructive/20">
              <XCircle className="w-16 h-16 text-destructive" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Session verrouillée</h2>
              <p className="text-sm text-destructive font-medium mt-2 max-w-[280px]">{message}</p>
              <p className="text-sm text-muted-foreground mt-3">Nouvelle tentative possible dans {cooldownSeconds}s</p>
            </div>
            <Button
              onClick={handleRestartSession}
              disabled={cooldownSeconds > 0}
              variant="secondary"
              className="w-full h-14"
            >
              Recommencer
            </Button>
            <Button
              onClick={handleGoToBranch}
              variant="outline"
              className="w-full h-14"
            >
              Aller en agence
            </Button>
          </div>
        )}
      </div>
    </ScreenLayoutV2>
  );
}
