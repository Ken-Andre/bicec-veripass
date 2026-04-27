import { apiGet, apiPost, type ApiError } from './api-client'

export async function fetchAmlAlerts() {
  return apiGet('/aml/alerts')
}

export async function fetchNiuConflicts() {
  return apiGet('/aml/niu-conflicts')
}

export async function fetchAgencies() {
  return apiGet('/aml/agencies')
}

export async function fetchBatchJobs() {
  return apiGet('/aml/batch-jobs')
}

export async function clearAmlAlert(alertId: string, justification: string) {
  return apiPost(`/aml/alerts/${alertId}/clear`, { justification })
}

export async function confirmAmlAlert(alertId: string, justification: string) {
  return apiPost(`/aml/alerts/${alertId}/confirm`, { justification })
}

export async function escalateAmlAlert(alertId: string, reason: string) {
  return apiPost(`/aml/alerts/${alertId}/escalate`, { reason })
}

export async function resolveNiuConflict(conflictId: string, action: 'MERGED' | 'FRAUD', justification: string) {
  return apiPost(`/aml/niu-conflicts/${conflictId}/resolve`, { action, justification })
}

export { ApiError }
