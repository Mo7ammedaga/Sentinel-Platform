import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchIcon, FolderKanban, CheckSquare, FileText, StickyNote } from 'lucide-react';
import { searchApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { SearchResults } from '../types';
import { Card, ErrorNote, EmptyState } from '../components/ui';
import { Input } from '../components/Field';
import { Button } from '../components/Button';
import { CardSkeleton } from '../components/Skeleton';

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try { setResults(await searchApi.query(query.trim())); }
    catch (err) { setError(apiError(err)); }
    finally { setLoading(false); }
  };

  // Arriving via the command palette (?q=...) runs the search immediately.
  useEffect(() => {
    const initial = searchParams.get('q');
    if (initial) run(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const section = (title: string, items: { id: number }[], render: (i: any) => string, Icon: React.ElementType) =>
    items.length > 0 && (
      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-200">
          <Icon className="h-4 w-4 text-surface-500" /> {title}
          <span className="text-xs font-normal text-surface-500">({items.length})</span>
        </h2>
        <ul className="space-y-1.5 text-sm text-surface-300">
          {items.map((i) => (
            <li key={i.id} className="truncate rounded-lg bg-surface-800/50 px-3 py-2 transition-colors hover:bg-surface-800">
              {render(i)}
            </li>
          ))}
        </ul>
      </Card>
    );

  const empty = results && !results.projects.length && !results.tasks.length
    && !results.files.length && !results.notes.length;

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Search</h1>
        <p className="text-sm text-surface-500">Across projects, tasks, files, and notes.</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
                 placeholder="Search everything…" className="pl-9" />
        </div>
        <Button type="submit">Search</Button>
      </form>
      {error && <ErrorNote message={error} />}
      {loading && <CardSkeleton />}
      {!loading && results && (
        <div className="animate-fadeIn space-y-3">
          {section('Projects', results.projects, (p) => p.name, FolderKanban)}
          {section('Tasks', results.tasks, (t) => t.title, CheckSquare)}
          {section('Files', results.files, (f) => f.filename, FileText)}
          {section('Notes', results.notes, (n) => n.content, StickyNote)}
          {empty && <EmptyState message="No results for this search." icon={SearchIcon} />}
        </div>
      )}
    </div>
  );
}
