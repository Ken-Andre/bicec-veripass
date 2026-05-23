import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  message?: string;
  variant?: 'spinner' | 'skeleton';
  centered?: boolean;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message,
  variant = 'spinner',
  centered = true,
  className,
}) => {
  if (variant === 'skeleton') {
    return (
      <div className={cn('flex flex-col gap-4 animate-pulse', centered && 'items-center', className)}>
        <div className="h-4 w-3/4 bg-muted rounded" />
        <div className="h-4 w-1/2 bg-muted rounded" />
        <div className="h-4 w-2/3 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3',
        centered && 'justify-center',
        className
      )}
    >
      <Loader2 className="w-8 h-8 text-primary animate-spin" aria-hidden="true" />
      {message && (
        <p className="text-sm text-muted-foreground font-medium text-center">{message}</p>
      )}
    </div>
  );
};
