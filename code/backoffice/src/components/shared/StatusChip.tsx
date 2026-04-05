/**
 * StatusChip — Badge de statut KYC avec 18 variantes colorées
 * Source: veripass-gatekeeper prototype
 * Mapping vers BICEC VeriPass — conforme ADR-001
 */
import { cn } from '@/lib/utils';
import { KycStatus } from '@/types';

const statusConfig: Record<
  string,
  { label: string; variant: string; colorDot: string }
> = {
  [KycStatus.INITIATED]: { label: 'Initié', variant: 'bg-muted text-muted-foreground', colorDot: 'bg-gray-400' },
  [KycStatus.DOCUMENT_UPLOAD_PENDING]: { label: 'En attente docs', variant: 'bg-muted text-muted-foreground', colorDot: 'bg-gray-400' },
  [KycStatus.DOCUMENT_UPLOADED]: { label: 'Docs reçus', variant: 'bg-primary/10 text-primary', colorDot: 'bg-primary' },
  [KycStatus.OCR_PROCESSING]: { label: 'OCR…', variant: 'bg-primary/10 text-primary', colorDot: 'bg-blue-400 animate-pulse' },
  [KycStatus.OCR_COMPLETED]: { label: 'OCR OK', variant: 'bg-success/10 text-success', colorDot: 'bg-green-500' },
  [KycStatus.OCR_FAILED]: { label: 'OCR ✗', variant: 'bg-error/10 text-error', colorDot: 'bg-red-500' },
  [KycStatus.BIOMETRIC_PENDING]: { label: 'Bio…', variant: 'bg-warning/10 text-warning', colorDot: 'bg-yellow-400' },
  [KycStatus.BIOMETRIC_PROCESSING]: { label: 'Bio…', variant: 'bg-primary/10 text-primary', colorDot: 'bg-blue-400 animate-pulse' },
  [KycStatus.BIOMETRIC_COMPLETED]: { label: 'Bio OK', variant: 'bg-success/10 text-success', colorDot: 'bg-green-500' },
  [KycStatus.BIOMETRIC_FAILED]: { label: 'Bio ✗', variant: 'bg-error/10 text-error', colorDot: 'bg-red-500' },
  [KycStatus.AML_CHECK]: { label: 'AML en cours', variant: 'bg-warning/10 text-warning', colorDot: 'bg-yellow-400' },
  [KycStatus.AML_FLAGGED]: { label: 'AML ⚠', variant: 'bg-destructive/10 text-destructive', colorDot: 'bg-red-600' },
  [KycStatus.AML_CLEARED]: { label: 'AML ✓', variant: 'bg-success/10 text-success', colorDot: 'bg-green-500' },
  [KycStatus.PENDING_REVIEW]: { label: 'En file', variant: 'bg-warning/10 text-warning', colorDot: 'bg-yellow-400' },
  [KycStatus.MANUAL_REVIEW]: { label: 'Révision', variant: 'bg-bicec-orange/10 text-bicec-orange', colorDot: 'bg-orange-500' },
  [KycStatus.READY_FOR_OPS]: { label: 'Prêt Ops', variant: 'bg-success/10 text-success', colorDot: 'bg-green-500' },
  [KycStatus.APPROVED]: { label: 'Approuvé', variant: 'bg-success/15 text-success font-semibold', colorDot: 'bg-green-600' },
  [KycStatus.REJECTED]: { label: 'Rejeté', variant: 'bg-destructive/15 text-destructive font-semibold', colorDot: 'bg-red-600' },
};

interface StatusChipProps {
  status: KycStatus | string;
  showDot?: boolean;
  className?: string;
}

export function StatusChip({ status, showDot = true, className }: StatusChipProps) {
  const cfg = statusConfig[status] || { label: status, variant: 'bg-muted text-muted-foreground', colorDot: 'bg-gray-400' };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
        cfg.variant,
        className
      )}
    >
      {showDot && <span className={cn('w-1.5 h-1.5 rounded-full', cfg.colorDot)} />}
      {cfg.label}
    </span>
  );
}