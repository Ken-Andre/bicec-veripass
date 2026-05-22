import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { apiClient, type ApiError } from '../../services/apiClient';
import { cn } from '../../lib/utils';
import { Fingerprint, Delete, ShieldCheck, HelpCircle } from 'lucide-react';
import type { User } from '../../types';

const PinLoginScreen = () => {
  const navigate = useNavigate();
  const { login, user, biometricEnabled, isPasskeySupported, authenticateWithPasskey } = useAuth();

  // Guard: redirect to pin-setup if user has no PIN configured
  useEffect(() => {
    if (user && !user.has_pin) {
      navigate('/auth/pin-setup', { replace: true });
    }
  }, [user, navigate]);

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const MAX_ATTEMPTS = 5;

  // Auto-trigger biometric login if enabled
  useEffect(() => {
    if (!biometricEnabled || !isPasskeySupported || loading) return;

    const tryBiometric = async () => {
      const result = await authenticateWithPasskey();
      if (result?.access_token) {
        const freshUser = await apiClient.get<User>('/auth/me', {
          headers: { Authorization: `Bearer ${result.access_token}` },
        });
        login(result.access_token, freshUser);
        navigate('/dashboard', { replace: true });
      }
    };

    const timer = setTimeout(tryBiometric, 500);
    return () => clearTimeout(timer);
  }, [biometricEnabled, isPasskeySupported, authenticateWithPasskey, user, login, navigate, loading]);

  const handleDigit = (digit: string) => {
    if (pin.length >= 6 || loading) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError('');
    if (newPin.length === 6) handleVerify(newPin);
  };

  const handleDelete = () => setPin(pin.slice(0, -1));

  const handleVerify = async (code: string) => {
    if (!user?.phone) {
      setError("Erreur d'identification de l'utilisateur");
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post<{ access_token: string }, { phone: string; pin: string }>('/auth/pin/verify', {
        phone: user.phone,
        pin: code
      });
      const freshUser = await apiClient.get<User>('/auth/me', {
        headers: {
          Authorization: `Bearer ${res.access_token}`,
        },
      });

      login(res.access_token, freshUser);

      navigate('/dashboard');
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      const detail = typeof apiErr.response?.data === 'object' && apiErr.response?.data !== null
        ? (apiErr.response.data as { detail?: string }).detail
        : undefined;
      const message = apiErr.message || String(err);
      if (apiErr.status === 403 && typeof detail === 'string' && detail.toLowerCase().includes('otp')) {
        setError('Session PIN invalide. Redirection vers OTP...');
        setTimeout(() => navigate('/auth/phone'), 1500);
        return;
      }

      const isServerError =
        /^HTTP 5\d\d$/.test(message) ||
        message === 'Internal Server Error' ||
        message === 'Bad Gateway' ||
        message === 'Service Unavailable' ||
        message === 'Gateway Timeout';

      if (isServerError) {
        setError('Problème temporaire, veuillez réessayer.');
        setPin('');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }

      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setPin('');
      }, 500);

      if (newAttempts >= MAX_ATTEMPTS) {
        setError('Compte bloqué. Utilisez l\'OTP pour vous reconnecter.');
      } else {
        setError(`PIN incorrect (${MAX_ATTEMPTS - newAttempts} restants)`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPin = () => {
    navigate('/auth/forgot-pin');
  };

  const handleBiometric = async () => {
    if (!biometricEnabled || !isPasskeySupported) return;

    setLoading(true);
    setError('');

    try {
      const result = await authenticateWithPasskey();
      if (result?.access_token) {
        const freshUser = await apiClient.get<User>('/auth/me', {
          headers: { Authorization: `Bearer ${result.access_token}` },
        });
        login(result.access_token, freshUser);
        navigate('/dashboard', { replace: true });
      } else {
        setError('Biométrie échouée. Utilisez votre PIN.');
      }
    } catch {
      setError('Erreur de connexion biométrique');
    } finally {
      setLoading(false);
    }
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <ScreenLayoutV2 className="bg-slate-50">
      <div className="flex-1 flex flex-col items-center pt-8">
        <div className="text-center w-full px-6">
          <div className="h-20 w-20 rounded-3xl bg-primary shadow-lg shadow-primary/20 flex items-center justify-center mx-auto mb-8">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl font-black text-primary tracking-tight">Bon retour</h1>
          <p className="text-muted-foreground text-lg mt-2 mb-10">Saisissez votre code secret</p>

          {/* PIN Dots Indicators */}
          <div className={cn(
            "flex justify-center gap-5 mb-4 transition-transform duration-300",
            shake && "animate-shake"
          )}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={cn(
                'h-5 w-5 rounded-full border-2 transition-all duration-300 shadow-sm',
                i < pin.length
                  ? 'bg-primary border-primary scale-125 shadow-primary/20'
                  : 'bg-white border-slate-200',
                error && i < pin.length && 'bg-destructive border-destructive',
              )} />
            ))}
          </div>

          {error && (
            <div className="mt-6 mb-2">
              <p className="text-destructive text-xs font-bold uppercase tracking-widest leading-loose">
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Keypad */}
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
                disabled={attempts >= MAX_ATTEMPTS || loading}
                className={cn(
                  'h-20 w-20 mx-auto flex items-center justify-center rounded-full text-3xl font-bold transition-all border shadow-sm',
                  d === '' && 'invisible pointer-events-none',
                  d === 'del'
                    ? 'border-transparent text-muted-foreground active:text-primary active:scale-90'
                    : 'bg-white border-slate-100 text-foreground active:scale-90 active:bg-slate-50 active:shadow-inner active:border-primary/30',
                  (attempts >= MAX_ATTEMPTS || loading) && 'opacity-30',
                )}
              >
                {d === 'del' ? <Delete className="w-8 h-8" /> : d}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4 mt-10">
            <button
              type="button"
              onClick={handleForgotPin}
              className="flex items-center justify-center gap-2 w-full py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              PIN Oublié ?
            </button>

            {biometricEnabled && isPasskeySupported ? (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleBiometric}
                loading={loading}
                disabled={loading || attempts >= MAX_ATTEMPTS}
              >
                <Fingerprint className="h-5 w-5" />
                Connexion biométrique
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="md"
                disabled
              >
                <Fingerprint className="h-5 w-5" />
                {isPasskeySupported ? 'Biométrie non activée' : 'Biométrie indisponible'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </ScreenLayoutV2>
  );
};

export default PinLoginScreen;
