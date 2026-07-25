import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, UserPlus, MessageSquare } from 'lucide-react';
import { notificationsApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { AppNotification } from '../types';
import { Card, ErrorNote, EmptyState } from '../components/ui';
import { CardSkeleton } from '../components/Skeleton';

const ICONS: Record<string, React.ElementType> = {
  task_assigned: UserPlus,
  message_received: MessageSquare,
};

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

  if (loading) return <div className="max-w-2xl space-y-2">{[0, 1, 2].map((i) => <CardSkeleton key={i} rows={1} />)}</div>;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Notifications</h1>
          <p className="text-sm text-surface-500">Click a notification to jump straight to it.</p>
        </div>
        {items.some((n) => !n.is_read) && (
          <button onClick={markAll} className="flex items-center gap-1.5 text-sm font-medium text-primary-400 hover:text-primary-300">
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>
      {error && <ErrorNote message={error} />}
      {items.length === 0 ? (
        <EmptyState message="You have no notifications." icon={Bell} />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = ICONS[n.type] || Bell;
            return (
              <button key={n.id} onClick={() => open(n)}
                      className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50">
                <Card hover className={`transition-opacity ${n.is_read ? 'opacity-60' : 'border-l-4 border-l-primary-500'}`}>
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary-500/10 p-2">
                      <Icon className="h-4 w-4 text-primary-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-surface-100">{n.title}</div>
                      {n.body && <div className="text-xs text-surface-500">{n.body}</div>}
                      <div className="mt-1 text-xs text-surface-600">{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                    {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" />}
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
