import { api, API_BASE, tokenStore } from './client';
import {
  Alert, DashboardStats, HighRiskUser, Investigation, Paginated, User, UserEvent,
  Workspace, Project, Task, Note, FileItem, DirectoryUser, Message,
  AppNotification, SearchResults, ManagedUser, Role, BaselineCoverage, FullProfile,
  ModelPerformance, RiskTrendPoint, Session,
} from '../types';

interface AuthResponse { access_token: string; refresh_token: string; user: User; }

export interface RegisterInput {
  email: string; password: string; first_name: string; last_name: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),
  register: (input: RegisterInput) =>
    api.post<AuthResponse>('/auth/register', input).then((r) => r.data),
  profile: () => api.get<{ user: User }>('/auth/profile').then((r) => r.data.user),

  fullProfile: () => api.get<{ user: FullProfile }>('/auth/profile').then((r) => r.data.user),
  updateProfile: (data: Partial<{ first_name: string; last_name: string; bio: string }>) =>
    api.patch<{ user: FullProfile }>('/auth/profile', data).then((r) => r.data.user),
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }).then((r) => r.data),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ user: FullProfile }>('/auth/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data.user);
  },

  listSessions: () =>
    api.get<{ sessions: Session[] }>('/auth/sessions').then((r) => r.data.sessions),
  revokeSession: (id: number) =>
    api.delete(`/auth/sessions/${id}`).then((r) => r.data),
};

export const securityApi = {
  stats: () => api.get<DashboardStats>('/dashboard/stats').then((r) => r.data),
  analyze: () => api.post('/ai/analyze').then((r) => r.data),
  alerts: (status?: string) =>
    api.get<{ alerts: Alert[]; count: number }>('/security/alerts', {
      params: status ? { status } : {},
    }).then((r) => r.data),
  highRiskUsers: () =>
    api.get<{ users: HighRiskUser[] }>('/security/high-risk-users').then((r) => r.data.users),
  baselineCoverage: () =>
    api.get<{ users: BaselineCoverage[] }>('/security/baseline-coverage').then((r) => r.data.users),
  modelPerformance: () =>
    api.get<ModelPerformance>('/security/model-performance').then((r) => r.data),
  riskTrend: (days = 14) =>
    api.get<{ days: number; trend: RiskTrendPoint[] }>('/security/risk-trend', { params: { days } })
      .then((r) => r.data.trend),
  openInvestigation: (alertId: number) =>
    api.post<Investigation>(`/security/alerts/${alertId}/investigations`).then((r) => r.data),
  updateInvestigation: (id: number, state: string, notes?: string) =>
    api.patch<Investigation>(`/security/investigations/${id}`, { state, notes }).then((r) => r.data),
};

// Workspace — each mutating call generates a behavioural Event server-side.
export const workspaceApi = {
  listWorkspaces: () =>
    api.get<Paginated<Workspace>>('/workspaces').then((r) => r.data.items),
  createWorkspace: (name: string) =>
    api.post<Workspace>('/workspaces', { name }).then((r) => r.data),

  listProjects: () =>
    api.get<Paginated<Project>>('/projects', { params: { per_page: 100 } })
      .then((r) => r.data.items),
  createProject: (workspace_id: number, name: string) =>
    api.post<Project>('/projects', { workspace_id, name }).then((r) => r.data),

  listTasks: (project_id: number) =>
    api.get<Paginated<Task>>('/tasks', { params: { project_id, per_page: 100 } })
      .then((r) => r.data.items),
  createTask: (project_id: number, title: string) =>
    api.post<Task>('/tasks', { project_id, title }).then((r) => r.data),
  completeTask: (id: number) =>
    api.put<Task>(`/tasks/${id}`, { status: 'completed' }).then((r) => r.data),
  deleteTask: (id: number) => api.delete(`/tasks/${id}`).then((r) => r.data),

  listNotes: (task_id: number) =>
    api.get<Paginated<Note>>('/notes', { params: { task_id, per_page: 100 } })
      .then((r) => r.data.items),
  createNote: (task_id: number, content: string) =>
    api.post<Note>('/notes', { task_id, content }).then((r) => r.data),

  listFiles: (task_id: number) =>
    api.get<Paginated<FileItem>>('/files', { params: { task_id, per_page: 100 } })
      .then((r) => r.data.items),

  // Real upload: sends the ACTUAL file the user picked on their device.
  uploadFile: (task_id: number, file: File) => {
    const form = new FormData();
    form.append('task_id', String(task_id));
    form.append('file', file);
    return api.post<FileItem>('/files', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  // Real download: fetches the actual bytes and saves them via the browser
  // (axios' client isn't used here because we need the raw Blob response, not
  // JSON — same auth-header pattern as MyDataPage's event export).
  downloadFile: async (id: number, filename: string) => {
    const res = await fetch(`${API_BASE}/api/v1/files/${id}/download`, {
      headers: { Authorization: `Bearer ${tokenStore.access()}` },
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  deleteFile: (id: number) => api.delete(`/files/${id}`).then((r) => r.data),
};

// Team chat (direct messages between colleagues).
export const chatApi = {
  directory: () =>
    api.get<{ users: DirectoryUser[] }>('/users').then((r) => r.data.users),
  conversation: (withUserId: number) =>
    api.get<Paginated<Message>>('/messages', { params: { with: withUserId, per_page: 100 } })
      .then((r) => r.data.items),
  send: (recipient_id: number, content: string) =>
    api.post<Message>('/messages', { recipient_id, content }).then((r) => r.data),
  markRead: (id: number) => api.post(`/messages/${id}/read`).then((r) => r.data),
};

export const notificationsApi = {
  list: () =>
    api.get<Paginated<AppNotification>>('/notifications', { params: { per_page: 50 } })
      .then((r) => r.data.items),
  unreadCount: () =>
    api.get<{ unread: number }>('/notifications/unread-count').then((r) => r.data.unread),
  markRead: (id: number) => api.post(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.post('/notifications/read-all').then((r) => r.data),
};

export const searchApi = {
  query: (q: string) =>
    api.get<SearchResults>('/search', { params: { q } }).then((r) => r.data),
};

export const adminApi = {
  listUsers: () =>
    api.get<{ users: ManagedUser[] }>('/admin/users').then((r) => r.data.users),
  setRole: (userId: number, role: Role) =>
    api.patch<ManagedUser>(`/admin/users/${userId}/role`, { role }).then((r) => r.data),
};

export const privacyApi = {
  notice: () => api.get('/privacy/notice').then((r) => r.data),
  myEvents: (page = 1) =>
    api.get<Paginated<UserEvent>>('/me/events', { params: { page, per_page: 25 } })
      .then((r) => r.data),
};
