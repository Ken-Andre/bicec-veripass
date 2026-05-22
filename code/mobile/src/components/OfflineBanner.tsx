import { useEffect, useState, useRef } from 'react';
import { WifiOff, Wifi, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnectivity } from '../hooks/useConnectivity';

export const OfflineBanner = () => {
  const { t } = useLanguage();
  const { isOnline, isSyncing, pendingCount, needsReuploadCount, failedCount, syncNow } = useConnectivity();
  const [dismissed, setDismissed] = useState(false);
  const [justCameOnline, setJustCameOnline] = useState(false);
  const prevIsOnline = useRef(isOnline);
  const prevOnlineForDismiss = useRef(isOnline);

  // Detect transition from offline → online to show "back online" message briefly
  useEffect(() => {
    const cameOnline = isOnline && !prevIsOnline.current;
    prevIsOnline.current = isOnline;

    if (cameOnline && !dismissed) {
      setJustCameOnline(true);
      const hideTimer = window.setTimeout(() => setJustCameOnline(false), 4000);
      return () => clearTimeout(hideTimer);
    }
    if (!isOnline) {
      setJustCameOnline(false);
    }
  }, [isOnline, dismissed]);

  // Reset dismissed state only when a new offline event happens.
  useEffect(() => {
    const wentOffline = !isOnline && prevOnlineForDismiss.current;
    prevOnlineForDismiss.current = isOnline;
    if (wentOffline && dismissed) {
      setDismissed(false);
    }
  }, [isOnline, dismissed]);

  const hasIssues = needsReuploadCount > 0 || failedCount > 0;
  const hasPending = pendingCount > 0;

  // Don't render if dismissed or online with no pending items and no issues
  if (dismissed) return null;
  if (isOnline && !hasPending && !hasIssues && !justCameOnline) return null;

  // Online with pending items — show sync progress
  if (isOnline && (hasPending || hasIssues || justCameOnline)) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white px-4 py-2.5 flex items-center justify-between gap-2 text-sm font-medium safe-top shadow-md">
        <div className="flex items-center gap-2 min-w-0">
          {isSyncing ? (
            <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
          ) : justCameOnline ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : hasIssues ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <Wifi className="w-4 h-4 shrink-0" />
          )}
          <span className="truncate">
            {isSyncing
              ? 'Synchronisation en cours...'
              : justCameOnline
                ? 'Connexion rétablie'
                : hasIssues
                  ? `${needsReuploadCount + failedCount} élément(s) nécessitent une action`
                  : `${pendingCount} élément(s) en attente de synchronisation`}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasIssues && !isSyncing && (
            <button
              onClick={() => void syncNow()}
              className="px-2 py-1 rounded bg-white/20 hover:bg-white/30 text-xs font-medium flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Réessayer
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="px-1.5 py-0.5 rounded hover:bg-white/20"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  // Offline — show offline banner
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between gap-2 text-sm font-medium safe-top shadow-md">
      <div className="flex items-center gap-2 min-w-0">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span className="truncate">
          {hasPending
            ? `Hors ligne — ${pendingCount} élément(s) seront synchronisés au retour de la connexion`
            : t('offline.banner') || 'Hors ligne — les données seront sauvegardées localement'}
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="px-1.5 py-0.5 rounded hover:bg-white/20 shrink-0"
        aria-label="Fermer"
      >
        ✕
      </button>
    </div>
  );
};
