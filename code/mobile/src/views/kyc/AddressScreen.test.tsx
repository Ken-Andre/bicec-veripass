/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for AddressScreen.
 *
 * Tests the offline enqueue pattern:
 * - Renders region/city/quartier cascading dropdowns from API
 * - Submits address via API when online and API succeeds
 * - Enqueues offline when navigator is offline
 * - Enqueues offline when online but API call fails
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
  enqueueOfflineAddress: vi.fn().mockResolvedValue(undefined),
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
    setAddress: vi.fn(),
    completeStep: vi.fn(),
  }),
  KycProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: vi.fn().mockReturnValue({ t: (key: string) => key }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { enqueueOfflineAddress } from '../../services/kycSyncService';
import { fetchWithCorrelation } from '../../services/apiClient';
import { useKyc } from '../../contexts/KycContext';
import AddressScreen from './AddressScreen';

// Typed mock references
const mockEnqueue = vi.mocked(enqueueOfflineAddress);
const mockFetch = vi.mocked(fetchWithCorrelation);
const mockUseKyc = vi.mocked(useKyc);

// ── Helpers ──────────────────────────────────────────────────────────────

const GEO_REGIONS = [
  { code: 'CE', name: 'Centre' },
  { code: 'LT', name: 'Littoral' },
];
const GEO_CITIES = [
  { code: 'YA1', name: 'Yaoundé 1' },
  { code: 'YA2', name: 'Yaoundé 2' },
];
const GEO_QUARTIERS = [
  { code: 'BAS', name: 'Bastos', commune_name: 'Yaoundé 1' },
  { code: 'NLO', name: 'Nlongkak', commune_name: 'Yaoundé 1' },
];

function mockGeoAndApiResponses(apiSuccess = true) {
  mockFetch.mockImplementation(((url: string, _options?: unknown) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    if (url === '/api/v1/kyc/geo/regions') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(GEO_REGIONS) } as unknown as Response);
    }
    if (url.startsWith('/api/v1/kyc/geo/cities/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(GEO_CITIES) } as unknown as Response);
    }
    if (url.startsWith('/api/v1/kyc/geo/quartiers/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(GEO_QUARTIERS) } as unknown as Response);
    }
    if (url === '/api/v1/kyc/address/submit') {
      if (apiSuccess) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'success' }) } as unknown as Response);
      }
      return Promise.reject(new Error('Network error'));
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as unknown as Response);
  }) as typeof fetchWithCorrelation);
}

function renderAddressScreen() {
  return render(
    <MemoryRouter>
      <AddressScreen />
    </MemoryRouter>,
  );
}

