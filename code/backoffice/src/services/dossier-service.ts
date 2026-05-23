import { apiGet, apiPost, type ApiError } from './api-client'

export interface QueueItem {
  id: string
  status: string
  access_level: string
  priority_flag: boolean
  client_name: string | null
  client_phone: string | null
  assigned_agent_name: string | null
  overall_confidence: number | null
  agency_code: string | null
  submitted_at: string | null
}

export interface PageResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export async function fetchQueue(): Promise<QueueItem[]> {
  const res = await apiGet<PageResponse<QueueItem>>('/backoffice/queue')
  return res.items
}

export async function fetchDossier(id: string) {
  return apiGet(`/backoffice/dossier/${id}`)
}

export async function fetchAuditLog(sessionId?: string) {
  const path = sessionId
    ? `/backoffice/audit-logs?session_id=${sessionId}`
    : '/backoffice/audit-logs'
  const res = await apiGet<PageResponse<unknown>>(path)
  return res.items
}

export async function reviewDossier(sessionId: string, decision: string, reason: string) {
  return apiPost(`/backoffice/dossier/${sessionId}/review`, { decision, reason })
}

export async function assignDossier(sessionId: string, agentId: string) {
  return apiPost(`/backoffice/dossier/${sessionId}/assign`, { agent_id: agentId })
}

export async function autoAssignDossier(sessionId: string) {
  return apiPost(`/backoffice/dossier/${sessionId}/auto-assign`)
}

export async function requestInfo(sessionId: string, message: string, _fields: string[]) {
  return apiPost(`/backoffice/dossier/${sessionId}/review`, {
    decision: 'INFO_REQUESTED',
    reason: message,
  })
}

export async function fetchDashboardStats() {
  return apiGet('/analytics/dashboard')
}

export { ApiError }
