/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for BillCaptureScreen.
 *
 * Tests the offline enqueue pattern for bill capture:
 * - Camera initialization (mocked)
 * - Upload attempt when online
 * - Offline enqueue when navigator is offline
 * - Both ENEO and CAMWATER bill types
 *
 * NOTE: BillCaptureScreen uses the camera API heavily. We mock
 * navigator.mediaDevices.getUserMedia to avoid real camera access.
 *
 * NOTE: jsdom does not implement HTMLMediaElement.play() — it returns
 * undefined instead of a Promise. We stub it to return Promise.resolve().
 * Similarly, video.onloadedmetadata must be triggered manually.
 *
 * NOTE: vi.mock factories are hoisted ABOVE const/let declarations,
 * so we use inline vi.fn() in the factory and retrieve references
 * via vi.mocked() after the module import.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { render, act } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('../../services/kycSyncService', () => ({
  enqueueOfflineBill: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/apiClient', () => ({
  fetchWithCorrelation: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
  apiClient: {},
}));

vi.mock('../../services/sentry', () => ({
  captureKycException: vi.fn(),
}));

vi.mock('../../contexts/KycContext', () => ({
  useKyc: vi.fn().mockReturnValue({
    sessionId: 'sess-1',
    setSessionId: vi.fn(),
    setBillCapture: vi.fn(),
    completeStep: vi.fn(),
  }),
  KycProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: vi.fn().mockReturnValue({ t: (key: string) => key }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { enqueueOfflineBill } from '../../services/kycSyncService';
import { fetchWithCorrelation } from '../../services/apiClient';
import { useKyc } from '../../contexts/KycContext';
import BillCaptureScreen from './BillCaptureScreen';

const mockEnqueue = vi.mocked(enqueueOfflineBill);
const mockFetch = vi.mocked(fetchWithCorrelation);
const mockUseKyc = vi.mocked(useKyc);

// ── Helpers ──────────────────────────────────────────────────────────────

const mockGetUserMedia = vi.fn();

function mockApiSuccess() {
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'success' }) } as unknown as Response);
}

function mockApiFailure() {
  mockFetch.mockRejectedValue(new Error('Network error'));
}

function setupCameraMocks() {
  const mockStream = {
    getTracks: () => [{ stop: vi.fn() }],
    getVideoTracks: () => [{ stop: vi.fn() }],
  };
  mockGetUserMedia.mockResolvedValue(mockStream);

  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true,
    });
  } else {
    navigator.mediaDevices.getUserMedia = mockGetUserMedia;
  }

  // Stub HTMLMediaElement.play() — jsdom returns undefined, not a Promise
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined) as any;

  // Mock canvas methods for capture flow
  HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation((callback: any) => {
    callback(new Blob(['fake-image'], { type: 'image/jpeg' }));
  });
  HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,fakebilldata==');

  // Mock getContext('2d') for canvas drawing (jsdom doesn't implement it)
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    drawImage: vi.fn(),
  }) as any;
}

function renderBillScreen(billType: 'ENEO' | 'CAMWATER' = 'ENEO') {
  return render(
    <MemoryRouter>
      <BillCaptureScreen billType={billType} />
    </MemoryRouter>,
  );
}

/** Trigger camera readiness by firing the video's loadedmetadata event.
 *
 * The component sets cameraReady=true via two paths:
 *  1. video.onloadedmetadata → setCameraReady(true)  (primary)
 *  2. setTimeout(() => setCameraReady(true), 2000)      (fallback)
 *
 * We trigger path 1 directly. Path 2's setTimeout was created with real
 * timers during render, so vi.useFakeTimers()+advance won't catch it.
 * The loadedmetadata event is sufficient for all test scenarios.
 */
async function makeCameraReady() {
  const video = document.querySelector('video') as HTMLVideoElement | null;
  if (video) {
    act(() => {
      fireEvent.loadedMetadata(video);
    });
  }
}

let originalOnLine: boolean;
let originalGetUserMedia: any;
let originalPlay: any;
let originalGetContext: any;
let originalToBlob: any;
let originalToDataURL: any;

