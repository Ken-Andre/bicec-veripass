import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PinLoginScreen from '../PinLoginScreen';

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
    login: mockLogin,
    user: {
      id: 'user-1',
      phone: '+237690000005',
      email: null,
      role: 'CLIENT',
      has_pin: true,
    },
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

describe('PinLoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthFlags.biometricEnabled = false;
    mockAuthFlags.isPasskeySupported = false;
  });

  it('reloads the authenticated user from /auth/me after a successful PIN login', async () => {
    mockPost.mockResolvedValue({
      access_token: 'token-123',
    });
    mockGet.mockResolvedValue({
      id: 'user-1',
      phone: '+237690000005',
      email: 'fresh@example.com',
      role: 'CLIENT',
      has_pin: true,
    });

    render(
      <MemoryRouter>
        <PinLoginScreen />
      </MemoryRouter>,
    );

    ['1', '2', '3', '4', '5', '6'].forEach((digit) => {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/auth/me', {
        headers: {
          Authorization: 'Bearer token-123',
        },
      });
    });
    expect(mockLogin).toHaveBeenCalledWith('token-123', expect.objectContaining({
      email: 'fresh@example.com',
    }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('redirects to OTP when backend says OTP is required', async () => {
    const error = new Error('PIN non configuré. Veuillez d\'abord configurer votre PIN via OTP.') as Error & {
      status?: number;
      response?: { data: { detail: string } };
    };
    error.status = 403;
    error.response = {
      data: {
        detail: 'PIN non configuré. Veuillez d\'abord configurer votre PIN via OTP.',
      },
    };
    mockPost.mockRejectedValue(error);

    render(
      <MemoryRouter>
        <PinLoginScreen />
      </MemoryRouter>,
    );

    ['1', '2', '3', '4', '5', '6'].forEach((digit) => {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    });

    await waitFor(() => {
      expect(screen.getByText(/redirection vers otp/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/auth/phone');
    }, { timeout: 2000 });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('logs in with a backend-issued token after mocked passkey success', async () => {
    mockAuthFlags.biometricEnabled = true;
    mockAuthFlags.isPasskeySupported = true;
    mockAuthenticateWithPasskey.mockResolvedValue({ access_token: 'bio-token' });
    mockGet.mockResolvedValue({
      id: 'user-1',
      phone: '+237690000005',
      email: 'fresh@example.com',
      role: 'CLIENT',
      has_pin: true,
    });

    render(
      <MemoryRouter>
        <PinLoginScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/auth/me', {
        headers: {
          Authorization: 'Bearer bio-token',
        },
      });
    });
    expect(mockLogin).toHaveBeenCalledWith('bio-token', expect.objectContaining({
      phone: '+237690000005',
    }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });
});
