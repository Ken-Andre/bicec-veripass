import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/use-theme';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { ChevronRight, Lock, Fingerprint, Bell, Moon, Shield, Wrench } from 'lucide-react';
import { cn } from '../../lib/utils';
import { disablePushNotifications, enablePushNotifications } from '../../services/pushNotificationService';
import { apiClient } from '../../services/apiClient';

type OfficialChannel = 'sms' | 'email';

export function SettingsScreen() {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { biometricEnabled, isPasskeySupported, setBiometric } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [pushEnabled, setPushEnabled] = useState(() => localStorage.getItem('vp_push_enabled') === 'true');
  const [pushLoading, setPushLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [officialChannel, setOfficialChannel] = useState<OfficialChannel>('sms');
  const [officialChannelLoading, setOfficialChannelLoading] = useState(false);
  const [officialChannelError, setOfficialChannelError] = useState('');
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    let active = true;
    async function loadPreferences() {
      try {
        const prefs = await apiClient.get<{ official_channel: OfficialChannel; push_enabled: boolean }>('/notifications/preferences');
        if (!active) return;
        setOfficialChannel(prefs.official_channel);
        setPushEnabled(prefs.push_enabled);
      } catch {
        // Keep local defaults when the preference endpoint is unavailable.
      }
    }
    void loadPreferences();
    return () => { active = false; };
  }, []);

  const handleBiometricToggle = async (v: boolean) => {
    setBiometricLoading(true);
    await setBiometric(v);
    setBiometricLoading(false);
  };

  const handlePushToggle = async (v: boolean) => {
    setPushLoading(true);
    try {
      if (v) {
        const enabled = await enablePushNotifications();
        if (enabled) {
          await apiClient.put('/notifications/preferences', { push_enabled: true });
        }
        setPushEnabled(enabled);
      } else {
        await disablePushNotifications();
        await apiClient.put('/notifications/preferences', { push_enabled: false });
        setPushEnabled(false);
      }
    } finally {
      setPushLoading(false);
    }
  };

  const handleOfficialChannelChange = async (channel: OfficialChannel) => {
    if (channel === officialChannel || officialChannelLoading) return;
    const previous = officialChannel;
    setOfficialChannel(channel);
    setOfficialChannelLoading(true);
    setOfficialChannelError('');
    try {
      const prefs = await apiClient.put<{ official_channel: OfficialChannel }, { official_channel: OfficialChannel }>(
        '/notifications/preferences',
        { official_channel: channel },
      );
      setOfficialChannel(prefs.official_channel);
    } catch (err) {
      setOfficialChannel(previous);
      setOfficialChannelError(err instanceof Error ? err.message : t('settings.officialChannelError'));
    } finally {
      setOfficialChannelLoading(false);
    }
  };

  return (
    <ScreenLayoutV2 showBack title={t('settings.title')} contentClassName="pb-40">
      <div className="space-y-6 pt-2">
        {/* Language */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('settings.language')}</h3>
          <div className="bg-card border border-border rounded-2xl p-1 flex">
            {(['fr', 'en'] as const).map((lang) => (
              <button key={lang} onClick={() => setLanguage(lang)} className={cn(
                'flex-1 py-3 rounded-xl text-sm font-medium transition-all',
                language === lang ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground'
              )}>
                {lang === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('settings.officialChannel')}</h3>
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-xs text-muted-foreground">{t('settings.officialChannelHelp')}</p>
            <div className="grid grid-cols-2 gap-2">
              {(['sms', 'email'] as const).map((channel) => (
                <button
                  key={channel}
                  type="button"
                  disabled={officialChannelLoading}
                  onClick={() => void handleOfficialChannelChange(channel)}
                  className={cn(
                    'h-11 rounded-xl border text-sm font-semibold transition-all',
                    officialChannel === channel
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground',
                    officialChannelLoading && 'opacity-60',
                  )}
                >
                  {channel === 'sms' ? 'SMS' : 'Email'}
                </button>
              ))}
            </div>
            {officialChannelError && (
              <p className="text-xs font-medium text-destructive">{officialChannelError}</p>
            )}
          </div>
        </div>

        {/* Toggles */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('settings.preferences')}</h3>
          <div className="space-y-1">
            {[
              { icon: Fingerprint, label: t('settings.biometric') + (!isPasskeySupported ? ` (${t('auth.biometric.unsupported')})` : ''), value: biometricEnabled, onChange: (v: boolean) => handleBiometricToggle(v), disabled: !isPasskeySupported || biometricLoading },
              { icon: Bell, label: t('settings.notifications'), value: pushEnabled, onChange: handlePushToggle, disabled: pushLoading },
              { icon: Moon, label: t('settings.darkMode'), value: theme === 'dark', onChange: toggleTheme },
            ].map((item) => (
              <div key={item.label} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <item.icon className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                  </div>
                  <button
                    aria-label={item.label}
                    onClick={() => !item.disabled && item.onChange(!item.value)}
                    disabled={item.disabled}
                    className={cn(
                      'relative w-12 h-7 rounded-full transition-colors',
                      item.value ? 'bg-primary' : 'bg-muted',
                      item.disabled && 'opacity-50'
                    )}
                  >
                    <div className={cn(
                      'absolute top-0.5 h-6 w-6 rounded-full bg-card shadow transition-transform',
                      item.value ? 'translate-x-5' : 'translate-x-0.5'
                    )} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('settings.security')}</h3>
          <div className="space-y-1">
            {[
              { icon: Lock, label: t('settings.changePin'), path: '/auth/pin-setup' },
              { icon: Shield, label: t('settings.privacy'), path: '#' },
            ].map((item) => (
              <button key={item.label} onClick={() => item.path !== '#' && navigate(item.path)} className="w-full bg-card border border-border rounded-2xl p-4 text-left active:scale-[0.98] transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <item.icon className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {isDev && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('settings.dev.title')}</h3>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Wrench className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-foreground">{t('settings.dev.fullAccess')}</span>
                </div>
                <button
                  onClick={() => {
                    // Dev toggle handled by dashboard
                  }}
                  className="relative w-12 h-7 rounded-full bg-muted"
                >
                  <div className="absolute top-0.5 h-6 w-6 rounded-full bg-card shadow translate-x-0.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground/60 pt-4">BICEC VeriPass v1.0.0</p>
      </div>
    </ScreenLayoutV2>
  );
}
