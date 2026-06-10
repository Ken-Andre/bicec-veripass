import { apiClient } from './apiClient';

export type LegalDocumentKey = 'cgu' | 'privacy' | 'data_processing' | 'biometric';

export interface LegalDocument {
  id: string;
  document_key: LegalDocumentKey;
  locale: string;
  version: string;
  title: string;
  content: string;
  content_format: string;
  content_hash: string;
  status: string;
  effective_at?: string | null;
  published_at?: string | null;
}

export interface AcceptedLegalDocument {
  document_key: LegalDocumentKey;
  document_id: string;
  locale: string;
  version: string;
  content_hash: string;
  accepted_at: string;
}

export async function fetchLegalDocuments(locale: string): Promise<LegalDocument[]> {
  return apiClient.get<LegalDocument[]>(`/legal/documents?locale=${encodeURIComponent(locale)}`);
}

export function toAcceptedLegalDocument(document: LegalDocument): AcceptedLegalDocument {
  return {
    document_key: document.document_key,
    document_id: document.id,
    locale: document.locale,
    version: document.version,
    content_hash: document.content_hash,
    accepted_at: new Date().toISOString(),
  };
}
