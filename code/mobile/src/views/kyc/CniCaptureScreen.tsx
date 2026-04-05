import { useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { Camera, CheckCircle, AlertTriangle } from 'lucide-react';

export default function CniCaptureScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const side = location.pathname.includes('verso') ? 'verso' : 'recto';

  const [status, setStatus] = useState<'ready' | 'capturing' | 'success' | 'error'>('ready');
  const [quality, setQuality] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStatus('capturing');
    } catch {
      setStatus('error');
    }
  }, []);

  const capture = useCallback(async () => {
    if (!videoRef.current) return;

    // Simulate quality check
    setQuality(t('capture.quality.analyzing'));

    // Create canvas and capture
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);

    // Convert to blob
    canvas.toBlob(async (blob) => {
      if (!blob) return;

      // Upload to API
      const formData = new FormData();
      formData.append('file', blob, `cni_${side}.jpg`);
      formData.append('doc_type', `CNI_${side.toUpperCase()}`);

      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch('/api/v1/kyc/document/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (res.ok) {
          setQuality(t('capture.quality.good'));
          setStatus('success');
          setTimeout(() => {
            navigate(side === 'recto' ? '/kyc/cni-verso' : '/kyc/ocr-review');
          }, 1500);
        } else {
          setQuality(t('capture.quality.adjust'));
        }
      } catch {
        setQuality(t('capture.quality.adjust'));
      }
    }, 'image/jpeg', 0.9);
  }, [side, t, navigate]);

  return (
    <ScreenLayout title={t(`cni.${side}.title`)} showBack>
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="relative w-full max-w-md aspect-[1.6] rounded-xl overflow-hidden bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute inset-4 border-2 border-white/50 rounded-lg" />
          <p className="absolute bottom-4 left-0 right-0 text-center text-white text-sm bg-black/50 py-2">
            {t(`cni.${side}.tip`)}
          </p>
        </div>

        {quality && (
          <div className={`flex items-center gap-2 text-sm ${status === 'success' ? 'text-green-600' : 'text-yellow-600'}`}>
            {status === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {quality}
          </div>
        )}

        {status === 'ready' && (
          <button
            onClick={startCamera}
            className="w-full max-w-sm bg-primary text-primary-foreground py-3 rounded-lg font-medium flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            {t('capture.open.camera')}
          </button>
        )}

        {status === 'capturing' && (
          <div className="flex gap-3 w-full max-w-sm">
            <button onClick={capture} className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-medium">
              {t('capture.manual')}
            </button>
          </div>
        )}

        {status === 'success' && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span>{t('capture.success')}</span>
          </div>
        )}

        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>💡 {t('capture.tip.light')}</span>
          <span>💡 {t('capture.tip.steady')}</span>
        </div>
      </div>
    </ScreenLayout>
  );
}