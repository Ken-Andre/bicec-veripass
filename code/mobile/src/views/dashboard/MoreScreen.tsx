import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { useNavigate } from 'react-router-dom';
import { Settings, Bell, HelpCircle, MessageCircle, CreditCard, History, PiggyBank, ChevronRight, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';
import { Button } from '../../components/ui/button';

export function MoreScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [showLogout, setShowLogout] = useState(false);

  const sections = [
    {
      title: t('more.services'),
      items: [
        { icon: CreditCard, label: t('nav.cards'), path: '/cards' },
        { icon: PiggyBank, label: t('savings.title'), path: '/savings' },
        { icon: History, label: t('transactions.title'), path: '/transactions' },
      ],
    },
    {
      title: t('more.settings'),
      items: [
        { icon: Settings, label: t('settings.title'), path: '/settings' },
        { icon: Bell, label: t('notifications.title'), path: '/notifications' },
        { icon: HelpCircle, label: t('help.title'), path: '/help' },
        { icon: MessageCircle, label: t('support.title'), path: '/support' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <ScreenLayoutV2 title={t('more.title')}>
        <div className="space-y-6 pt-2">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{section.title}</h3>
              <div className="bg-card border border-border rounded-2xl divide-y divide-border/50 overflow-hidden">
                {section.items.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className="w-full flex items-center gap-4 px-4 py-4 hover:bg-muted/50 active:bg-muted transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={() => setShowLogout(true)}
            className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition-all"
          >
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <LogOut className="h-5 w-5 text-destructive" />
            </div>
            <span className="text-sm font-medium text-destructive">{t('more.logout')}</span>
          </button>
        </div>
      </ScreenLayoutV2>

      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogout(false)} />
          <div className="relative bg-background rounded-t-[2rem] sm:rounded-[2.5rem] w-full sm:max-w-sm p-8 pb-12 shadow-2xl">
            <h3 className="text-xl font-bold text-foreground text-center mb-4">{t('more.confirmLogout')}</h3>
            <div className="space-y-3">
              <Button variant="danger" onClick={() => { logout(); navigate('/', { replace: true }); }}>
                {t('more.confirm')}
              </Button>
              <Button variant="ghost" onClick={() => setShowLogout(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
