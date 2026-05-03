import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CniCaptureScreen from '../../views/kyc/CniCaptureScreen';

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
});

vi.mock('../../contexts/KycContext', () => ({
  useKyc: () => ({
    setCniCapture: vi.fn(),
    completeStep: vi.fn(),
    sessionId: 'test-session',
    setSessionId: vi.fn(),
  }),
}));

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../services/sentry', () => ({
  captureKycException: vi.fn(),
  captureKycMessage: vi.fn(),
}));

vi.mock('../../services/kycSyncService', () => ({
  enqueueOfflineCniCapture: vi.fn().mockResolvedValue(undefined),
  runKycSyncNow: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/apiClient', () => ({
  fetchWithCorrelation: vi.fn().mockResolvedValue({ ok: true }),
}));

describe('CniCaptureScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading overlay while camera initializes', async () => {
    // Never resolve getUserMedia to keep loading state
    mockGetUserMedia.mockImplementation(() => new Promise(() => {}));

    render(
      <MemoryRouter>
        <CniCaptureScreen side="recto" nextRoute="/next" />
      </MemoryRouter>
    );

    expect(screen.getByText('capture.initializing')).toBeInTheDocument();
  });

  it('shows error state when camera permission is denied', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

    render(
      <MemoryRouter>
        <CniCaptureScreen side="recto" nextRoute="/next" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/capture.camera.error/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /common.retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /common.back/i })).toBeInTheDocument();
  });

  it('shows camera viewport when stream is ready', async () => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    mockGetUserMedia.mockResolvedValue(mockStream);

    render(
      <MemoryRouter>
        <CniCaptureScreen side="recto" nextRoute="/next" />
      </MemoryRouter>
    );

    // The video element should be present
    expect(document.querySelector('video')).toBeInTheDocument();
  });
});
