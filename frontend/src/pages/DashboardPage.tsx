import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { securityApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { useLiveAlerts } from '../hooks/useLiveAlerts';
import { DashboardStats, HighRiskUser, BaselineCoverage } from '../types';
import { Card, StatCard, Badge, Spinner, ErrorNote, EmptyState } from '../components/ui';

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [highRisk, setHighRisk] = useState<HighRiskUser[]>([]);
  const [coverage, setCoverage] = useState<BaselineCoverage[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const { connected, alerts } = useLiveAlerts(true);

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, hr, cov] = await Promise.all([
        securityApi.stats(),
        securityApi.highRiskUsers(),
        securityApi.baselineCoverage(),
      ]);
      setStats(s);
      setHighRisk(hr);
      setCoverage(cov);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      await securityApi.analyze();
      await load();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Security Dashboard</h1>
          <p className="text-sm text-muted">
            Behaviour flagged as unusual relative to each user's own baseline — a
            signal for review, never a verdict.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-400' : 'text-muted'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            {connected ? 'Live' : 'Offline'}
          </span>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {analyzing ? 'Analyzing…' : 'Run analysis'}
          </button>
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Events (24h)" value={stats.total_events} tone="total" />
          <StatCard label="Critical" value={stats.critical} tone="critical"
                    onClick={stats.critical > 0 ? () => navigate('/alerts?severity=critical') : undefined} />
          <StatCard label="Suspicious" value={stats.suspicious} tone="suspicious"
                    onClick={stats.suspicious > 0 ? () => navigate('/alerts?severity=suspicious') : undefined} />
          <StatCard label="Normal" value={stats.normal} tone="normal" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-200">High-Risk Users</h2>
          {highRisk.length === 0 ? (
            <EmptyState message="No elevated risk right now." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted">
                <tr><th className="py-1">User</th><th>Risk</th><th>Open alerts</th></tr>
              </thead>
              <tbody>
                {highRisk.map((u) => (
                  <tr key={u.user_id} className="border-t border-slate-800">
                    <td className="py-2">{u.name || u.email || `user ${u.user_id}`}</td>
                    <td className="font-semibold text-slate-200">{u.current_score.toFixed(0)}</td>
                    <td>{u.open_alerts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Live Alerts</h2>
          {alerts.length === 0 ? (
            <EmptyState message="Waiting for new alerts… (run analysis to generate)" />
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.event_id} className="rounded border border-slate-800 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-200">{a.message}</span>
                    <Badge status={a.status} />
                  </div>
                  <div className="mt-1 text-xs text-muted">{a.explanation}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {new Date(a.timestamp).toLocaleTimeString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-slate-200">Monitoring Coverage</h2>
        <p className="mb-3 text-xs text-muted">
          The AI needs at least {coverage[0]?.required ?? 50} events to build a reliable
          baseline for someone. Below that, they will never appear in Alerts — not because
          they're "normal", but because there isn't enough history to judge yet.
        </p>
        {coverage.length === 0 ? (
          <EmptyState message="No users to show." />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr><th className="py-1">User</th><th>Role</th><th>Baseline</th><th>Status</th></tr>
            </thead>
            <tbody>
              {coverage.map((u) => (
                <tr key={u.user_id} className="border-t border-slate-800">
                  <td className="py-2">{u.name}</td>
                  <td className="capitalize text-muted">{u.role}</td>
                  <td className="w-40">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-800">
                        <div
                          className={`h-1.5 rounded-full ${u.ready ? 'bg-emerald-500' : 'bg-accent'}`}
                          style={{ width: `${Math.min(100, (u.event_count / u.required) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{u.event_count}/{u.required}</span>
                    </div>
                  </td>
                  <td>
                    {u.ready
                      ? <span className="rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">being monitored</span>
                      : <span className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-400">collecting baseline</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
