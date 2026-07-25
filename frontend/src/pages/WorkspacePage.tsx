import React, { useCallback, useEffect, useState } from 'react';
import { workspaceApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { Project, Task, Note, FileItem } from '../types';
import { Card, Badge, Spinner, ErrorNote } from '../components/ui';

const input =
  'w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent';
const btn =
  'rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60';
const ghost =
  'rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800';

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

  // Bootstrap: ensure a workspace exists, then load projects.
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Workspace</h1>
        <p className="text-sm text-muted">
          Do your work here — every action (create, complete, upload, download…) is
          recorded as an event the security AI analyses.
        </p>
      </div>
      {error && <ErrorNote message={error} />}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Projects */}
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Projects</h2>
          <div className="mb-3 flex gap-2">
            <input className={input} placeholder="New project" value={newProject}
                   onChange={(e) => setNewProject(e.target.value)} />
            <button className={btn} onClick={addProject}>Add</button>
          </div>
          <ul className="space-y-1">
            {projects.map((p) => (
              <li key={p.id}>
                <button onClick={() => openProject(p)}
                        className={`w-full rounded px-2 py-1.5 text-left text-sm ${project?.id === p.id ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/50'}`}>
                  {p.name}
                </button>
              </li>
            ))}
            {projects.length === 0 && <li className="text-sm text-muted">No projects yet.</li>}
          </ul>
        </Card>

        {/* Tasks */}
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-200">
            {project ? `Tasks · ${project.name}` : 'Tasks'}
          </h2>
          {!project ? (
            <p className="text-sm text-muted">Select a project.</p>
          ) : (
            <>
              <div className="mb-3 flex gap-2">
                <input className={input} placeholder="New task" value={newTask}
                       onChange={(e) => setNewTask(e.target.value)} />
                <button className={btn} onClick={addTask}>Add</button>
              </div>
              <ul className="space-y-1">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-slate-800/50">
                    <button onClick={() => openTask(t)}
                            className={`text-left text-sm ${task?.id === t.id ? 'text-white' : 'text-slate-300'}`}>
                      {t.title} <Badge status={t.status === 'completed' ? 'normal' : 'open'} />
                    </button>
                    <span className="flex gap-1">
                      {t.status !== 'completed' &&
                        <button className={ghost} onClick={() => completeTask(t)}>done</button>}
                      <button className={ghost} onClick={() => removeTask(t)}>del</button>
                    </span>
                  </li>
                ))}
                {tasks.length === 0 && <li className="text-sm text-muted">No tasks.</li>}
              </ul>
            </>
          )}
        </Card>

        {/* Task detail: notes + files */}
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-200">
            {task ? `Details · ${task.title}` : 'Details'}
          </h2>
          {!task ? (
            <p className="text-sm text-muted">Select a task.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="mb-1 text-xs uppercase text-muted">Notes</div>
                <div className="mb-2 flex gap-2">
                  <input className={input} placeholder="Add note" value={newNote}
                         onChange={(e) => setNewNote(e.target.value)} />
                  <button className={btn} onClick={addNote}>Add</button>
                </div>
                <ul className="space-y-1 text-sm text-slate-300">
                  {notes.map((n) => <li key={n.id} className="rounded bg-slate-800/40 px-2 py-1">{n.content}</li>)}
                </ul>
              </div>
              <div>
                <div className="mb-1 text-xs uppercase text-muted">Files</div>
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="file"
                    onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                    className="w-full text-xs text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-xs file:text-slate-200"
                  />
                  <button className={btn} onClick={addFile} disabled={!newFile}>Upload</button>
                </div>
                <ul className="space-y-1 text-sm">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between rounded bg-slate-800/40 px-2 py-1">
                      <span className="text-slate-300">
                        {f.filename}{' '}
                        {f.size_bytes != null && (
                          <span className="text-xs text-muted">({formatBytes(f.size_bytes)})</span>
                        )}
                      </span>
                      <span className="flex gap-1">
                        <button className={ghost} onClick={() => download(f)}>download</button>
                        <button className={ghost} onClick={() => removeFile(f)}>delete</button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
