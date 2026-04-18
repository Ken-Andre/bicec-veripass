import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, Wifi } from 'lucide-react';
import { getKycSyncSummary, getResumeTargetPath, runKycSyncNow } from '../services/kycSyncService';

export function KycResumeBanner() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [needsReupload, setNeedsReupload] = useState(false);

  const showMessage = useMemo(() => {
    if (needsReupload) {
      return 'Une capture doit etre reimportee pour finaliser la verification.';
    }
    if (pendingCount > 0) {
      return `Reprise de verification disponible (${pendingCount} element(s) en attente de sync).`;
    }
    return 'Reprise de verification disponible.';
  }, [needsReupload, pendingCount]);

  useEffect(() => {
    let mounted = true;
    let timer: number | null = null;

    const refresh = async () => {
      const online = typeof navigator === 'undefined' ? true : navigator.onLine;
      if (online) {
        await runKycSyncNow();
      }
      const [summary, path] = await Promise.all([getKycSyncSummary(), getResumeTargetPath()]);
      if (!mounted) return;
      setTargetPath(path);
      setPendingCount(summary.pendingCount);
      setNeedsReupload(summary.needsReuploadCount > 0);
      const shouldShow = Boolean(path) && (summary.hasResumeData || summary.pendingCount > 0 || summary.needsReuploadCount > 0);
      setVisible(online && shouldShow);
    };

    const onOnline = () => {
      if (timer) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        void refresh();
      }, 300);
    };

    const onOffline = () => setVisible(false);

    void refresh();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      mounted = false;
      if (timer) {
        window.clearTimeout(timer);
      }
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!visible || !targetPath) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between gap-3 text-sm font-medium safe-top shadow-lg">
      <div className="flex items-center gap-2">
        <Wifi className="w-4 h-4" />
        <span>{showMessage}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setVisible(false)}
          className="px-2 py-1 rounded bg-primary-foreground/20 hover:bg-primary-foreground/30"
        >
          Ignorer
        </button>
        <button
          onClick={() => navigate(targetPath)}
          className="px-2 py-1 rounded bg-primary-foreground text-primary hover:opacity-90 flex items-center gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reprendre
        </button>
      </div>
    </div>
  );
}
