import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function Index() {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      // Rediriger vers la page appropriée selon le rôle
      switch (user.role) {
        case 'JEAN':
          navigate('/validation')
          break
        case 'THOMAS':
          navigate('/compliance')
          break
        case 'SYLVIE':
          navigate('/command-center')
          break
        case 'ADMIN_IT':
          navigate('/admin')
          break
        default:
          navigate('/dashboard')
      }
    } else {
      navigate('/login')
    }
  }, [user, navigate])

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
    </div>
  )
}