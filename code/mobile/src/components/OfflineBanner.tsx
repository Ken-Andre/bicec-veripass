import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const OfflineBanner = () => {
  const { t } = useLanguage();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-warning text-warning-foreground px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium safe-top">
      <WifiOff className="w-4 h-4" />
      <span>{t('offline.banner')}</span>
    </div>
  );
};