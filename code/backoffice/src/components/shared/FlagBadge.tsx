/**
 * FlagBadge — Badge pour les drapeaux de dossier KYC
 * Source: veripass-gatekeeper prototype
 */
import { cn } from '@/lib/utils';
import { DossierFlag } from '@/types';

const flagConfig: Record<DossierFlag, { label: string; icon: string; variant: string }> = {
  LOW_OCR: { label: 'OCR faible', icon: '⚠️', variant: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  AML_HIT: { label: 'Alerte AML', icon: '🔴', variant: 'bg-red-50 text-red-700 border-red-200' },
  NIU_DECLARATIF: { label: 'NIU déclaratif', icon: '📝', variant: 'bg-blue-50 text-blue-700 border-blue-200' },
  DUPLICATE: { label: 'Doublon', icon: '🔄', variant: 'bg-purple-50 text-purple-700 border-purple-200' },
  EXPIRED_DOC: { label: 'Doc expiré', icon: '📅', variant: 'bg-orange-50 text-orange-700 border-orange-200' },
  LIVENESS_BORDERLINE: { label: 'Livenesse limite', icon: '🔍', variant: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  ADDRESS_INCOHERENT: { label: 'Adresse incohérente', icon: '📍', variant: 'bg-pink-50 text-pink-700 border-pink-200' },
};

interface FlagBadgeProps {
  flag: DossierFlag;
  compact?: boolean;
  className?: string;
}

export function FlagBadge({ flag, compact = false, className }: FlagBadgeProps) {
  const cfg = flagConfig[flag];
  if (!cfg) return null;

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold border',
          cfg.variant,
          className
        )}
        title={cfg.label}
      >
        {cfg.icon}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        cfg.variant,
        className
      )}
    >
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  );
}