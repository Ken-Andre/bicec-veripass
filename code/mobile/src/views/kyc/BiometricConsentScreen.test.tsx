import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BiometricConsentScreen from './BiometricConsentScreen';

const mockNavigate = vi.fn();
const mockSetBiometricConsentAccepted = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../contexts/KycContext', () => ({
  useKyc: () => ({
    biometricConsentAccepted: false,
    setBiometricConsentAccepted: mockSetBiometricConsentAccepted,
  }),
}));

describe('BiometricConsentScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires explicit consent before continuing', () => {
    render(
      <MemoryRouter>
        <BiometricConsentScreen />
      </MemoryRouter>,
    );

    const continueBtn = screen.getByText('Continuer vers le selfie');
    expect(continueBtn).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(continueBtn).not.toBeDisabled();

    fireEvent.click(continueBtn);
    expect(mockSetBiometricConsentAccepted).toHaveBeenCalledWith(true);
    expect(mockNavigate).toHaveBeenCalledWith('/kyc/liveness');
  });
});

