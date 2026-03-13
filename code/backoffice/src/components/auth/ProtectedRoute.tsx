import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
</content>
<write_to_file>
<path>code/backoffice/src/pages/UnauthorizedPage.tsx</path>
<content>import { Link } from 'react-router-dom'
import { ShieldOff, ArrowLeft } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="text-center">
        <ShieldOff className="mx-auto h-16 w-16 text-red-500" />
        <h1 className="mt-4 text-4xl font-bold text-gray-900">Accès refusé</h1>
        <p className="mt-2 text-xl text-gray-600">
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
        </p>
        <p className="mt-1 text-gray-500">
          Contactez votre administrateur si vous pensez que c'est une erreur.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à l'accueil
        </Link>
      </div>
    </div>
  )
}