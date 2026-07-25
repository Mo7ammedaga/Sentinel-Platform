export type Role = 'employee' | 'manager' | 'analyst' | 'admin';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface Session {
  id: number;
  device: string;
  ip_address: string | null;
  created_at: string;
  last_used_at: string | null;
  is_current: boolean;
}

export interface FullProfile extends User {
  first_name: string;
  last_name: string;
  organization: string;
  bio: string | null;
  avatar_url: string | null;
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
  severity: IncidentSeverity | null;
  resolution_summary: string | null;
  escalated_to_id: number | null;
  escalated_at: string | null;
  escalation_note: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
}

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentActionType =
  | 'containment' | 'remediation' | 'escalation' | 'evidence' | 'note' | 'status_change';

export interface IncidentAction {
  id: number;
  investigation_id: number;
  actor_id: number;
  actor_name?: string | null;
  action_type: IncidentActionType;
  description: string;
  created_at: string;
}

export interface IncidentEvidence {
  id: number;
  investigation_id: number;
  filename: string;
  size_bytes: number | null;
  description: string | null;
  uploaded_by: number;
  uploaded_by_name?: string | null;
  created_at: string;
}

export interface IncidentSummary { id: number; name: string; }
export interface IncidentDetail extends Investigation {
  alert: Alert | null;
  subject_user: IncidentSummary & { email: string } | null;
  analyst: IncidentSummary | null;
  escalated_to: IncidentSummary | null;
  actions: IncidentAction[];
  evidence: IncidentEvidence[];
}

export interface IncidentListItem extends Investigation {
  alert_title: string | null;
  subject_user_id: number | null;
  subject_name: string | null;
}

export interface AdminSummary { id: number; name: string; email: string; }

export interface ActivityPoint {
  action: string; risk: number; status: string; time: string;
}

export interface ModelVersionPerformance {
  model_version: string;
  confirmed: number;
  false_positive: number;
  total_reviewed: number;
  confirmed_rate: number | null;
}
export interface ModelPerformance {
  overall: {
    total_reviewed: number; confirmed: number; false_positive: number;
    confirmed_rate: number | null;
  };
  by_model_version: ModelVersionPerformance[];
}

export interface RiskTrendPoint {
  date: string; avg_risk: number; critical: number; suspicious: number;
}

export interface BaselineCoverage {
  user_id: number;
  email: string;
  name: string;
  role: Role;
  event_count: number;
  required: number;
  ready: boolean;
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
export interface FileItem {
  id: number; task_id: number; filename: string; size_bytes: number | null;
}
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
  'containing',
  'resolved',
  'closed',
] as const;

// States reached only after a confirmed threat — the incident-response phase.
export const RESPONSE_PHASE_STATES = ['confirmed', 'containing', 'resolved'] as const;
