import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { securityApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { IncidentListItem } from '../types';
import { Card, Badge, Avatar, ErrorNote, EmptyState } from '../components/ui';
import { Select } from '../components/Field';
import { CardSkeleton } from '../components/Skeleton';
import { IncidentDetailModal } from '../components/IncidentDetailModal';

export function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await securityApi.incidents(stateFilter || undefined);
      setIncidents(data.incidents);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [stateFilter]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="space-y-2">{[0, 1, 2].map((i) => <CardSkeleton key={i} rows={1} />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Incidents</h1>
          <p className="text-sm text-surface-500">
            Confirmed threats and their incident-response case files.
          </p>
        </div>
        <Select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="w-44">
          <option value="">All incidents</option>
          <option value="confirmed">Confirmed</option>
          <option value="containing">Containing</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed / archived</option>
        </Select>
      </div>

      {error && <ErrorNote message={error} />}

      {incidents.length === 0 ? (
        <EmptyState message="No confirmed incidents yet." icon={ShieldAlert} />
      ) : (
        <div className="space-y-2">
          {incidents.map((inc) => (
            <button key={inc.id} onClick={() => setOpenId(inc.id)}
                    className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50">
              <Card hover className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <Avatar name={inc.subject_name || `User ${inc.subject_user_id}`} size="sm" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-surface-100">
                        {inc.subject_name || `User #${inc.subject_user_id}`}
                      </span>
                      <Badge status={inc.state} />
                      {inc.severity && <Badge status={inc.severity} />}
                    </div>
                    <div className="mt-1 text-sm text-surface-300">{inc.alert_title}</div>
                    <div className="mt-1 text-xs text-surface-600">
                      confirmed {inc.confirmed_at ? new Date(inc.confirmed_at).toLocaleString() : '—'}
                    </div>
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {openId != null && (
        <IncidentDetailModal
          investigationId={openId}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
