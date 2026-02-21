// ── BICEC VeriPass — Type definitions ──

export type OnboardingStep =
  | 'welcome' | 'language' | 'phone-otp' | 'email-verify'
  | 'pin-setup' | 'biometrics' | 'id-front' | 'id-back'
  | 'ocr-review' | 'liveness' | 'address' | 'address-proof'
  | 'fiscal-id' | 'consent' | 'signature' | 'review-summary'
  | 'uploading' | 'success' | 'pending-dashboard' | 'limited-access' | 'full-access';

export interface StepMeta {
  id: OnboardingStep;
  label: string;
  group: string;
  icon: string;
}

export interface OCRField {
  key: string;
  label: string;
  value: string;
  confidence: number; // 0-100
  edited: boolean;
}

export interface ApplicationData {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  nationalId: string;   // N° série CNI recto (9 chiffres)
  niuId: string;        // NIU verso CNI — 17 chiffres numériques
  dateOfBirth: string;
  address: string;
  city: string;
  region: string;       // Région Cameroun
  quartier: string;
  commune: string;
  status: 'pending' | 'approved' | 'rejected' | 'limited';
  submittedAt: string;
  ocrFields: OCRField[];
  livenessScore: number;
  idFrontUrl: string;
  idBackUrl: string;
  selfieUrl: string;
  proofUrl: string;
  signatureUrl: string;
  rejectionReason?: string;
  validatorNotes?: string;
}

export type ViewMode = 'mobile' | 'backoffice';
