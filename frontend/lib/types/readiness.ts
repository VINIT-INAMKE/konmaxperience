export interface ReadinessMeter {
  id: string;
  code: string;
  name: string;
  description: string;
  current_value: number;
  target_value: number;
  weight: number;
}

export interface MeterTaskEvent {
  id: string;
  task_id: string;
  value: number;
  created_at: string;
  task: {
    id: string;
    title: string;
    valid_xp: number;
    owner: { id: string; name: string };
  };
}
