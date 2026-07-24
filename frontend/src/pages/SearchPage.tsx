import React, { useState } from 'react';
import { searchApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { SearchResults } from '../types';
import { Card, Spinner, ErrorNote } from '../components/ui';

export function SearchPage() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    try { setResults(await searchApi.query(q.trim())); }
    catch (err) { setError(apiError(err)); }
    finally { setLoading(false); }
  };

  const section = (title: string, items: { id: number }[], render: (i: any) => string) =>
    items.length > 0 && (
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-200">{title} ({items.length})</h2>
        <ul className="space-y-1 text-sm text-slate-300">
          {items.map((i) => <li key={i.id} className="rounded bg-slate-800/40 px-2 py-1">{render(i)}</li>)}
        </ul>
      </Card>
    );

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-white">Search</h1>
      <form onSubmit={run} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects, tasks, files, notes…"
               className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent" />
        <button className="rounded bg-accent px-4 py-2 text-sm font-medium text-white">Search</button>
      </form>
      {error && <ErrorNote message={error} />}
      {loading && <Spinner />}
      {results && (
        <div className="space-y-3">
          {section('Projects', results.projects, (p) => p.name)}
          {section('Tasks', results.tasks, (t) => t.title)}
          {section('Files', results.files, (f) => f.filename)}
          {section('Notes', results.notes, (n) => n.content)}
          {!results.projects.length && !results.tasks.length && !results.files.length && !results.notes.length && (
            <p className="text-sm text-muted">No results.</p>
          )}
        </div>
      )}
    </div>
  );
}
