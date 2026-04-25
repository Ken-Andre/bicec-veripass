/**
 * Unit tests for OfflineBanner component.
 *
 * Tests rendering in different connectivity states:
 * - Hidden when online with no pending items
 * - Amber offline banner when navigator is offline
 * - Blue sync banner when online with pending items
 * - "Connexion rétablie" briefly when transitioning online
 * - Dismiss behavior
 * - Retry button
 *
 * IMPORTANT: The component's `justCameOnline` useEffect fires on initial
 * mount when `isOnline=true`, showing "Connexion rétablie" for 4 seconds.
 * We use vi.useFakeTimers() and advance past the timeout inside act() so
 * React processes the state update from the setTimeout callback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { OfflineBanner } from './OfflineBanner';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockSyncNow = vi.fn().mockResolvedValue(undefined);

vi.mock('../hooks/useConnectivity', () => ({
  useConnectivity: () => mockUseConnectivity(),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) =>
      key === 'offline.banner'
        ? 'Hors ligne — les données seront sauvegardées localement'
        : key,
  }),
}));

// Mutable state for controlling useConnectivity return value per test
let connectivityState: {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  needsReuploadCount: number;
  failedCount: number;
  syncNow: () => Promise<void>;
};

function mockUseConnectivity() {
  return connectivityState;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function setState(overrides: Partial<typeof connectivityState> = {}) {
  connectivityState = {
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    needsReuploadCount: 0,
    failedCount: 0,
    syncNow: mockSyncNow,
    ...overrides,
  };
}

/**
 * Advance fake timers past the 4-second justCameOnline timeout
 * inside act() so React processes the resulting state update.
 */
function advancePastJustOnline() {
  act(() => {
    vi.advanceTimersByTime(4001);
  });
}

// ── Test suites ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  setState();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('OfflineBanner', () => {
  it('renders nothing when online with no pending items and no issues', () => {
    setState({ isOnline: true, pendingCount: 0, needsReuploadCount: 0, failedCount: 0 });
    const { container } = render(<OfflineBanner />);

    advancePastJustOnline();

    expect(container.innerHTML).toBe('');
  });

  it('renders offline banner when isOnline is false', () => {
    setState({ isOnline: false, pendingCount: 0 });
    render(<OfflineBanner />);

    expect(screen.getByText(/Hors ligne/i)).toBeInTheDocument();
  });

  it('shows pending item count in offline banner', () => {
    setState({ isOnline: false, pendingCount: 3 });
    render(<OfflineBanner />);

    expect(screen.getByText(/3 élément\(s\) seront synchronisés/i)).toBeInTheDocument();
  });

  it('renders sync progress banner when online with pending items', () => {
    setState({ isOnline: true, pendingCount: 5, isSyncing: false });
    render(<OfflineBanner />);

    advancePastJustOnline();

    expect(screen.getByText(/5 élément\(s\) en attente de synchronisation/i)).toBeInTheDocument();
  });

  it('renders syncing state with spinner text', () => {
    setState({ isOnline: true, pendingCount: 2, isSyncing: true });
    render(<OfflineBanner />);

    expect(screen.getByText(/Synchronisation en cours/i)).toBeInTheDocument();
  });

  it('shows "Connexion rétablie" briefly when coming online', () => {
    setState({ isOnline: true, pendingCount: 0 });
    render(<OfflineBanner />);

    // Immediately after mount with isOnline=true, justCameOnline is set
    expect(screen.getByText(/Connexion rétablie/i)).toBeInTheDocument();

    // After 4 seconds, the message clears and banner disappears (no pending items)
    advancePastJustOnline();
    expect(screen.queryByText(/Connexion rétablie/i)).not.toBeInTheDocument();
  });

  it('shows issue count when items need reupload or have failed', () => {
    setState({ isOnline: true, pendingCount: 0, needsReuploadCount: 2, failedCount: 1 });
    render(<OfflineBanner />);

    advancePastJustOnline();

    expect(screen.getByText(/3 élément\(s\) nécessitent une action/i)).toBeInTheDocument();
  });

  it('shows retry button when there are issues and not syncing', () => {
    setState({ isOnline: true, pendingCount: 0, needsReuploadCount: 1, failedCount: 0, isSyncing: false });
    render(<OfflineBanner />);

    advancePastJustOnline();

    expect(screen.getByText(/Réessayer/i)).toBeInTheDocument();
  });

  it('does not show retry button when syncing', () => {
    setState({ isOnline: true, pendingCount: 0, needsReuploadCount: 1, failedCount: 0, isSyncing: true });
    render(<OfflineBanner />);

    expect(screen.queryByText(/Réessayer/i)).not.toBeInTheDocument();
  });

  it('calls syncNow when retry button is clicked', async () => {
    setState({ isOnline: true, pendingCount: 0, needsReuploadCount: 1, failedCount: 0 });
    render(<OfflineBanner />);

    advancePastJustOnline();

    const retryBtn = screen.getByText(/Réessayer/i);
    await act(async () => {
      fireEvent.click(retryBtn);
      // Flush microtasks (the syncNow promise)
      await vi.runOnlyPendingTimersAsync();
    });

    expect(mockSyncNow).toHaveBeenCalledOnce();
  });

  it('dismisses the banner when close button is clicked', () => {
    setState({ isOnline: false, pendingCount: 1 });
    render(<OfflineBanner />);

    const closeBtn = screen.getByLabelText(/Fermer/i);
    fireEvent.click(closeBtn);

    expect(screen.queryByText(/Hors ligne/i)).not.toBeInTheDocument();
  });

  it('reappears when going offline after being dismissed', () => {
    // Start online with pending items (shows blue sync banner)
    setState({ isOnline: true, pendingCount: 1 });
    const { rerender } = render(<OfflineBanner />);

    advancePastJustOnline();

    // Dismiss the banner
    fireEvent.click(screen.getByLabelText(/Fermer/i));
    expect(screen.queryByText(/en attente/i)).not.toBeInTheDocument();

    // Go offline — the useEffect resets dismissed when isOnline changes
    setState({ isOnline: false, pendingCount: 1 });
    rerender(<OfflineBanner />);

    // Banner should reappear because going offline resets dismissed
    expect(screen.getByText(/Hors ligne/i)).toBeInTheDocument();
  });

  it('has correct amber styling when offline', () => {
    setState({ isOnline: false, pendingCount: 0 });
    const { container } = render(<OfflineBanner />);

    const banner = container.querySelector('.bg-amber-500');
    expect(banner).toBeInTheDocument();
  });

  it('has correct blue styling when online with pending items', () => {
    setState({ isOnline: true, pendingCount: 2 });
    const { container } = render(<OfflineBanner />);

    advancePastJustOnline();

    const banner = container.querySelector('.bg-blue-600');
    expect(banner).toBeInTheDocument();
  });
});
