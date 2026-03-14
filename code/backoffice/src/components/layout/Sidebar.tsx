import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import {
  LayoutDashboard,
  FileCheck,
  Shield,
  BarChart3,
  Command,
  Settings,
  LogOut,
  X,
  Menu,
} from 'lucide-react'
import { useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['JEAN', 'THOMAS', 'SYLVIE', 'ADMIN_IT'] },
  { name: 'Validation KYC', href: '/validation', icon: FileCheck, roles: ['JEAN'] },
  { name: 'Conformité AML', href: '/compliance', icon: Shield, roles: ['THOMAS'] },
  { name: 'Command Center', href: '/command-center', icon: Command, roles: ['SYLVIE'] },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['SYLVIE', 'THOMAS'] },
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
              'group flex items-center rounded-md px-3 py-2 text-sm font-medium',
              isActive
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
          <div className="fixed inset-0 bg-gray-600/75" onClick={() => setMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
            <div className="flex h-16 items-center justify-between px-4">
              <span className="text-lg font-semibold">BICEC VeriPass</span>
              <button onClick={() => setMobileOpen(false)}>
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 px-2 py-4">
              <NavigationLinks onClick={() => setMobileOpen(false)} />
            </nav>
            <div className="border-t p-4">
              <div className="mb-2 text-sm">
                <p className="font-medium">{user?.name}</p>
                <p className="text-gray-500">{user?.role}</p>
              </div>
              <button
                onClick={logout}
                className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                <LogOut className="mr-3 h-5 w-5" />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-lg font-semibold">BICEC VeriPass</span>
        </div>
        <nav className="flex-1 space-y-1 bg-white px-2 py-4">
          <NavigationLinks />
        </nav>
        <div className="border-t bg-white p-4">
          <div className="mb-2 text-sm">
            <p className="font-medium">{user?.name}</p>
            <p className="text-gray-500">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Déconnexion
          </button>
        </div>
      </div>

      <div className="lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-4 right-4 z-50 rounded-full bg-blue-600 p-3 text-white shadow-lg"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>
    </>
  )
}