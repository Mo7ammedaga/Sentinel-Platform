export type Role = 'employee' | 'manager' | 'analyst' | 'admin';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface DashboardStats {
  total_events: number;
  critical: number;
  suspicious: number;
  normal: number;
  time_period: string;
}

export interface Alert {
  id: number;
  event_id: number;
  user_id: number;
  user_email: string | null;
  user_name: string | null;
  severity: 'suspicious' | 'critical';
  risk_score: number;
  title: string;
  explanation: string;
  status: 'open' | 'investigating' | 'closed';
  created_at: string;
}

export interface Investigation {
  id: number;
  alert_id: number;
  analyst_id: number | null;
  state: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface HighRiskUser {
  user_id: number;
  email: string | null;
  name: string | null;
  current_score: number;
  open_alerts: number;
  last_flagged_at: string | null;
}

export interface LiveAlert {
  event_id: number;
  user_id: number;
  user_email: string | null;
  user_name: string | null;
  action: string;
  risk_score: number;
  status: 'suspicious' | 'critical';
  confidence: number;
  explanation: string;
  message: string;
  timestamp: string;
}

export interface UserEvent {
  id: number;
  action_type: string;
  resource_type: string;
  description: string | null;
  ip_address: string | null;
  status: string;
  risk_score: number;
  created_at: string;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; per_page: number; total: number; pages: number };
}

export interface Workspace { id: number; name: string; description: string | null; }
export interface Project { id: number; workspace_id: number; name: string; description: string | null; }
export interface Task {
  id: number; project_id: number; title: string; description: string | null;
  status: string; priority: string;
}
export interface Note { id: number; task_id: number; content: string; created_at: string; }
export interface FileItem { id: number; task_id: number; filename: string; file_path: string; }
export interface DirectoryUser { id: number; name: string; role: string; }
export interface AppNotification {
  id: number; type: string; title: string; body: string | null;
  link: string | null; is_read: boolean; created_at: string;
}
export interface SearchResults {
  projects: Project[]; tasks: Task[]; files: FileItem[]; notes: Note[];
}
export interface Message {
  id: number; sender_id: number; recipient_id: number; content: string;
  is_read: boolean; created_at: string;
}

export interface ManagedUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  is_active: boolean;
}

export const INVESTIGATION_STATES = [
  'open',
  'assigned',
  'investigating',
  'needs_evidence',
  'false_positive',
  'confirmed',
  'closed',
] as const;
