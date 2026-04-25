import { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { useKyc } from '../../contexts/KycContext';
import { PenLine, RotateCcw, CheckCircle, Loader2 } from 'lucide-react';
import { fetchWithCorrelation } from '../../services/apiClient';
import { enqueueOfflineSignature } from '../../services/kycSyncService';

export default function SignatureScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { setSignature, completeStep, sessionId, setSessionId } = useKyc();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return ctx;
  }, []);

  const getCoordinates = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDrawing = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
  }, [getCtx, getCoordinates]);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  }, [isDrawing, getCtx, getCoordinates]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    const ctx = getCtx();
    if (ctx) ctx.closePath();
  }, [getCtx]);

  const clearCanvas = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setError('');
  }, [getCtx]);

  const handleSubmit = async () => {
    if (!hasDrawn) {
      setError('Veuillez signer dans la zone ci-dessus.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    setSubmitting(true);
    try {
      const signatureData = canvas.toDataURL('image/png');
      setSignature(signatureData);
      const sid = sessionId || `offline-${Date.now()}`;
      if (!sessionId) setSessionId(sid);

      const online = typeof navigator !== 'undefined' && navigator.onLine;
      let submitted = false;

      if (online) {
        try {
          await fetchWithCorrelation('/api/v1/kyc/signature/submit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ signature_data: signatureData }),
          });
          submitted = true;
        } catch (err) {
          console.error('Signature submit error:', err);
        }
      }

      if (!submitted) {
        // Offline or online failed — enqueue for sync on reconnect
        await enqueueOfflineSignature({ sessionId: sid, signatureData });
      }

      completeStep('signature');
      navigate('/kyc/review');
    } catch (err) {
      console.error('Signature submit error:', err);
      // Continue anyway - signature is stored in context
      completeStep('signature');
      navigate('/kyc/review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenLayout title={t('signature.title') || 'Signature électronique'} showBack>
      <div className="flex flex-col gap-4 py-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <PenLine className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                {t('signature.instruction') || 'Signez pour confirmer votre identité'}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Cette signature sera associée à votre dossier KYC et a une valeur légale.
              </p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              width={600}
              height={250}
              className="w-full h-[250px] touch-none cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          {!hasDrawn && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-slate-300 text-lg font-medium">Signez ici</p>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={clearCanvas}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Effacer
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !hasDrawn}
            className="flex-[2] flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            {submitting ? 'Enregistrement...' : (t('common.continue') || 'Continuer')}
          </button>
        </div>
      </div>
    </ScreenLayout>
  );
}
