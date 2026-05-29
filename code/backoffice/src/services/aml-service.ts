import { apiGet, apiGetBlob, apiPost, type ApiError } from './api-client'
import type { AmlListImportReport } from '@/types/aml'

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

export async function fetchDocumentExpiry() {
  return apiGet('/aml/document-expiry')
}

export async function fetchAmlLists() {
  return apiGet('/aml/lists')
}

export async function downloadAmlListTemplate() {
  return apiGetBlob('/aml/lists/template')
}

async function postAmlListFile(path: string, file: File): Promise<AmlListImportReport> {
  const formData = new FormData()
  formData.append('file', file, file.name)
  return apiPost(path, formData)
}

export async function dryRunAmlListImport(file: File): Promise<AmlListImportReport> {
  return postAmlListFile('/aml/lists/import/dry-run', file)
}

export async function confirmAmlListImport(file: File): Promise<AmlListImportReport> {
  return postAmlListFile('/aml/lists/import', file)
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
