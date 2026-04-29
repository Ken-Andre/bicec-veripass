import { cn } from '../lib/utils';
import { Check } from 'lucide-react';

interface Step {
  label: string;
  sublabel?: string;
  duration?: string;
}

interface ProgressStepperProps {
  steps: Step[];
  currentStep: number;
  className?: string;
  variant?: 'horizontal' | 'vertical';
}

export function ProgressStepper({ steps, currentStep, className, variant = 'horizontal' }: ProgressStepperProps) {
  if (variant === 'vertical') {
    return (
      <div className={cn('space-y-0', className)}>
        {steps.map((step, i) => {
          const completed = i < currentStep;
          const active = i === currentStep;
          return (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors',
                    completed && 'bg-emerald-500 text-white',
                    active && 'bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110',
                    !completed && !active && 'bg-muted text-muted-foreground',
                  )}
                >
                  {completed ? <Check className="h-5 w-5" /> : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className={cn(
                    'w-0.5 h-12 my-1 transition-colors',
                    completed ? 'bg-emerald-500' : 'bg-border',
                  )} />
                )}
              </div>
              <div className="pt-2 pb-6">
                <p className={cn(
                  'font-semibold text-sm',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}>{step.label}</p>
                {step.sublabel && <p className="text-xs text-muted-foreground mt-0.5">{step.sublabel}</p>}
                {step.duration && <p className="text-xs text-primary mt-0.5">{step.duration}</p>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-between', className)}>
      {steps.map((step, i) => {
        const completed = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                completed && 'bg-emerald-500 text-white',
                active && 'bg-primary text-primary-foreground',
                !completed && !active && 'bg-muted text-muted-foreground',
              )}>
                {completed ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn(
                'text-[10px] mt-1 text-center max-w-[60px]',
                active ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}>{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                'h-0.5 flex-1 mx-2 mt-[-16px] transition-colors',
                completed ? 'bg-emerald-500' : 'bg-border',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
