import React, { useState } from 'react';
import { LucideIcon, AlertCircle, Loader2, Inbox } from 'lucide-react';

export function Card({ children, className = '', hover = false }: {
  children: React.ReactNode; className?: string; hover?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-surface-800 bg-surface-900/60 p-5 shadow-card
        transition-all duration-200 ${hover ? 'hover:-translate-y-0.5 hover:border-surface-700 hover:shadow-elevated' : ''}
        ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({ label, value, tone = 'normal', onClick, icon: Icon }: {
  label: string; value: React.ReactNode; tone?: 'total' | 'critical' | 'suspicious' | 'normal';
  onClick?: () => void; icon?: LucideIcon;
}) {
  const styles: Record<string, { bar: string; iconBg: string; iconColor: string }> = {
    total: { bar: 'border-l-primary-500', iconBg: 'bg-primary-500/10', iconColor: 'text-primary-400' },
    critical: { bar: 'border-l-danger-500', iconBg: 'bg-danger-500/10', iconColor: 'text-danger-400' },
    suspicious: { bar: 'border-l-warning-500', iconBg: 'bg-warning-500/10', iconColor: 'text-warning-400' },
    normal: { bar: 'border-l-success-500', iconBg: 'bg-success-500/10', iconColor: 'text-success-400' },
  };
  const s = styles[tone];
  const content = (
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-surface-500">{label}</div>
        <div className="mt-1.5 text-3xl font-semibold tabular-nums text-surface-50">{value}</div>
        {onClick && <div className="mt-1.5 text-xs font-medium text-primary-400">View alerts →</div>}
      </div>
      {Icon && (
        <div className={`rounded-lg p-2 ${s.iconBg}`}>
          <Icon className={`h-4 w-4 ${s.iconColor}`} />
        </div>
      )}
    </div>
  );
  return (
    <Card hover={!!onClick} className={`border-l-4 ${s.bar} ${onClick ? 'cursor-pointer' : ''}`}>
      {onClick ? <button onClick={onClick} className="block w-full text-left">{content}</button> : content}
    </Card>
  );
}

export function Badge({ status, dot = false }: { status: string; dot?: boolean }) {
  const map: Record<string, string> = {
    critical: 'bg-danger-500/15 text-danger-400 border-danger-500/30',
    suspicious: 'bg-warning-500/15 text-warning-400 border-warning-500/30',
    normal: 'bg-success-500/15 text-success-400 border-success-500/30',
    open: 'bg-primary-500/15 text-primary-400 border-primary-500/30',
    investigating: 'bg-warning-500/15 text-warning-400 border-warning-500/30',
    closed: 'bg-surface-500/15 text-surface-400 border-surface-500/30',
    confirmed: 'bg-danger-500/15 text-danger-400 border-danger-500/30',
    false_positive: 'bg-success-500/15 text-success-400 border-success-500/30',
    containing: 'bg-warning-500/15 text-warning-400 border-warning-500/30',
    resolved: 'bg-primary-500/15 text-primary-400 border-primary-500/30',
    low: 'bg-surface-500/15 text-surface-400 border-surface-500/30',
    medium: 'bg-warning-500/15 text-warning-400 border-warning-500/30',
    high: 'bg-danger-500/15 text-danger-400 border-danger-500/30',
  };
  const dotColor: Record<string, string> = {
    critical: 'bg-danger-400', suspicious: 'bg-warning-400', normal: 'bg-success-400',
    open: 'bg-primary-400', investigating: 'bg-warning-400', closed: 'bg-surface-400',
    confirmed: 'bg-danger-400', false_positive: 'bg-success-400',
    containing: 'bg-warning-400', resolved: 'bg-primary-400',
    low: 'bg-surface-400', medium: 'bg-warning-400', high: 'bg-danger-400',
  };
  const cls = map[status] || 'bg-surface-500/15 text-surface-400 border-surface-500/30';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColor[status] || 'bg-surface-400'}`} />}
      {status.replace('_', ' ')}
    </span>
  );
}

export function Avatar({ name, avatarUrl, size = 'md' }: {
  name: string; avatarUrl?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const [broken, setBroken] = useState(false);
  const initials = name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const dims: Record<string, string> = { sm: 'h-6 w-6 text-[10px]', md: 'h-8 w-8 text-xs', lg: 'h-16 w-16 text-lg', xl: 'h-24 w-24 text-2xl' };

  if (avatarUrl && !broken) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-full border-2 border-surface-800 object-cover ${dims[size]}`}
      />
    );
  }
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-600 to-primary-800 font-semibold text-white ${dims[size]}`}>
      {initials || '?'}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-8 text-sm text-surface-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex animate-slideUp items-start gap-2.5 rounded-lg border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-300">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

export function EmptyState({ message, icon: Icon = Inbox }: { message: string; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Icon className="h-8 w-8 text-surface-700" />
      <p className="text-sm text-surface-500">{message}</p>
    </div>
  );
}
