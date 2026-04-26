const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function fetchQueue() {
  const res = await fetch(`${API_BASE}/backoffice/queue`);
  if (!res.ok) throw new Error('Failed to fetch queue');
  return res.json();
}

export async function fetchDossier(id: string) {
  const res = await fetch(`${API_BASE}/backoffice/dossier/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch dossier ${id}`);
  return res.json();
}

export async function fetchAuditLog(sessionId?: string) {
  const url = sessionId
    ? `${API_BASE}/backoffice/audit-log?session_id=${sessionId}`
    : `${API_BASE}/backoffice/audit-log`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch audit log');
  return res.json();
}

export async function claimDossier(sessionId: string, agentId: string) {
  const res = await fetch(`${API_BASE}/backoffice/dossier/${sessionId}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId }),
  });
  if (!res.ok) throw new Error(`Failed to claim dossier ${sessionId}`);
  return res.json();
}

export async function unclaimDossier(sessionId: string, agentId: string) {
  const res = await fetch(`${API_BASE}/backoffice/dossier/${sessionId}/unclaim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId }),
  });
  if (!res.ok) throw new Error(`Failed to unclaim dossier ${sessionId}`);
  return res.json();
}

export async function requestInfo(sessionId: string, agentId: string, message: string, fields: string[]) {
  const res = await fetch(`${API_BASE}/backoffice/dossier/${sessionId}/request-info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, agentId, message, fields }),
  });
  if (!res.ok) throw new Error(`Failed to request info for dossier ${sessionId}`);
  return res.json();
}

export async function fetchDashboardStats(token: string) {
  const res = await fetch(`${API_BASE}/analytics/dashboard`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error('Failed to fetch dashboard stats');
  return res.json();
}