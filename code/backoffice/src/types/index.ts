/**
 * Index de tous les types Backoffice
 * Centralise les exports pour import unique
 */

export { KycStatus, AccessLevel, Priority, DocumentType, DossierFlag, RejectReason } from './kyc';
export type { OcrField, KycDocument, BiometricResult, ClientIdentity, KycSession } from './kyc';

export { AmlSeverity, AmlAlertStatus } from './aml';
export type { SanctionHit, AmlAlert, NiuConflict, Agency, BatchJob, DocumentExpiryItem, DocumentExpiryResponse } from './aml';

export { ActionType } from './audit';
export type { AuditEntry } from './audit';
