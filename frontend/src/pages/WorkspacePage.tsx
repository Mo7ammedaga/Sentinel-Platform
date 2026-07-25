import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus, FolderKanban, ChevronLeft, MoreHorizontal, Trash2, ArrowRight, ArrowLeft,
} from 'lucide-react';
import { workspaceApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { useToast } from '../components/Toast';
import { Project, Task } from '../types';
import { Card, EmptyState } from '../components/ui';
import { Button } from '../components/Button';
import { Input, Select } from '../components/Field';
import { Modal, ConfirmModal } from '../components/Modal';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { CardSkeleton } from '../components/Skeleton';

const PRIORITY_STYLE: Record<string, string> = {
  low: 'border-l-surface-500',
  medium: 'border-l-warning-500',
  high: 'border-l-danger-500',
};
const PRIORITY_TAG: Record<string, string> = {
  low: 'text-surface-500', medium: 'text-warning-400', high: 'text-danger-400',
};

const COLUMNS: { key: 'pending' | 'in_progress' | 'completed'; label: string }[] = [
  { key: 'pending', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Done' },
];

function TaskCard({ task, onOpen, onMove, onDelete }: {
  task: Task; onOpen: () => void; onMove: (dir: 1 | -1) => void; onDelete: () => void;
}) {
  const idx = COLUMNS.findIndex((c) => c.key === task.status);
  return (
    <div className={`group animate-scaleIn rounded-lg border-l-4 border border-surface-800 bg-surface-900 p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:border-surface-700 hover:shadow-card ${PRIORITY_STYLE[task.priority]}`}>
      <button onClick={onOpen}
              className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50">
        <div className="text-sm text-surface-200">{task.title}</div>
        <div className={`mt-1.5 text-[10px] font-medium uppercase tracking-wide ${PRIORITY_TAG[task.priority]}`}>{task.priority}</div>
      </button>
      {/* Always visible on touch (no hover state exists there); hover-reveal
          is a desktop-only declutter, not the only way to reach these. */}
      <div className="mt-2 flex items-center justify-between gap-1 md:hidden md:group-hover:flex">
        <button disabled={idx <= 0} onClick={() => onMove(-1)} aria-label="Move to previous column"
                className="rounded p-1 text-surface-500 hover:bg-surface-800 hover:text-surface-200 disabled:opacity-0">
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDelete} aria-label="Delete task"
                className="rounded p-1 text-surface-600 hover:bg-danger-500/20 hover:text-danger-400">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button disabled={idx >= COLUMNS.length - 1} onClick={() => onMove(1)} aria-label="Move to next column"
                className="rounded p-1 text-surface-500 hover:bg-surface-800 hover:text-surface-200 disabled:opacity-0">
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function WorkspacePage() {
  const { show } = useToast();
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<Task | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<Project | null>(null);

  const fail = (e: unknown) => { const msg = apiError(e); setError(msg); show(msg, 'error'); };

  const boot = useCallback(async () => {
    try {
      let ws = await workspaceApi.listWorkspaces();
      if (ws.length === 0) await workspaceApi.createWorkspace('My Workspace');
      ws = await workspaceApi.listWorkspaces();
      setWorkspaceId(ws[0]?.id ?? null);
      setProjects(await workspaceApi.listProjects());
    } catch (e) { fail(e); } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { boot(); }, [boot]);

  const openProject = async (p: Project) => {
    setProject(p);
    try { setTasks(await workspaceApi.listTasks(p.id)); } catch (e) { fail(e); }
  };

  const addProject = async () => {
    if (!newProjectName.trim() || !workspaceId) return;
    try {
      await workspaceApi.createProject(workspaceId, newProjectName.trim());
      setNewProjectName(''); setNewProjectOpen(false);
      setProjects(await workspaceApi.listProjects());
      show('Project created.', 'success');
    } catch (e) { fail(e); }
  };
  const deleteProject = async (p: Project) => {
    try {
      await workspaceApi.deleteProject(p.id);
      setProjects(await workspaceApi.listProjects());
      if (project?.id === p.id) setProject(null);
      show('Project deleted.', 'success');
    } catch (e) { fail(e); }
  };

  const addTask = async () => {
    if (!newTaskName.trim() || !project) return;
    try {
      await workspaceApi.createTask(project.id, newTaskName.trim(), newTaskPriority);
      setNewTaskName('');
      setTasks(await workspaceApi.listTasks(project.id));
    } catch (e) { fail(e); }
  };
  const refreshTasks = async () => {
    if (!project) return;
    try { setTasks(await workspaceApi.listTasks(project.id)); } catch (e) { fail(e); }
  };
  const moveTask = async (t: Task, dir: 1 | -1) => {
    const idx = COLUMNS.findIndex((c) => c.key === t.status);
    const next = COLUMNS[idx + dir];
    if (!next) return;
    try {
      await workspaceApi.updateTaskStatus(t.id, next.key);
      setTasks(await workspaceApi.listTasks(project!.id));
      if (next.key === 'completed') show(`"${t.title}" completed 🎉`, 'success');
    } catch (e) { fail(e); }
  };
  const deleteTask = async (t: Task) => {
    try {
      await workspaceApi.deleteTask(t.id);
      setTasks(await workspaceApi.listTasks(project!.id));
      show('Task deleted.', 'success');
    } catch (e) { fail(e); }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Workspace</h1>
          <p className="text-sm text-surface-500">
            Every action here — create, complete, upload, download — is recorded as an event the security AI analyses.
          </p>
        </div>
        {!project && (
          <Button icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setNewProjectOpen(true)}>New project</Button>
        )}
      </div>

      {error && <p className="text-sm text-danger-400">{error}</p>}

      {!project ? (
        projects.length === 0 ? (
          <EmptyState message="No projects yet — create one to get started." icon={FolderKanban} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Card key={p.id} hover className="group relative cursor-pointer">
                <button onClick={() => openProject(p)}
                        className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500/10">
                    <FolderKanban className="h-4.5 w-4.5 text-primary-400" />
                  </div>
                  <div className="truncate text-sm font-semibold text-surface-100">{p.name}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-surface-500">{p.description || 'No description'}</div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteProject(p); }}
                  aria-label={`Delete project ${p.name}`}
                  className="absolute right-3 top-3 rounded p-1 text-surface-600 hover:bg-danger-500/20 hover:text-danger-400 md:hidden md:group-hover:block"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </Card>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => setProject(null)} className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-200">
              <ChevronLeft className="h-4 w-4" /> {project.name}
            </button>
            <div className="flex gap-2">
              <Input value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && addTask()} placeholder="New task title…" className="w-56" />
              <Select value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                      className="w-28">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
              <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={addTask}>Add</Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.key);
              return (
                <div key={col.key} className="rounded-xl border border-surface-800 bg-surface-900/40 p-3">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-surface-500">{col.label}</span>
                    <span className="rounded-full bg-surface-800 px-2 py-0.5 text-[10px] text-surface-400">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        onOpen={() => setOpenTask(t)}
                        onMove={(dir) => moveTask(t, dir)}
                        onDelete={() => setConfirmDeleteTask(t)}
                      />
                    ))}
                    {colTasks.length === 0 && (
                      <p className="px-1 py-3 text-center text-xs text-surface-700">Nothing here.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} title="New project"
             footer={<Button onClick={addProject}>Create project</Button>}>
        <Input label="Project name" value={newProjectName} autoFocus
               onChange={(e) => setNewProjectName(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && addProject()} />
      </Modal>

      {openTask && (
        <TaskDetailModal task={openTask} onClose={() => setOpenTask(null)} onChanged={refreshTasks} />
      )}

      <ConfirmModal
        open={!!confirmDeleteTask}
        onClose={() => setConfirmDeleteTask(null)}
        onConfirm={() => confirmDeleteTask && deleteTask(confirmDeleteTask)}
        title="Delete task"
        message={`Delete "${confirmDeleteTask?.title}"? This also removes its notes and files.`}
      />
      <ConfirmModal
        open={!!confirmDeleteProject}
        onClose={() => setConfirmDeleteProject(null)}
        onConfirm={() => confirmDeleteProject && deleteProject(confirmDeleteProject)}
        title="Delete project"
        message={`Delete "${confirmDeleteProject?.name}"?`}
      />
    </div>
  );
}
