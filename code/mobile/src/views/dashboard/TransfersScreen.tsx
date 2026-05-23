import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ArrowDownLeft, Calendar } from 'lucide-react';

export function TransfersScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const items = [
    { icon: ArrowUpRight, label: t('transfer.send.title'), desc: t('transfer.send.desc'), path: '/transfers/send' },
    { icon: ArrowDownLeft, label: t('receive.title'), desc: t('receive.desc'), path: '/transfers/receive' },
    { icon: Calendar, label: t('transfer.recurring'), desc: t('transfer.recurringDesc'), path: '#' },
  ];

  return (
    <ScreenLayoutV2 title={t('nav.transfers')}>
      <div className="space-y-4 pt-2">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => item.path !== '#' && navigate(item.path)}
            className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-4 active:scale-95 transition-all text-left"
          >
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <item.icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </ScreenLayoutV2>
  );
}
