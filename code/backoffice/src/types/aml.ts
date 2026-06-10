/**
 * Types AML (Anti-Money Laundering) / Conformité
 * Source: veripass-gatekeeper prototype
 * Mapping vers BICEC VeriPass - Thomas persona
 */

export enum AmlSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum AmlAlertStatus {
  OPEN = 'OPEN',
  CLEARED = 'CLEARED',
  CONFIRMED = 'CONFIRMED',
  ESCALATED = 'ESCALATED',
}

export interface SanctionHit {
  id: string;
  listName: string;
  matchedName: string;
  matchScore: number;
  listType: 'PEP' | 'SANCTIONS' | 'ADVERSE_MEDIA';
  details: string;
  country: string;
}

export interface AmlAlert {
  id: string;
  sessionId: string;
  clientName: string;
  niu: string;
  severity: AmlSeverity;
  status: AmlAlertStatus;
  hits: SanctionHit[];
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  justification?: string;
}

export interface NiuConflict {
  id: string;
  niu: string;
  sessionA: {
    id: string;
    clientName: string;
    createdAt: string;
    confidence: number;
  };
  sessionB: {
    id: string;
    clientName: string;
    createdAt: string;
    confidence: number;
  };
  similarityScore: number;
  status: 'OPEN' | 'MERGED' | 'FRAUD';
}

export interface Agency {
  id: string;
  code: string;
  name: string;
  city: string;
  isActive: boolean;
  agentCount: number;
}

export interface BatchJob {
  id: string;
  type: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  totalItems: number;
  processedItems: number;
  failedItems: number;
  startedAt: string;
  completedAt?: string;
}

export interface DocumentExpiryItem {
  sessionId: string;
  clientName: string;
  status: string;
  accessLevel: string;
  expiryDate: string | null;
  state: 'expired' | 'expiring';
  notifiedAt?: string | null;
  contact?: string | null;
}

export interface DocumentExpiryResponse {
  items: DocumentExpiryItem[];
  total: number;
  page: number;
  limit: number;
}

export interface AmlListRegistryItem {
  source: string;
  listType: 'PEP' | 'SANCTIONS' | 'ADVERSE_MEDIA';
  activeCount: number;
  latestSyncedAt?: string | null;
  latestImportId?: string | null;
  latestImportStatus?: string | null;
  latestImportAt?: string | null;
  importedBy?: string | null;
}

export interface AmlListImportReport {
  importId?: string | null;
  source: string;
  listType: 'PEP' | 'SANCTIONS' | 'ADVERSE_MEDIA';
  dryRun: boolean;
  status: string;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  errors: Array<{ row: number; message: string }>;
}
