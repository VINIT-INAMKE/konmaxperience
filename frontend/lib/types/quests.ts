export type QuestStatus = 'planned' | 'active' | 'completed' | 'blocked';

export const QUEST_STATUS_LABELS: Record<QuestStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
  blocked: 'Blocked',
};

export interface Quest {
  id: string;
  mission_id: string;
  title: string;
  description: string;
  week_number: number;
  owner_user_id: string;
  owner?: { id: string; name: string };
  status: QuestStatus;
  baseline_task_count: number;
  core_progress_percent: number;
  adhoc_progress_percent: number;
  progress_percent: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  mission?: { id: string; title: string };
  tasks?: TaskSummary[];
  _count?: { tasks: number };
}

export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  task_type: string;
  owner_user_id: string;
  priority: string;
  due_date: string | null;
  blocked: boolean;
  depends_on_task_id: string | null;
}

export interface CreateQuestDto {
  mission_id: string;
  title: string;
  description: string;
  week_number: number;
  owner_user_id: string;
  start_date?: string;
  end_date?: string;
}

export interface UpdateQuestDto extends Partial<CreateQuestDto> {
  status?: QuestStatus;
}
