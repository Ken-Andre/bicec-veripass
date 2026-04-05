/**
 * TanStack Query hooks pour les appels API
 * Source: veripass-gatekeeper prototype (src/hooks/useQueryHooks.ts)
 * WARNING: Nécessite @tanstack/react-query installé
 */

import { useQuery } from '@tanstack/react-query';
import { fetchQueue, fetchDossier, fetchAuditLog } from '@/services/dossier-service';
import { fetchAmlAlerts, fetchNiuConflicts, fetchAgencies, fetchBatchJobs } from '@/services/aml-service';

/**
 * Fetch la file d'attente des dossiers KYC
 * Rafraîchissement auto toutes les 30 secondes
 */
export function useQueue() {
  return useQuery({
    queryKey: ['queue'],
    queryFn: fetchQueue,
    refetchInterval: 30_000,
  });
}

/**
 * Fetch un dossier KYC spécifique
 * N'appelle l'API que si l'ID est fourni
 */
export function useDossier(id: string) {
  return useQuery({
    queryKey: ['dossier', id],
    queryFn: () => fetchDossier(id),
    enabled: !!id,
  });
}

/**
 * Fetch le journal d'audit pour une session KYC
 * Rafraîchissement auto toutes les 30 secondes
 */
export function useAuditLog(sessionId?: string) {
  return useQuery({
    queryKey: ['audit', sessionId],
    queryFn: () => fetchAuditLog(sessionId),
    refetchInterval: 30_000,
  });
}

/**
 * Fetch les alertes AML
 * Rafraîchissement auto toutes les 30 secondes
 */
export function useAmlAlerts() {
  return useQuery({
    queryKey: ['aml-alerts'],
    queryFn: fetchAmlAlerts,
    refetchInterval: 30_000,
  });
}

/**
 * Fetch les conflits NIU
 * Rafraîchissement auto toutes les 30 secondes
 */
export function useNiuConflicts() {
  return useQuery({
    queryKey: ['niu-conflicts'],
    queryFn: fetchNiuConflicts,
    refetchInterval: 30_000,
  });
}

/**
 * Fetch la liste des agences
 * Rafraîchissement auto toutes les 30 secondes
 */
export function useAgencies() {
  return useQuery({
    queryKey: ['agencies'],
    queryFn: fetchAgencies,
    refetchInterval: 30_000,
  });
}

/**
 * Fetch les jobs batch
 * Rafraîchissement auto toutes les 30 secondes
 */
export function useBatchJobs() {
  return useQuery({
    queryKey: ['batch-jobs'],
    queryFn: fetchBatchJobs,
    refetchInterval: 30_000,
  });
}