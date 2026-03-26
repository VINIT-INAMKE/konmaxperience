export type ActivityEventType = 'validation' | 'readiness' | 'quest_complete' | 'blocker_resolved';

export interface ActivityFeedItem {
  id: string;
  type: ActivityEventType;
  description: string;
  timestamp: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  metadata?: Record<string, unknown>;
}

export interface TeamContributionRow {
  roleCode: string;
  roleName: string;
  tasksCompleted: number;
  tasksValidated: number;
  blockedCount: number;
  readinessDelta: { meterName: string; value: number }[];
}
