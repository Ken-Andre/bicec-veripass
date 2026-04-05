import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { initFaceLandmarker, detectForVideo, isFacePresent, computeSmileScore, computeEAR, computeYawAngle } from '../../services/mediapipeService';

type ChallengeType = 'smile' | 'blink' | 'turn_left' | 'turn_right';

const CHALLENGES: ChallengeType[] = ['smile', 'blink', 'turn_left'];
const HOLD_FRAMES = 8;

export default function LivenessScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { resetLivenessAttempts } = useKyc();

  const [status, setStatus] = useState<'loading' | 'ready' | 'challenge' | 'success' | 'fail'>('loading');
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const [, setHoldCount] = useState(0);
  const [message, setMessage] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);

  const challengeInstructions: Record<ChallengeType, string> = {
    smile: t('liveness.challenge.smile') || 'Souriez !',
    blink: t('liveness.challenge.blink') || 'Clignez des yeux',
    turn_left: t('liveness.challenge.turn') || 'Tournez à gauche',
    turn_right: t('liveness.challenge.turn') || 'Tournez à droite',
  };

  const checkChallenge = useCallback((type: ChallengeType, landmarks: Parameters<typeof computeSmileScore>[0]): boolean => {
    switch (type) {
      case 'smile': return computeSmileScore(landmarks) > 0.3;
      case 'blink': return computeEAR(landmarks) < 0.2;
      case 'turn_left': return computeYawAngle(landmarks) < -15;
      case 'turn_right': return computeYawAngle(landmarks) > 15;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      await initFaceLandmarker();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('challenge');
      setCurrentChallenge(0);
      setHoldCount(0);
    } catch {
      setMessage(t('liveness.camera.error'));
      setStatus('fail');
    }
  }, [t]);

  // Detection loop
  useEffect(() => {
    if (status !== 'challenge') return;

    const detect = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      const result = detectForVideo(videoRef.current, performance.now());
      if (isFacePresent(result.faceLandmarks)) {
        const landmarks = result.faceLandmarks[0];
        const challengeType = CHALLENGES[currentChallenge];

        if (checkChallenge(challengeType, landmarks)) {
          setHoldCount(prev => {
            const next = prev + 1;
            if (next >= HOLD_FRAMES) {
              // Challenge passed
              if (currentChallenge < CHALLENGES.length - 1) {
                setCurrentChallenge(c => c + 1);
                return 0;
              } else {
                // All challenges passed
                setStatus('success');
                return next;
              }
            }
            return next;
          });
        } else {
          setHoldCount(0);
        }
      } else {
        setMessage(t('liveness.face.not_detected'));
        setHoldCount(0);
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };

    animFrameRef.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [status, currentChallenge, checkChallenge, t]);

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('access_token');
      await fetch('/api/v1/kyc/liveness/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ landmarks_json: [{ timestamp: Date.now(), landmarks: [] }], challenge_type: CHALLENGES[currentChallenge] }),
      });
      resetLivenessAttempts();
      navigate('/kyc/address');
    } catch {
      navigate('/kyc/address');
    }
  };

  return (
    <ScreenLayout title={t('liveness.intro.title')} showBack>
      <div className="flex flex-col items-center gap-4 py-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('liveness.loading.model')}</p>
            <button onClick={startCamera} className="bg-primary text-primary-foreground px-6 py-2 rounded-lg">
              {t('capture.open.camera')}
            </button>
          </>
        )}

        {status === 'challenge' && (
          <>
            <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-primary">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
            <p className="text-lg font-bold text-center">{challengeInstructions[CHALLENGES[currentChallenge]]}</p>
            <div className="flex gap-1">
              {CHALLENGES.map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full ${i <= currentChallenge ? 'bg-primary' : 'bg-muted'}`} />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{t('liveness.challenge.progress')}</p>
            {message && <p className="text-sm text-yellow-600">{message}</p>}
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500" />
            <h2 className="text-xl font-bold">{t('liveness.success')}</h2>
            <button onClick={handleSubmit} className="w-full max-w-sm bg-primary text-primary-foreground py-3 rounded-lg">
              {t('common.continue')}
            </button>
          </>
        )}

        {status === 'fail' && (
          <>
            <XCircle className="w-16 h-16 text-red-500" />
            <h2 className="text-xl font-bold">{t('liveness.fail.title')}</h2>
            <p className="text-sm text-muted-foreground text-center">{message}</p>
            <button onClick={() => { setStatus('loading'); }} className="w-full max-w-sm bg-primary text-primary-foreground py-3 rounded-lg">
              {t('liveness.fail.retry')}
            </button>
          </>
        )}
      </div>
    </ScreenLayout>
  );
}