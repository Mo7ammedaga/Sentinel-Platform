import React, { useEffect, useState } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import { workspaceApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { useToast } from './Toast';
import { Task, Note, FileItem } from '../types';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input, Select } from './Field';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskDetailModal({ task, onClose, onChanged }: {
  task: Task; onClose: () => void; onChanged: () => void;
}) {
  const { show } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [priority, setPriority] = useState(task.priority);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setNotes(await workspaceApi.listNotes(task.id));
      setFiles(await workspaceApi.listFiles(task.id));
    } catch (e) { setError(apiError(e)); }
  };
  useEffect(() => { load(); }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const addNote = async () => {
    if (!newNote.trim()) return;
    try { await workspaceApi.createNote(task.id, newNote.trim()); setNewNote(''); await load(); }
    catch (e) { setError(apiError(e)); }
  };
  const addFile = async () => {
    if (!newFile) return;
    try { await workspaceApi.uploadFile(task.id, newFile); setNewFile(null); await load(); show('File uploaded.', 'success'); }
    catch (e) { setError(apiError(e)); }
  };
  const download = async (f: FileItem) => {
    try { await workspaceApi.downloadFile(f.id, f.filename); } catch (e) { setError(apiError(e)); }
  };
  const removeFile = async (f: FileItem) => {
    try { await workspaceApi.deleteFile(f.id); await load(); } catch (e) { setError(apiError(e)); }
  };
  const changePriority = async (next: 'low' | 'medium' | 'high') => {
    const previous = priority;
    setPriority(next);   // optimistic — the select should feel instant
    try {
      await workspaceApi.updateTaskPriority(task.id, next);
      onChanged();
    } catch (e) {
      setPriority(previous);
      setError(apiError(e));
    }
  };

  return (
    <Modal open onClose={onClose} title={task.title}>
      {error && <p className="mb-3 text-xs text-danger-400">{error}</p>}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-surface-500">Priority</label>
          <Select value={priority} onChange={(e) => changePriority(e.target.value as 'low' | 'medium' | 'high')}
                  className="w-32 py-1.5 text-xs">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-surface-500">Notes</span>
            <span className="text-xs text-surface-600">{notes.length}</span>
          </div>
          <div className="mb-2 flex gap-2">
            <Input value={newNote} onChange={(e) => setNewNote(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && addNote()} placeholder="Add a note…" />
            <Button size="sm" onClick={addNote}>Add</Button>
          </div>
          {notes.length === 0 ? (
            <p className="text-xs text-surface-600">No notes.</p>
          ) : (
            <ul className="max-h-40 space-y-1.5 overflow-y-auto text-sm text-surface-300">
              {notes.map((n) => <li key={n.id} className="rounded-lg bg-surface-800/50 px-3 py-2">{n.content}</li>)}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-surface-500">Files</span>
            <span className="text-xs text-surface-600">{files.length}</span>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <input type="file" onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                   className="w-full text-xs text-surface-400 file:mr-2 file:rounded-md file:border-0 file:bg-surface-700 file:px-2.5 file:py-1.5 file:text-xs file:text-surface-200" />
            <Button size="sm" onClick={addFile} disabled={!newFile} icon={<Upload className="h-3 w-3" />}>Upload</Button>
          </div>
          {files.length === 0 ? (
            <p className="text-xs text-surface-600">No files.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-800/50 px-3 py-2">
                  <span className="truncate text-surface-300">
                    {f.filename}{' '}
                    {f.size_bytes != null && <span className="text-xs text-surface-600">({formatBytes(f.size_bytes)})</span>}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <button onClick={() => download(f)} aria-label={`Download ${f.filename}`}
                            className="rounded p-1.5 text-surface-500 hover:bg-surface-700 hover:text-surface-200">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeFile(f)} aria-label={`Delete ${f.filename}`}
                            className="rounded p-1.5 text-surface-500 hover:bg-danger-500/20 hover:text-danger-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
