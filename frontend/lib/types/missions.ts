export type MissionPhase = 'setup' | 'foundation' | 'activation' | 'scale';
export type MissionScope = 'food' | 'art' | 'lifestyle' | 'system' | 'mixed';
export type MissionStatus = 'planned' | 'active' | 'completed' | 'paused';

export const MISSION_PHASE_LABELS: Record<MissionPhase, string> = {
  setup: 'Setup',
  foundation: 'Foundation',
  activation: 'Activation',
  scale: 'Scale',
};

export const MISSION_SCOPE_LABELS: Record<MissionScope, string> = {
  food: 'Food',
  art: 'Art',
  lifestyle: 'Lifestyle',
  system: 'System',
  mixed: 'Mixed',
};

export const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
  paused: 'Paused',
};

export interface Mission {
  id: string;
  title: string;
  description: string;
  phase: MissionPhase;
  scope: MissionScope;
  status: MissionStatus;
  start_date: string | null;
  end_date: string | null;
  progress_percent: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  quests?: QuestSummary[];
}

export interface QuestSummary {
  id: string;
  title: string;
  status: string;
  progress_percent: number;
}

export interface CreateMissionDto {
  title: string;
  description: string;
  phase: MissionPhase;
  scope: MissionScope;
  start_date?: string;
  end_date?: string;
}

export interface UpdateMissionDto extends Partial<CreateMissionDto> {
  status?: MissionStatus;
}
