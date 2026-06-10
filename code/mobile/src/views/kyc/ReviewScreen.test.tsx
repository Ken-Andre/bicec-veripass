import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ReviewScreen from './ReviewScreen';
import { fetchWithCorrelation } from '../../services/apiClient';
import { getSubmissionBlockerStatus, runKycSyncNow } from '../../services/kycSyncService';

vi.mock('../../services/apiClient', () => ({
  fetchWithCorrelation: vi.fn(),
}));

vi.mock('../../services/kycSyncService', () => ({
  getSubmissionBlockerStatus: vi.fn(),
  runKycSyncNow: vi.fn(),
}));

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('../../contexts/KycContext', () => ({
  useKyc: () => ({
    address: { quartier: 'Melen', city: 'Yaounde', gps_lat: 3.86 },
    billCapture: { type: 'ENEO' },
    completeStep: vi.fn(),
    setAccessLevel: vi.fn(),
    setEditStep: vi.fn(),
    setStatus: vi.fn(),
    signatureData: 'data:image/png;base64,signature',
  }),
}));

const mockFetch = vi.mocked(fetchWithCorrelation);
const mockRunKycSyncNow = vi.mocked(runKycSyncNow);
const mockGetSubmissionBlockerStatus = vi.mocked(getSubmissionBlockerStatus);

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

function renderReviewScreen() {
  return render(
    <MemoryRouter>
      <ReviewScreen />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRunKycSyncNow.mockResolvedValue(undefined);
  mockGetSubmissionBlockerStatus.mockResolvedValue({ canSubmit: true });
  mockFetch.mockImplementation(async (url) => {
    if (url === '/api/v1/kyc/session/current') {
      return jsonResponse({
        documents: [
          { doc_type: 'CNI_RECTO' },
          { doc_type: 'CNI_VERSO' },
          { doc_type: 'SELFIE' },
          { doc_type: 'BILL_ENEO' },
          { doc_type: 'NIU' },
        ],
        consent_record: { cgu_accepted: true },
        status: 'DRAFT',
      });
    }
    if (url === '/api/v1/kyc/readiness') {
      return jsonResponse({
        blocking_reasons: [],
        can_submit: true,
        has_bill_document: true,
        has_biometric_result: true,
        has_consent: true,
        has_ocr_review: true,
        has_ocr_review_confirmed: true,
        required_missing_documents: [],
        warnings: [],
      });
    }
    if (url === '/api/v1/kyc/submit') {
      return jsonResponse({
        access_level: 'LIMITED_ACCESS',
        message: 'submitted',
        session_id: 'sess-1',
        status: 'PENDING_AGENT_REVIEW',
      });
    }
    return jsonResponse({});
  });
});

describe('ReviewScreen final consent gates', () => {
  it('requires final accuracy, BICEC sharing and terms confirmations before submission', async () => {
    const user = userEvent.setup();
    renderReviewScreen();

    const submitButton = await screen.findByRole('button', { name: /review.submit/i });

    expect(screen.getByText('Attestations finales')).toBeInTheDocument();
    expect(screen.getByText('Cochez les attestations finales pour activer la soumission.')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Les informations du dossier sont exactes/i }));
    await user.click(screen.getByRole('button', { name: /J'autorise le partage avec BICEC/i }));
    await user.click(screen.getByRole('button', { name: /J'accepte les CGU/i }));

    expect(submitButton).not.toBeDisabled();

    await user.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/kyc/submit', { method: 'POST' });
    });
  });
});
