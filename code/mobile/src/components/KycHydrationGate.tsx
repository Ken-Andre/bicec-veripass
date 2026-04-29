import { useKyc } from '../contexts/KycContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Loader2, ShieldCheck } from 'lucide-react';

export function KycHydrationGate({ children }: { children: React.ReactNode }) {
  const { hydrated } = useKyc();
  const { t } = useLanguage();

  if (hydrated) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="rounded-3xl p-8 max-w-sm w-full text-center space-y-4 bg-white/80 backdrop-blur-xl border border-white/40 shadow-xl">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <ShieldCheck className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-base font-semibold text-foreground">
          {t('kyc.hydration.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('kyc.hydration.subtitle')}
        </p>
        <div className="flex items-center justify-center pt-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      </div>
    </div>
  );
}
