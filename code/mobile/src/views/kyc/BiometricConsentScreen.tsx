import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fingerprint, ShieldCheck, ChevronRight } from 'lucide-react';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { useKyc } from '../../contexts/KycContext';

export default function BiometricConsentScreen() {
  const navigate = useNavigate();
  const { biometricConsentAccepted, setBiometricConsentAccepted } = useKyc();
  const [accepted, setAccepted] = useState<boolean>(biometricConsentAccepted);

  const handleContinue = () => {
    if (!accepted) return;
    setBiometricConsentAccepted(true);
    navigate('/kyc/liveness');
  };

  return (
    <ScreenLayoutV2 title="Consentement biometrique" showBack>
      <div className="flex flex-col gap-6 py-4">
        <div className="rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 p-6">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Fingerprint className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-black text-foreground">Verification selfie & liveness</h2>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Nous analysons vos traits faciaux uniquement pour confirmer que vous etes bien le titulaire du document.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
            <p className="text-sm text-foreground">
              Les donnees biometrie sont utilisees uniquement pour la verification KYC, conformement aux exigences
              reglementaires BICEC.
            </p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
            <input
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
            />
            <span className="text-sm font-semibold text-foreground">
              J accepte le traitement biometrie pour la verification d identite.
            </span>
          </label>
        </div>

        <Button onClick={handleContinue} disabled={!accepted}>
          Continuer vers le selfie
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </ScreenLayoutV2>
  );
}
