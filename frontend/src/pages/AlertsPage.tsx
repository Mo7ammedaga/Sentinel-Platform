import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldAlert, Search } from 'lucide-react';
import { securityApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { useToast } from '../components/Toast';
import { Alert, INVESTIGATION_STATES } from '../types';
import { Card, Badge, Avatar, ErrorNote, EmptyState } from '../components/ui';
import { Select, Textarea } from '../components/Field';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { CardSkeleton } from '../components/Skeleton';
import { IncidentDetailModal } from '../components/IncidentDetailModal';
import { RESPONSE_PHASE_STATES } from '../types';

export function AlertsPage() {
  const { show } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Alert | null>(null);
  const [investigationId, setInvestigationId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [incidentId, setIncidentId] = useState<number | null>(null);
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
    setTransitioning(true);
    try {
      await securityApi.updateInvestigation(investigationId, state, notes);
      const openedIncident = RESPONSE_PHASE_STATES.includes(
        state as (typeof RESPONSE_PHASE_STATES)[number]);
      setSelected(null);
      if (openedIncident) {
        // Confirming a real threat opens the incident-response case file —
        // the workflow continues, it doesn't just close here.
        setIncidentId(investigationId);
      } else {
        show(`Investigation marked ${state.replace('_', ' ')}.`, 'success');
      }
      setInvestigationId(null);
      await load();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setTransitioning(false);
    }
  };

  const setSeverity = (v: string) => setSearchParams(v ? { severity: v } : {});
  const visible = severityFilter ? alerts.filter((a) => a.severity === severityFilter) : alerts;

  if (loading) return <div className="space-y-2">{[0, 1, 2].map((i) => <CardSkeleton key={i} rows={1} />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Alerts</h1>
          {severityFilter && (
            <p className="text-xs text-surface-500">
              Showing <span className="capitalize text-surface-300">{severityFilter}</span> only ·{' '}
              <button onClick={() => setSeverity('')} className="text-primary-400 hover:text-primary-300">clear</button>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Select value={severityFilter} onChange={(e) => setSeverity(e.target.value)} className="w-40">
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="suspicious">Suspicious</option>
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="closed">Closed</option>
          </Select>
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      {visible.length === 0 ? (
        <EmptyState message="No alerts match this filter." icon={Search} />
      ) : (
        <div className="space-y-2">
          {visible.map((a) => (
            <Card key={a.id} hover className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3">
                <Avatar name={a.user_name || `User ${a.user_id}`} size="sm" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-surface-100">
                      {a.user_name || `User #${a.user_id}`}
                    </span>
                    {a.user_email && <span className="text-xs text-surface-500">{a.user_email}</span>}
                    <Badge status={a.severity} dot />
                    <Badge status={a.status} />
                  </div>
                  <div className="mt-1 text-sm text-surface-300">{a.title}</div>
                  <div className="mt-1 text-xs text-surface-500">{a.explanation}</div>
                  <div className="mt-1 text-xs text-surface-600">
                    risk {a.risk_score.toFixed(0)} · {new Date(a.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              {a.status === 'open' && (
                <Button size="sm" variant="secondary" icon={<ShieldAlert className="h-3.5 w-3.5" />}
                        onClick={() => openInvestigation(a)}>
                  Investigate
                </Button>
              )}
              {a.status === 'investigating' && (
                <span className="shrink-0 text-xs text-surface-600">already being investigated</span>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Investigation · ${selected.title}` : ''}
        footer={
          <div className="flex flex-wrap gap-2">
            {/* Pre-verdict states only — Containing/Resolved/Closed belong to
                the incident-response case file, opened once confirmed. */}
            {INVESTIGATION_STATES.filter((s) =>
              !['open', 'containing', 'resolved', 'closed'].includes(s)).map((s) => (
              <button
                key={s}
                disabled={transitioning}
                onClick={() => transition(s)}
                className="rounded-lg border border-surface-700 px-2.5 py-1.5 text-xs capitalize text-surface-200 hover:bg-surface-800 disabled:opacity-50"
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        }
      >
        <p className="mb-3 text-xs text-surface-500">
          You are the reviewer. The AI flags the unusual; the decision is yours.
        </p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Investigation notes / evidence…"
          rows={4}
        />
      </Modal>

      {incidentId != null && (
        <IncidentDetailModal
          investigationId={incidentId}
          onClose={() => setIncidentId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
