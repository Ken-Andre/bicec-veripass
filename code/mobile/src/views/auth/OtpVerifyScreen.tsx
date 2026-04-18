import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenLayout } from '../../components/ScreenLayout';
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
    if (!identifier) {
      navigate('/auth/phone');
      return;
    }
    inputRefs.current[0]?.focus();
  }, [identifier, navigate]);

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

      // Login flow: after phone OTP verify, go directly to PIN login
      if (mode === 'login') {
        navigate('/auth/pin-login', { replace: true });
      } else {
        // Signup flow: go to email entry
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
      console.error("Resend error", err);
    }
  };

  return (
    <ScreenLayout showBack title="Sécurité">
      <div className="flex-1 flex flex-col pt-4">
        <div className="space-y-8 flex-1">
          <div className="space-y-3">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <MessageSquareCheck className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-primary">Vérification</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Nous avons envoyé un code à 6 chiffres sur le <span className="font-bold text-slate-800">{identifier}</span>
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
                  digit ? 'border-primary bg-white shadow-sm' : 'border-slate-100 bg-slate-50',
                  'focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white',
                )}
              />
            ))}
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl animate-shake">
              <p className="text-red-600 text-sm font-semibold text-center">{error}</p>
            </div>
          )}

          <div className="text-center pt-2">
            <button
              onClick={handleResend}
              disabled={resendTimer > 0}
              className="text-sm font-bold text-primary active:opacity-70 disabled:text-slate-400 transition-colors uppercase tracking-widest"
            >
              {resendTimer > 0 ? `Renvoyer (${resendTimer}s)` : "Renvoyer le code"}
            </button>
          </div>
        </div>

        <div className="pt-8 pb-4">
          <button
            onClick={handleVerify}
            disabled={!isComplete || loading}
            className="bicec-button w-full h-16 text-lg"
          >
            {loading ? (
              <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Valider le compte'
            )}
          </button>
        </div>
      </div>
    </ScreenLayout>
  );
};

export default OtpVerifyScreen;
