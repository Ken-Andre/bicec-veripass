import { Loader2 } from 'lucide-react';

export function PageLoader() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--app-viewport-bg)]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
