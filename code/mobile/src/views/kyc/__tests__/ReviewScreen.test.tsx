import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReviewScreen from '../ReviewScreen';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockCompleteStep = vi.hoisted(() => vi.fn());
const mockSetEditStep = vi.hoisted(() => vi.fn());
const mockSetStatus = vi.hoisted(() => vi.fn());
const mockSetAccessLevel = vi.hoisted(() => vi.fn());
const mockFetchWithCorrelation = vi.hoisted(() => vi.fn());
const mockRunKycSyncNow = vi.hoisted(() => vi.fn());
const mockGetSubmissionBlockerStatus = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../contexts/KycContext', () => ({
  useKyc: () => ({
    address: null,
    signatureData: null,
    billCapture: null,
    completeStep: mockCompleteStep,
    setEditStep: mockSetEditStep,
    setStatus: mockSetStatus,
    setAccessLevel: mockSetAccessLevel,
  }),
}));

vi.mock('../../../services/kycSyncService', () => ({
  runKycSyncNow: mockRunKycSyncNow,
  getSubmissionBlockerStatus: mockGetSubmissionBlockerStatus,
}));

vi.mock('../../../services/apiClient', () => ({
  fetchWithCorrelation: mockFetchWithCorrelation,
}));

describe('ReviewScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunKycSyncNow.mockResolvedValue(undefined);
    mockGetSubmissionBlockerStatus.mockResolvedValue({ canSubmit: true, blockingReason: null });
    mockFetchWithCorrelation
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: 'DRAFT',
          documents: [],
          consent_record: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          can_submit: true,
          blocking_reasons: [],
          warnings: [],
          has_ocr_review: true,
          has_ocr_review_confirmed: true,
          has_consent: true,
          has_biometric_result: true,
          has_bill_document: true,
          required_missing_documents: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          session_id: 'sess-1',
          status: 'PENDING_AGENT_REVIEW',
          access_level: 'RESTRICTED',
          message: 'ok',
        }),
      });
  });

  it('applies backend status and access level immediately after submit', async () => {
    render(
      <MemoryRouter>
        <ReviewScreen />
      </MemoryRouter>,
    );

    // Wait for the elements to be loaded
    const submitButton = await screen.findByRole('button', { name: /review\.submit/i });

    // Click the final confirmations to enable the submit button
    fireEvent.click(screen.getByText("Les informations du dossier sont exactes"));
    fireEvent.click(screen.getByText("J'autorise le partage avec BICEC"));
    fireEvent.click(screen.getByText("J'accepte les CGU et la politique de confidentialite"));

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSetStatus).toHaveBeenCalledWith('PENDING_AGENT_REVIEW');
    });
    expect(mockSetAccessLevel).toHaveBeenCalledWith('RESTRICTED');
    expect(mockCompleteStep).toHaveBeenCalledWith('submission');
    expect(mockNavigate).toHaveBeenCalledWith('/kyc/submit-success');
  });
});
