import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { apiClient } from '../../services/apiClient';

const PhoneEntryScreen = () => {
  const navigate = useNavigate();
  const { setPhone } = useAuth();
  const [phone, setPhoneValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = /^[0-9]{9}$/.test(phone);

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      const fullPhone = `+237${phone}`;
      await apiClient.post('/auth/otp/send', { phone: fullPhone });
      setPhone(fullPhone);
      navigate('/auth/otp');
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
          <h1 className="text-2xl font-bold text-foreground">Votre numéro</h1>
          <p className="text-muted-foreground text-sm">Saisissez votre numéro de téléphone pour recevoir un code de vérification.</p>

          <div className="flex gap-3 pt-4">
            <div className="flex h-12 items-center rounded-xl bg-muted px-4 text-sm font-semibold text-foreground">
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
              className="h-12 rounded-xl text-lg tracking-wider bg-card border border-border px-4 transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none flex-1"
              autoFocus
            />
          </div>
          {error && <p className="text-destructive text-sm mt-3 font-medium">{error}</p>}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isValid || loading}
          className="w-full bg-primary text-primary-foreground font-semibold h-14 rounded-2xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 mt-8"
        >
          {loading ? 'Envoi...' : 'Continuer'}
        </button>

        <div className="mt-8 flex justify-center opacity-20 hover:opacity-100 transition-opacity">
          <button
             type="button"
             id="sentry-test-btn"
             onClick={() => { throw new Error("Verification Sentry - Mobile") }}
             className="text-[10px] text-gray-400 uppercase tracking-widest font-bold"
          >
            Test Sentry Integration
          </button>
        </div>
      </div>
    </ScreenLayout>
  );
};

export default PhoneEntryScreen;
