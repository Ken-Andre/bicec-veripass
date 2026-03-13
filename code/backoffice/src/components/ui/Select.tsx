import { createContext, useContext, useState, type ReactNode } from 'react'
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