import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle2, CalendarDays, Flag, ChevronRight } from 'lucide-react';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { useKyc } from '../../contexts/KycContext';

const NATIONALITIES = [
  { code: 'CM', label: 'Cameroun', enabled: true },
  { code: 'GA', label: 'Gabon', enabled: false },
  { code: 'TD', label: 'Tchad', enabled: false },
  { code: 'CG', label: 'Congo', enabled: false },
  { code: 'GQ', label: 'Guinee Equatoriale', enabled: false },
];

export default function BasicProfileScreen() {
  const navigate = useNavigate();
  const { basicProfile, setBasicProfile } = useKyc();

  const [firstName, setFirstName] = useState(basicProfile?.firstName ?? '');
  const [lastName, setLastName] = useState(basicProfile?.lastName ?? '');
  const [birthDate, setBirthDate] = useState(basicProfile?.birthDate ?? '');
  const [nationality, setNationality] = useState(basicProfile?.nationality ?? 'CM');

  const isValid = useMemo(() => {
    return (
      firstName.trim().length >= 2 &&
      lastName.trim().length >= 2 &&
      birthDate.length > 0 &&
      nationality === 'CM'
    );
  }, [birthDate, firstName, lastName, nationality]);

  const handleContinue = () => {
    if (!isValid) return;
    setBasicProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate,
      nationality,
    });
    navigate('/kyc/document-choice');
  };

  return (
    <ScreenLayoutV2 title="Profil de base" showBack>
      <div className="flex flex-col gap-4 py-2">
        <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-primary">
            Renseignez vos informations identitaires pour demarrer votre verification.
          </p>
        </div>

        <label className="text-sm font-semibold text-foreground">Prenom</label>
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
          <UserCircle2 className="h-5 w-5 text-muted-foreground" />
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full bg-transparent text-base outline-none"
            placeholder="Ex: Marie Claire"
          />
        </div>

        <label className="text-sm font-semibold text-foreground">Nom</label>
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
          <UserCircle2 className="h-5 w-5 text-muted-foreground" />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full bg-transparent text-base outline-none"
            placeholder="Ex: Nguemo"
          />
        </div>

        <label className="text-sm font-semibold text-foreground">Date de naissance</label>
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          <input
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            type="date"
            className="w-full bg-transparent text-base outline-none"
          />
        </div>

        <label className="text-sm font-semibold text-foreground">Nationalite</label>
        <div className="rounded-2xl border border-border bg-card p-2">
          <div className="flex items-center gap-2 px-2 pb-2">
            <Flag className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pays eligibles</span>
          </div>
          <div className="space-y-2">
            {NATIONALITIES.map((n) => (
              <button
                key={n.code}
                type="button"
                disabled={!n.enabled}
                onClick={() => n.enabled && setNationality(n.code)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition ${
                  n.enabled
                    ? nationality === n.code
                      ? 'border border-primary bg-primary/10 text-primary'
                      : 'border border-border bg-card text-foreground'
                    : 'cursor-not-allowed border border-border bg-muted text-muted-foreground'
                }`}
              >
                <span className="font-semibold">{n.label}</span>
                {!n.enabled ? (
                  <span className="text-xs font-bold uppercase">Bientot</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleContinue}
          disabled={!isValid}
          className="mt-4"
        >
          Continuer
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </ScreenLayoutV2>
  );
}
