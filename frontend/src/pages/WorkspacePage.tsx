import React, { useCallback, useEffect, useState } from 'react';
import { workspaceApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { Project, Task, Note, FileItem } from '../types';
import { Card, Spinner, ErrorNote, EmptyState } from '../components/ui';

const input =
  'w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent';
const btn =
  'shrink-0 rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60';
const ghost =
  'rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800';

const PRIORITY_STYLE: Record<string, string> = {
  low: 'border-slate-600 text-slate-400',
  medium: 'border-amber-500/40 text-amber-400',
  high: 'border-red-500/40 text-red-400',
};

function PriorityTag({ priority }: { priority: string }) {
  return (
    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${PRIORITY_STYLE[priority] || PRIORITY_STYLE.low}`}>
      {priority}
    </span>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function WorkspacePage() {
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [task, setTask] = useState<Task | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newProject, setNewProject] = useState('');
  const [newTask, setNewTask] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);

  const fail = (e: unknown) => setError(apiError(e));

  const boot = useCallback(async () => {
    try {
      let ws = await workspaceApi.listWorkspaces();
      if (ws.length === 0) await workspaceApi.createWorkspace('My Workspace');
      ws = await workspaceApi.listWorkspaces();
      setWorkspaceId(ws[0]?.id ?? null);
      setProjects(await workspaceApi.listProjects());
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { boot(); }, [boot]);

  const openProject = async (p: Project) => {
    setProject(p); setTask(null); setNotes([]); setFiles([]);
    try { setTasks(await workspaceApi.listTasks(p.id)); } catch (e) { fail(e); }
  };
  const openTask = async (t: Task) => {
    setTask(t);
    try {
      setNotes(await workspaceApi.listNotes(t.id));
      setFiles(await workspaceApi.listFiles(t.id));
    } catch (e) { fail(e); }
  };

  const addProject = async () => {
    if (!newProject.trim() || !workspaceId) return;
    try {
      await workspaceApi.createProject(workspaceId, newProject.trim());
      setNewProject('');
      setProjects(await workspaceApi.listProjects());
    } catch (e) { fail(e); }
  };
  const addTask = async () => {
    if (!newTask.trim() || !project) return;
    try {
      await workspaceApi.createTask(project.id, newTask.trim());
      setNewTask('');
      setTasks(await workspaceApi.listTasks(project.id));
    } catch (e) { fail(e); }
  };
  const completeTask = async (t: Task) => {
    try { await workspaceApi.completeTask(t.id); if (project) setTasks(await workspaceApi.listTasks(project.id)); }
    catch (e) { fail(e); }
  };
  const removeTask = async (t: Task) => {
    try {
      await workspaceApi.deleteTask(t.id);
      if (task?.id === t.id) setTask(null);
      if (project) setTasks(await workspaceApi.listTasks(project.id));
    } catch (e) { fail(e); }
  };
  const addNote = async () => {
    if (!newNote.trim() || !task) return;
    try { await workspaceApi.createNote(task.id, newNote.trim()); setNewNote(''); setNotes(await workspaceApi.listNotes(task.id)); }
    catch (e) { fail(e); }
  };
  const addFile = async () => {
    if (!newFile || !task) return;
    try {
      await workspaceApi.uploadFile(task.id, newFile);
      setNewFile(null);
      setFiles(await workspaceApi.listFiles(task.id));
    } catch (e) { fail(e); }
  };
  const download = async (f: FileItem) => {
    try { await workspaceApi.downloadFile(f.id, f.filename); } catch (e) { fail(e); }
  };
  const removeFile = async (f: FileItem) => {
    try { await workspaceApi.deleteFile(f.id); setFiles(await workspaceApi.listFiles(task!.id)); }
    catch (e) { fail(e); }
  };

  if (loading) return <Spinner />;

  const openTasks = tasks.filter((t) => t.status !== 'completed');
  const doneTasks = tasks.filter((t) => t.status === 'completed');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Workspace</h1>
        <p className="text-sm text-muted">
          Do your work here — every action (create, complete, upload, download…) is
          recorded as an event the security AI analyses.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Workspace
          {project && <><span className="mx-1.5">›</span>{project.name}</>}
          {task && <><span className="mx-1.5">›</span>{task.title}</>}
        </p>
      </div>
      {error && <ErrorNote message={error} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Projects</h2>
          <div className="mb-3 flex gap-2">
            <input className={input} placeholder="New project" value={newProject}
                   onChange={(e) => setNewProject(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && addProject()} />
            <button className={btn} onClick={addProject}>Add</button>
          </div>
          {projects.length === 0 ? (
            <EmptyState message="No projects yet — create one above." />
          ) : (
            <ul className="space-y-1">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => openProject(p)}
                    className={`w-full truncate rounded border-l-2 px-3 py-2 text-left text-sm transition ${
                      project?.id === p.id
                        ? 'border-l-accent bg-slate-800/80 text-white'
                        : 'border-l-transparent text-slate-300 hover:border-l-slate-600 hover:bg-slate-800/40'
                    }`}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Tasks</h2>
          {!project ? (
            <EmptyState message="Select a project to see its tasks." />
          ) : (
            <>
              <div className="mb-3 flex gap-2">
                <input className={input} placeholder="New task" value={newTask}
                       onChange={(e) => setNewTask(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && addTask()} />
                <button className={btn} onClick={addTask}>Add</button>
              </div>
              {tasks.length === 0 ? (
                <EmptyState message="No tasks yet — add one above." />
              ) : (
                <div className="space-y-4">
                  <ul className="space-y-1">
                    {openTasks.map((t) => (
                      <li key={t.id} className="group flex items-center justify-between gap-2 rounded">
                        <button onClick={() => openTask(t)}
                                className={`flex flex-1 items-center gap-2 truncate rounded px-2 py-1.5 text-left text-sm ${task?.id === t.id ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/40'}`}>
                          <span className="truncate">{t.title}</span>
                          <PriorityTag priority={t.priority} />
                        </button>
                        <span className="hidden shrink-0 gap-1 group-hover:flex">
                          <button className={ghost} onClick={() => completeTask(t)}>done</button>
                          <button className={ghost} onClick={() => removeTask(t)}>del</button>
                        </span>
                      </li>
                    ))}
                    {openTasks.length === 0 && <li className="px-2 text-xs text-slate-500">All tasks completed.</li>}
                  </ul>
                  {doneTasks.length > 0 && (
                    <div>
                      <div className="mb-1 px-2 text-xs uppercase text-muted">Completed ({doneTasks.length})</div>
                      <ul className="space-y-1">
                        {doneTasks.map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-2 rounded">
                            <button onClick={() => openTask(t)}
                                    className={`flex-1 truncate rounded px-2 py-1.5 text-left text-sm text-slate-500 line-through ${task?.id === t.id ? 'bg-slate-800/60' : ''}`}>
                              {t.title}
                            </button>
                            <button className={`${ghost} shrink-0`} onClick={() => removeTask(t)}>del</button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Details</h2>
          {!task ? (
            <EmptyState message="Select a task to view notes and files." />
          ) : (
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Notes</span>
                  <span className="text-xs text-slate-500">{notes.length}</span>
                </div>
                <div className="mb-2 flex gap-2">
                  <input className={input} placeholder="Add note" value={newNote}
                         onChange={(e) => setNewNote(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && addNote()} />
                  <button className={btn} onClick={addNote}>Add</button>
                </div>
                {notes.length === 0 ? (
                  <p className="text-xs text-slate-500">No notes.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-slate-300">
                    {notes.map((n) => <li key={n.id} className="rounded bg-slate-800/40 px-2 py-1.5">{n.content}</li>)}
                  </ul>
                )}
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Files</span>
                  <span className="text-xs text-slate-500">{files.length}</span>
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="file"
                    onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                    className="w-full text-xs text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-xs file:text-slate-200"
                  />
                  <button className={btn} onClick={addFile} disabled={!newFile}>Upload</button>
                </div>
                {files.length === 0 ? (
                  <p className="text-xs text-slate-500">No files.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {files.map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-2 rounded bg-slate-800/40 px-2 py-1.5">
                        <span className="truncate text-slate-300">
                          {f.filename}{' '}
                          {f.size_bytes != null && <span className="text-xs text-muted">({formatBytes(f.size_bytes)})</span>}
                        </span>
                        <span className="flex shrink-0 gap-1">
                          <button className={ghost} onClick={() => download(f)}>download</button>
                          <button className={ghost} onClick={() => removeFile(f)}>delete</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
