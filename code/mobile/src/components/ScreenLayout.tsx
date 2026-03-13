import type { ReactNode } from 'react';
import { OfflineBanner } from './OfflineBanner';
import { cn } from '../lib/utils';
import { useTheme } from '../hooks/use-theme';

interface ScreenLayoutProps {
  children: ReactNode;
  className?: string;
}

export function ScreenLayout({ children, className }: ScreenLayoutProps) {
  useTheme();
  
  return (
    <div className={cn("min-h-[100dvh] flex flex-col bg-background text-foreground transition-colors", className)}>
      <OfflineBanner />
      <main className="flex-1 flex flex-col w-full max-w-md mx-auto relative pt-safe-top pb-safe-bottom">
        {children}
      </main>
    </div>
  );
}
