import React, { createContext, useContext, useState, useCallback } from 'react'
import type { User, AuthState } from '../types'

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

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
<path>code/backoffice/src/App.tsx</path>
<content>import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import MainLayout from './components/layout/MainLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ValidationDeskPage from './pages/validation/ValidationDeskPage'
import CompliancePage from './pages/compliance/CompliancePage'
import AdminPage from './pages/admin/AdminPage'
import AnalyticsPage from './pages/analytics/AnalyticsPage'
import CommandCenterPage from './pages/command-center/CommandCenterPage'
import NotFoundPage from './pages/NotFoundPage'

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        
        <Route
          path="validation"
          element={
            <ProtectedRoute allowedRoles={['JEAN']}>
              <ValidationDeskPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="compliance"
          element={
            <ProtectedRoute allowedRoles={['THOMAS']}>
              <CompliancePage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="command-center"
          element={
            <ProtectedRoute allowedRoles={['SYLVIE']}>
              <CommandCenterPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="analytics"
          element={
            <ProtectedRoute allowedRoles={['SYLVIE', 'THOMAS']}>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="admin"
          element={
            <ProtectedRoute allowedRoles={['ADMIN_IT']}>
              <AdminPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App