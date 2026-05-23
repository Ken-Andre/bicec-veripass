import { useQuery } from '@tanstack/react-query'
import { fetchQueue, fetchDossier, fetchAuditLog } from '@/services/dossier-service'
import { fetchAmlAlerts, fetchNiuConflicts, fetchAgencies, fetchBatchJobs } from '@/services/aml-service'
import type { QueueItem } from '@/services/dossier-service'
import type { AmlAlert, NiuConflict, Agency, BatchJob } from '@/types/aml'

export function useQueue() {
  return useQuery<QueueItem[]>({
    queryKey: ['queue'],
    queryFn: fetchQueue,
    refetchInterval: 30_000,
  })
}

export function useDossier(id: string) {
  return useQuery({
    queryKey: ['dossier', id],
    queryFn: () => fetchDossier(id),
    enabled: !!id,
  })
}

export function useAuditLog(sessionId?: string) {
  return useQuery<any[]>({
    queryKey: ['audit', sessionId],
    queryFn: () => fetchAuditLog(sessionId),
    refetchInterval: 30_000,
  })
}

export function useAmlAlerts() {
  return useQuery<AmlAlert[]>({
    queryKey: ['aml-alerts'],
    queryFn: fetchAmlAlerts,
    refetchInterval: 30_000,
  })
}

export function useNiuConflicts() {
  return useQuery<NiuConflict[]>({
    queryKey: ['niu-conflicts'],
    queryFn: fetchNiuConflicts,
    refetchInterval: 30_000,
  })
}

export function useAgencies() {
  return useQuery<Agency[]>({
    queryKey: ['agencies'],
    queryFn: fetchAgencies,
    refetchInterval: 30_000,
  })
}

export function useBatchJobs() {
  return useQuery<BatchJob[]>({
    queryKey: ['batch-jobs'],
    queryFn: fetchBatchJobs,
    refetchInterval: 30_000,
  })
}
