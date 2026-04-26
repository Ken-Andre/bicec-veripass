import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
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
    <div className="fixed top-16 left-4 right-4 z-[100] bg-white border border-slate-200 text-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl shadow-xl animate-in slide-in-from-top-5 fade-in duration-300">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-blue-50 text-primary-bicec-blue rounded-full flex items-center justify-center flex-shrink-0 border border-blue-100">
          <RotateCcw className="w-5 h-5" />
        </div>
        <div className="flex flex-col gap-0.5 max-w-[calc(100%-3.5rem)]">
          <span className="font-extrabold text-[#111827]">Reprise d'activité</span>
          <span className="text-xs text-slate-500 font-medium leading-tight line-clamp-2">
            {showMessage}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setVisible(false)}
          className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold transition-all text-xs"
        >
          Ignorer
        </button>
        <button
          onClick={() => navigate(targetPath)}
          className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-primary-bicec-red text-white hover:bg-red-700 font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 text-xs"
        >
          Continuer
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
