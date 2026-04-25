/**
 * Integration tests for ConsentScreen.
 *
 * Tests the offline enqueue pattern:
 * - Checkbox toggling (CGU, privacy, data processing)
 * - Submit disabled until all checkboxes accepted
 * - Online API success vs offline enqueue
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
  enqueueOfflineConsent: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../../components/ScreenLayout', () => ({
  ScreenLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { enqueueOfflineConsent } from '../../services/kycSyncService';
import { fetchWithCorrelation } from '../../services/apiClient';
import { useKyc } from '../../contexts/KycContext';
import ConsentScreen from './ConsentScreen';

const mockEnqueue = vi.mocked(enqueueOfflineConsent);
const mockFetch = vi.mocked(fetchWithCorrelation);
const mockUseKyc = vi.mocked(useKyc);

// ── Helpers ──────────────────────────────────────────────────────────────

function mockApiSuccess() {
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'success' }) });
}

function mockApiFailure() {
  mockFetch.mockRejectedValue(new Error('Network error'));
}

function renderConsentScreen() {
  return render(
    <MemoryRouter>
      <ConsentScreen />
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

describe('ConsentScreen integration', () => {
  it('renders three consent buttons with translation keys', () => {
    renderConsentScreen();

    // The component renders buttons with t('consent.cgu'), t('consent.privacy'), t('consent.data')
    expect(screen.getByText('consent.cgu')).toBeInTheDocument();
    expect(screen.getByText('consent.privacy')).toBeInTheDocument();
    expect(screen.getByText('consent.data')).toBeInTheDocument();
  });

  it('submit button is disabled until all consents are accepted', () => {
    renderConsentScreen();

    const submitBtn = screen.getByText('consent.submit');
    expect(submitBtn).toBeDisabled();
  });

  it('enables submit after all three checkboxes are clicked', () => {
    renderConsentScreen();

    // Each consent row has an outer <button> with a nested <Checkbox> button.
    // Both call toggle(). We use fireEvent.click on the outer button directly
    // (not user.click which can trigger both handlers due to event bubbling).
    const cguBtn = screen.getByText('consent.cgu').closest('button')!;
    const privacyBtn = screen.getByText('consent.privacy').closest('button')!;
    const dataBtn = screen.getByText('consent.data').closest('button')!;

    fireEvent.click(cguBtn);
    fireEvent.click(privacyBtn);
    fireEvent.click(dataBtn);

    const submitBtn = screen.getByText('consent.submit');
    expect(submitBtn).not.toBeDisabled();
  });

  it('calls API when online and all consents accepted', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    renderConsentScreen();

    // Click checkboxes via outer buttons (fireEvent to avoid double-toggle)
    const cguBtn = screen.getByText('consent.cgu').closest('button')!;
    const privacyBtn = screen.getByText('consent.privacy').closest('button')!;
    const dataBtn = screen.getByText('consent.data').closest('button')!;

    fireEvent.click(cguBtn);
    fireEvent.click(privacyBtn);
    fireEvent.click(dataBtn);

    // Submit
    fireEvent.click(screen.getByText('consent.submit'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/kyc/consent/submit',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    // Should NOT enqueue since API succeeded
    expect(mockEnqueue).not.toHaveBeenCalled();
    // Verify step is marked complete after successful API call
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('consent');
  });

  it('enqueues consent offline when navigator is offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    renderConsentScreen();

    const cguBtn = screen.getByText('consent.cgu').closest('button')!;
    const privacyBtn = screen.getByText('consent.privacy').closest('button')!;
    const dataBtn = screen.getByText('consent.data').closest('button')!;

    fireEvent.click(cguBtn);
    fireEvent.click(privacyBtn);
    fireEvent.click(dataBtn);

    fireEvent.click(screen.getByText('consent.submit'));

    await waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          cguAccepted: true,
          privacyAccepted: true,
          dataProcessingAccepted: true,
        }),
      );
    });
    // Verify step is marked complete after offline enqueue
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('consent');
  });

  it('enqueues consent offline when online but API fails', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockApiFailure();

    renderConsentScreen();

    const cguBtn = screen.getByText('consent.cgu').closest('button')!;
    const privacyBtn = screen.getByText('consent.privacy').closest('button')!;
    const dataBtn = screen.getByText('consent.data').closest('button')!;

    fireEvent.click(cguBtn);
    fireEvent.click(privacyBtn);
    fireEvent.click(dataBtn);

    fireEvent.click(screen.getByText('consent.submit'));

    await waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          cguAccepted: true,
          privacyAccepted: true,
          dataProcessingAccepted: true,
        }),
      );
    });
    // Verify step is marked complete after offline enqueue on API failure
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('consent');
  });
});
