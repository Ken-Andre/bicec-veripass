import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../lib/utils';
import { MessageSquareCheck } from 'lucide-react';
import type { OtpVerifyResponse, User } from '../../types';

const OtpVerifyScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { phone, login } = useAuth();
  const mode = location.state?.mode || 'signup';
  const identifier = location.state?.identifier || phone;
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

  const isEmail = identifier?.includes('@');

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

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
    const lastFilledIndex = Math.min(paste.length - 1, 5) + (paste.length < 6 ? 1 : 0);
    inputRefs.current[Math.min(lastFilledIndex, 5)]?.focus();
  };

  const fullCode = code.join('');
  const isComplete = fullCode.length === 6;

  const handleVerify = async () => {
    if (!isComplete || !identifier) return;
    setLoading(true);
    setError('');
    try {
      const payload = isEmail ? { email: identifier, otp: fullCode } : { phone: identifier, otp: fullCode };
      const res = await apiClient.post<OtpVerifyResponse, typeof payload>('/auth/otp/verify', payload);

      const token = res.access_token;
      const userRes = await apiClient.get<User>('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      login(token, userRes);

      if (mode === 'login') {
        localStorage.removeItem('vp_onboarding_flow');
        navigate('/auth/pin-login', { replace: true });
      } else {
        localStorage.setItem('vp_onboarding_flow', '1');
        navigate('/auth/email', { state: { mode } });
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { detail?: string } } };
      setError(apiErr.response?.data?.detail || 'Code invalide ou expiré');
      setCode(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || !identifier) return;
    setResendTimer(60);
    try {
      const payload = isEmail ? { email: identifier } : { phone: identifier };
      await apiClient.post('/auth/otp/send', payload);
    } catch (err) {
      console.error('Resend error', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify();
  };

  // Guard: if identifier was lost (page reload, back navigation), show friendly error
  if (!identifier) {
    return (
      <ScreenLayoutV2 showBack title="Sécurité" center>
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center">
            <MessageSquareCheck className="w-8 h-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Session expirée</h2>
            <p className="text-muted-foreground text-sm">
              Votre session OTP a expiré ou la page a été rechargée. Veuillez recommencer.
            </p>
          </div>
          <Button onClick={() => navigate('/auth/phone')}>
            Retour à l'accueil
          </Button>
        </div>
      </ScreenLayoutV2>
    );
  }

  return (
    <ScreenLayoutV2 showBack title="Sécurité">
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col pt-4">
        <div className="space-y-8 flex-1">
          <div className="space-y-3">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <MessageSquareCheck className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-primary">Vérification</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Nous avons envoyé un code à 6 chiffres sur le <span className="font-bold text-foreground">{identifier}</span>
            </p>
          </div>

          <div className="flex justify-between gap-2 py-8" onPaste={handlePaste}>
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
                  'h-16 w-full max-w-[50px] rounded-2xl border-2 text-center text-2xl font-bold transition-all outline-none',
                  digit ? 'border-primary bg-white shadow-sm' : 'border-muted bg-muted/50',
                  'focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white',
                )}
              />
            ))}
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl animate-shake">
              <p className="text-destructive text-sm font-semibold text-center">{error}</p>
            </div>
          )}

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendTimer > 0}
              className="text-sm font-bold text-primary active:opacity-70 disabled:text-muted-foreground transition-colors uppercase tracking-widest"
            >
              {resendTimer > 0 ? `Renvoyer (${resendTimer}s)` : 'Renvoyer le code'}
            </button>
          </div>
        </div>

        <div className="pt-8 pb-4">
          <Button type="submit" loading={loading} disabled={!isComplete}>
            Valider le compte
          </Button>
        </div>
      </form>
    </ScreenLayoutV2>
  );
};

export default OtpVerifyScreen;
