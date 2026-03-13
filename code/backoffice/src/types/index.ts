export type Role = 'JEAN' | 'THOMAS' | 'SYLVIE' | 'ADMIN_IT'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  agencyId?: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface Dossier {
  id: string
  sessionId: string
  clientName: string
  clientPhone: string
  status: 'PENDING_KYC' | 'PENDING_INFO' | 'COMPLIANCE_REVIEW' | 'READY_FOR_OPS' | 'REJECTED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  assignedAgent?: string
  submittedAt: string
  documents: Document[]
}

export interface Document {
  id: string
  type: 'CNI_RECTO' | 'CNI_VERSO' | 'BILL_ENEO' | 'SELFIE'
  filePath: string
  ocrFields: OCRField[]
  confidence: number
}

export interface OCRField {
  name: string
  value: string
  confidence: number
  humanCorrected: boolean
}

export interface AMLAlert {
  id: string
  sessionId: string
  pepSanctionsId: string
  matchScore: number
  status: 'OPEN' | 'CLEARED' | 'CONFIRMED'
  fullName: string
  dateOfBirth?: string
  source: string
}

export interface Agent {
  id: string
  name: string
  email: string
  role: Role
  agencyId: string
  isAvailable: boolean
  activeDossierCount: number
  staticWeight: number
}
</content>
<write_to_file>
<path>code/backoffice/src/contexts/AuthContext.tsx</parameter>
<content>import React, { createContext, useContext, useState, useCallback } from 'react'
import type { User, Role, AuthState } from '../types'

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Mock users for demo - in production, this would come from the API
const MOCK_USERS: Record<string, User> = {
  'jean@bicec.cm': {
    id: '1',
    email: 'jean@bicec.cm',
    name: 'Jean Dupont',
    role: 'JEAN',
    agencyId: 'agency-1',
  },
  'thomas@bicec.cm': {
    id: '2',
    email: 'thomas@bicec.cm',
    name: 'Thomas Martin',
    role: 'THOMAS',
    agencyId: 'agency-1',
  },
  'sylvie@bicec.cm': {
    id: '3',
    email: 'sylvie@bicec.cm',
    name: 'Sylvie Bernard',
    role: 'SYLVIE',
    agencyId: 'agency-1',
  },
  'admin@bicec.cm': {
    id: '4',
    email: 'admin@bicec.cm',
    name: 'Admin IT',
    role: 'ADMIN_IT',
  },
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  })

  const login = useCallback(async (email: string, _password: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true }))
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const user = MOCK_USERS[email.toLowerCase()]
    if (user) {
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
      })
      return true
    }
    
    setState(prev => ({ ...prev, isLoading: false }))
    return false
  }, [])

  const logout = useCallback(() => {
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
</content>
<write_to_file>
<path>code/backoffice/src/components/layout/MainLayout.tsx</path>
<content>import { Outlet } from 'react-router-dom'
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
      {/* Mobile sidebar */}
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

      {/* Desktop sidebar */}
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

      {/* Mobile menu button */}
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
<path>code/backoffice/src/components/auth/ProtectedRoute.tsx</path>
<content>import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import type { Role } from '../../types'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: Role[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}