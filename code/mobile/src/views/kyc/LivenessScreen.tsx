import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { CheckCircle, XCircle, Loader2, Camera } from 'lucide-react';
import { initFaceLandmarker, detectForVideo, isFacePresent, computeSmileScore, computeEAR, computeYawAngle } from '../../services/mediapipeService';

type ChallengeType = 'smile' | 'blink' | 'turn_left' | 'turn_right';

const CHALLENGES: ChallengeType[] = ['smile', 'blink', 'turn_left'];
const HOLD_FRAMES = 8;
const NO_FACE_TIMEOUT_MS = 5000;

export default function LivenessScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { resetLivenessAttempts, incrementLivenessAttempt, livenessAttempts, completeStep } = useKyc();

  const [status, setStatus] = useState<'loading' | 'ready' | 'challenge' | 'success' | 'fail'>('loading');
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const [holdCount, setHoldCount] = useState(0);
  const [message, setMessage] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastFaceTimeRef = useRef<number>(0);

  const getChallengeInstruction = (type: ChallengeType) => {
    switch (type) {
      case 'smile': return t('liveness.challenge.smile') !== 'liveness.challenge.smile' ? t('liveness.challenge.smile') : 'Souriez naturellement';
      case 'blink': return t('liveness.challenge.blink') !== 'liveness.challenge.blink' ? t('liveness.challenge.blink') : 'Clignez des yeux';
      case 'turn_left': return t('liveness.challenge.turn') !== 'liveness.challenge.turn' ? t('liveness.challenge.turn') : 'Tournez la tête à gauche';
      case 'turn_right': return 'Tournez la tête à droite';
    }
  };

  const checkChallenge = useCallback((type: ChallengeType, landmarks: unknown): boolean => {
    if (!landmarks || !Array.isArray(landmarks)) return false;
    // Internal cast for ease of access if needed, or better: define landmarks type
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
      setMessage(`${t('liveness.camera.error') !== 'liveness.camera.error' ? t('liveness.camera.error') : 'Erreur caméra'} - ${error.message}`);
      setStatus('fail');
    }
  }, [t]);

  // Use a callback ref to bind the stream instantly once video component mounts
  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(console.error);
    }
  }, []);

  // Detection loop
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
                } else {
                  setStatus('success');
                  stopCamera();
                  return next;
                }
              }
              return next;
            });
          } else {
            setHoldCount(prev => Math.max(0, prev - 1));
          }
        } else {
          setHoldCount(0);
          if (lastFaceTimeRef.current !== 0 && Date.now() - lastFaceTimeRef.current > NO_FACE_TIMEOUT_MS) {
            setMessage(t('liveness.face.not_detected') !== 'liveness.face.not_detected' ? t('liveness.face.not_detected') : 'Visage non détecté. Placez-vous dans le cercle.');
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

  const handleSubmit = async () => {
    try {
      completeStep('liveness');
      resetLivenessAttempts();
      navigate('/kyc/address');

      const token = localStorage.getItem('vp_token');
      // Fire and forget: submit the completion data
      fetch('/api/v1/kyc/liveness/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ landmarks_json: [{ timestamp: Date.now(), landmarks: [] }], challenge_type: CHALLENGES[currentChallenge] }),
      }).catch(console.error);
    } catch {
      navigate('/kyc/address');
    }
  };

  const handleRetry = () => {
    incrementLivenessAttempt();
    if (livenessAttempts >= 2) {
      setMessage('Trop de tentatives échouées. Veuillez réinitialiser.');
    } else {
      startCamera();
    }
  };

  const getOvalBorderColor = () => {
    if (!faceDetected) return 'border-red-500';
    if (holdCount > 0) return 'border-green-500';
    return 'border-orange-500';
  };

  const holdProgressPercent = Math.min((holdCount / HOLD_FRAMES) * 100, 100);

  return (
    <ScreenLayout title={t('liveness.intro.title') !== 'liveness.intro.title' ? t('liveness.intro.title') : 'Vérification Faciale'} showBack>
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
              <h2 className="text-2xl font-bold text-slate-800">Vérification réussie</h2>
              <p className="text-muted-foreground mt-2">Votre identité a été confirmée.</p>
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
              <h2 className="text-2xl font-bold text-slate-800">Échec</h2>
              <p className="text-sm text-red-600 font-medium mt-2 max-w-[250px]">{message}</p>
            </div>
            <button onClick={handleRetry} disabled={livenessAttempts >= 2} className="flex justify-center items-center gap-2 w-full h-14 rounded-2xl text-base font-semibold bg-slate-900 text-white mt-8 hover:bg-slate-800 transition-colors disabled:opacity-50 active:scale-[0.98]">
              <Camera className="w-5 h-5" />
              {livenessAttempts >= 2 ? 'Session bloquée' : 'Réessayer'}
            </button>
          </div>
        )}
      </div>
    </ScreenLayout>
  );
}