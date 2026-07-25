import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { securityApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { Alert, INVESTIGATION_STATES } from '../types';
import { Card, Badge, Spinner, ErrorNote, EmptyState } from '../components/ui';

export function AlertsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Alert | null>(null);
  const [investigationId, setInvestigationId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const severityFilter = searchParams.get('severity') || '';

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await securityApi.alerts(statusFilter || undefined);
      setAlerts(data.alerts);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openInvestigation = async (alert: Alert) => {
    setSelected(alert);
    setNotes('');
    try {
      const inv = await securityApi.openInvestigation(alert.id);
      setInvestigationId(inv.id);
      await load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const transition = async (state: string) => {
    if (!investigationId) return;
    try {
      await securityApi.updateInvestigation(investigationId, state, notes);
      setSelected(null);
      setInvestigationId(null);
      await load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const setSeverity = (v: string) => setSearchParams(v ? { severity: v } : {});
  const visible = severityFilter ? alerts.filter((a) => a.severity === severityFilter) : alerts;

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Alerts</h1>
          {severityFilter && (
            <p className="text-xs text-muted">
              Showing <span className="capitalize text-slate-300">{severityFilter}</span> only ·{' '}
              <button onClick={() => setSeverity('')} className="text-accent">clear</button>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverity(e.target.value)}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200"
          >
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="suspicious">Suspicious</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      {visible.length === 0 ? (
        <EmptyState message="No alerts match this filter." />
      ) : (
        <div className="space-y-2">
          {visible.map((a) => (
            <Card key={a.id} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-100">
                    {a.user_name || `User #${a.user_id}`}
                  </span>
                  {a.user_email && <span className="text-xs text-muted">{a.user_email}</span>}
                  <Badge status={a.severity} />
                  <Badge status={a.status} />
                </div>
                <div className="mt-1 text-sm text-slate-300">{a.title}</div>
                <div className="mt-1 text-xs text-muted">{a.explanation}</div>
                <div className="mt-1 text-xs text-slate-500">
                  risk {a.risk_score.toFixed(0)} · {new Date(a.created_at).toLocaleString()}
                </div>
              </div>
              {a.status === 'open' && (
                <button
                  onClick={() => openInvestigation(a)}
                  className="shrink-0 rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                >
                  Investigate
                </button>
              )}
              {a.status === 'investigating' && (
                <span className="shrink-0 text-xs text-muted">already being investigated</span>
              )}
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <Card className="border-accent/40">
          <div className="mb-2 text-sm font-semibold text-slate-100">
            Investigation · {selected.title}
          </div>
          <p className="mb-2 text-xs text-muted">
            You are the reviewer. The AI flags the unusual; the decision is yours.
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Investigation notes / evidence…"
            className="mb-3 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            rows={3}
          />
          <div className="flex flex-wrap gap-2">
            {INVESTIGATION_STATES.filter((s) => s !== 'open').map((s) => (
              <button
                key={s}
                onClick={() => transition(s)}
                className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
