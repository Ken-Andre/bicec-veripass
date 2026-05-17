import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmailOtpVerifyScreen from '../EmailOtpVerifyScreen';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockRefreshUser = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      state: {
        email: 'fresh@example.com',
      },
    }),
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
    refreshUser: mockRefreshUser,
  }),
}));

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    post: mockPost,
  },
}));

describe('EmailOtpVerifyScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes the authenticated user after email verification', async () => {
    mockPost.mockResolvedValue({});
    mockRefreshUser.mockResolvedValue({
      id: 'user-1',
      phone: '+237690000005',
      email: 'fresh@example.com',
      role: 'CLIENT',
      has_pin: true,
    });

    render(
      <MemoryRouter>
        <EmailOtpVerifyScreen />
      </MemoryRouter>,
    );

    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input, index) => {
      fireEvent.change(input, { target: { value: String(index + 1) } });
    });

    fireEvent.click(screen.getByRole('button', { name: /confirmer l'email/i }));

    await waitFor(() => {
      expect(mockRefreshUser).toHaveBeenCalled();
    });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
