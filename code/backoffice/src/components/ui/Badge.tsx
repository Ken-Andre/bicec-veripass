import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2',
        {
          'border-transparent bg-slate-900 text-slate-50 hover:bg-slate-900/80': variant === 'default',
          'border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80': variant === 'secondary',
          'border-transparent bg-red-500 text-slate-50 hover:bg-red-500/80': variant === 'destructive',
          'text-slate-900': variant === 'outline',
          'border-transparent bg-green-500 text-white hover:bg-green-500/80': variant === 'success',
          'border-transparent bg-yellow-500 text-white hover:bg-yellow-500/80': variant === 'warning',
        },
        className
      )}
      {...props}
    />
  )
}
</content>
<write_to_file>
<path>code/backoffice/src/components/ui/Input.tsx</path>
<content>import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
</content>
<write_to_file>
<path>code/backoffice/src/components/ui/Avatar.tsx</path>
<content>import { cn } from '@/lib/utils'

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
</content>
<write_to_file>
<path>code/backoffice/src/components/ui/Dialog.tsx</path>
<content>import { createContext, useContext, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface DialogContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = createContext<DialogContextType | undefined>(undefined)

interface DialogProps {
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Dialog({ children, open: controlledOpen, onOpenChange }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  )
}

export function DialogTrigger({ children }: { children: ReactNode }) {
  const context = useContext(DialogContext)
  if (!context) throw new Error('DialogTrigger must be used within Dialog')

  return (
    <div onClick={() => context.setOpen(true)} className="inline-block cursor-pointer">
      {children}
    </div>
  )
}

export function DialogContent({ children, className }: { children: ReactNode; className?: string }) {
  const context = useContext(DialogContext)
  if (!context) throw new Error('DialogContent must be used within Dialog')

  if (!context.open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/80" onClick={() => context.setOpen(false)} />
      <div className={cn('relative z-50 grid w-full max-w-lg gap-4 border border-slate-200 bg-white p-6 shadow-lg sm:rounded-lg', className)}>
        {children}
        <button className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100" onClick={() => context.setOpen(false)}>
          <X className="h-4 w-4" />
          <span className="sr-only">Fermer</span>
        </button>
      </div>
    </div>
  )
}

export function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}>{children}</div>
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}>{children}</div>
}

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)}>{children}</h2>
}

export function DialogDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-sm text-slate-500', className)}>{children}</p>
}
</content>
<write_to_file>
<path>code/backoffice/src/components/ui/Table.tsx</path>
<content>import { cn } from '@/lib/utils'

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return <div className="relative w-full overflow-auto"><table className={cn('w-full caption-bottom text-sm', className)} {...props} /></div>
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b transition-colors hover:bg-slate-100/50', className)} {...props} />
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('h-12 px-4 text-left align-middle font-medium text-slate-500', className)} {...props} />
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('p-4 align-middle', className)} {...props} />
}
</content>
<write_to_file>
<path>code/backoffice/src/components/ui/Select.tsx</path>
<content>import { createContext, useContext, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface SelectContextType {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}

const SelectContext = createContext<SelectContextType | undefined>(undefined)

export function Select({ children, value: controlledValue, onValueChange, defaultValue }: { children: ReactNode; value?: string; onValueChange?: (value: string) => void; defaultValue?: string }) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue || '')
  const [open, setOpen] = useState(false)
  const value = controlledValue ?? uncontrolledValue
  const handleValueChange = onValueChange ?? setUncontrolledValue

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, open, setOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  )
}

export function SelectTrigger({ children, className }: { children: ReactNode; className?: string }) {
  const context = useContext(SelectContext)
  if (!context) throw new Error('SelectTrigger must be used within Select')

  return (
    <button type="button" className={cn('flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm', className)} onClick={() => context.setOpen(!context.open)}>
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  )
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const context = useContext(SelectContext)
  if (!context) throw new Error('SelectValue must be used within Select')
  return <span>{context.value || placeholder}</span>
}

export function SelectContent({ children, className }: { children: ReactNode; className?: string }) {
  const context = useContext(SelectContext)
  if (!context) throw new Error('SelectContent must be used within Select')
  if (!context.open) return null

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => context.setOpen(false)} />
      <div className={cn('absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-md', className)}>
        {children}
      </div>
    </>
  )
}

export function SelectItem({ children, value, className }: { children: ReactNode; value: string; className?: string }) {
  const context = useContext(SelectContext)
  if (!context) throw new Error('SelectItem must be used within Select')

  return (
    <div className={cn('relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-slate-100', context.value === value && 'bg-slate-100', className)} onClick={() => { context.onValueChange(value); context.setOpen(false) }}>
      {children}
    </div>
  )
}
</content>
<write_to_file>
<path>code/backoffice/src/components/ui/Textarea.tsx</path>
<content>import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return <textarea className={cn('flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm', className)} ref={ref} {...props} />
})
Textarea.displayName = 'Textarea'

export { Textarea }
</content>
<write_to_file>
<path>code/backoffice/src/components/NavLink.tsx</path>
<content>import { NavLink as RouterNavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export function NavLink({ to, icon: Icon, children }: { to: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <RouterNavLink to={to} className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100', isActive && 'bg-slate-100 font-medium')}>
      <Icon className="h-4 w-4" />
      {children}
    </RouterNavLink>
  )
}