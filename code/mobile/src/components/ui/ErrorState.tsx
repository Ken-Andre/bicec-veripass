import React from 'react';
import { cn } from '../../lib/utils';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Une erreur est survenue',
  message = 'Veuillez réessayer dans un instant.',
  onRetry,
  icon,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 text-center p-6',
        className
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
        {icon ?? <AlertTriangle className="w-8 h-8 text-destructive" />}
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-md shadow-primary/20 active:scale-[0.98] transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          Réessayer
        </button>
      )}
    </div>
  );
};
