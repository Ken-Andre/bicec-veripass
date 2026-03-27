import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../lib/utils';
import { ChevronLeft } from 'lucide-react';

const PinSetupScreen = () => {
  const navigate = useNavigate();
  const { setPinSetupCompleted } = useAuth();
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async () => {
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
      await apiClient.post('/auth/pin/setup', { pin });
      setPinSetupCompleted();
      // On redirige vers la liveness ou le dashboard selon l'état
      navigate('/');
    } catch (err) {
      setError('Erreur lors de la configuration du PIN');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <ScreenLayout>
      <div className="flex-1 flex flex-col p-6">
        <header className="flex items-center mb-8">
          <button 
            onClick={() => step === 'confirm' ? setStep('create') : navigate(-1)}
            className="p-2 -ml-2 hover:bg-muted rounded-full"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold ml-2">
            {step === 'create' ? 'Créez votre code PIN' : 'Confirmez votre code PIN'}
          </h1>
        </header>

        <div className="flex-1 flex flex-col items-center justify-between">
          <div className="text-center w-full">
            <p className="text-muted-foreground text-sm mb-8">
              {step === 'create' 
                ? 'Choisissez un code à 6 chiffres pour sécuriser vos prochaines connexions.'
                : 'Veuillez saisir à nouveau votre code pour confirmer.'}
            </p>

            <div className="flex justify-center gap-4 mb-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={cn(
                  'h-4 w-4 rounded-full border-2 transition-all',
                  i < currentPin.length 
                    ? 'bg-primary border-primary scale-110' 
                    : 'bg-transparent border-muted-foreground/30',
                )} />
              ))}
            </div>
            {error && <p className="text-destructive text-sm mt-4 font-medium">{error}</p>}
          </div>

          <div className="w-full max-w-xs mx-auto pb-8">
            <div className="grid grid-cols-3 gap-y-4 gap-x-8 mb-10">
              {digits.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (d === 'del') handleDelete();
                    else if (d) handleDigit(d);
                  }}
                  className={cn(
                    'h-16 w-16 mx-auto flex items-center justify-center rounded-full text-2xl font-semibold transition-all',
                    d === '' && 'invisible pointer-events-none',
                    d === 'del' 
                      ? 'text-muted-foreground hover:text-foreground' 
                      : 'hover:bg-primary/10 active:bg-primary/20 bg-muted/30',
                  )}
                >
                  {d === 'del' ? '⌫' : d}
                </button>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={currentPin.length !== 6 || loading}
              className="w-full h-14 rounded-2xl text-base font-bold bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-[0.98]"
            >
              {loading ? 'Traitement...' : step === 'create' ? 'Continuer' : 'Confirmer'}
            </button>
          </div>
        </div>
      </div>
    </ScreenLayout>
  );
};

export default PinSetupScreen;
