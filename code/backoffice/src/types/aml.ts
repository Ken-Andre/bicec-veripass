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
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
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
  status: 'PENDING' | 'MERGED' | 'FRAUD';
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