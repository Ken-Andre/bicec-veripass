import { cn } from '../lib/utils';

interface ConfidenceBadgeProps {
  confidence: number;
  className?: string;
}

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  const level = confidence >= 0.85 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
  const percent = Math.round(confidence * 100);

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
      level === 'high' && 'bg-emerald-100 text-emerald-700',
      level === 'medium' && 'bg-amber-100 text-amber-700',
      level === 'low' && 'bg-red-100 text-red-700',
      className
    )}>
      <span className={cn(
        'h-1.5 w-1.5 rounded-full',
        level === 'high' && 'bg-emerald-500',
        level === 'medium' && 'bg-amber-500',
        level === 'low' && 'bg-red-500',
      )} />
      {percent}%
    </span>
  );
}
