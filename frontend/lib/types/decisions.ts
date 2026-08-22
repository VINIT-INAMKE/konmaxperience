export type DecisionType = 'individual' | 'cross_function' | 'strategic';
export type DecisionStatus = 'proposed' | 'aligned' | 'approved' | 'rejected' | 'reopened';

export interface Decision {
  id: string;
  title: string;
  decision_type: DecisionType;
  context: string;
  proposed_by: string;
  proposer?: { id: string; name: string };
  impact_scope: string;
  final_decision: string | null;
  status: DecisionStatus;
  linked_task_id: string | null;
  linked_task?: { id: string; title: string } | null;
  linked_mission_id: string | null;
  linked_mission?: { id: string; title: string } | null;
  created_at: string;
  updated_at: string;
}

export const DECISION_TYPE_LABELS: Record<DecisionType, string> = {
  individual: 'Individual',
  cross_function: 'Cross-function',
  strategic: 'Strategic',
};

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  proposed: 'Proposed',
  aligned: 'Aligned',
  approved: 'Approved',
  rejected: 'Rejected',
  reopened: 'Reopened',
};
