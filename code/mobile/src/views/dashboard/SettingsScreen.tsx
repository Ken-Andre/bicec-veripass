import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/use-theme';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { ChevronRight, Lock, Fingerprint, Bell, Moon, Shield, Wrench } from 'lucide-react';
import { cn } from '../../lib/utils';

export function SettingsScreen() {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { biometricEnabled, isPasskeySupported, setBiometric } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const isDev = import.meta.env.DEV;

  const handleBiometricToggle = async (v: boolean) => {
    setBiometricLoading(true);
    await setBiometric(v);
    setBiometricLoading(false);
  };

  return (
    <ScreenLayoutV2 showBack title={t('settings.title')}>
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

        {/* Toggles */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('settings.preferences')}</h3>
          <div className="space-y-1">
            {[
              { icon: Fingerprint, label: t('settings.biometric') + (!isPasskeySupported ? ` (${t('auth.biometric.unsupported')})` : ''), value: biometricEnabled, onChange: (v: boolean) => handleBiometricToggle(v), disabled: !isPasskeySupported || biometricLoading },
              { icon: Bell, label: t('settings.notifications'), value: pushEnabled, onChange: setPushEnabled },
              { icon: Moon, label: t('settings.darkMode'), value: theme === 'dark', onChange: toggleTheme },
            ].map((item) => (
              <div key={item.label} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <item.icon className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                  </div>
                  <button
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
