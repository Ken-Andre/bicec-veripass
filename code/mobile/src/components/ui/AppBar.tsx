import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface AppBarProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  transparent?: boolean;
  className?: string;
}

export const AppBar: React.FC<AppBarProps> = ({
  title,
  showBack = false,
  onBack,
  rightAction,
  transparent = false,
  className,
}) => {
  const navigate = useNavigate();

  return (
    <header
      className={cn(
        'sticky top-0 z-30 safe-top border-b backdrop-blur-xl',
        transparent
          ? 'bg-transparent border-transparent'
          : 'bg-background/92 border-border/60 shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-3 h-14 px-4">
        {showBack && (
          <button
            onClick={onBack ?? (() => navigate(-1))}
            className="p-2 -ml-2 rounded-full hover:bg-muted active:bg-slate-200 transition-colors shrink-0"
            aria-label="Retour"
          >
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
        )}
        {title && (
          <h1 className="text-xl font-bold tracking-tight leading-snug flex-1">
            {title}
          </h1>
        )}
        {rightAction && (
          <div className="shrink-0">{rightAction}</div>
        )}
      </div>
    </header>
  );
};
