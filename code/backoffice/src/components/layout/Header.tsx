import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Bell, User } from 'lucide-react'

export default function Header() {
  const { user } = useAuth()
  const [hasNotifications] = useState(true)

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-gray-900 lg:hidden">BICEC VeriPass</h1>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative rounded-full p-2 text-gray-400 hover:text-gray-500">
          <Bell className="h-5 w-5" />
          {hasNotifications && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
          )}
        </button>
        <Link to="/profile" aria-label="Profil" className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-50">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200">
            <User className="h-5 w-5 text-gray-600" />
          </div>
          <span className="hidden text-sm font-medium text-gray-700 sm:block">
            {user?.name}
          </span>
        </Link>
      </div>
    </header>
  )
}
