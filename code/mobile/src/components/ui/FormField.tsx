import React from 'react';
import { cn } from '../../lib/utils';

export interface FormFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  hint,
  children,
  className,
}) => {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
          {label}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground px-1">{hint}</p>
      )}
      {error && (
        <p className="text-xs font-semibold text-destructive px-1">{error}</p>
      )}
    </div>
  );
};
