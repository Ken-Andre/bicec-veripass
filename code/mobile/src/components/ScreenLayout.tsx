import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';

interface ScreenLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  showNav?: boolean;
  center?: boolean;
  className?: string;
}

export const ScreenLayout: React.FC<ScreenLayoutProps> = ({
  children,
  title,
  showBack = false,
  onBack,
  showNav = false,
  center = false,
  className,
}) => {
  const navigate = useNavigate();

  return (
    <div className={cn('min-h-screen bg-background flex flex-col relative overflow-hidden', className)}>
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-28 -right-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      </div>
      {(title || showBack) && (
        <header className="sticky top-0 z-30 glass-strong safe-top border-b border-white/40">
          <div className="flex items-center gap-3 h-16 px-4">
            {showBack && (
              <button
                onClick={onBack ?? (() => navigate(-1))}
                className="p-2 -ml-2 rounded-full hover:bg-muted active:bg-slate-200 transition-colors"
                aria-label="Retour"
              >
                <ArrowLeft className="w-6 h-6 text-foreground" />
              </button>
            )}
            {title && (
              <h1 className="text-xl font-bold tracking-tight truncate flex-1">{title}</h1>
            )}
          </div>
        </header>
      )}
      <main
        className={cn(
          'flex-1 flex flex-col px-6 py-8 safe-bottom relative z-10',
          center && 'items-center justify-center text-center',
          showNav && 'pb-24'
        )}
      >
        <div className={cn('w-full max-w-md mx-auto flex flex-col flex-1', center && 'justify-center items-center')}>
          {children}
        </div>
      </main>
    </div>
  );
};
