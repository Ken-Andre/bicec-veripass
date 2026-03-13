import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const MOCK_USERS: Record<string, User & { password: string }> = {
  'jean@bicec.cm': {
    id: '1',
    email: 'jean@bicec.cm',
    name: 'Jean Dupont',
    role: 'JEAN',
    agencyId: 'agency-1',
    password: 'password123',
  },
  'thomas@bicec.cm': {
    id: '2',
    email: 'thomas@bicec.cm',
    name: 'Thomas Martin',
    role: 'THOMAS',
    agencyId: 'agency-1',
    password: 'password123',
  },
  'sylvie@bicec.cm': {
    id: '3',
    email: 'sylvie@bicec.cm',
    name: 'Sylvie Bernard',
    role: 'SYLVIE',
    agencyId: 'agency-1',
    password: 'password123',
  },
  'admin@bicec.cm': {
    id: '4',
    email: 'admin@bicec.cm',
    name: 'Admin IT',
    role: 'ADMIN_IT',
    password: 'password123',
  },
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  })

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true }))
    
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const userWithPassword = MOCK_USERS[email.toLowerCase()]
    if (userWithPassword && userWithPassword.password === password) {
      const { password: _, ...user } = userWithPassword
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

export type { User, AuthState }