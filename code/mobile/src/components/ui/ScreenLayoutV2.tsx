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
    <div className={cn('min-h-[100dvh] bg-background flex flex-col relative overflow-x-hidden', className)}>
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
          'flex-1 flex flex-col px-6 py-6 relative z-10 overflow-y-auto',
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
        <div className="shrink-0 z-20 bg-background/95 backdrop-blur-xl border-t border-border/50">
          <div className="max-w-md mx-auto px-6 pt-3 pb-safe">
            {footer}
          </div>
        </div>
      )}
    </div>
  );
};
