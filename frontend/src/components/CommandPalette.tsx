import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FolderKanban, CheckSquare, FileText, StickyNote, CornerDownLeft } from 'lucide-react';
import { searchApi } from '../api/endpoints';
import { SearchResults } from '../types';

/** Global quick-search, opened with Cmd+K / Ctrl+K from anywhere. Uses the
 * same /search endpoint as the Search page — this is a faster way IN to it,
 * not a separate feature. Only mounted for workspace-capable roles (matches
 * the backend's role gate on /search). */
export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
    else { setQ(''); setResults(null); }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    const t = setTimeout(() => { searchApi.query(q.trim()).then(setResults).catch(() => {}); }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const goToFullResults = () => {
    if (!q.trim()) return;
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    setOpen(false);
  };

  if (!open) return null;

  const flatCount = results
    ? results.projects.length + results.tasks.length + results.files.length + results.notes.length
    : 0;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[15vh]">
      <div className="absolute inset-0 animate-fadeIn bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg animate-scaleIn overflow-hidden rounded-xl border border-surface-700 bg-surface-900 shadow-elevated">
        <form onSubmit={(e) => { e.preventDefault(); goToFullResults(); }}
              className="flex items-center gap-2.5 border-b border-surface-800 px-4 py-3">
          <Search className="h-4 w-4 text-surface-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects, tasks, files, notes…"
            className="flex-1 bg-transparent text-sm text-surface-100 placeholder:text-surface-500 outline-none"
          />
          <kbd className="rounded border border-surface-700 px-1.5 py-0.5 text-[10px] text-surface-500">esc</kbd>
        </form>

        {results && flatCount > 0 && (
          <div className="max-h-72 overflow-y-auto p-2">
            {[
              ['Projects', results.projects, FolderKanban, (i: any) => i.name],
              ['Tasks', results.tasks, CheckSquare, (i: any) => i.title],
              ['Files', results.files, FileText, (i: any) => i.filename],
              ['Notes', results.notes, StickyNote, (i: any) => i.content],
            ].map(([label, items, Icon, render]: any) =>
              items.length > 0 && (
                <div key={label} className="mb-1">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-surface-600">{label}</div>
                  {items.slice(0, 4).map((i: any) => (
                    <button
                      key={i.id}
                      onClick={goToFullResults}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-surface-300 hover:bg-surface-800"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-surface-500" />
                      <span className="truncate">{render(i)}</span>
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        )}
        {q.trim() && (
          <button onClick={goToFullResults} className="flex w-full items-center gap-2 border-t border-surface-800 px-4 py-2.5 text-xs text-surface-500 hover:bg-surface-800/60">
            <CornerDownLeft className="h-3 w-3" /> View all results
          </button>
        )}
      </div>
    </div>
  );
}
