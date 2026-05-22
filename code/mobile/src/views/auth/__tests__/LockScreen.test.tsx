import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LockScreen from '../LockScreen';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockLogin = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());

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
  }),
}));

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    post: mockPost,
  },
}));

describe('LockScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to OTP instead of counting a wrong PIN when backend requires OTP', async () => {
    const error = new Error("PIN non configuré. Veuillez d'abord configurer votre PIN via OTP.") as Error & {
      status?: number;
      response?: { data: { detail: string } };
    };
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

    await waitFor(() => {
      expect(screen.getByText(/reconnexion otp requise/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/auth/phone', { replace: true });
    }, { timeout: 2000 });
    expect(mockLogin).not.toHaveBeenCalled();
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
      expect(mockLogin).toHaveBeenCalledWith('test-new-access-token', expect.objectContaining({ id: 'user-1' }));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });
});
