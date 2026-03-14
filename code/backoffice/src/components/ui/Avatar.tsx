import { cn } from '@/lib/utils'

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  fallback?: string
}

export function Avatar({ className, src, alt, fallback, ...props }: AvatarProps) {
  const initials = fallback || alt?.charAt(0)?.toUpperCase() || '?'

  return (
    <div
      className={cn(
        'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
        className
      )}
      {...props}
    >
      {src ? (
        <img src={src} alt={alt} className="aspect-square h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600">
          {initials}
        </div>
      )}
    </div>
  )
}