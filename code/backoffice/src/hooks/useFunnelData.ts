/**
 * Hook de calcul d'entonnoir KYC (Funnel Analytics)
 * Source: veripass-gatekeeper prototype (src/hooks/useFunnelData.ts)
 * Mapping vers BICEC VeriPass - Epic 7 (Sylvie)
 *
 * WARNING: Les couleurs utilisent les variables CSS Tailwind du projet.
 */

import { useMemo } from 'react';
import { KycStatus, type KycSession } from '@/types';

const FUNNEL_STEPS = [
  { key: 'initiated', label: 'Initiés', statuses: Object.values(KycStatus) },
  {
    key: 'ocr_done',
    label: 'OCR traité',
    statuses: [
      KycStatus.OCR_COMPLETED,
      KycStatus.BIOMETRIC_PENDING,
      KycStatus.BIOMETRIC_PROCESSING,
      KycStatus.BIOMETRIC_COMPLETED,
      KycStatus.BIOMETRIC_FAILED,
      KycStatus.AML_CHECK,
      KycStatus.AML_FLAGGED,
      KycStatus.AML_CLEARED,
      KycStatus.PENDING_REVIEW,
      KycStatus.MANUAL_REVIEW,
      KycStatus.READY_FOR_OPS,
      KycStatus.APPROVED,
      KycStatus.REJECTED,
    ],
  },
  {
    key: 'bio_done',
    label: 'Biométrie OK',
    statuses: [
      KycStatus.BIOMETRIC_COMPLETED,
      KycStatus.AML_CHECK,
      KycStatus.AML_FLAGGED,
      KycStatus.AML_CLEARED,
      KycStatus.PENDING_REVIEW,
      KycStatus.MANUAL_REVIEW,
      KycStatus.READY_FOR_OPS,
      KycStatus.APPROVED,
      KycStatus.REJECTED,
    ],
  },
  {
    key: 'aml_done',
    label: 'AML passé',
    statuses: [
      KycStatus.AML_CLEARED,
      KycStatus.PENDING_REVIEW,
      KycStatus.MANUAL_REVIEW,
      KycStatus.READY_FOR_OPS,
      KycStatus.APPROVED,
      KycStatus.REJECTED,
    ],
  },
  {
    key: 'reviewed',
    label: 'Validé agent',
    statuses: [KycStatus.READY_FOR_OPS, KycStatus.APPROVED],
  },
  {
    key: 'approved',
    label: 'Approuvé',
    statuses: [KycStatus.APPROVED],
  },
];

const FUNNEL_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--primary))',
  'hsl(var(--bicec-or))',
  'hsl(var(--bicec-or))',
  'hsl(var(--success))',
  'hsl(var(--success))',
];

export interface FunnelStep {
  name: string;
  value: number; // Percentage (0-100)
  count: number; // Absolute count
  color: string;
}

/**
 * Hook de calcul d'entonnoir de conversion KYC
 * Data-driven: calcule depuis les sessions réelles
 *
 * @param sessions - Liste des sessions KYC (depuis TanStack Query)
 * @returns Tableau de 6 étapes avec nom, pourcentage, count, couleur
 */
export function useFunnelData(sessions: KycSession[] | undefined): FunnelStep[] {
  return useMemo(() => {
    const list = sessions || [];
    const total = list.length || 1; // Avoid division by zero
    return FUNNEL_STEPS.map((step, i) => {
      const count = list.filter((s) =>
        step.statuses.includes(s.status)
      ).length;
      return {
        name: step.label,
        value: Math.round((count / total) * 100),
        count,
        color: FUNNEL_COLORS[i],
      };
    });
  }, [sessions]);
}