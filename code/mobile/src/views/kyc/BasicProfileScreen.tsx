import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle2, CalendarDays, Flag, ChevronRight } from 'lucide-react';
import { ScreenLayout } from '../../components/ScreenLayout';
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
    <ScreenLayout title="Profil de base" showBack>
      <div className="flex flex-col gap-4 py-2">
        <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-primary">
            Renseignez vos informations identitaires pour demarrer votre verification.
          </p>
        </div>

        <label className="text-sm font-semibold text-slate-700">Prenom</label>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <UserCircle2 className="h-5 w-5 text-slate-400" />
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full bg-transparent text-base outline-none"
            placeholder="Ex: Marie Claire"
          />
        </div>

        <label className="text-sm font-semibold text-slate-700">Nom</label>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <UserCircle2 className="h-5 w-5 text-slate-400" />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full bg-transparent text-base outline-none"
            placeholder="Ex: Nguemo"
          />
        </div>

        <label className="text-sm font-semibold text-slate-700">Date de naissance</label>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <CalendarDays className="h-5 w-5 text-slate-400" />
          <input
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            type="date"
            className="w-full bg-transparent text-base outline-none"
          />
        </div>

        <label className="text-sm font-semibold text-slate-700">Nationalite</label>
        <div className="rounded-2xl border border-slate-200 bg-white p-2">
          <div className="flex items-center gap-2 px-2 pb-2">
            <Flag className="h-5 w-5 text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pays eligibles</span>
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
                      : 'border border-slate-200 bg-white text-slate-700'
                    : 'cursor-not-allowed border border-slate-100 bg-slate-50 text-slate-400'
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

        <button
          onClick={handleContinue}
          disabled={!isValid}
          className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-white transition disabled:opacity-50"
        >
          Continuer
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </ScreenLayout>
  );
}

