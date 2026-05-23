import { useState, useEffect, useCallback, useRef } from 'react';
import { runKycSyncNow, getKycSyncSummary, type QueueSummary } from '../services/kycSyncService';

export interface ConnectivityState {
  /** Whether the browser reports being online */
  isOnline: boolean;
  /** Whether a sync operation is currently in progress */
  isSyncing: boolean;
  /** Number of pending items in the offline queue */
  pendingCount: number;
  /** Number of items that need re-upload */
  needsReuploadCount: number;
  /** Number of failed items */
  failedCount: number;
  /** ISO timestamp of the last successful sync, or null */
  lastSyncAt: string | null;
  /** Manually trigger a sync */
  syncNow: () => Promise<void>;
}

const LAST_SYNC_KEY = 'vp_last_sync_at';

export function useConnectivity(): ConnectivityState {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [summary, setSummary] = useState<QueueSummary>({
    pendingCount: 0,
    needsReuploadCount: 0,
    failedCount: 0,
    hasResumeData: false,
  });
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() =>
    localStorage.getItem(LAST_SYNC_KEY),
  );

  const mountedRef = useRef(true);

  const refreshSummary = useCallback(async () => {
    try {
      const s = await getKycSyncSummary();
      if (mountedRef.current) {
        setSummary(s);
      }
    } catch {
      // ignore
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await runKycSyncNow();
      const now = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, now);
      if (mountedRef.current) {
        setLastSyncAt(now);
      }
      await refreshSummary();
    } catch {
      // ignore
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [isSyncing, refreshSummary]);

  // Listen for online/offline events
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      void syncNow();
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [syncNow]);

  // Refresh summary periodically and on mount
  useEffect(() => {
    mountedRef.current = true;
    const initialRefresh = window.setTimeout(() => {
      void refreshSummary();
    }, 0);

    const interval = window.setInterval(() => {
      void refreshSummary();
    }, 30_000); // refresh every 30s

    return () => {
      mountedRef.current = false;
      clearTimeout(initialRefresh);
      clearInterval(interval);
    };
  }, [refreshSummary]);

  return {
    isOnline,
    isSyncing,
    pendingCount: summary.pendingCount,
    needsReuploadCount: summary.needsReuploadCount,
    failedCount: summary.failedCount,
    lastSyncAt,
    syncNow,
  };
}
