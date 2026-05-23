import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LockScreen from '../LockScreen';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockLogin = vi.hoisted(() => vi.fn());
const mockAuthenticateWithPasskey = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());
const mockAuthFlags = vi.hoisted(() => ({
  biometricEnabled: false,
  isPasskeySupported: false,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      phone: '+237690000005',
      email: null,
      role: 'CLIENT',
      has_pin: true,
    },
    login: mockLogin,
    biometricEnabled: mockAuthFlags.biometricEnabled,
    isPasskeySupported: mockAuthFlags.isPasskeySupported,
    authenticateWithPasskey: mockAuthenticateWithPasskey,
  }),
}));

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    post: mockPost,
    get: mockGet,
  },
}));

describe('LockScreen', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    sessionStorage.clear();
    mockAuthFlags.biometricEnabled = false;
    mockAuthFlags.isPasskeySupported = false;
    mockGet.mockResolvedValue({
      id: 'user-1',
      phone: '+237690000005',
      email: 'fresh@example.com',
      role: 'CLIENT',
      has_pin: true,
    });
  });

  it('redirects to OTP instead of counting a wrong PIN when backend requires OTP', async () => {
    const error = new Error("PIN non configuré. Veuillez d'abord configurer votre PIN via OTP.") as Error & {
      status?: number;
      response?: { data: { detail: string } };
    };
    vi.useFakeTimers();
    error.status = 403;
    error.response = {
      data: {
        detail: "PIN non configuré. Veuillez d'abord configurer votre PIN via OTP.",
      },
    };
    mockPost.mockRejectedValue(error);

    render(
      <MemoryRouter>
        <LockScreen />
      </MemoryRouter>,
    );

    ['1', '2', '3', '4', '5', '6'].forEach((digit) => {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/reconnexion otp requise/i)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(mockNavigate).toHaveBeenCalledWith('/auth', { replace: true });
    expect(mockLogin).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('calls login and navigates to the target route on successful PIN entry', async () => {
    mockPost.mockResolvedValue({
      access_token: 'test-new-access-token',
      refresh_token: 'test-new-refresh-token',
    });

    render(
      <MemoryRouter>
        <LockScreen />
      </MemoryRouter>,
    );

    ['1', '2', '3', '4', '5', '6'].forEach((digit) => {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/auth/me', {
        headers: {
          Authorization: 'Bearer test-new-access-token',
        },
      });
      expect(mockLogin).toHaveBeenCalledWith('test-new-access-token', expect.objectContaining({
        email: 'fresh@example.com',
      }));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('does not resume back to the lock route after successful PIN entry', async () => {
    sessionStorage.setItem('vp_last_route', '/auth/lock');
    mockPost.mockResolvedValue({
      access_token: 'test-new-access-token',
      refresh_token: 'test-new-refresh-token',
    });

    render(
      <MemoryRouter>
        <LockScreen />
      </MemoryRouter>,
    );

    ['1', '2', '3', '4', '5', '6'].forEach((digit) => {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    });

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test-new-access-token', expect.any(Object));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('shows biometric login on the lock screen when enrolled', async () => {
    mockAuthFlags.biometricEnabled = true;
    mockAuthFlags.isPasskeySupported = true;
    mockAuthenticateWithPasskey.mockResolvedValue({ access_token: 'bio-token' });

    render(
      <MemoryRouter>
        <LockScreen />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /connexion biom/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('bio-token', expect.objectContaining({ email: 'fresh@example.com' }));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });
});
