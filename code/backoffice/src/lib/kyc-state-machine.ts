/**
 * Machine d'état KYC - Gestion des transitions de status
 * Source: veripass-gatekeeper prototype (src/lib/kyc-state-machine.ts)
 * Mapping vers BICEC VeriPass - conforme ADR-001 et state-machine-kyc-v3-updated.md
 *
 * WARNING: Cette machine est en lecture seule côté frontend.
 * Les transitions réelles sont validées par le backend SQLAlchemy.
 */

import { KycStatus, AccessLevel, type KycSession } from '@/types';
import { ActionType, type AuditEntry } from '@/types';
import { generateId } from './id';

export type TransitionAction =
  | 'UPLOAD_DOCUMENT'
  | 'START_OCR'
  | 'OCR_SUCCESS'
  | 'OCR_FAIL'
  | 'START_BIOMETRIC'
  | 'BIOMETRIC_SUCCESS'
  | 'BIOMETRIC_FAIL'
  | 'START_AML'
  | 'AML_FLAG'
  | 'AML_CLEAR'
  | 'SUBMIT_REVIEW'
  | 'ASSIGN_AGENT'
  | 'APPROVE'
  | 'REJECT'
  | 'REQUEST_INFO'
  | 'RETRY_OCR'
  | 'RETRY_BIOMETRIC';

/**
 * Matrice des transitions autorisées
 * Conformément à state-machine-kyc-v3-updated.md
 */
const allowedTransitions: Record<string, Partial<Record<TransitionAction, KycStatus>>> = {
  [KycStatus.INITIATED]: {
    UPLOAD_DOCUMENT: KycStatus.DOCUMENT_UPLOAD_PENDING,
  },
  [KycStatus.DOCUMENT_UPLOAD_PENDING]: {
    UPLOAD_DOCUMENT: KycStatus.DOCUMENT_UPLOADED,
  },
  [KycStatus.DOCUMENT_UPLOADED]: {
    START_OCR: KycStatus.OCR_PROCESSING,
  },
  [KycStatus.OCR_PROCESSING]: {
    OCR_SUCCESS: KycStatus.OCR_COMPLETED,
    OCR_FAIL: KycStatus.OCR_FAILED,
  },
  [KycStatus.OCR_COMPLETED]: {
    START_BIOMETRIC: KycStatus.BIOMETRIC_PENDING,
  },
  [KycStatus.OCR_FAILED]: {
    RETRY_OCR: KycStatus.OCR_PROCESSING,
    REJECT: KycStatus.REJECTED,
  },
  [KycStatus.BIOMETRIC_PENDING]: {
    START_BIOMETRIC: KycStatus.BIOMETRIC_PROCESSING,
  },
  [KycStatus.BIOMETRIC_PROCESSING]: {
    BIOMETRIC_SUCCESS: KycStatus.BIOMETRIC_COMPLETED,
    BIOMETRIC_FAIL: KycStatus.BIOMETRIC_FAILED,
  },
  [KycStatus.BIOMETRIC_COMPLETED]: {
    START_AML: KycStatus.AML_CHECK,
  },
  [KycStatus.BIOMETRIC_FAILED]: {
    RETRY_BIOMETRIC: KycStatus.BIOMETRIC_PROCESSING,
    REJECT: KycStatus.REJECTED,
  },
  [KycStatus.AML_CHECK]: {
    AML_FLAG: KycStatus.AML_FLAGGED,
    AML_CLEAR: KycStatus.AML_CLEARED,
  },
  [KycStatus.AML_FLAGGED]: {
    AML_CLEAR: KycStatus.AML_CLEARED,
    REJECT: KycStatus.REJECTED,
  },
  [KycStatus.AML_CLEARED]: {
    SUBMIT_REVIEW: KycStatus.PENDING_REVIEW,
  },
  [KycStatus.PENDING_REVIEW]: {
    ASSIGN_AGENT: KycStatus.MANUAL_REVIEW,
  },
  [KycStatus.MANUAL_REVIEW]: {
    APPROVE: KycStatus.READY_FOR_OPS,
    REJECT: KycStatus.REJECTED,
    REQUEST_INFO: KycStatus.PENDING_REVIEW,
  },
  [KycStatus.READY_FOR_OPS]: {
    APPROVE: KycStatus.APPROVED,
  },
};

