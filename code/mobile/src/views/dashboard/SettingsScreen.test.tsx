import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsScreen } from './SettingsScreen';

const mockGet = vi.hoisted(() => vi.fn());
const mockPut = vi.hoisted(() => vi.fn());
const mockEnablePushNotifications = vi.hoisted(() => vi.fn());
const mockDisablePushNotifications = vi.hoisted(() => vi.fn());

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'fr',
    setLanguage: vi.fn(),
    t: (key: string) => ({
      'settings.title': 'Parametres',
      'settings.language': 'Langue',
      'settings.preferences': 'Preferences',
      'settings.biometric': 'Biometrie',
      'settings.notifications': 'Notifications push',
      'settings.officialChannel': 'Messages officiels',
      'settings.officialChannelHelp': 'Choisissez le canal officiel.',
      'settings.officialChannelError': 'Preference impossible a enregistrer.',
      'settings.darkMode': 'Mode sombre',
      'settings.security': 'Securite',
      'settings.changePin': 'Changer le PIN',
      'settings.privacy': 'Confidentialite',
      'settings.dev.title': 'Developpement',
      'settings.dev.fullAccess': 'Forcer Full Access',
      'auth.biometric.unsupported': 'indisponible',
    }[key] || key),
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    biometricEnabled: false,
    isPasskeySupported: true,
    setBiometric: vi.fn(),
  }),
}));

vi.mock('../../hooks/use-theme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    get: mockGet,
    put: mockPut,
  },
}));

vi.mock('../../services/pushNotificationService', () => ({
  enablePushNotifications: mockEnablePushNotifications,
  disablePushNotifications: mockDisablePushNotifications,
}));

describe('SettingsScreen notification preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default' },
    });
    mockGet.mockResolvedValue({
      official_channel: 'sms',
      push_enabled: true,
    });
    mockPut.mockResolvedValue({
      official_channel: 'email',
      push_enabled: true,
      in_app_enabled: true,
    });
    mockDisablePushNotifications.mockResolvedValue(undefined);
    mockEnablePushNotifications.mockResolvedValue({
      enabled: true,
      code: 'enabled',
      message: 'Notifications push activees.',
    });
  });

  it('loads and persists the official message channel preference', async () => {
    render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/notifications/preferences');
    });

    expect(screen.getByText('Messages officiels')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Email' }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/notifications/preferences', {
        official_channel: 'email',
      });
    });
  });

  it('keeps push disabled until the browser permission is granted', async () => {
    localStorage.setItem('vp_push_enabled', 'true');

    render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/notifications/preferences');
    });

    const button = screen.getByRole('button', { name: 'Notifications push' });
    expect(button.querySelector('div')).toHaveClass('translate-x-0.5');
  });

  it('persists push opt-out when push notifications are disabled', async () => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'granted' },
    });

    render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/notifications/preferences');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Notifications push' }));

    await waitFor(() => {
      expect(mockDisablePushNotifications).toHaveBeenCalled();
      expect(mockPut).toHaveBeenCalledWith('/notifications/preferences', {
        push_enabled: false,
      });
    });
  });
});
