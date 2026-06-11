import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import {
  FileCheck,
  Shield,
  BarChart3,
  Command,
  Settings,
  FileText,
  ScrollText,
  ListChecks,
  LogOut,
  X,
  Menu,
} from 'lucide-react'
import { useState } from 'react'

const navigation = [
  { name: 'Validation KYC', href: '/validation', icon: FileCheck, roles: ['JEAN'] },
  { name: 'Conformité AML', href: '/compliance', icon: Shield, roles: ['THOMAS'] },
  { name: 'Listes AML', href: '/compliance/lists', icon: ListChecks, roles: ['THOMAS', 'ADMIN_IT'] },
  { name: 'Centre de pilotage', href: '/command-center', icon: Command, roles: ['SYLVIE'] },
  { name: 'Tableaux de bord', href: '/analytics', icon: BarChart3, roles: ['SYLVIE', 'THOMAS', 'ADMIN_IT'] },
  { name: 'Journal audit', href: '/admin/audit', icon: ScrollText, roles: ['SYLVIE', 'ADMIN_IT'] },
  { name: 'Documents légaux', href: '/admin/legal', icon: FileText, roles: ['ADMIN_IT'] },
  { name: 'Administration', href: '/admin', icon: Settings, roles: ['ADMIN_IT'] },
]

function NavigationLinks({ onClick }: { onClick?: () => void }) {
  const { user } = useAuth()
  const filteredNavigation = navigation.filter(item => 
    user && item.roles.includes(user.role)
  )

  return (
    <>
      {filteredNavigation.map(item => (
        <NavLink
          key={item.name}
          to={item.href}
          onClick={onClick}
          className={({ isActive }) =>
            cn(
              'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                : 'text-sidebar-foreground/85 hover:bg-white/10 hover:text-sidebar-foreground'
            )
          }
        >
          <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
          {item.name}
        </NavLink>
      ))}
    </>
  )
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-bicec-brun/75" onClick={() => setMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-sidebar text-sidebar-foreground">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <span className="text-lg font-semibold">BICEC VeriPass</span>
              <button aria-label="Fermer le menu" onClick={() => setMobileOpen(false)}>
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 px-2 py-4">
              <NavigationLinks onClick={() => setMobileOpen(false)} />
            </nav>
            <div className="border-t border-white/10 p-4">
              <div className="mb-2 text-sm">
                <p className="font-medium">{user?.name}</p>
                <p className="text-sidebar-muted">{user?.role}</p>
              </div>
              <button
                onClick={logout}
                className="flex w-full items-center rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-white/10 hover:text-sidebar-foreground"
              >
                <LogOut className="mr-3 h-5 w-5" />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex h-16 items-center border-b border-white/10 bg-sidebar px-6 text-sidebar-foreground">
          <span className="text-lg font-semibold">BICEC VeriPass</span>
        </div>
        <nav className="flex-1 space-y-1 bg-sidebar px-2 py-4">
          <NavigationLinks />
        </nav>
        <div className="border-t border-white/10 bg-sidebar p-4 text-sidebar-foreground">
          <div className="mb-2 text-sm">
            <p className="font-medium">{user?.name}</p>
            <p className="text-sidebar-muted">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-white/10 hover:text-sidebar-foreground"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Déconnexion
          </button>
        </div>
      </div>

      <div className="lg:hidden">
        <button
          aria-label="Ouvrir le menu"
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-4 right-4 z-50 rounded-full bg-primary p-3 text-primary-foreground shadow-lg"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>
    </>
  )
}