let originalOnLine: boolean;

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  originalOnLine = navigator.onLine;
  mockGeoAndApiResponses();
  mockUseKyc.mockReturnValue({
    sessionId: 'sess-1',
    setSessionId: vi.fn(),
    setAddress: vi.fn(),
    completeStep: vi.fn(),
  } as any);
});

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('AddressScreen integration', () => {
  it('renders region dropdown from API', async () => {
    renderAddressScreen();

    await waitFor(() => {
      expect(screen.getByText('Centre')).toBeInTheDocument();
    });
    expect(screen.getByText('Littoral')).toBeInTheDocument();
  });

  it('cascades city dropdown when region is selected', async () => {
    const user = userEvent.setup();
    renderAddressScreen();

    await waitFor(() => {
      expect(screen.getByText('Centre')).toBeInTheDocument();
    });

    const regionSelect = screen.getByLabelText('Region');
    await user.selectOptions(regionSelect, 'CE');

    await waitFor(() => {
      expect(screen.getByText('Yaoundé 1')).toBeInTheDocument();
    });
  });

  it('cascades quartier dropdown when city is selected', async () => {
    const user = userEvent.setup();
    renderAddressScreen();

    await waitFor(() => {
      expect(screen.getByText('Centre')).toBeInTheDocument();
    });

    const regionSelect = screen.getByLabelText('Region');
    await user.selectOptions(regionSelect, 'CE');

    await waitFor(() => {
      expect(screen.getByText('Yaoundé 1')).toBeInTheDocument();
    });

    const citySelect = screen.getByLabelText('Ville');
    await user.selectOptions(citySelect, 'YA1');

    await waitFor(() => {
      // Quartier option text includes commune: "Bastos (Yaoundé 1)"
      expect(screen.getByText(/Bastos/)).toBeInTheDocument();
    });
  });

  it('enqueues address offline when navigator is offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const user = userEvent.setup();

    renderAddressScreen();

    await waitFor(() => expect(screen.getByText('Centre')).toBeInTheDocument());

    // Fill form
    const regionSelect = screen.getByLabelText('Region');
    await user.selectOptions(regionSelect, 'CE');

    await waitFor(() => expect(screen.getByText('Yaoundé 1')).toBeInTheDocument());
    const citySelect = screen.getByLabelText('Ville');
    await user.selectOptions(citySelect, 'YA1');

    await waitFor(() => expect(screen.getByText(/Bastos/)).toBeInTheDocument());
    const quartierSelect = screen.getByLabelText('Quartier');
    await user.selectOptions(quartierSelect, 'BAS');

    // Simulate GPS capture
    const geoMock = vi.fn().mockImplementation((success: any) => {
      success({ coords: { latitude: 3.85, longitude: 11.5 } });
    });
    (navigator as any).geolocation = { getCurrentPosition: geoMock };

    const gpsButton = screen.getByText('Capturer');
    fireEvent.click(gpsButton);

    // Wait for GPS to be captured and submit enabled
    await waitFor(() => {
      const submitBtn = screen.getByText('Continuer');
      expect(submitBtn).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          address: expect.objectContaining({
            region: 'CE',
            city: 'YA1',
            quartier: 'BAS',
            gps_lat: 3.85,
            gps_lng: 11.5,
          }),
        }),
      );
    });
    // Verify step is marked complete after offline enqueue
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('address');
  });

  it('enqueues address offline when online but API call fails', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockGeoAndApiResponses(false); // API fails for address/submit
    const user = userEvent.setup();

    renderAddressScreen();

    await waitFor(() => expect(screen.getByText('Centre')).toBeInTheDocument());

    const regionSelect = screen.getByLabelText('Region');
    await user.selectOptions(regionSelect, 'CE');

    await waitFor(() => expect(screen.getByText('Yaoundé 1')).toBeInTheDocument());
    const citySelect = screen.getByLabelText('Ville');
    await user.selectOptions(citySelect, 'YA1');

    await waitFor(() => expect(screen.getByText(/Bastos/)).toBeInTheDocument());
    const quartierSelect = screen.getByLabelText('Quartier');
    await user.selectOptions(quartierSelect, 'BAS');

    // Simulate GPS capture
    const geoMock = vi.fn().mockImplementation((success: any) => {
      success({ coords: { latitude: 4.05, longitude: 9.7 } });
    });
    (navigator as any).geolocation = { getCurrentPosition: geoMock };

    fireEvent.click(screen.getByText('Capturer'));

    await waitFor(() => {
      const submitBtn = screen.getByText('Continuer');
      expect(submitBtn).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          address: expect.objectContaining({
            region: 'CE',
            gps_lat: 4.05,
            gps_lng: 9.7,
          }),
        }),
      );
    });
    // Verify step is marked complete after offline enqueue on API failure
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('address');
  });

  it('calls API when online and API succeeds', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockGeoAndApiResponses(true);
    const user = userEvent.setup();

    renderAddressScreen();

    await waitFor(() => expect(screen.getByText('Centre')).toBeInTheDocument());

    const regionSelect = screen.getByLabelText('Region');
    await user.selectOptions(regionSelect, 'CE');

    await waitFor(() => expect(screen.getByText('Yaoundé 1')).toBeInTheDocument());
    const citySelect = screen.getByLabelText('Ville');
    await user.selectOptions(citySelect, 'YA1');

    await waitFor(() => expect(screen.getByText(/Bastos/)).toBeInTheDocument());
    const quartierSelect = screen.getByLabelText('Quartier');
    await user.selectOptions(quartierSelect, 'BAS');

    // Simulate GPS capture
    const geoMock = vi.fn().mockImplementation((success: any) => {
      success({ coords: { latitude: 3.85, longitude: 11.5 } });
    });
    (navigator as any).geolocation = { getCurrentPosition: geoMock };

    fireEvent.click(screen.getByText('Capturer'));

    await waitFor(() => {
      const submitBtn = screen.getByText('Continuer');
      expect(submitBtn).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/kyc/address/submit',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    // Should NOT enqueue since API succeeded
    expect(mockEnqueue).not.toHaveBeenCalled();
    // Verify step is marked complete after successful API call
    expect(mockUseKyc().completeStep).toHaveBeenCalledWith('address');
  });
});
