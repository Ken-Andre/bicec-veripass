import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { CheckCircle, XCircle, Loader2, Camera } from 'lucide-react';
import { initFaceLandmarker, detectForVideo, isFacePresent, computeSmileScore, computeEAR, computeYawAngle } from '../../services/mediapipeService';
import type { LivenessResult } from '../../types';
import { enqueueOfflineLivenessCapture, runKycSyncNow, safeSubmitLiveness } from '../../services/kycSyncService';
import { fetchWithCorrelation } from '../../services/apiClient';
import { captureKycException, captureKycMessage } from '../../services/sentry';

type ChallengeType = 'smile' | 'blink' | 'turn_left' | 'turn_right';

const CHALLENGES: ChallengeType[] = ['smile', 'blink', 'turn_left'];
const HOLD_FRAMES = 8;
const NO_FACE_TIMEOUT_MS = 5000;
const MAX_LANDMARK_FRAMES = 48;

export default function LivenessScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { resetLivenessAttempts, incrementLivenessAttempt, livenessAttempts, completeStep, sessionId, setSessionId } = useKyc();

  const [status, setStatus] = useState<'loading' | 'ready' | 'challenge' | 'success' | 'fail' | 'locked'>('loading');
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const holdCountRef = useRef(0);
  const [holdCount, setHoldCount] = useState(0); // Mirror of holdCountRef for re-renders
  const [message, setMessage] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastFaceTimeRef = useRef<number>(0);
  const capturedLandmarksRef = useRef<Array<Record<string, unknown>>>([]);
  const selfieCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const selfieDataUrlRef = useRef<string | null>(null);
  const challengeCompleteRef = useRef(false);

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
  const uploadSelfie = useCallback(async (): Promise<boolean> => {
    const dataUrl = selfieDataUrlRef.current;
    if (!dataUrl) {
      captureKycMessage('No selfie frame captured, skipping selfie upload', 'upload_failure', {
        sessionId,
        step: 'liveness',
        operation: 'selfie_upload_no_frame',
      });
      return false;
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
        throw new Error(`selfie_upload_failed_${res.status}: ${JSON.stringify(detail)}`);
      }
      return true;
    } catch (err) {
      // Queue for offline retry — store selfie in liveness offline payload
      captureKycException(err, 'upload_failure', {
        sessionId: stableSessionId,
        step: 'liveness',
        operation: 'selfie_upload',
        extra: { queued_offline: true },
      });
      // Fall through — liveness submit will include selfie in offline queue
      return false;
    }
  }, [computeSha256, sessionId]);

  const getChallengeInstruction = (type: ChallengeType) => {
    switch (type) {
      case 'smile': return t('liveness.challenge.smile') !== 'liveness.challenge.smile' ? t('liveness.challenge.smile') : 'Souriez naturellement';
      case 'blink': return t('liveness.challenge.blink') !== 'liveness.challenge.blink' ? t('liveness.challenge.blink') : 'Clignez des yeux';
      case 'turn_left': return t('liveness.challenge.turn') !== 'liveness.challenge.turn' ? t('liveness.challenge.turn') : 'Tournez la tete a gauche';
      case 'turn_right': return 'Tournez la tete a droite';
    }
  };

  const checkChallenge = useCallback((type: ChallengeType, landmarks: unknown): boolean => {
    if (!landmarks || !Array.isArray(landmarks)) return false;
    switch (type) {
      case 'smile': return computeSmileScore(landmarks) > 0.3;
      case 'blink': return computeEAR(landmarks) < 0.2;
      case 'turn_left': return computeYawAngle(landmarks) < -15;
      case 'turn_right': return computeYawAngle(landmarks) > 15;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
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
      setHoldCount(0);
      challengeCompleteRef.current = false;
      setMessage('');
      lastFaceTimeRef.current = Date.now();
      capturedLandmarksRef.current = [];
      selfieDataUrlRef.current = null;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Camera access error:', error);
      captureKycException(error, 'camera_error', {
        sessionId,
        step: 'liveness',
        operation: 'liveness_camera_init',
      });
      setMessage(`${t('liveness.camera.error') !== 'liveness.camera.error' ? t('liveness.camera.error') : 'Erreur camera'} - ${error.message}`);
      setStatus('fail');
    }
  }, [t, sessionId]);

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

          if (checkChallenge(type, landmarks)) {
            holdCountRef.current += 1;
            setHoldCount(holdCountRef.current);
            if (holdCountRef.current >= HOLD_FRAMES) {
              if (currentChallenge < CHALLENGES.length - 1) {
                holdCountRef.current = 0;
                setHoldCount(0);
                setCurrentChallenge(c => c + 1);
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
            setHoldCount(holdCountRef.current);
          }
        } else {
          holdCountRef.current = 0;
          setHoldCount(0);
          if (lastFaceTimeRef.current !== 0 && Date.now() - lastFaceTimeRef.current > NO_FACE_TIMEOUT_MS) {
            setMessage(t('liveness.face.not_detected') !== 'liveness.face.not_detected' ? t('liveness.face.not_detected') : 'Visage non detecte. Placez-vous dans le cercle.');
          }
        }
      } catch {
        // Mediapipe not ready or frame skipped
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };

    animFrameRef.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [status, currentChallenge, checkChallenge, stopCamera, t]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
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
      setMessage('Aucune donnee biometrie capturee. Veuillez recommencer la verification.');
      setStatus('fail');
      return;
    }

    // Upload selfie BEFORE liveness submit so the backend has the SELFIE
    // document available for face matching in compute_face_match_score_for_session.
    const selfieOk = await uploadSelfie();

    try {
      const finalChallenge = CHALLENGES[Math.min(currentChallenge, CHALLENGES.length - 1)];
      const result = await submitLiveness(payload, finalChallenge);

      if (result.is_locked || result.strikes_remaining === 0) {
        setCooldownSeconds(result.cooldown_seconds ?? 60);
        setMessage('Session verrouillee temporairement apres 3 echecs. Vous pouvez recommencer ou aller en agence.');
        setStatus('locked');
        stopCamera();
        return;
      }

      completeStep('liveness');
      resetLivenessAttempts();
      navigate('/kyc/address');
      await runKycSyncNow();
    } catch (err) {
      const networkLike = err instanceof TypeError || (err instanceof Error && err.message.toLowerCase().includes('fetch'));
      if (networkLike) {
        await enqueueOfflineLivenessCapture({
          sessionId: ensureSessionId(),
          challengeType: CHALLENGES[Math.min(currentChallenge, CHALLENGES.length - 1)],
          landmarks: payload,
          selfieDataUrl: selfieOk ? undefined : (selfieDataUrlRef.current ?? undefined), // Only include selfie in offline queue if online upload failed
        });
        completeStep('liveness');
        resetLivenessAttempts();
        setMessage('Connexion indisponible. La verification sera synchronisee automatiquement au retour reseau.');
        navigate('/kyc/address');
        return;
      }
      captureKycException(err, 'match_error', {
        sessionId,
        step: 'liveness',
        operation: 'liveness_submit',
      });
      setMessage('Erreur lors de la verification liveness. Veuillez reessayer.');
      setStatus('fail');
    }
  };

  const handleRetry = async () => {
    incrementLivenessAttempt();
    if (livenessAttempts >= 2) {
      setCooldownSeconds(60);
      setMessage('Desole pour la gene, mais pour des raisons techniques/securite, cette session est terminee.');
      setStatus('locked');
      stopCamera();
      return;
    }

    setMessage('Tentative relancee. Veuillez recommencer le challenge.');
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
    if (!faceDetected) return 'border-red-500';
    if (holdCount > 0) return 'border-green-500';
    return 'border-orange-500';
  };

  const holdProgressPercent = Math.min((holdCount / HOLD_FRAMES) * 100, 100);
  const ensureSessionId = () => {
    if (sessionId) return sessionId;
    const generated = `offline-${Date.now()}`;
    setSessionId(generated);
    return generated;
  };

  return (
    <ScreenLayout title={t('liveness.intro.title') !== 'liveness.intro.title' ? t('liveness.intro.title') : 'Verification Faciale'} showBack>
      <div className="flex flex-col items-center gap-6 py-6 w-full max-w-sm mx-auto h-full justify-center">

        {(status === 'loading' || status === 'ready') && (
          <div className="flex flex-col items-center justify-center gap-6 py-12 animate-in fade-in duration-500">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
            <p className="text-lg text-muted-foreground font-medium text-center">Initialisation de la camera<br />et du modele biometrique...</p>
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

            <div className="flex gap-3 mt-2">
              {CHALLENGES.map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full transition-all duration-300 ${i < currentChallenge ? 'bg-green-500 scale-110' : i === currentChallenge ? 'bg-primary ring-4 ring-primary/30' : 'bg-muted'}`} />
              ))}
            </div>

            <div className="w-full h-3 bg-muted rounded-full overflow-hidden mt-2 border border-black/5">
              <div
                className="h-full bg-green-500 transition-all duration-200"
                style={{ width: `${holdProgressPercent}%` }}
              ></div>
            </div>

            {message && (
              <div className="animate-in slide-in-from-bottom flex items-start gap-2 bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-semibold text-left border border-red-200 shadow-sm w-full">
                <XCircle className="w-5 h-5 shrink-0" />
                <p>{message}</p>
              </div>
            )}
            {!message && !faceDetected && (
              <p className="text-sm text-muted-foreground animate-pulse">Positionnez votre visage dans l'ovale</p>
            )}
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center justify-center gap-6 py-12 animate-in fade-in zoom-in duration-500 w-full">
            <div className="w-28 h-28 bg-green-50 rounded-full flex items-center justify-center border-4 border-green-100">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-800">Verification reussie</h2>
              <p className="text-muted-foreground mt-2">Votre identite a ete confirmee.</p>
            </div>
            <button onClick={handleSubmit} className="w-full h-14 rounded-2xl text-base font-semibold gradient-primary text-white mt-8 shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity active:scale-[0.98]">
              Continuer
            </button>
          </div>
        )}

        {status === 'fail' && (
          <div className="flex flex-col items-center justify-center gap-6 py-12 w-full animate-in fade-in zoom-in">
            <div className="w-28 h-28 bg-red-50 rounded-full flex items-center justify-center border-4 border-red-100">
              <XCircle className="w-16 h-16 text-red-500" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-800">Echec</h2>
              <p className="text-sm text-red-600 font-medium mt-2 max-w-[250px]">{message}</p>
            </div>
            <button onClick={handleRetry} disabled={livenessAttempts >= 2} className="flex justify-center items-center gap-2 w-full h-14 rounded-2xl text-base font-semibold bg-slate-900 text-white mt-8 hover:bg-slate-800 transition-colors disabled:opacity-50 active:scale-[0.98]">
              <Camera className="w-5 h-5" />
              {livenessAttempts >= 2 ? 'Session bloquee' : 'Reessayer'}
            </button>
          </div>
        )}

        {status === 'locked' && (
          <div className="flex flex-col items-center justify-center gap-6 py-12 w-full animate-in fade-in zoom-in">
            <div className="w-28 h-28 bg-red-50 rounded-full flex items-center justify-center border-4 border-red-100">
              <XCircle className="w-16 h-16 text-red-500" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-800">Session verrouillee</h2>
              <p className="text-sm text-red-600 font-medium mt-2 max-w-[280px]">{message}</p>
              <p className="text-sm text-slate-600 mt-3">Nouvelle tentative possible dans {cooldownSeconds}s</p>
            </div>
            <button
              onClick={handleRestartSession}
              disabled={cooldownSeconds > 0}
              className="w-full h-14 rounded-2xl text-base font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Recommencer
            </button>
            <button
              onClick={handleGoToBranch}
              className="w-full h-14 rounded-2xl text-base font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 transition-colors"
            >
              Aller en agence
            </button>
          </div>
        )}
      </div>
    </ScreenLayout>
  );
}
