/**
 * Service API pour la conformité AML/CFT
 * Source: veripass-gatekeeper prototype (src/services/aml-service.ts)
 * WARNING: Endpoint URLs doivent correspondre aux routes backend FastAPI
 */

import type { AmlAlert, NiuConflict, Agency, BatchJob } from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function fetchAmlAlerts(): Promise<AmlAlert[]> {
  const res = await fetch(`${API_BASE}/aml/alerts`);
  if (!res.ok) throw new Error('Failed to fetch AML alerts');
  return res.json();
}

export async function fetchNiuConflicts(): Promise<NiuConflict[]> {
  const res = await fetch(`${API_BASE}/aml/niu-conflicts`);
  if (!res.ok) throw new Error('Failed to fetch NIU conflicts');
  return res.json();
}

export async function fetchAgencies(): Promise<Agency[]> {
  const res = await fetch(`${API_BASE}/aml/agencies`);
  if (!res.ok) throw new Error('Failed to fetch agencies');
  return res.json();
}

export async function fetchBatchJobs(): Promise<BatchJob[]> {
  const res = await fetch(`${API_BASE}/aml/batch-jobs`);
  if (!res.ok) throw new Error('Failed to fetch batch jobs');
  return res.json();
}

export async function clearAmlAlert(alertId: string, agentId: string, justification: string) {
  const res = await fetch(`${API_BASE}/aml/alerts/${alertId}/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, justification }),
  });
  if (!res.ok) throw new Error(`Failed to clear AML alert ${alertId}`);
  return res.json();
}

export async function confirmAmlAlert(alertId: string, agentId: string, justification: string) {
  const res = await fetch(`${API_BASE}/aml/alerts/${alertId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, justification }),
  });
  if (!res.ok) throw new Error(`Failed to confirm AML alert ${alertId}`);
  return res.json();
}

export async function escalateAmlAlert(alertId: string, agentId: string, reason: string) {
  const res = await fetch(`${API_BASE}/aml/alerts/${alertId}/escalate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, reason }),
  });
  if (!res.ok) throw new Error(`Failed to escalate AML alert ${alertId}`);
  return res.json();
}

export async function resolveNiuConflict(conflictId: string, action: 'MERGED' | 'FRAUD', agentId: string, justification: string) {
  const res = await fetch(`${API_BASE}/aml/niu-conflicts/${conflictId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, agentId, justification }),
  });
  if (!res.ok) throw new Error(`Failed to resolve NIU conflict ${conflictId}`);
  return res.json();
}