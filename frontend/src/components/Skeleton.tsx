import React from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton animate-shimmer rounded ${className}`} aria-hidden="true" />;
}

/** A generic card-shaped loading placeholder — used while a page's first
 * fetch is in flight, instead of a bare "Loading…" string. */
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 rounded-xl border border-surface-800 bg-surface-900/60 p-5">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 4, cols = 3 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
