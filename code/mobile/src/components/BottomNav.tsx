import { cn } from '../lib/utils';
import { Home, MapPin, MessageCircle, MoreHorizontal, LayoutGrid } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { icon: Home, label: 'Dossier', path: '/dashboard' },
    { icon: LayoutGrid, label: 'Produits', path: '/products' },
    { icon: MapPin, label: 'GAB', path: '/cards/atm-finder' },
    { icon: MessageCircle, label: 'Support', path: '/support' },
    { icon: MoreHorizontal, label: 'Plus', path: '/more' },
  ];

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 rounded-[1.75rem] border border-white/55 bg-white/72 shadow-[0_-10px_34px_rgba(18,53,91,0.14)] backdrop-blur-2xl">
      <div className="grid min-h-16 grid-cols-5 items-center gap-1 px-2 pt-1 pb-safe">
        {items.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path || location.pathname.startsWith(path + '/');
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                'flex h-12 flex-col items-center justify-center gap-1 rounded-2xl transition-all',
                active ? 'bg-primary/12 text-primary shadow-sm' : 'text-muted-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
