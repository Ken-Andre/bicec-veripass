import React from 'react';
import { cn } from '../../lib/utils';
import { AppBar } from './AppBar';

export interface ScreenLayoutV2Props {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  footer?: React.ReactNode;
  center?: boolean;
  showNav?: boolean;
  className?: string;
  contentClassName?: string;
  transparentHeader?: boolean;
}

export const ScreenLayoutV2: React.FC<ScreenLayoutV2Props> = ({
  children,
  title,
  showBack = false,
  onBack,
  rightAction,
  footer,
  center = false,
  showNav = false,
  className,
  contentClassName,
  transparentHeader = false,
}) => {
  return (
    <div className={cn('min-h-screen bg-background flex flex-col relative', className)}>
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 opacity-60 overflow-hidden">
        <div className="absolute -top-28 -right-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* App Bar */}
      {(title || showBack) && (
        <AppBar
          title={title}
          showBack={showBack}
          onBack={onBack}
          rightAction={rightAction}
          transparent={transparentHeader}
        />
      )}

      {/* Scrollable content */}
      <main
        className={cn(
          'flex-1 flex flex-col px-6 py-8 safe-bottom relative z-10 overflow-y-auto',
          center && 'items-center justify-center text-center',
          showNav && 'pb-24',
          contentClassName
        )}
      >
        <div className={cn('w-full max-w-md mx-auto flex flex-col', center && 'justify-center items-center')}>
          {children}
        </div>
      </main>

      {/* Sticky footer (CTA zone) */}
      {footer && (
        <div className="shrink-0 z-20 safe-bottom bg-background/90 backdrop-blur-sm border-t border-border/50">
          <div className="max-w-md mx-auto px-6 py-4">
            {footer}
          </div>
        </div>
      )}
    </div>
  );
};
