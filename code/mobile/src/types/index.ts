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

// === KYC STATUS (merged from both sources) ===
export type KycStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'MANUAL_REVIEW'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'INFO_REQUESTED';

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
  | 'address'
  | 'utility_bill'
  | 'niu'
  | 'consent'
  | 'submission';

export type AccessLevel = 'RESTRICTED_ACCESS' | 'LIMITED_ACCESS' | 'FULL_ACCESS';

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

export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  label: string;
  amount: number;
  date: string;
  category: TransactionCategory;
  counterparty: string;
}
