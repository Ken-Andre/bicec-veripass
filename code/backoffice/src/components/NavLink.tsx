import { NavLink as RouterNavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export function NavLink({ to, icon: Icon, children }: { to: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <RouterNavLink to={to} className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100', isActive && 'bg-slate-100 font-medium')}>
      <Icon className="h-4 w-4" />
      {children}
    </RouterNavLink>
  )
}