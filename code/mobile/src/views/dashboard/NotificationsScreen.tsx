import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { apiClient } from '../../services/apiClient';
import { Bell, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Notification, NotificationType } from '../../types';

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<Notification[]>('/kyc/notifications')
      .then(data => setNotifications(data || []))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <ScreenLayoutV2 showBack title={t('notifications.title')}>
      <div className="space-y-3 pt-2">
        {loading && (
          <div className="space-y-2 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-2xl" />)}
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <Bell className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>
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
