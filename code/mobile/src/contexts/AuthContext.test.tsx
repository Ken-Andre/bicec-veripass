import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockSetSessionExpiredHandler = vi.hoisted(() => vi.fn());
const mockEnsureDeviceRegistered = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    delete: vi.fn(),
  },
  setSessionExpiredHandler: mockSetSessionExpiredHandler,
}));

vi.mock('../services/passkeyService', () => ({
  isPasskeySupported: vi.fn(() => true),
  registerPasskey: vi.fn(),
  authenticatePasskey: vi.fn(),
  removePasskey: vi.fn(),
}));

vi.mock('../services/kycOfflineStore', () => ({
  clearPersistedKycState: vi.fn(),
}));

vi.mock('../services/deviceRegistrationService', () => ({
  ensureDeviceRegistered: mockEnsureDeviceRegistered,
}));

function AuthStateProbe() {
  const { isLocked } = useAuth();
  return <div data-testid="lock-state">{isLocked ? 'locked' : 'unlocked'}</div>;
}

describe('AuthProvider session expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureDeviceRegistered.mockResolvedValue('vp_dev_test');
    localStorage.clear();
    sessionStorage.clear();
    window.history.pushState({}, '', '/mobile/dashboard');
  });

  it('redirects expired sessions to the auth choice entrypoint', () => {
    render(
      <AuthProvider>
        <div />
      </AuthProvider>,
    );

    const handler = mockSetSessionExpiredHandler.mock.calls.at(-1)?.[0];
    expect(handler).toEqual(expect.any(Function));

    handler();

    expect(mockNavigate).toHaveBeenCalledWith('/auth', { replace: true });
  });

  it('restores a locked session on reload without registering the device', async () => {
    localStorage.setItem('vp_token', 'test-token');
    localStorage.setItem('vp_user', JSON.stringify({
      id: 'user-1',
      phone: '+237690000005',
      role: 'CLIENT',
      has_pin: true,
    }));
    sessionStorage.setItem('vp_is_locked', 'true');

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('lock-state')).toHaveTextContent('locked');
    });
    expect(mockEnsureDeviceRegistered).not.toHaveBeenCalled();
  });

  it('treats direct lock-screen entry with a persisted token as locked', async () => {
    window.history.pushState({}, '', '/mobile/auth/lock');
    localStorage.setItem('vp_token', 'test-token');
    localStorage.setItem('vp_user', JSON.stringify({
      id: 'user-1',
      phone: '+237690000005',
      role: 'CLIENT',
      has_pin: true,
    }));

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('lock-state')).toHaveTextContent('locked');
    });
    expect(sessionStorage.getItem('vp_is_locked')).toBe('true');
  });

  it('keeps the saved profile and routes to PIN login when a token expires', () => {
    localStorage.setItem('vp_token', 'expired-token');
    localStorage.setItem('vp_user', JSON.stringify({
      id: 'user-1',
      phone: '+237690000005',
      role: 'CLIENT',
      has_pin: true,
    }));

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    const handler = mockSetSessionExpiredHandler.mock.calls.at(-1)?.[0];
    expect(handler).toEqual(expect.any(Function));

    handler();

    expect(localStorage.getItem('vp_token')).toBeNull();
    expect(localStorage.getItem('vp_user')).toContain('+237690000005');
    expect(mockNavigate).toHaveBeenCalledWith('/auth/pin-login', { replace: true });
  });
});
