import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../lib/utils';
import { Delete, Lock } from 'lucide-react';

const LockScreen = () => {
  const navigate = useNavigate();
  const { user, unlock } = useAuth();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const MAX_ATTEMPTS = 5;

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
      await apiClient.post('/auth/pin/verify', {
        phone: user.phone,
        pin: code
      });

      unlock();
      const lastRoute = sessionStorage.getItem('vp_last_route') || '/dashboard';
      // Strip any /mobile prefix to avoid double-basename issue
      const cleanRoute = lastRoute.replace(/^\/mobile/, '') || '/dashboard';
      navigate(cleanRoute, { replace: true });
    } catch (err: unknown) {
      // Distinguish a real PIN failure from a backend server error.
      // apiClient surfaces the HTTP status in the message as "HTTP 5xx"
      // or via the standard status text ("Internal Server Error", etc.).
      const message = err instanceof Error ? err.message : String(err);
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
        setError('Compte bloqué. Reconnexion complète requise.');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      } else {
        setError(`PIN incorrect (${MAX_ATTEMPTS - newAttempts} restants)`);
      }
    } finally {
      setLoading(false);
    }
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <ScreenLayoutV2 className="bg-muted/50">
      <div className="flex-1 flex flex-col items-center pt-8">
        <div className="text-center w-full px-6">
          <div className="h-20 w-20 rounded-3xl bg-primary-bicec-red shadow-lg shadow-primary-bicec-red/20 flex items-center justify-center mx-auto mb-8">
            <Lock className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl font-black text-primary-bicec-blue tracking-tight">Session verrouillée</h1>
          <p className="text-muted-foreground text-lg mt-2 mb-10">Saisissez votre code pour reprendre</p>

          {/* PIN Dots Indicators */}
          <div className={cn(
            "flex justify-center gap-5 mb-4 transition-transform duration-300",
            shake && "animate-shake"
          )}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={cn(
                'h-5 w-5 rounded-full border-2 transition-all duration-300 shadow-sm',
                i < pin.length
                  ? 'bg-primary-bicec-blue border-primary-bicec-blue scale-125 shadow-primary-bicec-blue/20'
                  : 'bg-card border-border',
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
                    ? 'border-transparent text-muted-foreground active:text-primary-bicec-blue active:scale-90'
                    : 'bg-card border-border text-foreground active:scale-90 active:bg-muted/50 active:shadow-inner active:border-primary-bicec-blue/30',
                  (attempts >= MAX_ATTEMPTS || loading) && 'opacity-30',
                )}
              >
                {d === 'del' ? <Delete className="w-8 h-8" /> : d}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4 mt-10">
            <button
              onClick={() => navigate('/auth/forgot-pin')}
              className="text-sm font-bold text-primary active:opacity-70 transition-colors uppercase tracking-widest text-center py-2"
            >
              PIN oublié ?
            </button>
          </div>
        </div>
      </div>
    </ScreenLayoutV2>
  );
};

export default LockScreen;
