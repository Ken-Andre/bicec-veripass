import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AuthEntryScreen from '../AuthEntryScreen';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('AuthEntryScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes login users to the login phone flow', () => {
    render(<AuthEntryScreen />);

    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/auth/phone?mode=login');
  });

  it('routes new users to the signup phone flow', () => {
    render(<AuthEntryScreen />);

    fireEvent.click(screen.getByRole('button', { name: /créer un compte/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/auth/phone?mode=signup');
  });
});
