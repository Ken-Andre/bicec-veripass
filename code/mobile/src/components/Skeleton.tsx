import { cn } from '../lib/utils';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-muted/60',
        className
      )}
      style={style}
    />
  );
}

export function SkeletonField() {
  return (
    <div className="flex flex-col gap-1">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="p-4 rounded-2xl border border-muted/20 space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4" style={{ width: `${60 + Math.random() * 30}%` }} />
      ))}
    </div>
  );
}

export function OcrFieldsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
        <Skeleton className="h-4 w-3/4 mb-2" />
        <div className="flex gap-2 mt-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>

      {/* Field skeletons */}
      {[1, 2, 3, 4, 5].map((i) => (
        <SkeletonField key={i} />
      ))}

      {/* Button skeleton */}
      <Skeleton className="h-14 w-full rounded-2xl mt-6" />
    </div>
  );
}
