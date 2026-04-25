import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { globalShowToast } from './ToastContext'

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
  sessionWarning: boolean
  retryRefresh: () => Promise<void>
  dismissWarning: () => void
  tokenExpiresAt: number
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_BASE = '/api/v1'
const TOKEN_KEY = 'veripass_access_token'
const REFRESH_KEY = 'veripass_refresh_token'
const USER_KEY = 'veripass_user'
const EXPIRES_KEY = 'veripass_token_expires_at'

// Refresh the access token 2 minutes before it actually expires
const REFRESH_BEFORE_EXPIRY_MS = 2 * 60 * 1000

function storeTokens(access_token: string, refresh_token: string, expires_in: number) {
  localStorage.setItem(TOKEN_KEY, access_token)
  localStorage.setItem(REFRESH_KEY, refresh_token)
  const expiresAt = Date.now() + expires_in * 1000
  localStorage.setItem(EXPIRES_KEY, String(expiresAt))
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(EXPIRES_KEY)
}

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

  // Guard against concurrent refresh attempts
  const refreshMutex = useRef<Promise<boolean> | null>(null)
  // Track token expiry so the proactive refresh effect re-schedules after each rotation
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number>(() =>
    Number(localStorage.getItem(EXPIRES_KEY) || '0')
  )
  // Session warning: shown when token refresh fails (session about to expire)
  const [sessionWarning, setSessionWarning] = useState(false)
  // Guard against double-logout on the expiry timer
  const hasLoggedOutRef = useRef(false)

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
        // Surface backend error detail (lockout, remaining attempts)
        let detail = 'Email ou mot de passe incorrect'
        try {
          const data = await res.json()
          if (data.detail) detail = data.detail
        } catch { /* use default */ }
        throw new Error(detail)
      }

      const data = await res.json()
      const { access_token, refresh_token } = data

      // Fetch agent profile (authoritative source, no client-side JWT parsing)
      const meRes = await fetch(`${API_BASE}/auth/agent/me`, {
        headers: { Authorization: `Bearer ${access_token}` },
      })
      
      if (!meRes.ok) {
        setState(prev => ({ ...prev, isLoading: false }))
        throw new Error('Échec de la récupération du profil')
      }
      
      const agentData = await meRes.json()

      const user: User = {
        id: agentData.id,
        email: agentData.email,
        name: agentData.name,
        role: agentData.role,
        agencyId: agentData.agency_id,
      }

      storeTokens(access_token, refresh_token, data.expires_in)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
      setTokenExpiresAt(Number(localStorage.getItem(EXPIRES_KEY)))

      setState({ user, isAuthenticated: true, isLoading: false })
      return true
    } catch (err: any) {
      setState(prev => ({ ...prev, isLoading: false }))
      // Re-throw so LoginPage can display lockout/attempts detail
      throw err
    }
  }, [])

  // -----------------------------------------------------------------------
  // Token refresh: silent rotation via POST /auth/refresh
  // -----------------------------------------------------------------------

  const logout = useCallback(() => {
    clearTokens()
    setTokenExpiresAt(0)
    setSessionWarning(false)
    setState({ user: null, isAuthenticated: false, isLoading: false })
  }, [])

  /** Attempt to refresh the access token using the stored refresh token.
   *  Returns true on success, false on failure (caller should logout). */
  const refreshTokens = useCallback(async (): Promise<boolean> => {
    // Mutex: if a refresh is already in flight, reuse that promise
    if (refreshMutex.current) return refreshMutex.current

    const refreshToken = localStorage.getItem(REFRESH_KEY)
    if (!refreshToken) return false

    const promise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })
        if (!res.ok) return false
        const data = await res.json()
        storeTokens(data.access_token, data.refresh_token, data.expires_in)
        setTokenExpiresAt(Number(localStorage.getItem(EXPIRES_KEY)))
        setSessionWarning(false)
        return true
      } catch {
        return false
      } finally {
        refreshMutex.current = null
      }
    })()

    refreshMutex.current = promise
    return promise
  }, [])

  const getAuthHeader = useCallback((): Record<string, string> => {
    const token = localStorage.getItem(TOKEN_KEY)
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  /** Manually retry token refresh (from the warning banner). */
  const retryRefresh = useCallback(async () => {
    await refreshTokens()
    // refreshTokens() already clears sessionWarning on success
  }, [refreshTokens])

  /** Dismiss the warning without retrying (session will still expire). */
  const dismissWarning = useCallback(() => {
    setSessionWarning(false)
  }, [])

  // -----------------------------------------------------------------------
  // Proactive refresh: refresh token before it expires
  // Re-schedules after each rotation via tokenExpiresAt dependency
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!state.isAuthenticated || !tokenExpiresAt) return

    const delay = tokenExpiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS
    // If already past the refresh window, refresh immediately
    if (delay <= 0) {
      refreshTokens().then(ok => { if (!ok) setSessionWarning(true) })
      return
    }

    const timerId = window.setTimeout(async () => {
      const ok = await refreshTokens()
      if (!ok) setSessionWarning(true)
    }, delay)

    return () => clearTimeout(timerId)
  }, [state.isAuthenticated, tokenExpiresAt, refreshTokens, logout])

  // -----------------------------------------------------------------------
  // Multi-tab sync: listen for storage changes from other tabs
  // If Tab A refreshes tokens, Tab B picks up the new tokens via storage event
  // -----------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY && e.newValue) {
        // Another tab wrote a new access token — update our expiry tracker
        setTokenExpiresAt(Number(localStorage.getItem(EXPIRES_KEY) || '0'))
      }
      if (e.key === TOKEN_KEY && !e.newValue) {
        // Another tab logged out
        logout()
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [logout])

  // -----------------------------------------------------------------------
  // Auto-logout when token actually expires (even if warning was dismissed)
  // This runs in AuthContext so it's independent of the banner component lifecycle.
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!state.isAuthenticated || !tokenExpiresAt) return

    const delay = tokenExpiresAt - Date.now()
    if (delay <= 0) {
      // Token already expired — logout immediately
      if (!hasLoggedOutRef.current) {
        hasLoggedOutRef.current = true
        logout()
        window.location.href = '/login'
      }
      return
    }

    const timerId = window.setTimeout(() => {
      if (!hasLoggedOutRef.current) {
        hasLoggedOutRef.current = true
        logout()
        window.location.href = '/login'
      }
    }, delay)

    return () => clearTimeout(timerId)
  }, [state.isAuthenticated, tokenExpiresAt, logout])

  // Reset the logout guard when user logs back in
  useEffect(() => {
    if (state.isAuthenticated) hasLoggedOutRef.current = false
  }, [state.isAuthenticated])

  // -----------------------------------------------------------------------
  // Intercept 401s: try refresh + retry before logout
  // -----------------------------------------------------------------------
  useEffect(() => {
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      let response = await originalFetch(...args)

      if (response.status === 401) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
        // Skip auth endpoints — they handle 401 themselves
        if (!url.includes(API_BASE) || url.includes('/auth/')) {
          return response
        }

        // Attempt silent token refresh + retry once
        const refreshed = await refreshTokens()
        if (refreshed) {
          // Clone the request with the new Authorization header
          const newToken = localStorage.getItem(TOKEN_KEY)
          const newHeaders = {
            ...(args[1]?.headers as Record<string, string> | undefined),
            Authorization: `Bearer ${newToken}`,
          }
          response = await originalFetch(args[0], { ...args[1], headers: newHeaders })
          // If the retry also 401s, then truly force logout
          if (response.status === 401) {
            globalShowToast('Session expirée — redirection vers la connexion', 'error')
            logout()
            window.location.href = '/login'
          }
          return response
        }

        // Refresh failed — show warning + error toast
        setSessionWarning(true)
        globalShowToast('Erreur d\'authentification — impossible de renouveler la session', 'error')
      }
      return response
    }
    return () => { window.fetch = originalFetch }
  }, [logout, refreshTokens])

  return (
    <AuthContext.Provider value={{ ...state, login, logout, getAuthHeader, sessionWarning, retryRefresh, dismissWarning, tokenExpiresAt }}>
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
