// === EXISTING TYPES (kept for compatibility) ===

export interface User {
  id: string;
  phone?: string;
  email?: string;
  role: string;
  has_pin: boolean;
}

export interface KycData {
  idDocumentFront?: File | Blob;
  idDocumentBack?: File | Blob;
  mrzData?: unknown;
  faceVideoLength?: number;
  livenessScore?: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

export interface KycStepInfo {
  id: string;
  label: string;
  completed: boolean;
}

// === KYC STATUS ===
// Source of truth: statuses returned by backend /kyc/review-status endpoint
// + statuses used internally by the frontend for UI gating.
// Adding a new backend status here will cause compile errors in exhaustive
// switch/mapping functions (assertNever), preventing silent fallback bugs.

/** Statuses returned by the backend /kyc/review-status endpoint */
export type BackendKycStatus =
  | 'PENDING_AGENT_REVIEW'  // primary post-submit status
  | 'PENDING_KYC'           // legacy alias
  | 'PENDING_INFO'          // agent requested more info
  | 'APPROVED'              // agent approved the dossier
  | 'REJECTED'              // agent rejected the dossier
  | 'FRAUD_SUSPECT'         // agent flagged for fraud
  | 'NO_SUBMISSION';        // no session exists (backend fallback)

/** Full union: backend + frontend-only statuses */
export type KycStatus =
  | BackendKycStatus
  | 'DRAFT'
  | 'ABANDONED'
  | 'COMPLIANCE_REVIEW'
  | 'READY_FOR_OPS'
  | 'PROVISIONING'
  | 'OPS_ERROR'
  | 'OPS_CORRECTION'
  | 'VALIDATED_PENDING_AGENCY'
  | 'ACTIVATED_LIMITED'
  | 'ACTIVATED_PRE_FULL'
  | 'ACTIVATED_FULL'
  | 'EXPIRY_WARNING'
  | 'PENDING_RESUBMIT'
  | 'MONITORED'
  | 'DISABLED'
  | 'SUBMITTED'
  | 'INFO_REQUESTED'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'MANUAL_REVIEW';

/**
 * Exhaustive check for KycStatus — throws at runtime if a value is unhandled.
 * Use in switch/mapping to guarantee compile-time coverage.
 * Example:
 *   function mapStatus(s: KycStatus): string {
 *     switch (s) {
 *       case 'PENDING_AGENT_REVIEW': return '...';
 *       // ... all cases ...
 *       default: return assertNever(s);
 *     }
 *   }
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled KycStatus: ${value}`);
}

// === LANGUAGE ===
export type Language = 'fr' | 'en';

// === AUTH TYPES (from biveripass) ===

export interface OtpSendRequest {
  phone: string;
  channel?: 'sms' | 'whatsapp';
}

export interface OtpSendResponse {
  request_id: string;
  expires_in: number;
}

export interface OtpVerifyRequest {
  phone: string;
  code: string;
  request_id: string;
}

export interface OtpVerifyResponse {
  access_token: string;
  refresh_token: string;
  user_id: string;
  is_new_user: boolean;
}

export interface PinSetupRequest {
  pin: string;
  confirm_pin: string;
}

export interface PinSetupResponse {
  success: boolean;
}

export interface PinVerifyRequest {
  pin: string;
}

export interface PinVerifyResponse {
  access_token: string;
  refresh_token: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

// === KYC STEP TYPE (from biveripass) ===

export type KycStepType =
  | 'cni_recto'
  | 'cni_verso'
  | 'ocr_review'
  | 'liveness'
  | 'utility_bill'
  | 'address'
  | 'niu'
  | 'consent'
  | 'signature'
  | 'submission';

// ADR-001: Access tiers match backend LifecycleState → AccessTier mapping
export type AccessTier =
  | 'GUEST'              // DRAFT, REJECTED, ABANDONED — no KYC access
  | 'RESTRICTED'         // SUBMITTED, PROCESSING, PENDING_AGENT_REVIEW, PENDING_INFO — dashboard vitrine only
  | 'LIMITED_ACCESS'     // APPROVED, ACCOUNT_CREATED without NIU — services restreints
  | 'FULL_ACCESS'        // ACCOUNT_CREATED with valid NIU — all services
  | 'DISABLED';          // FRAUD_SUSPECT — access blocked

/** @deprecated Use AccessTier instead for ADR-001 compliance */
export type AccessLevel = AccessTier;

export interface KycSession {
  session_id: string;
  user_id: string;
  status: KycStatus;
  current_step: KycStepType;
  access_level: AccessLevel;
  created_at: string;
  updated_at: string;
  completed_steps: KycStepType[];
}

export interface CaptureResult {
  capture_id: string;
  quality_score: number;
  image_hash: string;
  metadata: Record<string, unknown>;
}

export interface OcrField {
  field_name: string;
  value: string;
  confidence: number;
  editable: boolean;
}

export interface OcrResult {
  fields: OcrField[];
  overall_confidence: number;
}

export interface LivenessChallenge {
  challenge_type: 'smile' | 'blink' | 'turn_left' | 'turn_right';
  instruction_fr: string;
  instruction_en: string;
}

export interface LivenessResult {
  is_alive: boolean;
  confidence: number;
  attempts_remaining: number;
  face_match_score?: number;
  anti_spoofing_score?: number;
  strikes_remaining?: number;
  is_locked?: boolean;
  cooldown_seconds?: number | null;
  lockout_count_24h?: number | null;
  branch_fallback_available?: boolean;
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface LandmarkFrame {
  landmarks: LandmarkPoint[];
  timestamp: number;
}

export interface LivenessSubmitPayload {
  session_id: string;
  landmarks_json: LandmarkFrame[];
}

export interface AddressData {
  region: string;
  city: string;
  commune: string;
  quartier: string;
  lieu_dit?: string;
  gps_lat?: number;
  gps_lng?: number;
}

export interface BasicProfileData {
  firstName: string;
  lastName: string;
  birthDate: string;
  nationality: string;
}

export interface DocumentChoiceData {
  documentType: 'CNI' | 'PASSPORT' | 'DRIVER_LICENSE';
  nationality: string;
}

export interface KycSubmitResponse {
  submission_id: string;
  status: KycStatus;
  estimated_review_time: string;
}

// === NOTIFICATION TYPES ===

export type NotificationType =
  | 'DOSSIER_APPROVED'
  | 'DOSSIER_REJECTED'
  | 'INFO_REQUESTED'
  | 'KYC_APPROVED'
  | 'KYC_REJECTED'
  | 'KYC_INFO_REQUESTED'
  | 'KYC_SUBMITTED'
  | 'SUPPORT_MESSAGE'
  | 'SUPPORT_MESSAGE_SENT'
  | 'GENERAL';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata?: Record<string, unknown>;
}

// === SUPPORT TYPES ===

export interface SupportThread {
  id: string;
  subject: string;
  status: 'open' | 'closed';
  created_at: string;
  last_message_at: string;
}

export interface SupportMessage {
  id: string;
  thread_id: string;
  sender: 'user' | 'agent';
  content: string;
  attachments?: string[];
  created_at: string;
}

// === PLAN TYPES ===

export interface BankPlan {
  id: string;
  name: string;
  tier: 'standard' | 'premium' | 'ultra';
  monthly_fee: number;
  features: string[];
  recommended?: boolean;
}

// === GEO DATA (Cameroun) ===

export interface GeoRegion {
  code: string;
  name: string;
}

export interface GeoCity {
  code: string;
  name: string;
  region_code: string;
}

export interface GeoCommune {
  code: string;
  name: string;
  city_code: string;
}

export interface GeoQuartier {
  code: string;
  name: string;
  city_code: string;
  commune_name: string;
}

// === TRANSACTION TYPES ===

export type TransactionCategory =
  | 'transfer_out'
  | 'transfer_in'
  | 'mobile_recharge'
  | 'bill_payment'
  | 'purchase'
  | 'salary';

export type IsoScheme = 'SEPA' | 'XAF-RTGS' | 'MOBILE';

export interface IsoTransactionMeta {
  endToEndId: string;
  msgId: string;
  scheme: IsoScheme;
}

export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  label: string;
  amount: number;
  date: string;
  category: TransactionCategory;
  counterparty: string;
  iso?: IsoTransactionMeta;
}

