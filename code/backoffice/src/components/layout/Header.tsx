import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Bell, User } from 'lucide-react'

export default function Header() {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 shadow-sm backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-foreground lg:hidden">BICEC VeriPass</h1>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled
          aria-label="Notifications - bientot disponible"
          title="Notifications - bientot disponible"
          className="relative flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-md border border-border bg-muted text-muted-foreground opacity-65"
        >
          <Bell className="h-4 w-4" />
        </button>
        <Link to="/profile" aria-label="Profil" className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <User className="h-5 w-5" />
          </div>
          <span className="hidden text-sm font-medium text-foreground sm:block">
            {user?.name}
          </span>
        </Link>
      </div>
    </header>
  )
}
