export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'pending' | 'closed' | 'escalated';
export type UserRole = string;

export interface RoleDefinition {
  id: string;
  name: string;
  permissions: string[];
  description?: string;
}

export interface EscalationEntry {
  reason: string;
  timestamp: number;
  userId: string;
  userName: string;
}

export interface Incident {
  id: string;
  ticketNumber: string;
  alertName: string;
  severity: Severity;
  host: string;
  description: string;
  detectionTime: number;
  slaDeadline: number;
  status: IncidentStatus;
  ownerId: string;
  domain: string;
  evidenceUrl?: string;
  extensionRequested?: boolean;
  extensionReason?: string;
  correlationId?: string;
  assignedTo?: string; // User name
  closureComment?: string;
  rootCause?: string;
  escalationHistory?: EscalationEntry[];
  source?: 'MANUAL' | 'EMAIL';
  metadata?: any;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions?: string[];
}

export interface AssignmentRule {
  id: string;
  name: string;
  keyword: string;
  assignedToUserId: string;
  assignedToUserName: string;
  active: boolean;
  matchingStrategy?: 'exact' | 'fuzzy' | 'regex' | 'contains';
  priority?: number;
  severityOverride?: string;
  autoSlaAssignment?: boolean;
  sendNotifications?: boolean;
}

export interface Analytics {
  open: number;
  closed: number;
  pending: number;
  escalated: number;
  slaBreached: number;
  mttr: number; // Mean time to resolve
}