// === BANKING TYPES ===

export interface BankCard {
  id: string;
  name: string;
  last4: string;
  fullNumber: string;
  type: 'virtual' | 'physical';
  brand: 'visa' | 'mastercard';
  expiry: string;
  cvv: string;
  status: 'active' | 'frozen' | 'blocked';
  frozen: boolean;
}

export interface CreditTransferInput {
  debtorName: string;
  debtorIban: string;
  debtorBic?: string;
  creditorName: string;
  creditorIban: string;
  creditorBic?: string;
  amount: number;
  currency: string;
  remittance?: string;
  scheme?: IsoScheme;
}

export interface BuiltCreditTransfer {
  msgId: string;
  endToEndId: string;
  instrId: string;
  createdAt: string;
  xml: string;
  scheme: IsoScheme;
}

export interface SavingsPocket {
  id: string;
  name: string;
  amount: number;
  goal: number;
  color: string;
  icon: string;
}

export interface Transfer {
  id: string;
  type: 'bicec' | 'mobile';
  amount: number;
  currency: string;
  creditorName: string;
  creditorIban?: string;
  creditorPhone?: string;
  motif?: string;
  status: 'pending' | 'completed' | 'failed';
  iso?: IsoTransactionMeta;
  createdAt: string;
}

export interface AccountInfo {
  user_id: string;
  iban: string;
  bic: string;
  holder_name: string;
  balance: number;
  currency: string;
  access_level: string;
}
