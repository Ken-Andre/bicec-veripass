import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { mockNotifications } from '../../services/mockData';
import { Bell, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { NotificationType } from '../../types';

const typeIcons: Record<NotificationType, typeof Bell> = {
  DOSSIER_APPROVED: CheckCircle,
  DOSSIER_REJECTED: AlertTriangle,
  INFO_REQUESTED: Info,
  GENERAL: Bell,
};

const typeColors: Record<NotificationType, string> = {
  DOSSIER_APPROVED: 'bg-emerald-100 text-emerald-600',
  DOSSIER_REJECTED: 'bg-red-100 text-red-600',
  INFO_REQUESTED: 'bg-amber-100 text-amber-600',
  GENERAL: 'bg-blue-100 text-blue-600',
};

export function NotificationsScreen() {
  const { t } = useLanguage();
  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <ScreenLayout showBack title={t('notifications.title')}>
      <div className="space-y-3 pt-2">
        {mockNotifications.map((n) => {
          const Icon = typeIcons[n.type] || Bell;
          const colorClass = typeColors[n.type] || 'bg-slate-100 text-slate-500';
          return (
            <div key={n.id} className={cn('bg-white border rounded-2xl p-4 active:scale-[0.98] transition-all', n.read ? 'border-slate-100' : 'border-primary/20')}>
              <div className="flex items-start gap-3">
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', colorClass)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{n.message}</p>
                  <p className="text-[10px] text-slate-300 mt-2">{formatDate(n.created_at)}</p>
                </div>
                {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />}
              </div>
            </div>
          );
        })}
      </div>
    </ScreenLayout>
  );
}
