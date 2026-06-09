import { cn } from '../../lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        {
          'bg-primary/10 text-primary': variant === 'default',
          'bg-muted text-muted-foreground': variant === 'secondary',
          'bg-success/10 text-success': variant === 'success',
          'bg-warning/15 text-amber-800': variant === 'warning',
          'bg-destructive/10 text-destructive': variant === 'danger',
        },
        className
      )}
      {...props}
    />
  )
}
