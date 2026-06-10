import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { apiClient } from '../../services/apiClient';
import { Mail, Phone } from 'lucide-react';

const PhoneEntryScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setPhone } = useAuth();
  const [phone, setPhoneValue] = useState('');
  const [email, setEmailValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const mode = searchParams.get('mode') || 'signup';
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone');

  const isPhoneValid = /^[0-9]{9}$/.test(phone);
  const isEmailValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  const isValid = mode === 'login'
    ? (loginMethod === 'phone' ? isPhoneValid : isEmailValid)
    : isPhoneValid;

  const handleCheckAndSend = async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        if (loginMethod === 'phone') {
          const fullPhone = `+237${phone}`;
          const checkRes = await apiClient.get<{ exists: boolean; phone?: string }>(`/auth/user/exists?phone=${encodeURIComponent(fullPhone)}`);
          if (!checkRes.exists) {
            setError('Numéro non reconnu. Créez d\'abord un compte.');
            setLoading(false);
            return;
          }
          setPhone(fullPhone);
          await apiClient.post<void, { phone?: string; email?: string }>('/auth/otp/send', { phone: fullPhone });
          navigate('/auth/otp', { state: { mode: 'login', identifier: fullPhone } });
        } else {
          const checkRes = await apiClient.get<{ exists: boolean; phone: string }>(`/auth/user/exists?email=${encodeURIComponent(email)}`);
          if (!checkRes.exists) {
            setError('Email non reconnu. Créez d\'abord un compte.');
            setLoading(false);
            return;
          }
          setPhone(checkRes.phone);
          await apiClient.post<void, { phone?: string; email?: string }>('/auth/otp/send', { email: email });
          navigate('/auth/otp', { state: { mode: 'login', identifier: email } });
        }
      } else {
        const fullPhone = `+237${phone}`;
        const checkRes = await apiClient.get<{ exists: boolean }>(`/auth/user/exists?phone=${encodeURIComponent(fullPhone)}`);
        if (checkRes.exists) {
          setError('Ce numéro est déjà utilisé. Connectez-vous.');
          setLoading(false);
          return;
        }
        setPhone(fullPhone);
        await apiClient.post<void, { phone?: string; email?: string }>('/auth/otp/send', { phone: fullPhone });
        navigate('/auth/otp', { state: { mode: 'signup', identifier: fullPhone } });
      }
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || "Erreur lors de l'envoi du code");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCheckAndSend();
  };

  const footer = (
    <div className="space-y-4">
      <Button
        type="submit"
        form="phone-form"
        loading={loading}
        disabled={!isValid}
        fullWidth
      >
        {mode === 'login' ? 'Envoyer le code' : 'Envoyer le code SMS'}
      </Button>
      {mode === 'signup' && (
        <p className="text-center text-xs text-muted-foreground font-medium">
          En continuant, vous recevrez un SMS de vérification. Des frais d'opérateur peuvent s'appliquer.
        </p>
      )}
    </div>
  );

  if (mode === 'login') {
    return (
      <ScreenLayoutV2 showBack title="Connexion" footer={footer}>
        <form id="phone-form" onSubmit={handleSubmit} className="flex-1 flex flex-col pt-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold tracking-tight text-primary">Bon retour</h2>
              <p className="text-muted-foreground text-lg">Connectez-vous avec votre numéro ou email.</p>
            </div>

            {/* Login method toggle */}
            <div className="flex rounded-2xl bg-muted p-1">
              <button
                type="button"
                onClick={() => setLoginMethod('phone')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${loginMethod === 'phone' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}
              >
                <Phone className="w-4 h-4" />
                Téléphone
              </button>
              <button
                type="button"
                onClick={() => setLoginMethod('email')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${loginMethod === 'email' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}
              >
                <Mail className="w-4 h-4" />
                Email
              </button>
            </div>

            {loginMethod === 'phone' ? (
              <div className="flex flex-col gap-4 pt-4">
                <div className="grid h-16 grid-cols-[5rem_minmax(0,1fr)] gap-3">
                  <div className="flex min-w-0 items-center justify-center rounded-2xl bg-muted px-3 text-lg font-bold text-foreground border-2 border-border">
                    +237
                  </div>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={9}
                    value={phone}
                    onChange={(e) => setPhoneValue(e.target.value.replace(/\D/g, ''))}
                    placeholder="6XX XXX XXX"
                    className="min-w-0"
                    inputClassName="text-xl font-bold tracking-widest placeholder:tracking-normal placeholder:font-medium"
                    autoFocus
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 pt-4">
                <Input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmailValue(e.target.value.toLowerCase().trim())}
                  placeholder="votre@email.com"
                  autoFocus
                />
              </div>
            )}

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl animate-shake">
                <p className="text-destructive text-sm font-semibold">{error}</p>
              </div>
            )}
          </div>
        </form>
      </ScreenLayoutV2>
    );
  }

  // SIGNUP mode
  return (
    <ScreenLayoutV2 showBack title="Identification" footer={footer}>
      <form id="phone-form" onSubmit={handleSubmit} className="flex-1 flex flex-col pt-4">
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tight text-primary">Votre numéro</h2>
            <p className="text-muted-foreground text-lg">Un code de sécurité vous sera envoyé par SMS pour valider votre identité.</p>
          </div>

          <div className="flex flex-col gap-4 pt-4">
            <div className="grid h-16 grid-cols-[5rem_minmax(0,1fr)] gap-3">
              <div className="flex min-w-0 items-center justify-center rounded-2xl bg-muted px-3 text-lg font-bold text-foreground border-2 border-border">
                +237
              </div>
              <Input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={9}
                value={phone}
                onChange={(e) => setPhoneValue(e.target.value.replace(/\D/g, ''))}
                placeholder="6XX XXX XXX"
                className="min-w-0"
                inputClassName="text-xl font-bold tracking-widest placeholder:tracking-normal placeholder:font-medium"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl animate-shake">
              <p className="text-destructive text-sm font-semibold">{error}</p>
            </div>
          )}
        </div>
      </form>
    </ScreenLayoutV2>
  );
};

export default PhoneEntryScreen;
