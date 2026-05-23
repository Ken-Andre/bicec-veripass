/**
 * Types Audit / Journal d'activité
 * Source: veripass-gatekeeper prototype
 * Mapping vers BICEC VeriPass - Admin IT persona
 */

export enum ActionType {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  REQUEST_INFO = 'REQUEST_INFO',
  ASSIGN = 'ASSIGN',
  UNASSIGN = 'UNASSIGN',
  OCR_CORRECT = 'OCR_CORRECT',
  AML_CLEAR = 'AML_CLEAR',
  AML_CONFIRM = 'AML_CONFIRM',
  AML_ESCALATE = 'AML_ESCALATE',
  FIELD_EDIT = 'FIELD_EDIT',
  STATUS_CHANGE = 'STATUS_CHANGE',
  SYSTEM_AUTO = 'SYSTEM_AUTO',
  BIOMETRIC_CHECK = 'BIOMETRIC_CHECK',
  MERGE_IDENTITY = 'MERGE_IDENTITY',
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  actionType: ActionType;
  previousState: string;
  newState: string;
  rationale: string;
  sessionId: string;
  metadata?: Record<string, unknown>;
}