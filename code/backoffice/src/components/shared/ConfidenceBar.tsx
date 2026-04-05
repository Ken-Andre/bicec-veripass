/**
 * ConfidenceBar — Barre de confiance OCR (vert/orange/rouge)
 * Source: veripass-gatekeeper prototype
 */
import { cn } from '@/lib/utils';

interface ConfidenceBarProps {
  score: number; // 0-1
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getColor(score: number): string {
  if (score >= 0.85) return 'bg-green-500';
  if (score >= 0.5) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getTextClass(score: number): string {
  if (score >= 0.85) return 'text-green-600';
  if (score >= 0.5) return 'text-yellow-600';
  return 'text-red-600';
}

function getBarHeight(size: 'sm' | 'md' | 'lg') {
  switch (size) {
    case 'sm': return 'h-1';
    case 'lg': return 'h-3';
    default: return 'h-2';
  }
}

export function ConfidenceBar({ score, showLabel = true, size = 'md', className }: ConfidenceBarProps) {
  const clamped = Math.min(Math.max(score, 0), 1);
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('flex-1 bg-muted rounded-full overflow-hidden', getBarHeight(size))}>
        <div
          className={cn('rounded-full transition-all', getColor(score))}
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn('text-xs font-medium tabular-nums', getTextClass(score))}>
          {Math.round(clamped * 100)}%
        </span>
      )}
    </div>
  );
}