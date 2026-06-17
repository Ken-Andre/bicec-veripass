/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for NiuScreen.
 *
 * Tests the offline enqueue pattern:
 * - DECLARATIVE mode with manual NIU input
 * - MISSING mode (skip NIU)
 * - Online API success vs offline enqueue
 *
 * NOTE: vi.mock factories are hoisted ABOVE const/let declarations,
 * so we use inline vi.fn() in the factory and retrieve references
 * via vi.mocked() after the module import.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('../../services/kycSyncService', () => ({
  enqueueOfflineNiu: vi.fn().mockResolvedValue(undefined),
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
    completeStep: vi.fn(),
  }),
  KycProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: vi.fn().mockReturnValue({ t: (key: string) => key }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { enqueueOfflineNiu } from '../../services/kycSyncService';
import { fetchWithCorrelation } from '../../services/apiClient';
import { useKyc } from '../../contexts/KycContext';
import NiuScreen from './NiuScreen';

const mockEnqueue = vi.mocked(enqueueOfflineNiu);
const mockFetch = vi.mocked(fetchWithCorrelation);
const mockUseKyc = vi.mocked(useKyc);

// ── Helpers ──────────────────────────────────────────────────────────────

function mockApiSuccess() {
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'success' }) } as unknown as Response);
}

function mockApiFailure() {
  mockFetch.mockRejectedValue(new Error('Network error'));
}

function renderNiuScreen() {
  return render(
    <MemoryRouter>
      <NiuScreen />
    </MemoryRouter>,
  );
}

let originalOnLine: boolean;

beforeEach(() => {
  vi.clearAllMocks();
  originalOnLine = navigator.onLine;
  mockApiSuccess();
  mockUseKyc.mockReturnValue({
    sessionId: 'sess-1',
    setSessionId: vi.fn(),
    completeStep: vi.fn(),
  } as any);
});

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('NiuScreen integration', () => {
  it('renders the three NIU options on mount', () => {
    renderNiuScreen();

    // The three buttons: upload, manual (Saisir), skip (Passer)
    expect(screen.getByText('niu.upload')).toBeInTheDocument();
    expect(screen.getByText('niu.manual')).toBeInTheDocument();
    expect(screen.getByText('niu.skip')).toBeInTheDocument();
  });

  it('switches to manual input mode when manual button is clicked', async () => {
    const user = userEvent.setup();
    renderNiuScreen();

    await user.click(screen.getByText('niu.manual'));

    expect(screen.getByPlaceholderText('M012345678901A')).toBeInTheDocument();
  });

  it('enqueues NIU offline when navigator is offline and MISSING is selected', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    renderNiuScreen();

    // Click the skip button (Passer)
    fireEvent.click(screen.getByText('niu.skip'));

    await waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          niuType: 'MISSING',
          niuValue: null,
        }),
      );
    });
    // Verify step is marked complete after offline enqueue
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('niu');
  });

  it('calls API when online and MISSING is selected', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    renderNiuScreen();

    fireEvent.click(screen.getByText('niu.skip'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/kyc/niu/submit',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(mockEnqueue).not.toHaveBeenCalled();
    // Verify step is marked complete after successful API call
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('niu');
  });

  it('enqueues offline when online but API fails for DECLARATIVE NIU', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockApiFailure();
    const user = userEvent.setup();

    renderNiuScreen();

    // Switch to manual mode
    await user.click(screen.getByText('niu.manual'));

    const input = screen.getByPlaceholderText('M012345678901A');
    await user.type(input, 'm012345678901a');

    // Submit (the button shows common.continue key)
    fireEvent.click(screen.getByText('common.continue'));

    await waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          niuType: 'DECLARATIVE',
          niuValue: 'M012345678901A',
        }),
      );
    });
    // Verify step is marked complete after offline enqueue on API failure
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('niu');
  });

  it('normalizes manual NIU input to 14 uppercase alphanumeric characters', async () => {
    const user = userEvent.setup();
    renderNiuScreen();

    await user.click(screen.getByText('niu.manual'));
    const input = screen.getByPlaceholderText('M012345678901A');
    await user.type(input, 'm012-345 678 901a-extra');

    expect(input).toHaveValue('M012345678901A');
  });

  it('keeps continue disabled until the NIU has exactly 14 alphanumeric characters', async () => {
    const user = userEvent.setup();
    renderNiuScreen();

    await user.click(screen.getByText('niu.manual'));
    const input = screen.getByPlaceholderText('M012345678901A');
    const continueButton = screen.getByText('common.continue');

    expect(continueButton).toBeDisabled();
    await user.type(input, 'M012345678901');
    expect(continueButton).toBeDisabled();
    await user.type(input, 'A');
    expect(continueButton).not.toBeDisabled();
  });

  it('generates offline session ID when sessionId is null', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    mockUseKyc.mockReturnValue({
      sessionId: null,
      setSessionId: vi.fn(),
      completeStep: vi.fn(),
    } as any);

    renderNiuScreen();

    fireEvent.click(screen.getByText('niu.skip'));

    await waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: expect.stringContaining('offline-'),
        }),
      );
    });
  });
});
