export type TaskType = 'core' | 'adhoc' | 'improvement';
export type TaskStatus = 'todo' | 'doing' | 'done' | 'blocked' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskDomain =
  | 'food'
  | 'art'
  | 'lifestyle'
  | 'ops'
  | 'procurement'
  | 'bi'
  | 'talent'
  | 'tech'
  | 'design';

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  core: 'Core',
  adhoc: 'Ad-hoc',
  improvement: 'Improvement',
};

export const TASK_TYPE_XP_WEIGHT: Record<TaskType, number> = {
  core: 1.0,
  adhoc: 0.7,
  improvement: 0.8,
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  doing: 'Doing',
  done: 'Done',
  blocked: 'Blocked',
  cancelled: 'Cancelled',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const TASK_DOMAIN_LABELS: Record<TaskDomain, string> = {
  food: 'Food',
  art: 'Art',
  lifestyle: 'Lifestyle',
  ops: 'Operations',
  procurement: 'Procurement',
  bi: 'Business Intelligence',
  talent: 'Talent',
  tech: 'Tech',
  design: 'Design/Outreach',
};

export const KANBAN_COLUMNS: TaskStatus[] = ['todo', 'doing', 'done', 'blocked'];

export interface Task {
  id: string;
  mission_id: string;
  quest_id: string | null;
  title: string;
  description: string;
  task_type: TaskType;
  domain: TaskDomain;
  owner_user_id: string;
  owner?: { id: string; name: string };
  created_by: string;
  creator?: { id: string; name: string };
  status: TaskStatus;
  priority: TaskPriority;
  xp: number;
  valid_xp: number;
  verified: boolean;
  valid: boolean;
  requires_approval: boolean;
  blocked: boolean;
  blocked_reason: string | null;
  depends_on_task_id: string | null;
  depends_on?: { id: string; title: string; status: string } | null;
  readiness_meter_id: string | null;
  readiness_value: number;
  kpi_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  is_own?: boolean;
  quest?: {
    id: string;
    title: string;
    mission?: { id: string; title: string };
  } | null;
  mission?: { id: string; title: string } | null;
  readiness_meter?: { id: string; name: string } | null;
  linked_assets?: { id: string; name: string; asset_type: string }[];
  linked_purchase_orders?: {
    id: string;
    status: string;
    total_amount: number;
    vendor: { id: string; name: string };
  }[];
}

export interface CreateTaskDto {
  mission_id: string;
  quest_id?: string;
  title: string;
  description: string;
  task_type: TaskType;
  domain: TaskDomain;
  owner_user_id: string;
  priority: TaskPriority;
  xp?: number;
  depends_on_task_id?: string;
  due_date?: string;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  depends_on_task_id?: string | null;
  due_date?: string | null;
}

export interface BlockTaskDto {
  reason: string;
}
