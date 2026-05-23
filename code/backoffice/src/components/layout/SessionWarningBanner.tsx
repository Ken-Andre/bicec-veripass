import { useState, useEffect } from 'react'
import { AlertTriangle, RefreshCw, LogOut, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '@/components/ui/Button'

export default function SessionWarningBanner() {
  const { sessionWarning, retryRefresh, dismissWarning, logout, tokenExpiresAt } = useAuth()
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [retrying, setRetrying] = useState(false)

  // Countdown timer: how long until the token actually expires
  // Note: auto-logout is handled by AuthContext's own timer, not here.
  // This effect only drives the countdown display.
  useEffect(() => {
    if (!sessionWarning || !tokenExpiresAt) return

    const update = () => {
      const remaining = Math.max(0, Math.floor((tokenExpiresAt - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [sessionWarning, tokenExpiresAt])

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await retryRefresh()
    } finally {
      setRetrying(false)
    }
  }

  if (!sessionWarning) return null

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timeDisplay = minutes > 0
    ? `${minutes}m ${seconds.toString().padStart(2, '0')}s`
    : `${seconds}s`

  return (
    <div className="fixed inset-x-0 top-0 z-50 animate-slide-down">
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Session sur le point d'expirer
              </p>
              <p className="text-xs text-amber-600">
                La connexion sera fermée dans <span className="font-mono font-bold">{timeDisplay}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={retrying}
              className="border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200"
            >
              {retrying ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Réessayer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { logout(); window.location.href = '/back-office/login' }}
              className="border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200"
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Déconnexion
            </Button>
            <button
              onClick={dismissWarning}
              className="ml-1 rounded p-1 text-amber-400 hover:text-amber-600"
              aria-label="Masquer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
