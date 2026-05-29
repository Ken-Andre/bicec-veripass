import { cn } from '../lib/utils';
import { Home, CreditCard, ArrowLeftRight, MoreHorizontal } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';

export const BottomNav = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { icon: Home, label: t('nav.home'), path: '/dashboard' },
    { icon: CreditCard, label: t('nav.cards'), path: '/cards' },
    { icon: ArrowLeftRight, label: t('nav.transfers'), path: '/transfers' },
    { icon: MoreHorizontal, label: t('nav.more'), path: '/more' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 bg-background/96 backdrop-blur-xl shadow-[0_-4px_18px_rgba(0,0,0,0.06)]">
      <div className="flex min-h-14 items-center justify-around px-2 pt-1 pb-safe">
        {items.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path || location.pathname.startsWith(path + '/');
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 w-full h-full transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
