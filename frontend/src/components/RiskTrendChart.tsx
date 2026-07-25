import React from 'react';
import { RiskTrendPoint } from '../types';

// Hand-rolled SVG bar chart — no charting library needed for one simple view,
// keeps the bundle small and matches the app's existing colour tokens.
const COLORS = { critical: '#dc2626', suspicious: '#d97706' };

export function RiskTrendChart({ data }: { data: RiskTrendPoint[] }) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">No data in this period yet.</p>;
  }

  const width = 640;
  const height = 160;
  const padding = 24;
  const max = Math.max(1, ...data.map((d) => d.critical + d.suspicious));
  const barWidth = (width - padding * 2) / data.length;
  const scale = (n: number) => (n / max) * (height - padding * 2);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[480px]" role="img"
           aria-label="Critical and suspicious events per day">
        {data.map((d, i) => {
          const x = padding + i * barWidth;
          const critH = scale(d.critical);
          const suspH = scale(d.suspicious);
          const baseY = height - padding;
          return (
            <g key={d.date}>
              <rect x={x + barWidth * 0.2} y={baseY - suspH} width={barWidth * 0.6}
                    height={suspH} fill={COLORS.suspicious} opacity={0.9} />
              <rect x={x + barWidth * 0.2} y={baseY - suspH - critH} width={barWidth * 0.6}
                    height={critH} fill={COLORS.critical} opacity={0.9} />
              <title>{`${d.date}: ${d.critical} critical, ${d.suspicious} suspicious, avg risk ${d.avg_risk}`}</title>
            </g>
          );
        })}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding}
              stroke="#334155" strokeWidth={1} />
      </svg>
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>{data[0]?.date}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLORS.critical }} /> critical
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLORS.suspicious }} /> suspicious
          </span>
        </span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}
