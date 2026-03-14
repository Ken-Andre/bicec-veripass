export type Role = 'JEAN' | 'THOMAS' | 'SYLVIE' | 'ADMIN_IT'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  agencyId?: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface Dossier {
  id: string
  sessionId: string
  clientName: string
  clientPhone: string
  status: 'PENDING_KYC' | 'PENDING_INFO' | 'COMPLIANCE_REVIEW' | 'READY_FOR_OPS' | 'REJECTED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  assignedAgent?: string
  submittedAt: string
  documents: Document[]
}

export interface Document {
  id: string
  type: 'CNI_RECTO' | 'CNI_VERSO' | 'BILL_ENEO' | 'SELFIE'
  filePath: string
  ocrFields: OCRField[]
  confidence: number
}

export interface OCRField {
  name: string
  value: string
  confidence: number
  humanCorrected: boolean
}

export interface AMLAlert {
  id: string
  sessionId: string
  pepSanctionsId: string
  matchScore: number
  status: 'OPEN' | 'CLEARED' | 'CONFIRMED'
  fullName: string
  dateOfBirth?: string
  source: string
}

export interface Agent {
  id: string
  name: string
  email: string
  role: Role
  agencyId: string
  isAvailable: boolean
  activeDossierCount: number
  staticWeight: number
}