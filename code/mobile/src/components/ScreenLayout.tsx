import type { ReactNode } from 'react';
import { OfflineBanner } from './OfflineBanner';
import { cn } from '../lib/utils';
import { useTheme } from '../hooks/use-theme';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ScreenLayoutProps {
  children: ReactNode;
  className?: string;
  showBack?: boolean;
  title?: string;
}

export function ScreenLayout({ children, className, showBack, title }: ScreenLayoutProps) {
  useTheme();
  const navigate = useNavigate();
  
  return (
    <div className={cn("min-h-[100dvh] flex flex-col bg-background text-foreground transition-colors", className)}>
      <OfflineBanner />
      <main className="flex-1 flex flex-col w-full max-w-md mx-auto relative">
        {(showBack || title) && (
          <header className="flex items-center px-6 py-4 pt-safe-top">
            {showBack && (
              <button 
                onClick={() => navigate(-1)}
                className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors mr-2"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            {title && <h1 className="text-xl font-bold tracking-tight">{title}</h1>}
          </header>
        )}
        <div className={cn("flex-1 flex flex-col", !showBack && !title && "pt-safe-top")}>
          {children}
        </div>
      </main>
    </div>
  );
}
