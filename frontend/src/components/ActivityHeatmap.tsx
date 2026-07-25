import React from 'react';
import { RiskTrendPoint } from '../types';

/** GitHub-contributions-style heatmap, built entirely from the existing
 * risk-trend endpoint at a longer window (?days=90) — no new backend. */
export function ActivityHeatmap({ data }: { data: RiskTrendPoint[] }) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-surface-500">No data yet.</p>;
  }

  const byDate = new Map(data.map((d) => [d.date, d]));
  const last = new Date(data[data.length - 1].date + 'T00:00:00Z');

  // Build a Sun-Sat grid ending on `last`, going back ~90 days.
  const endDow = last.getUTCDay();
  const gridEnd = new Date(last);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - endDow));
  const days: { date: string; intensity: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(gridEnd);
    d.setUTCDate(gridEnd.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const point = byDate.get(key);
    const intensity = point ? point.critical * 2 + point.suspicious : 0;
    days.push({ date: key, intensity });
  }
  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const cellClass = (n: number) => {
    if (n === 0) return 'bg-surface-800';
    if (n <= 1) return 'bg-primary-900';
    if (n <= 3) return 'bg-primary-700';
    if (n <= 6) return 'bg-primary-500';
    return 'bg-danger-500';
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <div key={day.date} className="group relative">
                <div className={`h-3 w-3 rounded-sm transition-transform hover:scale-125 ${cellClass(day.intensity)}`} />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-surface-700 bg-surface-800 px-2.5 py-1.5 text-[11px] shadow-elevated group-hover:block">
                  <span className="font-medium text-surface-100">{day.date}</span>
                  <span className="text-surface-400">
                    {' — '}{day.intensity === 0 ? 'no anomalies' : `${day.intensity} weighted anomaly score`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-surface-500">
        Less
        <span className="h-2.5 w-2.5 rounded-sm bg-surface-800" />
        <span className="h-2.5 w-2.5 rounded-sm bg-primary-900" />
        <span className="h-2.5 w-2.5 rounded-sm bg-primary-700" />
        <span className="h-2.5 w-2.5 rounded-sm bg-primary-500" />
        <span className="h-2.5 w-2.5 rounded-sm bg-danger-500" />
        More
      </div>
    </div>
  );
}