/**
 * Mapping Status → AccessLevel
 * Conformément à ADR-001 et state-machine-kyc-v3-updated.md
 */
const accessLevelMap: Partial<Record<KycStatus, AccessLevel>> = {
  [KycStatus.INITIATED]: AccessLevel.NONE,
  [KycStatus.DOCUMENT_UPLOADED]: AccessLevel.RESTRICTED,
  [KycStatus.OCR_COMPLETED]: AccessLevel.RESTRICTED,
  [KycStatus.BIOMETRIC_COMPLETED]: AccessLevel.LIMITED,
  [KycStatus.AML_CLEARED]: AccessLevel.LIMITED,
  [KycStatus.READY_FOR_OPS]: AccessLevel.PRE_FULL,
  [KycStatus.APPROVED]: AccessLevel.FULL,
  [KycStatus.REJECTED]: AccessLevel.SUSPENDED,
};

/**
 * Mapping Action → ActionType (pour les logs d'audit)
 */
const actionTypeMap: Partial<Record<TransitionAction, ActionType>> = {
  APPROVE: ActionType.APPROVE,
  REJECT: ActionType.REJECT,
  REQUEST_INFO: ActionType.REQUEST_INFO,
  ASSIGN_AGENT: ActionType.ASSIGN,
  AML_CLEAR: ActionType.AML_CLEAR,
  AML_FLAG: ActionType.STATUS_CHANGE,
};

export interface TransitionResult {
  session: KycSession;
  auditEntry: AuditEntry;
}

/**
 * Exécute une transition d'état KYC
 *
 * @param session - Session KYC actuelle
 * @param action - Action à exécuter
 * @param agentId - ID de l'agent (JEAN/THOMAS)
 * @param agentName - Nom de l'agent
 * @param rationale - Justification de la transition
 * @param metadata - Métadonnées supplémentaires
 * @returns Nouvelle session et entrée d'audit
 *
 * @throws Si la transition n'est pas autorisée
 */
export function transition(
  session: KycSession,
  action: TransitionAction,
  agentId: string,
  agentName: string,
  rationale: string,
  metadata?: Record<string, unknown>
): TransitionResult {
  const currentTransitions = allowedTransitions[session.status];
  if (!currentTransitions) {
    throw new Error(`No transitions available from state: ${session.status}`);
  }

  const newStatus = currentTransitions[action];
  if (!newStatus) {
    throw new Error(`Action "${action}" not allowed from state "${session.status}". Available: ${getAvailableActions(session.status).join(', ')}`);
  }

  const previousState = session.status;
  const newAccessLevel = accessLevelMap[newStatus] ?? session.accessLevel;

  const updatedSession: KycSession = {
    ...session,
    status: newStatus,
    accessLevel: newAccessLevel,
    updatedAt: new Date().toISOString(),
  };

  const auditEntry: AuditEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    agentId,
    agentName,
    actionType: actionTypeMap[action] ?? ActionType.STATUS_CHANGE,
    previousState,
    newState: newStatus,
    rationale,
    sessionId: session.id,
    metadata,
  };

  return { session: updatedSession, auditEntry };
}

/**
 * Retourne les actions disponibles depuis un statut donné
 *
 * @param status - Statut KYC actuel
 * @returns Liste des actions possibles
 */
export function getAvailableActions(status: KycStatus): TransitionAction[] {
  const transitions = allowedTransitions[status];
  return transitions ? (Object.keys(transitions) as TransitionAction[]) : [];
}