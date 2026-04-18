import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { CheckCircle, XCircle, Loader2, Camera } from 'lucide-react';
import { initFaceLandmarker, detectForVideo, isFacePresent, computeSmileScore, computeEAR, computeYawAngle } from '../../services/mediapipeService';
import type { LivenessResult } from '../../types';
import { enqueueOfflineLivenessCapture, runKycSyncNow, safeSubmitLiveness } from '../../services/kycSyncService';
import { captureKycException } from '../../services/sentry';

type ChallengeType = 'smile' | 'blink' | 'turn_left' | 'turn_right';

const CHALLENGES: ChallengeType[] = ['smile', 'blink', 'turn_left'];
const HOLD_FRAMES = 8;
const NO_FACE_TIMEOUT_MS = 5000;

export default function LivenessScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { resetLivenessAttempts, incrementLivenessAttempt, livenessAttempts, completeStep, sessionId, setSessionId } = useKyc();

  const [status, setStatus] = useState<'loading' | 'ready' | 'challenge' | 'success' | 'fail' | 'locked'>('loading');
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const [holdCount, setHoldCount] = useState(0);
  const [message, setMessage] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastFaceTimeRef = useRef<number>(0);

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
      setHoldCount(0);
      setMessage('');
      lastFaceTimeRef.current = Date.now();
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

  const submitLiveness = useCallback(async (landmarks: Array<Record<string, unknown>>, challengeType: ChallengeType): Promise<LivenessResult> => {
    return await safeSubmitLiveness({ landmarks_json: landmarks, challenge_type: challengeType });
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
          const type = CHALLENGES[currentChallenge];

          if (checkChallenge(type, landmarks)) {
            setHoldCount(prev => {
              const next = prev + 1;
              if (next >= HOLD_FRAMES) {
                if (currentChallenge < CHALLENGES.length - 1) {
                  setCurrentChallenge(c => c + 1);
                  return 0;
                }
                setStatus('success');
                stopCamera();
                return next;
              }
              return next;
            });
          } else {
            setHoldCount(prev => Math.max(0, prev - 1));
          }
        } else {
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
    const payload = [{ timestamp: Date.now(), landmarks: [{ x: 0.1, y: 0.1, z: 0 }] }];
    try {
      const result = await submitLiveness(payload, CHALLENGES[currentChallenge]);

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
          challengeType: CHALLENGES[currentChallenge],
          landmarks: payload,
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
    try {
      const retryPayload: Array<Record<string, unknown>> = [];
      const result = await submitLiveness(retryPayload, CHALLENGES[currentChallenge]);
      incrementLivenessAttempt();

      if (result.is_locked || result.strikes_remaining === 0 || livenessAttempts >= 2) {
        setCooldownSeconds(result.cooldown_seconds ?? 60);
        setMessage('Desole pour la gene, mais pour des raisons techniques/securite, cette session est terminee.');
        setStatus('locked');
        stopCamera();
        return;
      }

      setMessage('Tentative enregistree. Veuillez recommencer le challenge.');
      startCamera();
      await runKycSyncNow();
    } catch (err) {
      const networkLike = err instanceof TypeError || (err instanceof Error && err.message.toLowerCase().includes('fetch'));
      if (networkLike) {
        await enqueueOfflineLivenessCapture({
          sessionId: ensureSessionId(),
          challengeType: CHALLENGES[currentChallenge],
          landmarks: [],
        });
        incrementLivenessAttempt();
        setMessage('Tentative queue offline. Synchronisation automatique au retour reseau.');
        startCamera();
        return;
      }
      captureKycException(err, 'liveness_failure', {
        sessionId,
        step: 'liveness',
        operation: 'liveness_retry',
      });
      setMessage('Impossible d enregistrer la tentative. Verifiez votre connexion.');
      setStatus('fail');
    }
  };

  const handleRestartSession = async () => {
    try {
      const token = localStorage.getItem('vp_token');
      localStorage.removeItem('vp_kyc_cache');
      sessionStorage.removeItem('vp_kyc_cache');
      await fetch('/api/v1/kyc/session/start', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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
