import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, IdCard, ShieldAlert, ChevronRight } from 'lucide-react';
import { ScreenLayout } from '../../components/ScreenLayout';
import { useKyc } from '../../contexts/KycContext';
import type { DocumentChoiceData } from '../../types';

const DOCUMENTS: Array<{ type: DocumentChoiceData['documentType']; label: string; enabled: boolean }> = [
  { type: 'CNI', label: 'Carte Nationale d Identite (CNI)', enabled: true },
  { type: 'PASSPORT', label: 'Passeport', enabled: false },
  { type: 'DRIVER_LICENSE', label: 'Permis de conduire', enabled: false },
];

const NATIONALITIES = [
  { code: 'CM', label: 'Cameroun', enabled: true },
  { code: 'GA', label: 'Gabon', enabled: false },
  { code: 'TD', label: 'Tchad', enabled: false },
  { code: 'CG', label: 'Congo', enabled: false },
];

export default function DocumentChoiceScreen() {
  const navigate = useNavigate();
  const { documentChoice, setDocumentChoice } = useKyc();
  const [documentType, setDocumentType] = useState<DocumentChoiceData['documentType']>(
    documentChoice?.documentType ?? 'CNI',
  );
  const [nationality, setNationality] = useState(documentChoice?.nationality ?? 'CM');

  const canContinue = useMemo(() => documentType === 'CNI' && nationality === 'CM', [documentType, nationality]);

  const handleContinue = () => {
    if (!canContinue) return;
    setDocumentChoice({ documentType, nationality });
    localStorage.removeItem('vp_onboarding_flow');
    navigate('/kyc/cni-intro');
  };

  return (
    <ScreenLayout title="Document & nationalite" showBack>
      <div className="flex flex-col gap-5 py-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600" />
            <p className="text-sm font-semibold text-amber-700">
              Pour cette version, seules les CNI camerounaises sont prises en charge.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">Choix du document</p>
          {DOCUMENTS.map((doc) => (
            <button
              key={doc.type}
              type="button"
              disabled={!doc.enabled}
              onClick={() => doc.enabled && setDocumentType(doc.type)}
              className={`flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left transition ${
                doc.enabled
                  ? documentType === doc.type
                    ? 'border border-primary bg-primary/10 text-primary'
                    : 'border border-slate-200 bg-white text-slate-700'
                  : 'cursor-not-allowed border border-slate-100 bg-slate-50 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-3">
                {doc.type === 'CNI' ? <IdCard className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                <span className="font-semibold">{doc.label}</span>
              </div>
              {!doc.enabled ? <span className="text-xs font-bold uppercase">Indisponible</span> : null}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">Nationalite du document</p>
          {NATIONALITIES.map((n) => (
            <button
              key={n.code}
              type="button"
              disabled={!n.enabled}
              onClick={() => n.enabled && setNationality(n.code)}
              className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                n.enabled
                  ? nationality === n.code
                    ? 'border border-primary bg-primary/10 text-primary'
                    : 'border border-slate-200 bg-white text-slate-700'
                  : 'cursor-not-allowed border border-slate-100 bg-slate-50 text-slate-400'
              }`}
            >
              <span className="font-semibold">{n.label}</span>
              {!n.enabled ? <span className="text-xs font-bold uppercase">Bientot</span> : null}
            </button>
          ))}
        </div>

        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-white transition disabled:opacity-50"
        >
          Continuer vers la capture CNI
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </ScreenLayout>
  );
}
