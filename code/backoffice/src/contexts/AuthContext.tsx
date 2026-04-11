import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

interface User {
  id: string
  email: string
  name: string
  role: 'JEAN' | 'THOMAS' | 'SYLVIE' | 'ADMIN_IT'
  agencyId?: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  getAuthHeader: () => Record<string, string>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_BASE = '/api/v1'
const TOKEN_KEY = 'veripass_access_token'
const REFRESH_KEY = 'veripass_refresh_token'
const USER_KEY = 'veripass_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY)
      const token = localStorage.getItem(TOKEN_KEY)
      if (stored && token) {
        return { user: JSON.parse(stored), isAuthenticated: true, isLoading: false }
      }
    } catch {
      // ignore parse errors
    }
    return { user: null, isAuthenticated: false, isLoading: false }
  })

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true }))
    try {
      const res = await fetch(`${API_BASE}/auth/agent/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        setState(prev => ({ ...prev, isLoading: false }))
        return false
      }

      const data = await res.json()
      const { access_token, refresh_token } = data

      // Fetch agent profile (authoritative source, no client-side JWT parsing)
      const meRes = await fetch(`${API_BASE}/auth/agent/me`, {
        headers: { Authorization: `Bearer ${access_token}` },
      })
      
      if (!meRes.ok) {
        setState(prev => ({ ...prev, isLoading: false }))
        return false
      }
      
      const agentData = await meRes.json()

      const user: User = {
        id: agentData.id,
        email: agentData.email,
        name: agentData.name,
        role: agentData.role,
        agencyId: agentData.agency_id,
      }

      localStorage.setItem(TOKEN_KEY, access_token)
      localStorage.setItem(REFRESH_KEY, refresh_token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))

      setState({ user, isAuthenticated: true, isLoading: false })
      return true
    } catch {
      setState(prev => ({ ...prev, isLoading: false }))
      return false
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
    setState({ user: null, isAuthenticated: false, isLoading: false })
  }, [])

  const getAuthHeader = useCallback((): Record<string, string> => {
    const token = localStorage.getItem(TOKEN_KEY)
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  // Intercept 401s globally — redirect to login
  useEffect(() => {
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const response = await originalFetch(...args)
      if (response.status === 401) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
        // Only redirect if it's an API call (not the login endpoint itself)
        if (url.includes(API_BASE) && !url.includes('/auth/agent/login')) {
          logout()
          window.location.href = '/login'
        }
      }
      return response
    }
    return () => { window.fetch = originalFetch }
  }, [logout])

  return (
    <AuthContext.Provider value={{ ...state, login, logout, getAuthHeader }}>
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

export type { User, AuthState }
