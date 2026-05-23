import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../lib/utils';
import { Delete, Lock } from 'lucide-react';

const PinSetupScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setPinSetupCompleted } = useAuth();
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const onboardingFlow = Boolean((location.state as { onboarding?: boolean } | null)?.onboarding) ||
    localStorage.getItem('vp_onboarding_flow') === '1';

  const currentPin = step === 'create' ? pin : confirmPin;
  const setCurrentPin = step === 'create' ? setPin : setConfirmPin;

  const handleDigit = (digit: string) => {
    if (currentPin.length >= 6) return;
    setCurrentPin(currentPin + digit);
    setError('');
  };

  const handleDelete = () => {
    setCurrentPin(currentPin.slice(0, -1));
  };

  const handleSubmit = useCallback(async () => {
    if (step === 'create') {
      if (pin.length !== 6) return;
      setStep('confirm');
      return;
    }
    if (pin !== confirmPin) {
      setError('Les codes PIN ne correspondent pas');
      setConfirmPin('');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post<void, { pin: string }>('/auth/pin/setup', { pin });
      setPinSetupCompleted();
      if (onboardingFlow) {
        navigate('/kyc/basic-profile');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError('Erreur lors de la configuration du PIN');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [step, pin, confirmPin, navigate, setPinSetupCompleted, onboardingFlow]);

  // Auto-submit when 6 digits are entered for better UX
  useEffect(() => {
    if (currentPin.length === 6) {
      const timer = setTimeout(() => {
        if (step === 'confirm') {
          handleSubmit();
        } else {
          setStep('confirm');
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentPin.length, step, handleSubmit]);

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <ScreenLayoutV2
      showBack
      title="Sécurité PIN"
      className="bg-slate-50"
    >
      <div className="flex-1 flex flex-col pt-2 items-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-primary" />
        </div>

        <h2 className="text-3xl font-extrabold tracking-tight text-primary text-center">
          {step === 'create' ? 'Définir un PIN' : 'Confirmer'}
        </h2>
        <p className="text-muted-foreground text-lg text-center mt-3 mb-10 px-4 max-w-[280px]">
          {step === 'create'
            ? 'Choisissez 6 chiffres pour protéger votre application.'
            : 'Veuillez ressaisir votre code pour confirmer.'}
        </p>

        {/* PIN Indicators */}
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
          <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 rounded-xl animate-shake">
            <p className="text-destructive text-xs font-bold text-center">{error}</p>
          </div>
        )}

        {/* Pad Numérique Tactile */}
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
                    ? 'border-transparent text-muted-foreground active:text-primary active:scale-90'
                    : 'bg-white border-slate-100 text-foreground hover:border-primary/30 active:scale-90 active:bg-slate-50 active:shadow-inner',
                )}
              >
                {d === 'del' ? <Delete className="w-8 h-8" /> : d}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full pt-4 pb-8">
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={currentPin.length !== 6}
          >
            {step === 'confirm' ? 'Enregistrer le PIN' : 'Continuer'}
          </Button>
        </div>
      </div>
    </ScreenLayoutV2>
  );
};

export default PinSetupScreen;
