import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OtpVerifyScreen from '../OtpVerifyScreen';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockLogin = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      state: {
        mode: 'login',
        identifier: '+237690000005',
      },
    }),
  };
});

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    phone: '+237690000005',
    login: mockLogin,
  }),
}));

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    post: mockPost,
    get: mockGet,
  },
}));

describe('OtpVerifyScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('redirects login flow to PIN setup when OTP login returns a user without PIN', async () => {
    mockPost.mockResolvedValue({
      access_token: 'token-123',
    });
    mockGet.mockResolvedValue({
      id: 'user-1',
      phone: '+237690000005',
      email: null,
      role: 'CLIENT',
      has_pin: false,
    });

    render(
      <MemoryRouter>
        <OtpVerifyScreen />
      </MemoryRouter>,
    );

    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input, index) => {
      fireEvent.change(input, { target: { value: String(index + 1) } });
    });

    fireEvent.click(screen.getByRole('button', { name: /valider le compte/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('token-123', expect.objectContaining({ has_pin: false }));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/auth/pin-setup', { replace: true });
  });
});
