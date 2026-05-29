import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/use-theme';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { AlertCircle, Bell, CheckCircle, ChevronRight, Fingerprint, Lock, Moon, RefreshCw, Shield, Wrench } from 'lucide-react';
import { cn } from '../../lib/utils';
import { disablePushNotifications, enablePushNotifications } from '../../services/pushNotificationService';
import { apiClient, type ApiError } from '../../services/apiClient';

type OfficialChannel = 'sms' | 'email';

const SERVICE_UNAVAILABLE = 'Service temporairement indisponible. Reessayez dans quelques instants.';

function friendlyError(err: unknown, fallback = SERVICE_UNAVAILABLE) {
  const apiError = err as ApiError;
  if (apiError?.status && apiError.status < 500 && err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export function SettingsScreen() {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { biometricEnabled, isPasskeySupported, setBiometric } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [pushEnabled, setPushEnabled] = useState(() => localStorage.getItem('vp_push_enabled') === 'true');
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [officialChannel, setOfficialChannel] = useState<OfficialChannel>('sms');
  const [officialChannelLoading, setOfficialChannelLoading] = useState(false);
  const [officialChannelError, setOfficialChannelError] = useState('');
  const [preferencesError, setPreferencesError] = useState('');
  const isDev = import.meta.env.DEV;

  const label = useCallback((key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  }, [t]);

  const loadPreferences = useCallback(async () => {
    setPreferencesError('');
    try {
      const prefs = await apiClient.get<{ official_channel: OfficialChannel; push_enabled: boolean }>('/notifications/preferences');
      setOfficialChannel(prefs.official_channel);
      setPushEnabled(prefs.push_enabled);
      setPushMessage('');
    } catch {
      setPreferencesError(label('settings.serviceUnavailable', SERVICE_UNAVAILABLE));
    }
  }, [label]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!active) return;
      await loadPreferences();
    })();
    return () => { active = false; };
  }, [loadPreferences]);

  const handleBiometricToggle = async (v: boolean) => {
    setBiometricLoading(true);
    await setBiometric(v);
    setBiometricLoading(false);
  };

  const handlePushToggle = async (v: boolean) => {
    setPushLoading(true);
    setPushMessage('');
    try {
      if (v) {
        const result = await enablePushNotifications();
        if (!result.enabled) {
          setPushEnabled(false);
          setPushMessage(result.message);
          return;
        }
        try {
          await apiClient.put('/notifications/preferences', { push_enabled: true });
          setPushEnabled(true);
          setPushMessage(result.message);
        } catch {
          setPushEnabled(false);
          setPushMessage(label('settings.push.partialFailure', 'Autorisation acceptee, mais synchronisation impossible. Reessayez.'));
        }
      } else {
        await disablePushNotifications();
        setPushEnabled(false);
        try {
          await apiClient.put('/notifications/preferences', { push_enabled: false });
          setPushMessage(label('settings.push.disabled', 'Notifications push desactivees.'));
        } catch {
          setPushMessage(label('settings.push.disabledLocal', 'Notifications desactivees sur cet appareil. Synchronisation serveur en attente.'));
        }
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
      setOfficialChannelError(friendlyError(err, label('settings.serviceUnavailable', SERVICE_UNAVAILABLE)));
    } finally {
      setOfficialChannelLoading(false);
    }
  };

  const preferenceRows = [
    {
      icon: Fingerprint,
      label: label('settings.biometric', 'Biometrie') + (!isPasskeySupported ? ` (${label('auth.biometric.unsupported', 'indisponible')})` : ''),
      value: biometricEnabled,
      onChange: (v: boolean) => handleBiometricToggle(v),
      disabled: !isPasskeySupported || biometricLoading,
      message: '',
    },
    {
      icon: Bell,
      label: label('settings.notifications', 'Notifications push'),
      value: pushEnabled,
      onChange: handlePushToggle,
      disabled: pushLoading,
      message: pushMessage,
    },
    {
      icon: Moon,
      label: label('settings.darkMode', 'Mode sombre'),
      value: theme === 'dark',
      onChange: () => toggleTheme(),
      message: '',
    },
  ];

  return (
    <ScreenLayoutV2 showBack title={label('settings.title', 'Parametres')} contentClassName="pb-40">
      <div className="space-y-6 pt-2">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{label('settings.language', 'Langue')}</h3>
          <div className="bg-card border border-border rounded-2xl p-1 flex">
            {(['fr', 'en'] as const).map((lang) => (
              <button key={lang} onClick={() => setLanguage(lang)} className={cn(
                'flex-1 py-3 rounded-xl text-sm font-medium transition-all',
                language === lang ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground',
              )}>
                {lang === 'fr' ? 'Francais' : 'English'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{label('settings.officialChannel', 'Messages officiels')}</h3>
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-xs text-muted-foreground">{label('settings.officialChannelHelp', 'Choisissez le canal pour les informations importantes: carte a recuperer, passage en agence, politiques mises a jour.')}</p>
            {preferencesError && (
              <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <span className="flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {preferencesError}
                </span>
                <button
                  type="button"
                  onClick={() => void loadPreferences()}
                  className="inline-flex shrink-0 items-center gap-1 font-bold"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {label('common.retry', 'Reessayer')}
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {(['sms', 'email'] as const).map((channel) => {
                const active = officialChannel === channel;
                return (
                  <button
                    key={channel}
                    type="button"
                    aria-label={channel === 'sms' ? 'SMS' : 'Email'}
                    disabled={officialChannelLoading || Boolean(preferencesError)}
                    onClick={() => void handleOfficialChannelChange(channel)}
                    className={cn(
                      'min-h-12 rounded-xl border px-3 text-sm font-semibold transition-all flex items-center justify-center gap-2',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground',
                      (officialChannelLoading || preferencesError) && 'opacity-60',
                    )}
                  >
                    {active && <CheckCircle className="h-4 w-4" />}
                    <span>{channel === 'sms' ? 'SMS' : 'Email'}</span>
                  </button>
                );
              })}
            </div>
            {officialChannelError && (
              <p className="text-xs font-medium text-destructive">{officialChannelError}</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{label('settings.preferences', 'Preferences')}</h3>
          <div className="space-y-1">
            {preferenceRows.map((item) => (
              <div key={item.label} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <item.icon className="h-5 w-5 shrink-0 text-primary" />
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                  </div>
                  <button
                    aria-label={item.label}
                    onClick={() => !item.disabled && item.onChange(!item.value)}
                    disabled={item.disabled}
                    className={cn(
                      'relative w-12 h-7 rounded-full transition-colors shrink-0',
                      item.value ? 'bg-primary' : 'bg-muted',
                      item.disabled && 'opacity-50',
                    )}
                  >
                    <div className={cn(
                      'absolute top-0.5 h-6 w-6 rounded-full bg-card shadow transition-transform',
                      item.value ? 'translate-x-5' : 'translate-x-0.5',
                    )} />
                  </button>
                </div>
                {item.message && (
                  <p className={cn(
                    'mt-2 text-xs font-medium',
                    item.value ? 'text-emerald-700' : 'text-muted-foreground',
                  )}>
                    {item.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{label('settings.security', 'Securite')}</h3>
          <div className="space-y-1">
            {[
              { icon: Lock, label: label('settings.changePin', 'Changer le PIN'), path: '/auth/pin-setup' },
              { icon: Shield, label: label('settings.privacy', 'Confidentialite'), path: '#' },
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
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{label('settings.dev.title', 'Developpement')}</h3>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Wrench className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-foreground">{label('settings.dev.fullAccess', 'Forcer Full Access')}</span>
                </div>
                <button type="button" className="relative w-12 h-7 rounded-full bg-muted">
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