beforeEach(() => {
  vi.clearAllMocks();
  originalOnLine = navigator.onLine;
  originalGetUserMedia = navigator.mediaDevices?.getUserMedia;
  originalPlay = HTMLMediaElement.prototype.play;
  originalGetContext = HTMLCanvasElement.prototype.getContext;
  originalToBlob = HTMLCanvasElement.prototype.toBlob;
  originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

  setupCameraMocks();
  mockApiSuccess();
  mockUseKyc.mockReturnValue({
    sessionId: 'sess-1',
    setSessionId: vi.fn(),
    setBillCapture: vi.fn(),
    completeStep: vi.fn(),
  } as any);
});

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
  if (originalGetUserMedia && navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = originalGetUserMedia;
  }
  HTMLMediaElement.prototype.play = originalPlay;
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toBlob = originalToBlob;
  HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('BillCaptureScreen integration', () => {
  it('renders with ENEO bill type label', () => {
    renderBillScreen('ENEO');
    // The component shows billLabel = 'ENEO (electricité)' in the overlay AND
    // the bottom text, so there are multiple elements. Use getAllByText.
    expect(screen.getAllByText(/ENEO/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders with CAMWATER bill type label', () => {
    renderBillScreen('CAMWATER');
    expect(screen.getAllByText(/CAMWATER/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows camera error when getUserMedia fails', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

    renderBillScreen('ENEO');

    await waitFor(() => {
      // The error path renders: t('capture.camera.error') + ' - ' + error.message
      // With our mock t(key)=>key, that becomes: 'capture.camera.error - Permission denied'
      expect(screen.getByText(/capture\.camera\.error/i)).toBeInTheDocument();
    });
  });

  it('shows capture button after camera is ready', async () => {
    renderBillScreen('ENEO');

    // Wait for the video element to appear
    await waitFor(() => {
      expect(document.querySelector('video')).toBeInTheDocument();
    });

    await makeCameraReady();

    // The capture button should now be visible
    await waitFor(() => {
      expect(screen.getByText(/Capturer la facture/i)).toBeInTheDocument();
    });
  });

  it('enqueues bill offline when navigator is offline after capture', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    renderBillScreen('ENEO');

    await waitFor(() => {
      expect(document.querySelector('video')).toBeInTheDocument();
    });

    await makeCameraReady();

    await waitFor(() => {
      expect(screen.getByText(/Capturer la facture/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Capturer la facture/i));
    await waitFor(() => expect(screen.getByText('Confirmer')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Confirmer'));

    await waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          billType: 'ENEO',
          fileDataUrl: expect.stringMatching(/^data:image\/jpeg;base64,/),
        }),
      );
    });
    // Verify step is marked complete after offline enqueue
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('utility_bill');
  });

  it('enqueues bill offline when online but API call fails', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockApiFailure();

    renderBillScreen('CAMWATER');

    await waitFor(() => {
      expect(document.querySelector('video')).toBeInTheDocument();
    });

    await makeCameraReady();

    await waitFor(() => {
      expect(screen.getByText(/Capturer la facture/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Capturer la facture/i));
    await waitFor(() => expect(screen.getByText('Confirmer')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Confirmer'));

    await waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          billType: 'CAMWATER',
        }),
      );
    });
    // Verify step is marked complete after offline enqueue on API failure
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('utility_bill');
  });

  it('calls API when online and upload succeeds', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    renderBillScreen('ENEO');

    await waitFor(() => {
      expect(document.querySelector('video')).toBeInTheDocument();
    });

    await makeCameraReady();

    await waitFor(() => {
      expect(screen.getByText(/Capturer la facture/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Capturer la facture/i));
    await waitFor(() => expect(screen.getByText('Confirmer')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Confirmer'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/kyc/capture/bill',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    // Should NOT enqueue since API succeeded
    expect(mockEnqueue).not.toHaveBeenCalled();
    // Verify step is marked complete after successful API call
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('utility_bill');
  });
});
