import React, { useEffect, useState } from 'react';
import { Download, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { privacyApi } from '../api/endpoints';
import { apiError, API_BASE, tokenStore } from '../api/client';
import { useToast } from '../components/Toast';
import { UserEvent } from '../types';
import { Card, Badge, ErrorNote, EmptyState } from '../components/ui';
import { Button } from '../components/Button';
import { TableSkeleton } from '../components/Skeleton';

export function MyDataPage() {
  const { show } = useToast();
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    privacyApi.myEvents(page)
      .then((d) => { setEvents(d.items); setPages(d.pagination.pages); })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, [page]);

  const download = async () => {
    const res = await fetch(`${API_BASE}/api/v1/me/events/export`, {
      headers: { Authorization: `Bearer ${tokenStore.access()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my_events.json';
    a.click();
    URL.revokeObjectURL(url);
    show('Export downloaded.', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">My Data</h1>
          <p className="text-sm text-surface-500">
            Every event recorded about your activity. You can export it at any time.
          </p>
        </div>
        <Button variant="secondary" icon={<Download className="h-3.5 w-3.5" />} onClick={download}>
          Export
        </Button>
      </div>

      {error && <ErrorNote message={error} />}
      {loading ? (
        <Card><TableSkeleton rows={6} cols={4} /></Card>
      ) : events.length === 0 ? (
        <EmptyState message="No events recorded yet." icon={Lock} />
      ) : (
        <Card className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-surface-800 text-left text-xs uppercase text-surface-600">
              <tr><th className="px-4 py-3">Action</th><th>Resource</th><th>Status</th><th>When</th></tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-surface-800 hover:bg-surface-800/30">
                  <td className="px-4 py-2.5 text-surface-200">{e.action_type.replace(/_/g, ' ')}</td>
                  <td className="text-surface-500">{e.resource_type}</td>
                  <td><Badge status={e.status} /></td>
                  <td className="text-surface-500">{new Date(e.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-surface-800 px-4 py-3 text-xs text-surface-500">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                    icon={<ChevronLeft className="h-3 w-3" />}>
              Prev
            </Button>
            <span>Page {page} of {pages}</span>
            <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
