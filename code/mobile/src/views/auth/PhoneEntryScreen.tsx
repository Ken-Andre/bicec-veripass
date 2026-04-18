import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenLayout } from '../../components/ScreenLayout';
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

  // For login mode: toggle between phone and email
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
        // LOGIN FLOW: verify credentials exist before sending OTP
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
          // Login by email — check if any user has this email
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
        // SIGNUP FLOW: user must NOT exist
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

  if (mode === 'login') {
    return (
      <ScreenLayout showBack title="Connexion">
        <div className="flex-1 flex flex-col pt-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold tracking-tight text-primary">Bon retour</h2>
              <p className="text-slate-500 text-lg">Connectez-vous avec votre numéro ou email.</p>
            </div>

            {/* Login method toggle */}
            <div className="flex rounded-2xl bg-slate-100 p-1">
              <button
                onClick={() => setLoginMethod('phone')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${loginMethod === 'phone' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'
                  }`}
              >
                <Phone className="w-4 h-4" />
                Téléphone
              </button>
              <button
                onClick={() => setLoginMethod('email')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${loginMethod === 'email' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'
                  }`}
              >
                <Mail className="w-4 h-4" />
                Email
              </button>
            </div>

            {loginMethod === 'phone' ? (
              <div className="flex flex-col gap-4 pt-4">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Numéro de téléphone</label>
                <div className="flex gap-3 h-16 group">
                  <div className="flex items-center justify-center rounded-2xl bg-slate-100 px-4 text-lg font-bold text-slate-700 border-2 border-transparent transition-colors group-focus-within:border-primary/20 group-focus-within:bg-white">
                    🇨🇲 +237
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={9}
                    value={phone}
                    onChange={(e) => setPhoneValue(e.target.value.replace(/\D/g, ''))}
                    placeholder="6XX XXX XXX"
                    className="premium-input flex-1 h-full text-xl font-bold tracking-widest placeholder:tracking-normal placeholder:font-medium placeholder:text-slate-300"
                    autoFocus
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 pt-4">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Adresse email</label>
                <input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmailValue(e.target.value.toLowerCase().trim())}
                  placeholder="votre@email.com"
                  className="premium-input h-16 text-lg font-bold"
                  autoFocus
                />
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl animate-shake">
                <p className="text-red-600 text-sm font-semibold">{error}</p>
              </div>
            )}
          </div>

          <div className="mt-auto py-8">
            <button
              onClick={handleCheckAndSend}
              disabled={!isValid || loading}
              className="bicec-button w-full h-16 text-lg"
            >
              {loading ? (
                <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Envoyer le code'
              )}
            </button>
          </div>
        </div>
      </ScreenLayout>
    );
  }

  // SIGNUP mode (original)
  return (
    <ScreenLayout showBack title="Identification">
      <div className="flex-1 flex flex-col pt-4">
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tight text-primary">Votre numéro</h2>
            <p className="text-slate-500 text-lg">Un code de sécurité vous sera envoyé par SMS pour valider votre identité.</p>
          </div>

          <div className="flex flex-col gap-4 pt-4">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Numéro de téléphone</label>
            <div className="flex gap-3 h-16 group">
              <div className="flex items-center justify-center rounded-2xl bg-slate-100 px-4 text-lg font-bold text-slate-700 border-2 border-transparent transition-colors group-focus-within:border-primary/20 group-focus-within:bg-white">
                🇨🇲 +237
              </div>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={9}
                value={phone}
                onChange={(e) => setPhoneValue(e.target.value.replace(/\D/g, ''))}
                placeholder="6XX XXX XXX"
                className="premium-input flex-1 h-full text-xl font-bold tracking-widest placeholder:tracking-normal placeholder:font-medium placeholder:text-slate-300"
                autoFocus
              />
            </div>
          </div>
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl animate-shake">
              <p className="text-red-600 text-sm font-semibold">{error}</p>
            </div>
          )}
        </div>

        <div className="mt-auto py-8">
          <button
            onClick={handleCheckAndSend}
            disabled={!isValid || loading}
            className="bicec-button w-full h-16 text-lg"
          >
            {loading ? (
              <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Envoyer le code SMS'
            )}
          </button>
          <p className="text-center text-xs text-slate-400 font-medium mt-4">
            En continuant, vous recevrez un SMS de vérification. Des frais d'opérateur peuvent s'appliquer.
          </p>
        </div>
      </div>
    </ScreenLayout>
  );
};

export default PhoneEntryScreen;
