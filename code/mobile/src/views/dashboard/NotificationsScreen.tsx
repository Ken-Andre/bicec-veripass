import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { useMarkNotificationsRead, useNotificationsQuery } from '../../hooks/useNotificationUnreadCount';
import { Bell, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Notification, NotificationType } from '../../types';

const typeIcons: Partial<Record<NotificationType, typeof Bell>> = {
  DOSSIER_APPROVED: CheckCircle,
  DOSSIER_REJECTED: AlertTriangle,
  INFO_REQUESTED: Info,
  GENERAL: Bell,
};

const typeColors: Partial<Record<NotificationType, string>> = {
  DOSSIER_APPROVED: 'bg-emerald-100 text-emerald-600',
  DOSSIER_REJECTED: 'bg-red-100 text-red-600',
  INFO_REQUESTED: 'bg-amber-100 text-amber-600',
  GENERAL: 'bg-blue-100 text-blue-600',
};

export function NotificationsScreen() {
  const { t } = useLanguage();
  const query = useNotificationsQuery();
  const markAllRead = useMarkNotificationsRead();
  const loading = query.isLoading;
  const notifications: Notification[] = query.data?.items ?? [];
  const unreadCount = query.data?.unread_count ?? 0;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <ScreenLayoutV2 showBack title={t('notifications.title')}>
      <div className="space-y-3 pt-2">
        {!loading && unreadCount > 0 && (
          <button
            type="button"
            onClick={async () => {
              try {
                await markAllRead();
            } catch (err) {
              console.warn('[notifications] mark-all-read failed', err);
            }
            }}
            className="w-full rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary"
          >
            Tout marquer comme lu ({unreadCount})
          </button>
        )}

        {loading && (
          <div className="space-y-2 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-2xl" />)}
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">{t('notifications.empty') || 'Aucune notification pour le moment'}</p>
          </div>
        )}

        {notifications.map((n) => {
          const Icon = typeIcons[n.type] || Bell;
          const colorClass = typeColors[n.type] || 'bg-muted text-muted-foreground';
          return (
            <div key={n.id} className={cn('bg-card border rounded-2xl p-4 active:scale-[0.98] transition-all', n.read ? 'border-border' : 'border-primary/20')}>
              <div className="flex items-start gap-3">
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', colorClass)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-2">{formatDate(n.created_at)}</p>
                </div>
                {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />}
              </div>
            </div>
          );
        })}
      </div>
    </ScreenLayoutV2>
  );
}
