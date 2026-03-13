import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="mt-4 text-xl text-gray-600">Page non trouvée</p>
        <p className="mt-2 text-gray-500">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Home className="mr-2 h-4 w-4" />
          Retour à l'accueil
        </Link>
      </div>
    </div>
  )
}
</content>
<write_to_file>
<path>code/backoffice/src/pages/Index.tsx</path>
<content>import { Navigate } from 'react-router-dom'

export default function Index() {
  return <Navigate to="/" replace />
}