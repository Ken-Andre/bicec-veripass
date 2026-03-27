import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../lib/utils';
import { Fingerprint } from 'lucide-react';

const PinLoginScreen = () => {
  const navigate = useNavigate();
  const { login, user, resetAccount } = useAuth();

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
      const res: any = await apiClient.post('/auth/pin/verify', { 
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
      
      navigate('/');
    } catch (err) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
      if (newAttempts >= MAX_ATTEMPTS) {
        setError('Compte temporairement bloqué. Veuillez utiliser la récupération par OTP.');
      } else {
        setError(`Code PIN incorrect. (${MAX_ATTEMPTS - newAttempts} tentatives restantes)`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPin = () => {
    // On déconnecte mais on garde le phone si possible pour l'OTP
    // Pour simplifier, on reset tout et on repart à zéro
    resetAccount();
    navigate('/auth/phone');
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <ScreenLayout>
      <div className="flex-1 flex flex-col items-center justify-between p-6 pt-12">
        <div className="text-center w-full">
          <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6 shadow-sm">
            <span className="text-3xl font-black text-primary">VP</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Bon retour</h1>
          <p className="text-muted-foreground text-sm mb-10">Saisissez votre code PIN pour continuer</p>
          
          <div className={cn(
            "flex justify-center gap-4 mb-4 transition-transform duration-200",
            shake && "translate-x-2" // Simple shake approximation
          )}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={cn(
                'h-4 w-4 rounded-full border-2 transition-all duration-200',
                i < pin.length ? 'bg-primary border-primary scale-110' : 'bg-transparent border-muted-foreground/30',
                error && i < pin.length && 'bg-destructive border-destructive',
              )} />
            ))}
          </div>
          {error && <p className="text-destructive text-sm mt-4 font-medium px-4">{error}</p>}
        </div>

        <div className="w-full max-w-xs mx-auto pb-8">
          <div className="grid grid-cols-3 gap-y-4 gap-x-8 mb-8">
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
                  'h-16 w-16 mx-auto flex items-center justify-center rounded-full text-2xl font-semibold transition-all',
                  d === '' && 'invisible pointer-events-none',
                  d === 'del' 
                    ? 'text-muted-foreground hover:text-foreground' 
                    : 'hover:bg-primary/10 active:bg-primary/20 bg-muted/30',
                  (attempts >= MAX_ATTEMPTS || loading) && 'opacity-50',
                )}
              >
                {d === 'del' ? '⌫' : d}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleForgotPin}
              className="w-full py-3 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Code PIN oublié ?
            </button>
            
            {/* Biometric placeholder */}
            <button className="flex items-center justify-center gap-2 w-full py-3 text-primary/60 text-sm font-medium opacity-50 cursor-not-allowed">
              <Fingerprint className="h-5 w-5" />
              Utiliser la biométrie
            </button>
          </div>
        </div>
      </div>
    </ScreenLayout>
  );
};

export default PinLoginScreen;
