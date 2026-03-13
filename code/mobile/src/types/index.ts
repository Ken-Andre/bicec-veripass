export interface User {
  id: string;
  // Autres champs utilisateur
}

export interface KycData {
  idDocumentFront?: File | Blob;
  idDocumentBack?: File | Blob;
  mrzData?: any;
  faceVideoLength?: number;
  livenessScore?: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

export interface KycStep {
  id: string;
  label: string;
  completed: boolean;
}

export type KycStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'MANUAL_REVIEW';
