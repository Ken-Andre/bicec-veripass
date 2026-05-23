import React from 'react';
import { cn } from '../../lib/utils';

export type InputType = 'text' | 'email' | 'tel' | 'password' | 'number';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  inputClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      iconLeft,
      iconRight,
      className,
      inputClassName,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        {label && (
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
            {label}
          </label>
        )}
        <div
          className={cn(
            'relative flex items-center rounded-2xl border-2 bg-white transition-all duration-200',
            'focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10',
            error && 'border-destructive focus-within:border-destructive focus-within:ring-destructive/10',
            disabled && 'opacity-50 bg-muted cursor-not-allowed'
          )}
        >
          {iconLeft && (
            <div className="pl-4 text-muted-foreground shrink-0">{iconLeft}</div>
          )}
          <input
            ref={ref}
            disabled={disabled}
            className={cn(
              'flex-1 min-w-0 h-14 px-4 bg-transparent text-base font-semibold text-foreground placeholder:text-muted-foreground placeholder:font-medium outline-none',
              iconLeft && 'pl-3',
              iconRight && 'pr-3',
              inputClassName
            )}
            {...props}
          />
          {iconRight && (
            <div className="pr-4 text-muted-foreground shrink-0">{iconRight}</div>
          )}
        </div>
        {hint && !error && (
          <p className="text-xs text-muted-foreground px-1">{hint}</p>
        )}
        {error && (
          <p className="text-xs font-semibold text-destructive px-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
