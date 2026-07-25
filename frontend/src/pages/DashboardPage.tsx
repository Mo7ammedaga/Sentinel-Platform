import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ShieldAlert, ShieldX, ShieldCheck, Sparkles, Radio, Flame,
} from 'lucide-react';
import { securityApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { useLiveAlerts } from '../hooks/useLiveAlerts';
import { useToast } from '../components/Toast';
import { DashboardStats, HighRiskUser, BaselineCoverage, ModelPerformance, RiskTrendPoint } from '../types';
import { Card, StatCard, Badge, Avatar, ErrorNote, EmptyState } from '../components/ui';
import { RiskTrendChart } from '../components/RiskTrendChart';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { UserActivityModal } from '../components/UserActivityModal';
import { Button } from '../components/Button';
import { CardSkeleton } from '../components/Skeleton';

const TREND_OPTIONS = [7, 14, 30];

export function DashboardPage() {
  const navigate = useNavigate();
  const { show } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [highRisk, setHighRisk] = useState<HighRiskUser[]>([]);
  const [coverage, setCoverage] = useState<BaselineCoverage[]>([]);
  const [perf, setPerf] = useState<ModelPerformance | null>(null);
  const [trend, setTrend] = useState<RiskTrendPoint[]>([]);
  const [heatmap, setHeatmap] = useState<RiskTrendPoint[]>([]);
  const [trendDays, setTrendDays] = useState(14);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [openUser, setOpenUser] = useState<HighRiskUser | null>(null);
  const { connected, alerts } = useLiveAlerts(true);

  const load = useCallback(async (days = trendDays) => {
    setError('');
    try {
      const [s, hr, cov, mp, rt, hm] = await Promise.all([
        securityApi.stats(),
        securityApi.highRiskUsers(),
        securityApi.baselineCoverage(),
        securityApi.modelPerformance(),
        securityApi.riskTrend(days),
        securityApi.riskTrend(90),
      ]);
      setStats(s); setHighRisk(hr); setCoverage(cov); setPerf(mp); setTrend(rt); setHeatmap(hm);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [trendDays]);

  useEffect(() => { load(); }, [load]);

  const changeTrendDays = async (days: number) => {
    setTrendDays(days);
    try { setTrend(await securityApi.riskTrend(days)); } catch (e) { setError(apiError(e)); }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const result = await securityApi.analyze();
      await load();
      show(`Analysis complete — ${result.anomalies_detected ?? 0} anomal${result.anomalies_detected === 1 ? 'y' : 'ies'} found.`, 'success');
    } catch (e) {
      const msg = apiError(e);
      setError(msg);
      show(msg, 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton rows={1} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} rows={1} />)}
        </div>
        <CardSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Security Dashboard</h1>
          <p className="text-sm text-surface-500">
            Behaviour flagged as unusual relative to each user's own baseline — a
            signal for review, never a verdict.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-success-400' : 'text-surface-600'}`}>
            <Radio className={`h-3.5 w-3.5 ${connected ? 'animate-pulseDot' : ''}`} />
            {connected ? 'Live' : 'Offline'}
          </span>
          <Button onClick={runAnalysis} loading={analyzing} icon={!analyzing && <Sparkles className="h-3.5 w-3.5" />}>
            {analyzing ? 'Analyzing…' : 'Run analysis'}
          </Button>
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Events (24h)" value={stats.total_events} tone="total" icon={Activity} />
          <StatCard label="Critical" value={stats.critical} tone="critical" icon={ShieldX}
                    onClick={stats.critical > 0 ? () => navigate('/alerts?severity=critical') : undefined} />
          <StatCard label="Suspicious" value={stats.suspicious} tone="suspicious" icon={ShieldAlert}
                    onClick={stats.suspicious > 0 ? () => navigate('/alerts?severity=suspicious') : undefined} />
          <StatCard label="Normal" value={stats.normal} tone="normal" icon={ShieldCheck} />
        </div>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-surface-200">Risk Trend</h2>
          <div className="flex gap-1 rounded-lg border border-surface-800 p-0.5">
            {TREND_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => changeTrendDays(d)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  trendDays === d ? 'bg-primary-500/15 text-primary-300' : 'text-surface-500 hover:text-surface-300'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <RiskTrendChart data={trend} />
      </Card>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Flame className="h-4 w-4 text-surface-500" />
          <h2 className="text-sm font-semibold text-surface-200">Activity Heatmap</h2>
          <span className="text-xs text-surface-600">— last 90 days</span>
        </div>
        <ActivityHeatmap data={heatmap} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-surface-200">High-Risk Users</h2>
          {highRisk.length === 0 ? (
            <EmptyState message="No elevated risk right now." icon={ShieldCheck} />
          ) : (
            <ul className="space-y-1">
              {highRisk.map((u) => (
                <li key={u.user_id}>
                  <button
                    onClick={() => setOpenUser(u)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-surface-800/60"
                  >
                    <Avatar name={u.name || u.email || `user ${u.user_id}`} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-surface-200">{u.name || u.email || `User #${u.user_id}`}</span>
                      <span className="block text-xs text-surface-500">{u.open_alerts} open alert{u.open_alerts === 1 ? '' : 's'}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold tabular-nums text-surface-100">{u.current_score.toFixed(0)}</span>
                      <span className="block text-[10px] uppercase tracking-wide text-surface-600">risk</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-surface-200">Live Alerts</h2>
          {alerts.length === 0 ? (
            <EmptyState message="Waiting for new alerts… (run analysis to generate)" icon={Radio} />
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.event_id} className="animate-slideUp rounded-lg border border-surface-800 p-2.5 transition-colors hover:border-surface-700">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-surface-200">{a.message}</span>
                    <Badge status={a.status} dot />
                  </div>
                  <div className="mt-1 text-xs text-surface-500">{a.explanation}</div>
                  <div className="mt-1 text-xs text-surface-600">
                    {new Date(a.timestamp).toLocaleTimeString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-surface-200">Model Performance</h2>
          <p className="mb-3 text-xs text-surface-500">
            The analyst feedback loop: how investigation verdicts compare to what the
            AI flagged. This is the real measure of accuracy — not the model's own confidence.
          </p>
          {!perf || perf.overall.total_reviewed === 0 ? (
            <EmptyState message="No investigations closed yet — confirm or dismiss an alert to start tracking accuracy." icon={Sparkles} />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-2xl font-semibold tabular-nums text-surface-50">
                    {Math.round((perf.overall.confirmed_rate ?? 0) * 100)}%
                  </div>
                  <div className="text-xs text-surface-500">confirmed of {perf.overall.total_reviewed} reviewed</div>
                </div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-800">
                  <div className="h-2 rounded-full bg-success-500 transition-all duration-500"
                       style={{ width: `${(perf.overall.confirmed_rate ?? 0) * 100}%` }} />
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-surface-600">
                  <tr><th className="py-1">Model version</th><th>Confirmed</th><th>False positive</th></tr>
                </thead>
                <tbody>
                  {perf.by_model_version.map((v) => (
                    <tr key={v.model_version} className="border-t border-surface-800">
                      <td className="py-2 font-mono text-xs text-surface-300">{v.model_version}</td>
                      <td className="text-success-400">{v.confirmed}</td>
                      <td className="text-danger-400">{v.false_positive}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-semibold text-surface-200">Monitoring Coverage</h2>
          <p className="mb-3 text-xs text-surface-500">
            The AI needs at least {coverage[0]?.required ?? 50} events to build a reliable
            baseline for someone. Below that, they will never appear in Alerts — not because
            they're "normal", but because there isn't enough history to judge yet.
          </p>
          {coverage.length === 0 ? (
            <EmptyState message="No users to show." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-surface-600">
                <tr><th className="py-1">User</th><th>Role</th><th>Baseline</th><th>Status</th></tr>
              </thead>
              <tbody>
                {coverage.map((u) => (
                  <tr key={u.user_id} className="border-t border-surface-800">
                    <td className="py-2">{u.name}</td>
                    <td className="capitalize text-surface-500">{u.role}</td>
                    <td className="w-40">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-surface-800">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-500 ${u.ready ? 'bg-success-500' : 'bg-primary-500'}`}
                            style={{ width: `${Math.min(100, (u.event_count / u.required) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-surface-400">{u.event_count}/{u.required}</span>
                      </div>
                    </td>
                    <td>
                      {u.ready
                        ? <span className="rounded-full border border-success-500/30 bg-success-500/15 px-2 py-0.5 text-xs text-success-400">monitored</span>
                        : <span className="rounded-full border border-surface-700 px-2 py-0.5 text-xs text-surface-500">collecting</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {openUser && (
        <UserActivityModal
          userId={openUser.user_id}
          userName={openUser.name || openUser.email || `User #${openUser.user_id}`}
          onClose={() => setOpenUser(null)}
        />
      )}
    </div>
  );
}
