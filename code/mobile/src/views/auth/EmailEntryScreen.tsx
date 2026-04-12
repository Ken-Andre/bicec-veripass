import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenLayout } from '../../components/ScreenLayout';
import { apiClient } from '../../services/apiClient';
import { Mail } from 'lucide-react';

const EmailEntryScreen = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Strict email validation
  const isValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/auth/email/send', { email });
      // Keep email in some state or pass it to next screen if needed
      // For now, next screen assumes we sent it
      navigate('/auth/email-otp', { state: { email } });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const apiErr = err as { response: { data?: { detail?: string } } };
        setError(apiErr.response.data?.detail || "Erreur lors de l'envoi du code");
      } else {
        setError("Erreur lors de l'envoi du code");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout showBack title="Sécurité Compte">
      <div className="flex-1 flex flex-col pt-4">
        <div className="space-y-6 flex-1">
          <div className="space-y-3">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-primary">Votre email</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Associez une adresse email pour renforcer la sécurité de votre compte VeriPass.
            </p>
          </div>

          <div className="flex flex-col gap-4 pt-4">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Adresse Email</label>
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
              placeholder="votre@email.com"
              className="premium-input h-16 text-lg font-bold"
              autoFocus
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl animate-shake">
              <p className="text-red-600 text-sm font-semibold">{error}</p>
            </div>
          )}
        </div>

        <div className="space-y-4 py-8 mt-auto">
          <button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="bicec-button w-full h-16 text-lg"
          >
            {loading ? (
              <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Vérifier par email'
            )}
          </button>

          <button
            onClick={() => navigate('/auth/pin-setup')}
            className="w-full text-slate-400 font-bold h-12 uppercase tracking-widest text-xs active:text-primary transition-colors"
          >
            Passer cette étape
          </button>
        </div>
      </div>
    </ScreenLayout>
  );
};

export default EmailEntryScreen;
