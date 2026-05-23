import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:opacity-92 active:scale-[0.98] shadow-lg shadow-primary/30 disabled:shadow-none',
  secondary:
    'bg-secondary text-secondary-foreground hover:opacity-90 active:scale-[0.98] shadow-md',
  ghost:
    'bg-transparent text-foreground hover:bg-muted active:bg-muted/80',
  danger:
    'bg-destructive text-destructive-foreground hover:opacity-90 active:scale-[0.98] shadow-md shadow-destructive/20',
  outline:
    'bg-transparent text-foreground border-2 border-border hover:bg-muted active:bg-muted/80',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-10 px-4 text-sm',
  md: 'h-12 px-6 text-base',
  lg: 'h-14 px-8 text-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'lg',
      loading = false,
      fullWidth = true,
      disabled,
      children,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
          'disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none disabled:filter disabled:grayscale-[0.4]',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
