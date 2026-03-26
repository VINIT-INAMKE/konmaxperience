export interface MissionControlResponse {
  missions: {
    id: string;
    title: string;
    status: string;
    progress_percent: number;
    start_date: string | null;
    end_date: string | null;
    quests: {
      id: string;
      title: string;
      status: string;
      progress_percent: number;
    }[];
    _count: { quests: number; tasks: number };
  }[];
  readiness: {
    id: string;
    code: string;
    name: string;
    current_value: number;
    target_value: number;
  }[];
  actionRequired: {
    pendingApprovals: number;
    blockers: number;
    overdueTasks: number;
  };
}
