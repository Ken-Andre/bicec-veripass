/**
 * Integration tests for SignatureScreen.
 *
 * Tests the offline enqueue pattern:
 * - Canvas rendering and signature validation
 * - Submit disabled until signature drawn
 * - Online API success vs offline enqueue
 * - Clear canvas resets state
 *
 * NOTE: jsdom does not implement CanvasRenderingContext2D, so we mock
 * canvas.getContext('2d') to return a stub. The component's drawing
 * handlers call getCtx() which requires getContext('2d') to work.
 * We also directly set hasDrawn state by calling the component's
 * startDrawing+draw+stopDrawing chain, which relies on the ctx mock.
 *
 * NOTE: vi.mock factories are hoisted ABOVE const/let declarations,
 * so we use inline vi.fn() in the factory and retrieve references
 * via vi.mocked() after the module import.
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

vi.mock('../../contexts/KycContext', () => ({
  useKyc: vi.fn().mockReturnValue({
    sessionId: 'sess-1',
    setSessionId: vi.fn(),
    setSignature: vi.fn(),
    completeStep: vi.fn(),
  }),
  KycProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: vi.fn().mockReturnValue({ t: (key: string) => key }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../components/ScreenLayout', () => ({
  ScreenLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { enqueueOfflineSignature } from '../../services/kycSyncService';
import { fetchWithCorrelation } from '../../services/apiClient';
import { useKyc } from '../../contexts/KycContext';
import SignatureScreen from './SignatureScreen';

const mockEnqueue = vi.mocked(enqueueOfflineSignature);
const mockFetch = vi.mocked(fetchWithCorrelation);
const mockUseKyc = vi.mocked(useKyc);

// ── Canvas context mock ──────────────────────────────────────────────────
// jsdom does not implement CanvasRenderingContext2D. We stub it so
// the component's getCtx() returns a working mock, and drawing events
// actually invoke ctx.beginPath/lineTo/stroke, triggering setHasDrawn.

const ctxMock = {
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  closePath: vi.fn(),
  clearRect: vi.fn(),
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'butt' as CanvasLineCap,
  lineJoin: 'miter' as CanvasLineJoin,
};

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
let originalOnLine: boolean;

beforeEach(() => {
  vi.clearAllMocks();
  originalOnLine = navigator.onLine;

  // Stub getContext to return our mock 2d context
  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId: string) => {
    if (contextId === '2d') return ctxMock;
    return null;
  }) as any;

  // Mock canvas.toDataURL for signature extraction
  HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,sigtest==');

  mockUseKyc.mockReturnValue({
    sessionId: 'sess-1',
    setSessionId: vi.fn(),
    setSignature: vi.fn(),
    completeStep: vi.fn(),
  } as any);
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
  Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
});

// ── Helpers ──────────────────────────────────────────────────────────────

function mockApiSuccess() {
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'success' }) });
}

function mockApiFailure() {
  mockFetch.mockRejectedValue(new Error('Network error'));
}

/** Simulate drawing on the canvas by dispatching mouse events */
function drawOnCanvas() {
  const canvas = document.querySelector('canvas');
  if (!canvas) throw new Error('Canvas not found');

  // The component's startDrawing calls ctx.beginPath + ctx.moveTo + setIsDrawing(true)
  fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
  // The component's draw calls ctx.lineTo + ctx.stroke + setHasDrawn(true)
  fireEvent.mouseMove(canvas, { clientX: 150, clientY: 120 });
  // The component's stopDrawing calls ctx.closePath + setIsDrawing(false)
  fireEvent.mouseUp(canvas);
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
  it('renders the signature canvas and placeholder text', () => {
    renderSignatureScreen();

    expect(screen.getByText('Signez ici')).toBeInTheDocument();
    expect(document.querySelector('canvas')).toBeInTheDocument();
  });

  it('submit button is disabled until signature is drawn', () => {
    renderSignatureScreen();

    const submitBtn = screen.getByText('common.continue');
    expect(submitBtn).toBeDisabled();
  });

  it('enables submit after drawing on canvas', () => {
    renderSignatureScreen();

    drawOnCanvas();

    const submitBtn = screen.getByText('common.continue');
    expect(submitBtn).not.toBeDisabled();
  });

  it('clears the canvas when Effacer is clicked', () => {
    renderSignatureScreen();

    drawOnCanvas();
    expect(screen.getByText('common.continue')).not.toBeDisabled();

    // Click clear button (hardcoded French text in the component)
    fireEvent.click(screen.getByText('Effacer'));

    // Submit should be disabled again after clearing
    const submitBtn = screen.getByText('common.continue');
    expect(submitBtn).toBeDisabled();
  });

  it('enqueues signature offline when navigator is offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    renderSignatureScreen();

    drawOnCanvas();
    fireEvent.click(screen.getByText('common.continue'));

    await waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          signatureData: 'data:image/png;base64,sigtest==',
        }),
      );
    });
    // Verify step is marked complete after offline enqueue
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('signature');
  });

  it('enqueues signature offline when online but API fails', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockApiFailure();

    renderSignatureScreen();

    drawOnCanvas();
    fireEvent.click(screen.getByText('common.continue'));

    await waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          signatureData: 'data:image/png;base64,sigtest==',
        }),
      );
    });
    // Verify step is marked complete after offline enqueue on API failure
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('signature');
  });

  it('calls API when online and API succeeds', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockApiSuccess();

    renderSignatureScreen();

    drawOnCanvas();
    fireEvent.click(screen.getByText('common.continue'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/kyc/signature/submit',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    // Should NOT enqueue since API succeeded
    expect(mockEnqueue).not.toHaveBeenCalled();
    // Verify step is marked complete after successful API call
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('signature');
  });
});
