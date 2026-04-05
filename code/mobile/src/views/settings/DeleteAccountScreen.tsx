import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenLayout } from '../../components/ScreenLayout';
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
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression du compte');
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <ScreenLayout className="bg-slate-50">
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="h-20 w-20 rounded-3xl bg-green-500 shadow-lg shadow-green-500/20 flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Compte supprimé</h1>
          <p className="text-slate-500 text-lg mt-4 mb-8 leading-relaxed">
            Votre compte a été supprimé avec succès. Vous allez être redirigé.
          </p>
          <div className="h-1 w-32 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary animate-pulse rounded-full" />
          </div>
        </div>
      </ScreenLayout>
    );
  }

  if (step === 'warning') {
    return (
      <ScreenLayout showBack title="Supprimer le compte">
        <div className="flex-1 flex flex-col pt-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                <ShieldAlert className="w-8 h-8 text-primary-bicec-red" />
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-primary-bicec-red">Attention</h2>
              <p className="text-slate-500 text-lg leading-relaxed">
                Conformément aux réglementations COBAC et à la loi n°2024-017 relative à la protection des données, certaines de vos données seront conservées pendant une durée légale même après la suppression de votre compte. Cette suppression est irréversible.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-bold text-amber-800">Données conservées :</p>
                  <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                    <li>Historique des transactions (5 ans)</li>
                    <li>Documents d'identité vérifiés (10 ans)</li>
                    <li>Registres de conformité COBAC</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto py-8 space-y-4">
            <button
              onClick={handleNext}
              className="bicec-button w-full h-16 text-lg"
            >
              <Trash2 className="w-5 h-5" />
              Continuer la suppression
            </button>
            <button
              onClick={() => navigate(-1)}
              className="w-full h-14 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      </ScreenLayout>
    );
  }

  if (step === 'confirm') {
    const isValid = confirmText === 'SUPPRIMER';

    return (
      <ScreenLayout showBack title="Confirmation">
        <div className="flex-1 flex flex-col pt-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-primary-bicec-red">Confirmation finale</h2>
              <p className="text-slate-500 text-lg leading-relaxed">
                Pour confirmer la suppression, tapez exactement <span className="font-black text-slate-800">SUPPRIMER</span> ci-dessous.
              </p>
            </div>

            <div className="flex flex-col gap-4 pt-4">
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Tapez SUPPRIMER"
                className={cn(
                  'premium-input text-center font-black tracking-widest uppercase',
                  confirmText && !isValid && 'border-red-300 bg-red-50'
                )}
                autoFocus
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl animate-shake">
                <p className="text-red-600 text-sm font-semibold text-center">{error}</p>
              </div>
            )}
          </div>

          <div className="mt-auto py-8 space-y-4">
            <button
              onClick={handleNext}
              disabled={!isValid || loading}
              className="bicec-button w-full h-16 text-lg"
            >
              {loading ? (
                <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Confirmer la suppression'
              )}
            </button>
            <button
              onClick={() => navigate(-1)}
              className="w-full h-14 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout showBack title="Dernière étape">
      <div className="flex-1 flex flex-col pt-4">
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-primary-bicec-red" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-primary-bicec-red">Dernière confirmation</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Êtes-vous absolument sûr ? Cette action ne peut pas être annulée.
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <p className="text-sm font-bold text-red-700">
              En cliquant sur "Supprimer définitivement", vous acceptez la suppression irréversible de votre compte VeriPass BICEC.
            </p>
          </div>
        </div>

        <div className="mt-auto py-8 space-y-4">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="w-full h-16 bg-primary-bicec-red text-white font-bold text-lg rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? (
              <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Trash2 className="w-5 h-5" />
                Supprimer définitivement
              </>
            )}
          </button>
          <button
            onClick={() => setStep('confirm')}
            className="w-full h-14 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    </ScreenLayout>
  );
};

export default DeleteAccountScreen;
