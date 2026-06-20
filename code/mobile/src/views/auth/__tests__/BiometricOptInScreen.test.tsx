import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockSetBiometric = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    setBiometric: mockSetBiometric,
    isPasskeySupported: true,
  }),
}));

vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'auth.biometric.title': 'Connexion rapide',
        'auth.biometric.subtitle': 'Activez la biométrie pour un accès instantané.',
        'auth.biometric.secure': 'Données biométriques stockées localement',
        'auth.biometric.enable': 'Activer',
        'auth.biometric.skip': 'Plus tard',
        'auth.biometric.failed': 'Activation échouée. Vous pouvez continuer sans.',
      };
      return map[key] ?? key;
    },
    language: 'fr',
    setLanguage: () => {},
  }),
}));

import BiometricOptInScreen from '../BiometricOptInScreen';

describe('BiometricOptInScreen — non-régression routing', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSetBiometric.mockReset();
  });

  it('handleEnable : succès → navigate vers /kyc/intro (pas 404)', async () => {
    mockSetBiometric.mockResolvedValue(true);
    render(<BiometricOptInScreen />);

    const enableBtn = await screen.findByRole('button', { name: /activer/i });
    fireEvent.click(enableBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/kyc/intro');
    });
  });

  it('handleSkip : navigate vers /kyc/intro', async () => {
    render(<BiometricOptInScreen />);

    const skipBtn = await screen.findByRole('button', { name: /plus tard/i });
    fireEvent.click(skipBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/kyc/intro');
  });

  it('handleEnable : échec setBiometric → message d\'erreur visible, pas de navigation', async () => {
    mockSetBiometric.mockResolvedValue(false);
    render(<BiometricOptInScreen />);

    const enableBtn = await screen.findByRole('button', { name: /activer/i });
    fireEvent.click(enableBtn);

    await waitFor(() => {
      expect(screen.getByText(/activation échouée/i)).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
