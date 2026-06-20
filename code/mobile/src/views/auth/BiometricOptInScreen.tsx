import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { Fingerprint, Shield, ArrowRight } from 'lucide-react';

export default function BiometricOptInScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { setBiometric, isPasskeySupported } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEnable = async () => {
    setLoading(true);
    setError('');
    const success = await setBiometric(true);
    setLoading(false);
    if (success) {
      navigate('/kyc/intro');
    } else {
      setError(t('auth.biometric.failed') || 'Activation échouée. Vous pouvez continuer sans.');
    }
  };

  const handleSkip = () => {
    navigate('/kyc/intro');
  };

  return (
    <ScreenLayoutV2>
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
          <Fingerprint className="w-12 h-12 text-primary" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">
            {t('auth.biometric.title') || 'Connexion rapide'}
          </h2>
          <p className="text-muted-foreground max-w-xs mx-auto">
            {t('auth.biometric.subtitle') || 'Activez la biométrie pour un accès instantané et sécurisé à votre compte.'}
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="w-4 h-4" />
          <span>{t('auth.biometric.secure') || 'Données biométriques stockées localement'}</span>
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <div className="w-full max-w-sm space-y-3">
          {isPasskeySupported ? (
            <Button onClick={handleEnable} loading={loading}>
              <Fingerprint className="w-5 h-5" />
              {loading ? '...' : (t('auth.biometric.enable') || 'Activer la biométrie')}
            </Button>
          ) : (
            <div className="bg-warning/10 border border-warning/20 rounded-2xl p-4 text-center">
              <p className="text-sm text-warning">
                {t('auth.biometric.unsupported') || 'Biométrie non disponible sur cet appareil'}
              </p>
            </div>
          )}

          <button
            onClick={handleSkip}
            className="w-full py-3 text-sm text-muted-foreground font-medium active:scale-[0.98] transition-all"
          >
            {t('auth.biometric.skip') || 'Plus tard'}
            <ArrowRight className="w-4 h-4 inline ml-1" />
          </button>
        </div>
      </div>
    </ScreenLayoutV2>
  );
}
