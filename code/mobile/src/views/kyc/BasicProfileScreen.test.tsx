import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BasicProfileScreen from './BasicProfileScreen';

const mockNavigate = vi.fn();
const mockSetBasicProfile = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../contexts/KycContext', () => ({
  useKyc: () => ({
    basicProfile: null,
    setBasicProfile: mockSetBasicProfile,
  }),
}));

describe('BasicProfileScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps non-CM nationalities disabled', () => {
    render(
      <MemoryRouter>
        <BasicProfileScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText('Gabon').closest('button')).toBeDisabled();
    expect(screen.getByText('Tchad').closest('button')).toBeDisabled();
  });

  it('submits valid profile and navigates to document choice', () => {
    render(
      <MemoryRouter>
        <BasicProfileScreen />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('Ex: Marie Claire'), { target: { value: 'Marie' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Nguemo'), { target: { value: 'Nguemo' } });
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '1995-04-03' } });

    fireEvent.click(screen.getByText('Continuer'));

    expect(mockSetBasicProfile).toHaveBeenCalledWith({
      firstName: 'Marie',
      lastName: 'Nguemo',
      birthDate: '1995-04-03',
      nationality: 'CM',
    });
    expect(mockNavigate).toHaveBeenCalledWith('/kyc/document-choice');
  });
});
