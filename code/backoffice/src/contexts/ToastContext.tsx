import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  durationMs: number
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (message: string, variant?: ToastVariant, durationMs?: number) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

let _nextId = 0

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  info: 5000,
  success: 4000,
  warning: 6000,
  error: 8000,
}

// ---------------------------------------------------------------------------
// Module-level toast function — callable from anywhere (e.g. AuthContext
// fetch interceptor) without needing React context access.
// ---------------------------------------------------------------------------
let _globalShowToast: ((message: string, variant?: ToastVariant, durationMs?: number) => void) | null = null

/** Show a toast from outside React tree (e.g. AuthContext fetch interceptor). */
export function globalShowToast(message: string, variant: ToastVariant = 'info', durationMs?: number) {
  if (_globalShowToast) {
    _globalShowToast(message, variant, durationMs)
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info', durationMs?: number) => {
      const id = `toast-${++_nextId}`
      const duration = durationMs ?? DEFAULT_DURATION[variant]
      const toast: Toast = { id, message, variant, durationMs: duration }

      setToasts(prev => [...prev, toast])

      // Auto-dismiss after duration
      setTimeout(() => dismissToast(id), duration)
    },
    [dismissToast],
  )

  // Register the global function so non-React code can trigger toasts
  // Must be in useEffect (not render) for React 18 concurrent mode safety
  useEffect(() => {
    _globalShowToast = showToast
    return () => { _globalShowToast = null }
  }, [showToast])

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
