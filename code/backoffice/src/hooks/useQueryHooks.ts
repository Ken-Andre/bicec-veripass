import { useQuery } from '@tanstack/react-query'
import { fetchQueue, fetchQueueStats, fetchDossier, fetchAuditLog } from '@/services/dossier-service'
import { fetchAmlAlerts, fetchAmlLists, fetchNiuConflicts, fetchAgencies, fetchBatchJobs, fetchDocumentExpiry } from '@/services/aml-service'
import type { QueueItem, QueueStats } from '@/services/dossier-service'
import type { AmlAlert, AmlListRegistryItem, NiuConflict, Agency, BatchJob, DocumentExpiryResponse } from '@/types/aml'

export function useQueue(status?: string) {
  return useQuery<QueueItem[]>({
    queryKey: ['queue', status || 'active'],
    queryFn: () => fetchQueue(status),
    refetchInterval: 30_000,
  })
}

export function useQueueStats() {
  return useQuery<QueueStats>({
    queryKey: ['queue-stats'],
    queryFn: fetchQueueStats,
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

export function useDocumentExpiry() {
  return useQuery<DocumentExpiryResponse>({
    queryKey: ['document-expiry'],
    queryFn: fetchDocumentExpiry,
    refetchInterval: 30_000,
  })
}

export function useAmlLists() {
  return useQuery<AmlListRegistryItem[]>({
    queryKey: ['aml-lists'],
    queryFn: fetchAmlLists,
    refetchInterval: 60_000,
  })
}
