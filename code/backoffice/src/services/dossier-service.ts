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
  biometric_risk_flags?: string[]
}

export interface PageResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface QueueStats {
  pending: number
  info_required: number
  fraud_suspect: number
  approved: number
  rejected: number
}

export async function fetchQueue(status?: string): Promise<QueueItem[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  const res = await apiGet<PageResponse<QueueItem>>(`/backoffice/queue${query}`)
  return res.items
}

export async function fetchQueueStats(): Promise<QueueStats> {
  return apiGet('/backoffice/queue/stats')
}

export async function fetchDossier(id: string) {
  return apiGet(`/backoffice/dossier/${id}`)
}

export async function fetchAuditLog(sessionId?: string) {
  const path = sessionId
    ? `/backoffice/audit-logs?session_id=${sessionId}`
    : '/backoffice/audit-logs?limit=100'
  const res = await apiGet<PageResponse<unknown>>(path)
  return res.items.map((item: any) => ({
    ...item,
    timestamp: item.timestamp || item.performed_at,
    agentId: item.agentId || item.agent_id || item.performed_by,
    actionType: item.actionType || item.action,
    previousState: item.previousState || item.previous_state || '',
    newState: item.newState || item.new_state || '',
    rationale: item.rationale || item.reason || '',
    sessionId: item.sessionId || item.session_id || item.record_id,
  }))
}

export async function reviewDossier(
  sessionId: string,
  decision: string,
  reason: string,
  options?: { biometricOverrideConfirmed?: boolean },
) {
  return apiPost(`/backoffice/dossier/${sessionId}/review`, {
    decision,
    reason,
    biometric_override_confirmed: options?.biometricOverrideConfirmed ?? false,
  })
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
