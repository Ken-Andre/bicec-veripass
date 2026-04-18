import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../lib/utils';
import { Delete, Lock, MessageSquareCheck, Mail } from 'lucide-react';

type Step = 'otp-phone' | 'otp-email' | 'pin';

const ForgotPinScreen = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [step, setStep] = useState<Step>('otp-phone');
  const [phoneCode, setPhoneCode] = useState<string[]>(Array(6).fill(''));
  const [emailCode, setEmailCode] = useState<string[]>(Array(6).fill(''));
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);

  const phoneInputRefs: (HTMLInputElement | null)[] = [];
  const emailInputRefs: (HTMLInputElement | null)[] = [];

  // Must have a user (from lock screen context)
  useEffect(() => {
    if (!user?.phone) {
      navigate('/auth/pin-login', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const authHeaders = (): Record<string, string> =>
    recoveryToken ? { Authorization: `Bearer ${recoveryToken}` } : {};

  // ===== STEP 1: PHONE OTP =====
  if (step === 'otp-phone') {
    const fullCode = phoneCode.join('');
    const isComplete = fullCode.length === 6;

    const handleChange = (index: number, value: string) => {
      if (!/^\d?$/.test(value)) return;
      const newCode = [...phoneCode];
      newCode[index] = value;
      setPhoneCode(newCode);
      if (value && index < 5) phoneInputRefs[index + 1]?.focus();
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !phoneCode[index] && index > 0) {
        phoneInputRefs[index - 1]?.focus();
      }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      const newCode = [...phoneCode];
      paste.split('').forEach((c, i) => { newCode[i] = c; });
      setPhoneCode(newCode);
    };

    const handleVerify = async () => {
      if (!isComplete || !user?.phone) return;
      setLoading(true);
      setError('');
      try {
        interface VerifyResponse {
          access_token?: string;
        }
        const res = await apiClient.post<VerifyResponse, { phone: string; otp: string }>('/auth/otp/verify', {
          phone: user.phone,
          otp: fullCode
        });
        if (res.access_token) {
          setRecoveryToken(res.access_token);
        }
        // If user has email, go to email OTP for extra security
        if (user.email) {
          setStep('otp-email');
          setResendTimer(60);
        } else {
          setStep('pin');
        }
      } catch {
        setError('Code invalide ou expiré');
        setPhoneCode(Array(6).fill(''));
      } finally {
        setLoading(false);
      }
    };

    const handleResend = async () => {
      if (resendTimer > 0 || !user?.phone) return;
      setResendTimer(60);
      try {
        await apiClient.post('/auth/otp/send', { phone: user.phone });
      } catch (err) {
        console.error("Resend error", err);
      }
    };

    return (
      <ScreenLayout showBack title="Vérification SMS">
        <div className="flex-1 flex flex-col pt-4">
          <div className="space-y-8 flex-1">
            <div className="space-y-3">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                <MessageSquareCheck className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-primary">Vérification</h2>
              <p className="text-slate-500 text-lg leading-relaxed">
                Code envoyé au <span className="font-bold text-slate-800">{user?.phone}</span>
              </p>
            </div>

            <div className="flex justify-between gap-2 py-8" onPaste={handlePaste}>
              {phoneCode.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { phoneInputRefs[i] = el; }}
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
                'Vérifier'
              )}
            </button>
          </div>
        </div>
      </ScreenLayout>
    );
  }

  // ===== STEP 2: EMAIL OTP =====
  if (step === 'otp-email') {
    const fullCode = emailCode.join('');
    const isComplete = fullCode.length === 6;

    const handleChange = (index: number, value: string) => {
      if (!/^\d?$/.test(value)) return;
      const newCode = [...emailCode];
      newCode[index] = value;
      setEmailCode(newCode);
      if (value && index < 5) emailInputRefs[index + 1]?.focus();
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !emailCode[index] && index > 0) {
        emailInputRefs[index - 1]?.focus();
      }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      const newCode = [...emailCode];
      paste.split('').forEach((c, i) => { newCode[i] = c; });
      setEmailCode(newCode);
    };

    const handleVerify = async () => {
      if (!isComplete) return;
      setLoading(true);
      setError('');
      try {
        const headers = authHeaders();
        await apiClient.post('/auth/email/verify', { otp: fullCode }, { headers });
        setStep('pin');
      } catch {
        setError('Code invalide ou expiré');
        setEmailCode(Array(6).fill(''));
      } finally {
        setLoading(false);
      }
    };

    const handleResend = async () => {
      if (resendTimer > 0 || !user?.email) return;
      setResendTimer(60);
      try {
        const headers = authHeaders();
        await apiClient.post('/auth/email/send', { email: user.email }, { headers });
      } catch (err) {
        console.error("Resend error", err);
      }
    };

    return (
      <ScreenLayout showBack title="Vérification Email">
        <div className="flex-1 flex flex-col pt-4">
          <div className="space-y-8 flex-1">
            <div className="space-y-3">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-primary">Code Email</h2>
              <p className="text-slate-500 text-lg leading-relaxed">
                Code envoyé à <span className="font-bold text-slate-800">{user?.email}</span>
              </p>
            </div>

            <div className="flex justify-between gap-2 py-8" onPaste={handlePaste}>
              {emailCode.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { emailInputRefs[i] = el; }}
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
                'Vérifier'
              )}
            </button>
          </div>
        </div>
      </ScreenLayout>
    );
  }

  // ===== STEP 3: NEW PIN SETUP =====
  const currentPin = pinStep === 'create' ? pin : confirmPin;
  const setCurrentPin = pinStep === 'create' ? setPin : setConfirmPin;

  const handleDigit = (digit: string) => {
    if (currentPin.length >= 6) return;
    setCurrentPin(currentPin + digit);
    setError('');
  };

  const handleDelete = () => {
    setCurrentPin(currentPin.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (pinStep === 'create') {
      if (pin.length !== 6) return;
      setPinStep('confirm');
      return;
    }
    if (pin !== confirmPin) {
      setError('Les codes PIN ne correspondent pas');
      setConfirmPin('');
      return;
    }
    setLoading(true);
    try {
      const headers = authHeaders();
      await apiClient.post('/auth/pin/setup', { pin }, { headers });
      const userRes = await apiClient.get<unknown>('/auth/me', { headers }) as unknown as {
        id?: string;
        phone?: string;
        email?: string;
        role?: string;
        access_token?: string;
      };
      login(userRes.access_token || recoveryToken || '', {
        id: userRes.id || '',
        phone: userRes.phone || user?.phone || '',
        email: userRes.email || user?.email || '',
        role: userRes.role || 'CLIENT',
        has_pin: true
      });
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { detail?: string } } };
      setError(apiErr.response?.data?.detail || 'Erreur lors de la configuration du PIN');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <ScreenLayout showBack title="Nouveau PIN" className="bg-slate-50">
      <div className="flex-1 flex flex-col pt-2 items-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-primary" />
        </div>

        <h2 className="text-3xl font-extrabold tracking-tight text-primary text-center">
          {pinStep === 'create' ? 'Nouveau PIN' : 'Confirmer'}
        </h2>
        <p className="text-slate-500 text-lg text-center mt-3 mb-10 px-4 max-w-[280px]">
          {pinStep === 'create'
            ? 'Choisissez 6 chiffres pour votre nouveau code.'
            : 'Veuillez ressaisir votre code pour confirmer.'}
        </p>

        <div className="flex justify-center gap-5 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn(
              'h-5 w-5 rounded-full border-2 transition-all duration-300 shadow-sm',
              i < currentPin.length
                ? 'bg-primary border-primary scale-125 shadow-primary/20'
                : 'bg-white border-slate-200',
            )} />
          ))}
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-xl animate-shake">
            <p className="text-red-600 text-xs font-bold text-center">{error}</p>
          </div>
        )}

        <div className="w-full max-w-xs mt-auto pb-10">
          <div className="grid grid-cols-3 gap-y-6 gap-x-8">
            {digits.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (d === 'del') handleDelete();
                  else if (d) handleDigit(d);
                }}
                className={cn(
                  'h-20 w-20 mx-auto flex items-center justify-center rounded-full text-3xl font-bold transition-all border shadow-sm',
                  d === '' && 'invisible pointer-events-none',
                  d === 'del'
                    ? 'border-transparent text-slate-400 active:text-primary active:scale-90'
                    : 'bg-white border-slate-100 text-slate-800 hover:border-primary/30 active:scale-90 active:bg-slate-50 active:shadow-inner',
                )}
              >
                {d === 'del' ? <Delete className="w-8 h-8" /> : d}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full pt-4 pb-8">
          <button
            onClick={handleSubmit}
            disabled={currentPin.length !== 6 || loading}
            className="bicec-button w-full h-16 text-lg"
          >
            {loading ? (
              <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              pinStep === 'confirm' ? 'Enregistrer le PIN' : 'Continuer'
            )}
          </button>
        </div>
      </div>
    </ScreenLayout>
  );
};

export default ForgotPinScreen;
