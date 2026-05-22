import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthContext';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockSetSessionExpiredHandler = vi.hoisted(() => vi.fn());

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

describe('AuthProvider session expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
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
});
