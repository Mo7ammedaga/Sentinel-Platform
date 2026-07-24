import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { notificationsApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { AppNotification } from '../types';
import { Card, Spinner, ErrorNote } from '../components/ui';

export function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setItems(await notificationsApi.list()); }
    catch (e) { setError(apiError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const markRead = async (id: number) => {
    try { await notificationsApi.markRead(id); await load(); } catch (e) { setError(apiError(e)); }
  };
  const markAll = async () => {
    try { await notificationsApi.markAllRead(); await load(); } catch (e) { setError(apiError(e)); }
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Notifications</h1>
        {items.some((n) => !n.is_read) &&
          <button onClick={markAll} className="text-sm text-accent">Mark all read</button>}
      </div>
      {error && <ErrorNote message={error} />}
      {items.length === 0 ? (
        <p className="text-sm text-muted">You have no notifications.</p>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <Card key={n.id} className={n.is_read ? 'opacity-60' : 'border-l-4 border-l-accent'}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-100">{n.title}</div>
                  {n.body && <div className="text-xs text-muted">{n.body}</div>}
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(n.created_at).toLocaleString()}
                    {n.link && <> · <Link to={n.link} className="text-accent">open</Link></>}
                  </div>
                </div>
                {!n.is_read &&
                  <button onClick={() => markRead(n.id)}
                          className="shrink-0 rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800">
                    mark read
                  </button>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
