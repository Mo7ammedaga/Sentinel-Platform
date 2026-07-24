import React, { useEffect, useState } from 'react';
import { privacyApi } from '../api/endpoints';
import { apiError, API_BASE, tokenStore } from '../api/client';
import { UserEvent } from '../types';
import { Card, Badge, Spinner, ErrorNote } from '../components/ui';

export function MyDataPage() {
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

  const exportUrl = `${API_BASE}/api/v1/me/events/export`;
  const download = async () => {
    // Fetch with auth then save, since it's a protected endpoint.
    const res = await fetch(exportUrl, {
      headers: { Authorization: `Bearer ${tokenStore.access()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my_events.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">My Data</h1>
          <p className="text-sm text-muted">
            Every event recorded about your activity. You can export it at any time.
          </p>
        </div>
        <button
          onClick={download}
          className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
        >
          Export (JSON)
        </button>
      </div>

      {error && <ErrorNote message={error} />}
      {loading ? (
        <Spinner />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr><th className="py-1">Action</th><th>Resource</th><th>Status</th><th>When</th></tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-slate-800">
                  <td className="py-2">{e.action_type}</td>
                  <td className="text-muted">{e.resource_type}</td>
                  <td><Badge status={e.status} /></td>
                  <td className="text-muted">{new Date(e.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center justify-between text-xs text-muted">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40">Prev</button>
            <span>Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
              className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </Card>
      )}
    </div>
  );
}
