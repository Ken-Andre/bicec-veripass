/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for SignatureScreen (paper signature capture).
 *
 * Tests the camera/file-upload flow:
 * - Instructions state rendering
 * - File picker triggers review state
 * - Online API success vs offline enqueue
 * - Confirm triggers upload + signature submit
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('../../services/kycSyncService', () => ({
  enqueueOfflineSignature: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/apiClient', () => ({
  fetchWithCorrelation: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
  apiClient: {},
}));

vi.mock('../../services/sentry', () => ({
  captureKycException: vi.fn(),
}));

vi.mock('../../utils/imageCompression', () => ({
  compressForUpload: vi.fn().mockImplementation(async (blob: Blob) => blob),
}));

vi.mock('../../contexts/KycContext', () => ({
  useKyc: vi.fn().mockReturnValue({
    sessionId: 'sess-1',
    setSessionId: vi.fn(),
    completeStep: vi.fn(),
  }),
  KycProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: vi.fn().mockReturnValue({ t: (key: string) => key }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { enqueueOfflineSignature } from '../../services/kycSyncService';
import { fetchWithCorrelation } from '../../services/apiClient';
import { useKyc } from '../../contexts/KycContext';
import SignatureScreen from './SignatureScreen';

const mockEnqueue = vi.mocked(enqueueOfflineSignature);
const mockFetch = vi.mocked(fetchWithCorrelation);
const mockUseKyc = vi.mocked(useKyc);

let originalOnLine: boolean;

beforeEach(() => {
  vi.clearAllMocks();
  originalOnLine = navigator.onLine;

  mockUseKyc.mockReturnValue({
    sessionId: 'sess-1',
    setSessionId: vi.fn(),
    completeStep: vi.fn(),
  } as any);
});

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
});

// ── Helpers ──────────────────────────────────────────────────────────────

function mockApiSuccess() {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ id: 'mock_doc_handle', status: 'success' }),
  } as unknown as Response);
}

function mockApiFailure() {
  mockFetch.mockRejectedValue(new Error('Network error'));
}

function renderSignatureScreen() {
  return render(
    <MemoryRouter>
      <SignatureScreen />
    </MemoryRouter>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('SignatureScreen integration', () => {
  it('renders instructions state with camera and file picker buttons', () => {
    renderSignatureScreen();

    expect(screen.getAllByText('signature.title').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('signature.instruction')).toBeInTheDocument();
    expect(screen.getByText('signature.capture')).toBeInTheDocument();
    expect(screen.getByText('signature.choose_file')).toBeInTheDocument();
  });

  it('renders a hidden file input accepting jpg/jpeg/png', () => {
    renderSignatureScreen();

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('accept', '.jpg,.jpeg,.png');
  });

  it('enqueues signature offline when navigator is offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    renderSignatureScreen();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'sig.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByAltText(/Feuille de signature/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('signature.confirm'));

    await waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
        }),
      );
    });
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('signature');
  });

  it('calls API when online and API succeeds', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockApiSuccess();

    renderSignatureScreen();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'sig.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByAltText(/Feuille de signature/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('signature.confirm'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/kyc/document/upload',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('signature');
  });

  it('enqueues offline when online but API fails', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockApiFailure();

    renderSignatureScreen();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'sig.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByAltText(/Feuille de signature/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('signature.confirm'));

    await waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
        }),
      );
    });
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('signature');
  });
});
