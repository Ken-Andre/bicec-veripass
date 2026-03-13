import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <Header />
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
</content>
<write_to_file>
<path>code/backoffice/src/components/layout/Sidebar.tsx</path>
<content>import { NavLink } from 'react-router-dom'
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

export default function Sidebar() {
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const filteredNavigation = navigation.filter(item => 
    user && item.roles.includes(user.role)
  )

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
              {filteredNavigation.map(item => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
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
          {filteredNavigation.map(item => (
            <NavLink
              key={item.name}
              to={item.href}
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
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </>
  )
}
</content>
<write_to_file>
<path>code/backoffice/src/components/layout/Header.tsx</path>
<content>import { useAuth } from '../../contexts/AuthContext'
import { Bell, User } from 'lucide-react'

export default function Header() {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-gray-900 lg:hidden">BICEC VeriPass</h1>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative rounded-full p-2 text-gray-400 hover:text-gray-500">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200">
            <User className="h-5 w-5 text-gray-600" />
          </div>
          <span className="hidden text-sm font-medium text-gray-700 sm:block">
            {user?.name}
          </span>
        </div>
      </div>
    </header>
  )
}
</content>
<write_to_file>
<path>code/backoffice/src/components/ui/Button.tsx</path>
<content>import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'danger'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
          {
            'bg-blue-600 text-white hover:bg-blue-700': variant === 'default',
            'border border-gray-300 bg-white hover:bg-gray-50': variant === 'outline',
            'bg-gray-100 text-gray-900 hover:bg-gray-200': variant === 'secondary',
            'hover:bg-gray-100': variant === 'ghost',
            'text-blue-600 underline-offset-4 hover:underline': variant === 'link',
            'bg-red-600 text-white hover:bg-red-700': variant === 'danger',
          },
          {
            'h-10 px-4 py-2': size === 'default',
            'h-9 rounded-md px-3': size === 'sm',
            'h-11 rounded-md px-8': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
</content>
<write_to_file>
<path>code/backoffice/src/components/ui/Badge.tsx</path>
<content>import { cn } from '../../lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        {
          'bg-blue-100 text-blue-800': variant === 'default',
          'bg-gray-100 text-gray-800': variant === 'secondary',
          'bg-green-100 text-green-800': variant === 'success',
          'bg-yellow-100 text-yellow-800': variant === 'warning',
          'bg-red-100 text-red-800': variant === 'danger',
        },
        className
      )}
      {...props}
    />
  )
}
</content>
<write_to_file>
<path>code/backoffice/src/components/ui/Input.tsx</path>
<content>import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }