/**
 * AddressCoherencePanel — Vérification cohérence adresse
 * Source: veripass-gatekeeper prototype (src/components/shared/AddressCoherencePanel.tsx)
 * Mapping vers BICEC VeriPass — pour EvidenceViewerPage (Jean)
 */
import { cn } from '@/lib/utils';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface AddressData {
  region?: string;
  city?: string;
  commune?: string;
  quartier?: string;
  lieu_dit?: string;
}

interface AddressCoherencePanelProps {
  declared: AddressData;
  fromBill?: AddressData; // Adresse extraite de la facture ENEO/CAMWATER
  className?: string;
}

function compareAddresses(a: AddressData, b: AddressData): { match: boolean; details: string } {
  if (!a.city || !b.city) return { match: false, details: 'Données insuffisantes' };
  if (a.city.toLowerCase() === b.city.toLowerCase()) return { match: true, details: 'Ville cohérente' };
  if (a.commune && b.commune && a.commune.toLowerCase() === b.commune.toLowerCase()) {
    return { match: true, details: 'Commune cohérente' };
  }
  return { match: false, details: 'Incohérence détectée' };
}

export function AddressCoherencePanel({ declared, fromBill, className }: AddressCoherencePanelProps) {
  const check = fromBill ? compareAddresses(declared, fromBill) : { match: true, details: 'Pas de facture à comparer' };

  const Icon = fromBill
    ? check.match
      ? CheckCircle
      : XCircle
    : AlertTriangle;

  const colorClass = fromBill
    ? check.match
      ? 'text-green-600'
      : 'text-red-600'
    : 'text-yellow-600';

  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Icon className={cn('h-4 w-4', colorClass)} />
        Cohérence adresse
      </h4>

      <div className="space-y-2 text-xs">
        {/* Adresse déclarée */}
        <div>
          <span className="text-muted-foreground font-medium">Déclarée</span>
          <p className="text-foreground mt-1">
            {[declared.region, declared.city, declared.commune, declared.quartier, declared.lieu_dit]
              .filter(Boolean)
              .join(', ') || '—'}
          </p>
        </div>

        {/* Adresse facture */}
        {fromBill && (
          <div>
            <span className="text-muted-foreground font-medium">Facture</span>
            <p className="text-foreground mt-1">
              {[fromBill.region, fromBill.city, fromBill.commune, fromBill.quartier]
                .filter(Boolean)
                .join(', ') || '—'}
            </p>
          </div>
        )}

        {/* Résultat */}
        <div className={cn('text-xs font-medium mt-2', colorClass)}>
          {check.details}
        </div>
      </div>
    </div>
  );
}