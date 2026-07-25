import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { AppNotification } from '../types';
import { Card, Spinner, ErrorNote, EmptyState } from '../components/ui';

export function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setItems(await notificationsApi.list()); }
    catch (e) { setError(apiError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const markAll = async () => {
    try { await notificationsApi.markAllRead(); await load(); } catch (e) { setError(apiError(e)); }
  };

  // Click anywhere on a notification: mark it read, then jump straight to
  // where it points — one action, no dead-end "open" link to miss.
  const open = async (n: AppNotification) => {
    if (!n.is_read) {
      try { await notificationsApi.markRead(n.id); } catch (e) { setError(apiError(e)); }
    }
    if (n.link) navigate(n.link);
    else await load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Notifications</h1>
          <p className="text-sm text-muted">Click a notification to jump straight to it.</p>
        </div>
        {items.some((n) => !n.is_read) &&
          <button onClick={markAll} className="text-sm text-accent">Mark all read</button>}
      </div>
      {error && <ErrorNote message={error} />}
      {items.length === 0 ? (
        <EmptyState message="You have no notifications." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <button key={n.id} onClick={() => open(n)} className="block w-full text-left">
              <Card className={`transition hover:border-slate-700 ${n.is_read ? 'opacity-60' : 'border-l-4 border-l-accent'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-100">{n.title}</div>
                    {n.body && <div className="text-xs text-muted">{n.body}</div>}
                    <div className="mt-1 text-xs text-slate-500">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
