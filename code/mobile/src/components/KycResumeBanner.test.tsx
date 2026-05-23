import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KycResumeBanner } from './KycResumeBanner';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockUseLocation = vi.hoisted(() => vi.fn());
const mockRunKycSyncNow = vi.hoisted(() => vi.fn());
const mockGetKycSyncSummary = vi.hoisted(() => vi.fn());
const mockGetResumeTargetPath = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
}));

vi.mock('../services/kycSyncService', () => ({
  runKycSyncNow: mockRunKycSyncNow,
  getKycSyncSummary: mockGetKycSyncSummary,
  getResumeTargetPath: mockGetResumeTargetPath,
}));

describe('KycResumeBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue({ pathname: '/auth/lock' });
    mockRunKycSyncNow.mockResolvedValue(undefined);
    mockGetKycSyncSummary.mockResolvedValue({
      pendingCount: 0,
      needsReuploadCount: 0,
      failedCount: 0,
      hasResumeData: true,
    });
    mockGetResumeTargetPath.mockResolvedValue('/kyc/ocr-review');
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('does not render or replay KYC sync work on auth routes', async () => {
    render(<KycResumeBanner />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText(/Reprise d'activit/i)).not.toBeInTheDocument();
    expect(mockRunKycSyncNow).not.toHaveBeenCalled();
  });
});
