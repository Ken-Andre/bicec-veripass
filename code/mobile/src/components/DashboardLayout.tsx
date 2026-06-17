import React from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { cn } from '../lib/utils';

/**
 * DashboardLayout — Global layout for all authenticated banking screens.
 * Provides the BottomNav and handles safe-area insets.
 * Scroll is internal to <main> to keep BottomNav fixed and avoid body scroll.
 */
export const DashboardLayout: React.FC = () => {
  const location = useLocation();

  // Routes that should NOT show the BottomNav (e.g. sub-flows)
  const hiddenNavPaths = ['/transfers/send', '/transfers/receive', '/settings/delete-account', '/support'];
  const showNav = !hiddenNavPaths.some((p) => location.pathname.startsWith(p));

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background">
      <main className={cn('flex-1 overflow-y-auto', showNav && 'pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))]')}>
        <Outlet />
      </main>
      {showNav && <BottomNav />}
    </div>
  );
};
