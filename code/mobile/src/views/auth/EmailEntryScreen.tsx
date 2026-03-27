import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenLayout } from '../../components/ScreenLayout';
import { apiClient } from '../../services/apiClient';

const EmailEntryScreen = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Basic email validation
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/auth/email/send', { email });
      navigate('/auth/email-otp');
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erreur lors de l'envoi du code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout showBack>
      <div className="flex-1 flex flex-col justify-between p-6 pt-12">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Votre email</h1>
          <p className="text-muted-foreground text-sm">Saisissez votre adresse email pour recevoir un code de vérification supplémentaire.</p>

          <div className="pt-4">
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
              placeholder="exemple@email.com"
              className="h-12 rounded-xl text-lg bg-card border border-border px-4 transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none w-full"
              autoFocus
            />
          </div>
          {error && <p className="text-destructive text-sm mt-3 font-medium">{error}</p>}
        </div>

        <div className="space-y-3">
          <button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="w-full bg-primary text-primary-foreground font-semibold h-14 rounded-2xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Envoi...' : 'Continuer'}
          </button>
          <button
            onClick={() => navigate('/auth/pin-setup')}
            className="w-full text-muted-foreground font-medium h-12 rounded-2xl active:scale-[0.98] transition-all"
          >
            Passer cette étape
          </button>
        </div>
      </div>
    </ScreenLayout>
  );
};

export default EmailEntryScreen;