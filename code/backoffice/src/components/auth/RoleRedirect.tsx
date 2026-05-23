import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

const ROLE_HOME: Record<string, string> = {
  JEAN: '/validation',
  THOMAS: '/compliance',
  SYLVIE: '/command-center',
  ADMIN_IT: '/admin',
}

export function RoleRedirect() {
  const { user } = useAuth()
  const target = ROLE_HOME[user?.role || ''] || '/validation'
  return <Navigate to={target} replace />
}
