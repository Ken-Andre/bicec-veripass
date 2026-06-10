import { useEffect, useState, useCallback } from 'react';
import { registerSW } from 'virtual:pwa-register';

interface ServiceWorkerState {
  /** True when a new SW version is waiting to activate */
  needsRefresh: boolean;
  /** True when the app shell is fully cached and ready for offline use */
  offlineReady: boolean;
  /** Call to activate the waiting SW and reload the page */
  updateSW: () => void;
  /** Dismiss the update/offline-ready banner */
  dismiss: () => void;
}

/**
 * Hook that wraps vite-plugin-pwa's registerSW and exposes SW lifecycle state.
 *
 * Usage:
 *   const { needsRefresh, offlineReady, updateSW, dismiss } = useServiceWorker();
 */
export function useServiceWorker(): ServiceWorkerState {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  // updateSW is the function returned by registerSW; calling it with true
  // forces the waiting SW to skipWaiting and reloads the page.
  const [updateFn, setUpdateFn] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    let reloading = false;
    const cleanups: Array<() => void> = [];
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        reloading = true;
        setNeedsRefresh(true);
        update(true).catch((err) => {
          console.warn('[SW] Update failed:', err);
        });
      },
      onOfflineReady() {
        setOfflineReady(true);
      },
      onRegistered(registration) {
        if (import.meta.env.DEV) {
          console.log('[SW] Registered:', registration);
        }
        if (registration) {
          const refresh = () => {
            if (navigator.onLine) {
              registration.update().catch((err) => {
                console.warn('[SW] Registration update failed:', err);
              });
            }
          };
          const interval = window.setInterval(refresh, 2 * 60 * 1000);
          const handleOnline = () => refresh();
          const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') refresh();
          };

          refresh();
          window.addEventListener('online', handleOnline);
          document.addEventListener('visibilitychange', handleVisibilityChange);

          cleanups.push(() => {
            window.clearInterval(interval);
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
          });
        }
      },
      onRegisterError(error) {
        console.error('[SW] Registration failed:', error);
      },
    });

    const handleControllerChange = () => {
      if (!reloading) return;
      window.location.reload();
    };

    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);

    setTimeout(() => {
      setUpdateFn(() => update);
    }, 0);

    return () => {
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  useEffect(() => {
    const handleUpdateAvailable = () => {
      setNeedsRefresh(true);
    };

    window.addEventListener('vp:service-worker-update-available', handleUpdateAvailable);
    return () => {
      window.removeEventListener('vp:service-worker-update-available', handleUpdateAvailable);
    };
  }, []);

  const updateSW = useCallback(() => {
    updateFn?.(true).catch((err) => {
      console.warn('[SW] updateSW failed:', err);
    });
  }, [updateFn]);

  const dismiss = useCallback(() => {
    setNeedsRefresh(false);
    setOfflineReady(false);
  }, []);

  return { needsRefresh, offlineReady, updateSW, dismiss };
}
