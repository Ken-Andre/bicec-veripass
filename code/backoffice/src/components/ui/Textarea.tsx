import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return <textarea className={cn('flex min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm', className)} ref={ref} {...props} />
})
Textarea.displayName = 'Textarea'

export { Textarea }
