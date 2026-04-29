import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../lib/utils';
import { Fingerprint, Delete, ShieldCheck, HelpCircle } from 'lucide-react';

const PinLoginScreen = () => {
  const navigate = useNavigate();
  const { login, user, biometricEnabled, isPasskeySupported, authenticateWithPasskey } = useAuth();

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
      const success = await authenticateWithPasskey();
      if (success && user) {
        // Biometric succeeded — we still need a token from the backend
        // For now, try PIN verify with empty PIN or use stored token
        // In production, this would exchange a passkey assertion for a JWT
        try {
          const res = await apiClient.post<{ access_token: string }, { phone: string; pin: string }>('/auth/pin/verify', {
            phone: user.phone || '',
            pin: 'biometric'
          });
          login(res.access_token, {
            id: user.id,
            phone: user.phone,
            email: user.email || '',
            role: user.role,
            has_pin: true
          });
          navigate('/dashboard');
        } catch {
          // Biometric auth succeeded but backend didn't accept it
          // Fall through to PIN entry
          setError('Connectez-vous avec votre PIN');
        }
      }
    };

    // Small delay to let the page render first
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

      login(res.access_token, {
        id: user.id,
        phone: user.phone,
        email: user.email || '',
        role: user.role,
        has_pin: true
      });

      navigate('/dashboard');
    } catch (err: unknown) {
      // Check if PIN was revoked (403) — redirect to OTP
      // apiClient puts the backend `detail` string as Error.message
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('OTP')) {
        setError('Session expirée. Redirection vers OTP...');
        setTimeout(() => navigate('/auth/phone'), 1500);
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
      const success = await authenticateWithPasskey();
      if (success && user) {
        // Biometric succeeded — exchange for JWT via backend
        try {
          const res = await apiClient.post<{ access_token: string }, { phone: string; pin: string }>('/auth/pin/verify', {
            phone: user.phone || '',
            pin: 'biometric'
          });
          login(res.access_token, {
            id: user.id,
            phone: user.phone,
            email: user.email || '',
            role: user.role,
            has_pin: true
          });
          navigate('/dashboard');
        } catch {
          setError('Utilisez votre PIN pour vous connecter');
        }
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
    <ScreenLayout className="bg-slate-50">
      <div className="flex-1 flex flex-col items-center pt-8">
        <div className="text-center w-full px-6">
          <div className="h-20 w-20 rounded-3xl bg-primary shadow-lg shadow-primary/20 flex items-center justify-center mx-auto mb-8">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl font-black text-primary tracking-tight">Bon retour</h1>
          <p className="text-slate-500 text-lg mt-2 mb-10">Saisissez votre code secret</p>

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
                error && i < pin.length && 'bg-red-500 border-red-500',
              )} />
            ))}
          </div>

          {error && (
            <div className="mt-6 mb-2">
              <p className="text-red-600 text-xs font-bold uppercase tracking-widest leading-loose">
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
                    ? 'border-transparent text-slate-400 active:text-primary active:scale-90'
                    : 'bg-white border-slate-100 text-slate-800 active:scale-90 active:bg-slate-50 active:shadow-inner active:border-primary/30',
                  (attempts >= MAX_ATTEMPTS || loading) && 'opacity-30',
                )}
              >
                {d === 'del' ? <Delete className="w-8 h-8" /> : d}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4 mt-10">
            <button
              onClick={handleForgotPin}
              className="flex items-center justify-center gap-2 w-full py-2 text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-primary transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              PIN Oublié ?
            </button>

            {biometricEnabled && isPasskeySupported ? (
              <button
                onClick={handleBiometric}
                disabled={loading || attempts >= MAX_ATTEMPTS}
                className={cn(
                  "flex items-center justify-center gap-2 w-full py-4 rounded-2xl border shadow-sm text-sm font-bold transition-all",
                  "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 active:scale-[0.98]",
                  (loading || attempts >= MAX_ATTEMPTS) && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Fingerprint className="h-6 w-6" />
                {loading ? 'Connexion...' : 'Connexion biométrique'}
              </button>
            ) : (
              <button
                disabled
                className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-white border border-slate-100 shadow-sm text-slate-400 text-sm font-bold opacity-50 cursor-not-allowed"
              >
                <Fingerprint className="h-6 w-6" />
                {isPasskeySupported ? 'Biométrie non activée' : 'Biométrie indisponible'}
              </button>
            )}
          </div>
        </div>
      </div>
    </ScreenLayout>
  );
};

export default PinLoginScreen;
