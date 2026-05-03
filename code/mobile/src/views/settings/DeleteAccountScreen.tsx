import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { cn } from '../../lib/utils';
import { AlertTriangle, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react';

type Step = 'warning' | 'confirm' | 'final';

const DeleteAccountScreen = () => {
  const navigate = useNavigate();
  const { deleteAccount } = useAuth();

  const [step, setStep] = useState<Step>('warning');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleNext = () => {
    if (step === 'warning') {
      setStep('confirm');
    } else if (step === 'confirm') {
      if (confirmText !== 'SUPPRIMER') return;
      setStep('final');
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    try {
      await deleteAccount();
      setSuccess(true);
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 3000);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erreur inconnue');
      setError(error.message || 'Erreur lors de la suppression du compte');
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <ScreenLayoutV2 className="bg-slate-50">
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="h-20 w-20 rounded-3xl bg-success shadow-lg shadow-success/20 flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Compte supprimé</h1>
          <p className="text-muted-foreground text-lg mt-4 mb-8 leading-relaxed">
            Votre compte a été supprimé avec succès. Vous allez être redirigé.
          </p>
          <div className="h-1 w-32 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary animate-pulse rounded-full" />
          </div>
        </div>
      </ScreenLayoutV2>
    );
  }

  if (step === 'warning') {
    return (
      <ScreenLayoutV2 showBack title="Supprimer le compte">
        <div className="flex-1 flex flex-col pt-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-4">
                <ShieldAlert className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-destructive">Attention</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Conformément aux réglementations COBAC et à la loi n°2024-017 relative à la protection des données, certaines de vos données seront conservées pendant une durée légale même après la suppression de votre compte. Cette suppression est irréversible.
              </p>
            </div>

            <div className="bg-warning/10 border border-warning/20 rounded-2xl p-5 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-bold text-warning">Données conservées :</p>
                  <ul className="text-sm text-warning/80 space-y-1 list-disc list-inside">
                    <li>Historique des transactions (5 ans)</li>
                    <li>Documents d'identité vérifiés (10 ans)</li>
                    <li>Registres de conformité COBAC</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto py-8 space-y-4">
            <Button onClick={handleNext}>
              <Trash2 className="w-5 h-5" />
              Continuer la suppression
            </Button>
            <button
              onClick={() => navigate(-1)}
              className="w-full h-14 text-muted-foreground font-bold text-sm hover:text-foreground transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      </ScreenLayoutV2>
    );
  }

  if (step === 'confirm') {
    const isValid = confirmText === 'SUPPRIMER';

    return (
      <ScreenLayoutV2 showBack title="Confirmation">
        <div className="flex-1 flex flex-col pt-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-destructive">Confirmation finale</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Pour confirmer la suppression, tapez exactement <span className="font-black text-foreground">SUPPRIMER</span> ci-dessous.
              </p>
            </div>

            <div className="flex flex-col gap-4 pt-4">
              <Input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Tapez SUPPRIMER"
                inputClassName="text-center font-black tracking-widest uppercase"
                className={cn(confirmText && !isValid && '[&_input]:border-destructive [&_div]:border-destructive')}
                autoFocus
              />
            </div>

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl animate-shake">
                <p className="text-destructive text-sm font-semibold text-center">{error}</p>
              </div>
            )}
          </div>

          <div className="mt-auto py-8 space-y-4">
            <Button onClick={handleNext} loading={loading} disabled={!isValid}>
              Confirmer la suppression
            </Button>
            <button
              onClick={() => navigate(-1)}
              className="w-full h-14 text-muted-foreground font-bold text-sm hover:text-foreground transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      </ScreenLayoutV2>
    );
  }

  return (
    <ScreenLayoutV2 showBack title="Dernière étape">
      <div className="flex-1 flex flex-col pt-4">
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-destructive">Dernière confirmation</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Êtes-vous absolument sûr ? Cette action ne peut pas être annulée.
            </p>
          </div>

          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-5">
            <p className="text-sm font-bold text-destructive">
              En cliquant sur "Supprimer définitivement", vous acceptez la suppression irréversible de votre compte VeriPass BICEC.
            </p>
          </div>
        </div>

        <div className="mt-auto py-8 space-y-4">
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={loading}
          >
            <Trash2 className="w-5 h-5" />
            Supprimer définitivement
          </Button>
          <button
            onClick={() => setStep('confirm')}
            className="w-full h-14 text-muted-foreground font-bold text-sm hover:text-foreground transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    </ScreenLayoutV2>
  );
};

export default DeleteAccountScreen;
