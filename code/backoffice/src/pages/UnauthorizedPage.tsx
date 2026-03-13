import { useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'

export default function UnauthorizedPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex w-full max-w-md flex-col items-center space-y-8 text-center">
        <ShieldAlert className="h-24 w-24 text-red-500" />
        <div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Accès refusé
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Vous n'avez pas les autorisations nécessaires pour accéder à cette page.
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Retourner à l'accueil
        </button>
      </div>
    </div>
  )
}
