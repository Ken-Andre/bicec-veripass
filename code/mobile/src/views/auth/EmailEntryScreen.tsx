import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { apiClient } from '../../services/apiClient';
import { Mail } from 'lucide-react';

const EmailEntryScreen = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Strict email validation
  const isValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/auth/email/send', { email });
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
    <ScreenLayoutV2 showBack title="Sécurité Compte">
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col pt-4">
        <div className="space-y-6 flex-1">
          <div className="space-y-3">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-primary">Votre email</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Associez une adresse email pour renforcer la sécurité de votre compte VeriPass.
            </p>
          </div>

          <div className="pt-4">
            <Input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
              placeholder="votre@email.com"
              autoFocus
              error={error || undefined}
            />
          </div>
        </div>

        <div className="space-y-4 py-8 mt-auto">
          <Button type="submit" loading={loading} disabled={!isValid}>
            Vérifier par email
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/auth/pin-setup', { state: { onboarding: true } })}
          >
            Passer cette étape
          </Button>
        </div>
      </form>
    </ScreenLayoutV2>
  );
};

export default EmailEntryScreen;
