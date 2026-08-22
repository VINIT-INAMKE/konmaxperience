export type DecisionType = 'individual' | 'cross_function' | 'strategic';
/** Prisma `DecisionStatus`. */
export type DecisionStatus = 'proposed' | 'aligned' | 'approved' | 'rejected' | 'reopened';
/** Prisma `GovernanceTier` — how much sign-off a decision needs. */
export type GovernanceTier = 'tier_1' | 'tier_2' | 'tier_3';

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
  tier: GovernanceTier;
  required_role_codes: string[];
  resolved_by: string | null;
  resolved_at: string | null;
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

export const GOVERNANCE_TIERS: GovernanceTier[] = ['tier_1', 'tier_2', 'tier_3'];

export const GOVERNANCE_TIER_LABELS: Record<GovernanceTier, string> = {
  tier_1: 'Tier 1 — Owner call',
  tier_2: 'Tier 2 — Peer aligned',
  tier_3: 'Tier 3 — Founder approval',
};

export const GOVERNANCE_TIER_SHORT_LABELS: Record<GovernanceTier, string> = {
  tier_1: 'Tier 1',
  tier_2: 'Tier 2',
  tier_3: 'Tier 3',
};
