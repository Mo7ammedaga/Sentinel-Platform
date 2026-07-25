import React from 'react';
import { RiskTrendPoint } from '../types';

// Hand-rolled SVG bar chart — no charting library needed for one view, keeps
// the bundle small and uses the app's own design-system colour tokens.
const COLORS = { critical: '#dc2626', suspicious: '#d97706' };

export function RiskTrendChart({ data }: { data: RiskTrendPoint[] }) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-surface-500">No data in this period yet.</p>;
  }

  const width = 640;
  const height = 170;
  const padding = 24;
  const max = Math.max(1, ...data.map((d) => d.critical + d.suspicious));
  const barWidth = (width - padding * 2) / data.length;
  const scale = (n: number) => (n / max) * (height - padding * 2);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[480px]" role="img"
           aria-label="Critical and suspicious events per day">
        <defs>
          <linearGradient id="gradCritical" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.critical} stopOpacity="1" />
            <stop offset="100%" stopColor={COLORS.critical} stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="gradSuspicious" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.suspicious} stopOpacity="1" />
            <stop offset="100%" stopColor={COLORS.suspicious} stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {/* faint horizontal gridlines for readability */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={padding} x2={width - padding}
                y1={padding + f * (height - padding * 2)} y2={padding + f * (height - padding * 2)}
                stroke="#1e293b" strokeWidth={1} />
        ))}
        {data.map((d, i) => {
          const x = padding + i * barWidth;
          const critH = scale(d.critical);
          const suspH = scale(d.suspicious);
          const baseY = height - padding;
          const bw = barWidth * 0.55;
          const bx = x + barWidth * 0.225;
          return (
            <g key={d.date} className="transition-opacity hover:opacity-80">
              <rect x={bx} y={baseY - suspH} width={bw} height={suspH} rx={2} fill="url(#gradSuspicious)" />
              <rect x={bx} y={baseY - suspH - critH} width={bw} height={critH} rx={2} fill="url(#gradCritical)" />
              <title>{`${d.date}: ${d.critical} critical, ${d.suspicious} suspicious, avg risk ${d.avg_risk}`}</title>
            </g>
          );
        })}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding}
              stroke="#334155" strokeWidth={1} />
      </svg>
      <div className="mt-2 flex items-center justify-between text-[10px] text-surface-500">
        <span>{data[0]?.date}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLORS.critical }} /> critical
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLORS.suspicious }} /> suspicious
          </span>
        </span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}
