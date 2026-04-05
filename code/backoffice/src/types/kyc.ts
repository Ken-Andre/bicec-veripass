// KYC Types for Backoffice

// KYC Types enrichis pour Backoffice
// Source: veripass-gatekeeper prototype + state-machine-kyc-v3-updated.md
// WARNING: Synchroniser avec les modèles SQLAlchemy backend et les seeds Python

export enum KycStatus {
  INITIATED = 'INITIATED',
  DOCUMENT_UPLOAD_PENDING = 'DOCUMENT_UPLOAD_PENDING',
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  OCR_PROCESSING = 'OCR_PROCESSING',
  OCR_COMPLETED = 'OCR_COMPLETED',
  OCR_FAILED = 'OCR_FAILED',
  BIOMETRIC_PENDING = 'BIOMETRIC_PENDING',
  BIOMETRIC_PROCESSING = 'BIOMETRIC_PROCESSING',
  BIOMETRIC_COMPLETED = 'BIOMETRIC_COMPLETED',
  BIOMETRIC_FAILED = 'BIOMETRIC_FAILED',
  AML_CHECK = 'AML_CHECK',
  AML_CLEARED = 'AML_CLEARED',
  AML_FLAGGED = 'AML_FLAGGED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  READY_FOR_OPS = 'READY_FOR_OPS',
}

// 6 access levels per state-machine-kyc-v3-updated.md (mapping ADR-001)
export enum AccessLevel {
  NONE = 'NONE',
  RESTRICTED = 'RESTRICTED',
  LIMITED = 'LIMITED',
  PRE_FULL = 'PRE_FULL',
  FULL = 'FULL',
  SUSPENDED = 'SUSPENDED',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum DocumentType {
  CNI_RECTO = 'CNI_RECTO',
  CNI_VERSO = 'CNI_VERSO',
  SELFIE = 'SELFIE',
  PROOF_OF_ADDRESS = 'PROOF_OF_ADDRESS',
  PASSPORT = 'PASSPORT',
}

export enum DossierFlag {
  LOW_OCR = 'LOW_OCR',
  AML_HIT = 'AML_HIT',
  NIU_DECLARATIF = 'NIU_DECLARATIF',
  DUPLICATE = 'DUPLICATE',
  EXPIRED_DOC = 'EXPIRED_DOC',
  LIVENESS_BORDERLINE = 'LIVENESS_BORDERLINE',
  ADDRESS_INCOHERENT = 'ADDRESS_INCOHERENT',
}

// 8 reject reasons per ADR-004 (state machine transitions)
export enum RejectReason {
  IDENTITY_MISMATCH = 'IDENTITY_MISMATCH',
  DOCUMENT_EXPIRED = 'DOCUMENT_EXPIRED',
  LOW_QUALITY_IMAGE = 'LOW_QUALITY_IMAGE',
  LIVENESS_FAIL = 'LIVENESS_FAIL',
  DUPLICATE_DETECTED = 'DUPLICATE_DETECTED',
  AML_FLAGGED = 'AML_FLAGGED',
  INCOMPLETE_DOSSIER = 'INCOMPLETE_DOSSIER',
  OTHER = 'OTHER',
}

// bbox is optional for fields without OCR bounding box data
export interface OcrField {
  id: string;
  fieldName: string;
  extractedValue: string;
  correctedValue?: string;
  confidence: number;
  bbox?: { x: number; y: number; width: number; height: number };
  documentType: DocumentType;
  needsReview: boolean;
}

export interface KycDocument {
  id: string;
  type: DocumentType;
  url: string;
  uploadedAt: string;
  ocrFields: OcrField[];
}

export interface BiometricResult {
  faceMatchScore: number;
  livenessScore: number;
  antiSpoofingScore: number;
  selfieQuality: number;
}

export interface ClientIdentity {
  id: string;
  niu: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  gender: string;
  nationality: string;
  address: string;
  phone: string;
}

export interface KycSession {
  id: string;
  clientIdentity: ClientIdentity;
  status: KycStatus;
  accessLevel: AccessLevel;
  priority: Priority;
  flags: DossierFlag[];
  documents: KycDocument[];
  biometrics: BiometricResult;
  assignedAgentId?: string;
  agencyCode: string;
  overallConfidence: number;
  createdAt: string;
  updatedAt: string;
  slaDeadline: string;
}