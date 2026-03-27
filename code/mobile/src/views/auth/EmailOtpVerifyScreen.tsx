import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../lib/utils';

const EmailOtpVerifyScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  useEffect(() => {
    if (!user) {
      navigate('/auth/phone');
      return;
    }
    inputRefs.current[0]?.focus();
  }, [user, navigate]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    paste.split('').forEach((c, i) => { newCode[i] = c; });
    setCode(newCode);
    inputRefs.current[Math.min(paste.length, 5)]?.focus();
  };

  const fullCode = code.join('');
  const isComplete = fullCode.length === 6;

  const handleVerify = async () => {
    if (!isComplete) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/auth/email/verify', { otp: fullCode });

      // Email verified, proceed to PIN setup
      if (!user?.has_pin) {
        navigate('/auth/pin-setup');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Code invalide');
      setCode(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || !user?.email) return;
    setResendTimer(60);
    try {
      await apiClient.post('/auth/email/send', { email: user.email });
    } catch (err) {
      console.error("Resend error", err);
    }
  };

  const handleSkip = () => {
    if (!user?.has_pin) {
      navigate('/auth/pin-setup');
    } else {
      navigate('/');
    }
  };

  return (
    <ScreenLayout showBack>
      <div className="flex-1 flex flex-col justify-between p-6 pt-12">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Vérification email</h1>
          <p className="text-muted-foreground text-sm">
            Saisissez le code envoyé à <span className="font-semibold text-foreground">{user?.email}</span>
          </p>

          <div className="flex justify-center gap-3 pt-8" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={cn(
                  'h-14 w-12 rounded-xl border-2 bg-card text-center text-xl font-bold transition-all outline-none',
                  digit ? 'border-primary' : 'border-border',
                  'focus:border-primary focus:ring-2 focus:ring-primary/20',
                )}
              />
            ))}
          </div>

          {error && <p className="text-destructive text-sm text-center mt-4 font-medium">{error}</p>}

          <div className="pt-6 text-center">
            <button
              onClick={handleResend}
              disabled={resendTimer > 0}
              className="text-sm font-medium text-primary disabled:text-muted-foreground transition-colors"
            >
              {resendTimer > 0 ? `Renvoyer le code (${resendTimer}s)` : "Renvoyer le code"}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleVerify}
            disabled={!isComplete || loading}
            className="w-full bg-primary text-primary-foreground font-semibold h-14 rounded-2xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Vérification...' : 'Confirmer'}
          </button>
          <button
            onClick={handleSkip}
            className="w-full text-muted-foreground font-medium h-12 rounded-2xl active:scale-[0.98] transition-all"
          >
            Passer cette étape
          </button>
        </div>
      </div>
    </ScreenLayout>
  );
};

export default EmailOtpVerifyScreen;