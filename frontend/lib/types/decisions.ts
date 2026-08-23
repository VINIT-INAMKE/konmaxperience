export type DecisionType = 'individual' | 'cross_function' | 'strategic';
/** Prisma `DecisionStatus`. */
export type DecisionStatus = 'proposed' | 'aligned' | 'approved' | 'rejected' | 'reopened';
/** Prisma `GovernanceTier` — how much sign-off a decision needs. */
export type GovernanceTier = 'tier_1' | 'tier_2' | 'tier_3';
/** Prisma `VoteValue` — one required role's position on a decision. */
export type VoteValue = 'approve' | 'reject' | 'abstain';

/** SPEC §4.4 — one `DecisionVote` row, keyed `(decision_id, user_id)`. */
export interface DecisionVote {
  id: string;
  decision_id: string;
  user_id: string;
  user?: { id: string; name: string };
  role_code: string;
  vote: VoteValue;
  notes: string | null;
  created_at: string;
}

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
  votes?: DecisionVote[];
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

export const VOTE_VALUE_LABELS: Record<VoteValue, string> = {
  approve: 'Approved',
  reject: 'Rejected',
  abstain: 'Abstained',
};

/** Statuses that still accept votes (mirrors `OPEN_STATUSES` in the service). */
export const OPEN_DECISION_STATUSES: DecisionStatus[] = ['proposed', 'reopened'];
