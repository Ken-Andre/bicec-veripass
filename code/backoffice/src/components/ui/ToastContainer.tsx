import { useToast, type ToastVariant } from '../../contexts/ToastContext'
import { X, Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react'

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; icon: typeof Info; iconColor: string }> = {
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: Info,
    iconColor: 'text-blue-500',
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: CheckCircle,
    iconColor: 'text-green-500',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: AlertCircle,
    iconColor: 'text-red-500',
  },
}

export default function ToastContainer() {
  const { toasts, dismissToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col-reverse gap-2 w-full max-w-sm">
      {toasts.map((toast) => {
        const style = VARIANT_STYLES[toast.variant]
        const Icon = style.icon

        return (
          <div
            key={toast.id}
            className={`${style.bg} ${style.border} animate-slide-up flex items-start gap-3 rounded-lg border p-3 shadow-lg`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconColor}`} />
            <p className="flex-1 text-sm text-slate-800">{toast.message}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
