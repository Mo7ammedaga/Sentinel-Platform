import React from 'react';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-800 bg-slate-900/60 p-5 ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, tone = 'normal', onClick }: {
  label: string; value: React.ReactNode; tone?: 'total' | 'critical' | 'suspicious' | 'normal'; onClick?: () => void;
}) {
  const bar: Record<string, string> = {
    total: 'border-l-accent',
    critical: 'border-l-critical',
    suspicious: 'border-l-suspicious',
    normal: 'border-l-normal',
  };
  return (
    <Card className={`border-l-4 ${bar[tone]} ${onClick ? 'cursor-pointer transition hover:bg-slate-900' : ''}`}>
      {onClick ? (
        <button onClick={onClick} className="block w-full text-left">
          <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
          <div className="mt-1 text-3xl font-semibold text-slate-100">{value}</div>
          <div className="mt-1 text-xs text-accent">View alerts →</div>
        </button>
      ) : (
        <>
          <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
          <div className="mt-1 text-3xl font-semibold text-slate-100">{value}</div>
        </>
      )}
    </Card>
  );
}

export function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    critical: 'bg-red-500/15 text-red-400 border-red-500/30',
    suspicious: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    normal: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    open: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    investigating: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    closed: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    confirmed: 'bg-red-500/15 text-red-400 border-red-500/30',
    false_positive: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  };
  const cls = map[status] || 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200">
      {initials || '?'}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <div className="p-6 text-sm text-muted">{label}</div>;
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-muted">{message}</p>;
}
