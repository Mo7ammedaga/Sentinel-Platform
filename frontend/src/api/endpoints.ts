import { api } from './client';
import {
  Alert, DashboardStats, HighRiskUser, Investigation, Paginated, User, UserEvent,
} from '../types';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string; refresh_token: string; user: User }>(
      '/auth/login', { email, password }
    ).then((r) => r.data),
  profile: () => api.get<{ user: User }>('/auth/profile').then((r) => r.data.user),
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
  openInvestigation: (alertId: number) =>
    api.post<Investigation>(`/security/alerts/${alertId}/investigations`).then((r) => r.data),
  updateInvestigation: (id: number, state: string, notes?: string) =>
    api.patch<Investigation>(`/security/investigations/${id}`, { state, notes }).then((r) => r.data),
};

export const privacyApi = {
  notice: () => api.get('/privacy/notice').then((r) => r.data),
  myEvents: (page = 1) =>
    api.get<Paginated<UserEvent>>('/me/events', { params: { page, per_page: 25 } })
      .then((r) => r.data),
};
