import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const swMock = vi.hoisted(() => ({
  registerSW: vi.fn(),
  updateSW: vi.fn(() => Promise.resolve()),
  registrationUpdate: vi.fn(() => Promise.resolve()),
  options: undefined as
    | {
        onNeedRefresh?: () => void;
        onOfflineReady?: () => void;
        onRegistered?: (registration?: { update: () => Promise<void> }) => void;
      }
    | undefined,
}));

vi.mock('virtual:pwa-register', () => ({
  registerSW: swMock.registerSW,
}));

import { useServiceWorker } from './use-service-worker';

describe('useServiceWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    swMock.updateSW = vi.fn(() => Promise.resolve());
    swMock.registrationUpdate = vi.fn(() => Promise.resolve());
    swMock.options = undefined;
    swMock.registerSW.mockImplementation((options) => {
      swMock.options = options;
      options.onRegistered?.({ update: swMock.registrationUpdate });
      return swMock.updateSW;
    });
  });

  it('surfaces externally dispatched service worker update events', async () => {
    const { result } = renderHook(() => useServiceWorker());

    expect(result.current.needsRefresh).toBe(false);

    await act(async () => {
      window.dispatchEvent(new Event('vp:service-worker-update-available'));
    });

    expect(result.current.needsRefresh).toBe(true);
  });

  it('can dismiss update and offline-ready banners', async () => {
    const { result } = renderHook(() => useServiceWorker());

    await act(async () => {
      window.dispatchEvent(new Event('vp:service-worker-update-available'));
      swMock.options?.onOfflineReady?.();
    });

    expect(result.current.needsRefresh).toBe(true);
    expect(result.current.offlineReady).toBe(true);

    await act(async () => {
      result.current.dismiss();
    });

    expect(result.current.needsRefresh).toBe(false);
    expect(result.current.offlineReady).toBe(false);
  });

  it('delegates manual updates to vite-plugin-pwa with reload enabled', async () => {
    const { result } = renderHook(() => useServiceWorker());

    await waitFor(() => {
      act(() => {
        result.current.updateSW();
      });
      expect(swMock.updateSW).toHaveBeenCalledWith(true);
    });
  });
});
