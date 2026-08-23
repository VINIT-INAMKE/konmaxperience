/**
 * SPEC §4.4 / §6.2 — the `Approval` row the policy engine generates.
 *
 * The approvals surface used to be typed as `Evidence` because evidence was the
 * only thing that was ever approved. P3 makes the queue polymorphic: one row per
 * required role, per task / recipe / decision / evidence.
 *
 * Not re-exported from `lib/types/index.ts` — import from `@/lib/types/approvals`,
 * the same way `readiness` and `decisions` are imported.
 */

/** Prisma `ApprovalEntityType`. */
export type ApprovalEntityType = 'task' | 'evidence' | 'decision' | 'recipe';

/** Prisma `ApprovalStatus`. */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/** Prisma `ApprovalMode` — how many of the required roles have to sign off. */
export type ApprovalMode = 'all' | 'n_of';

/** Prisma `ApprovalScope` — the policy family the row was generated from. */
export type ApprovalScope =
  | 'task'
  | 'decision'
  | 'recipe'
  | 'pricing'
  | 'vendor'
  | 'experience'
  | 'tech'
  | 'hiring'
  | 'review';

/** The slice of `ApprovalPolicy` the inbox payload carries. */
export interface ApprovalPolicySummary {
  id: string;
  mode: ApprovalMode;
  min_approvals: number;
}

/** The display fields the backend resolves per entity type. */
export interface ApprovalSubject {
  id: string;
  title: string;
  /** App-relative deep link to the thing being approved. */
  url: string;
  owner?: { id: string; name: string } | null;
  /** The subject's own status (task status, recipe status, …). */
  status?: string | null;
}

export interface Approval {
  id: string;
  entity_type: ApprovalEntityType;
  entity_id: string;
  approval_scope: ApprovalScope;
  required_role_code: string;
  status: ApprovalStatus;
  notes: string | null;
  approved_by: string | null;
  approver?: { id: string; name: string } | null;
  override_by: string | null;
  override_reason: string | null;
  override_at: string | null;
  overrider?: { id: string; name: string } | null;
  delegated_from_user_id: string | null;
  delegated_from_user?: { id: string; name: string } | null;
  policy_id: string | null;
  policy?: ApprovalPolicySummary | null;
  subject: ApprovalSubject | null;
  created_at: string;
  updated_at: string;
}

/**
 * `GET /recipes/:id/approvals` — the gate for one entity, every required role,
 * decided or not. A narrower select than the inbox row: no `subject`, no policy.
 */
export interface ApprovalGateRow {
  id: string;
  required_role_code: string;
  status: ApprovalStatus;
  notes: string | null;
  approved_by: string | null;
  approver?: { id: string; name: string } | null;
  override_by: string | null;
  override_reason: string | null;
  override_at: string | null;
  policy_id: string | null;
  created_at: string;
  updated_at: string;
}

export const APPROVAL_ENTITY_LABELS: Record<ApprovalEntityType, string> = {
  task: 'Task',
  evidence: 'Evidence',
  decision: 'Decision',
  recipe: 'Recipe',
};

/** Plural headings for the grouped queue. */
export const APPROVAL_ENTITY_GROUP_LABELS: Record<ApprovalEntityType, string> = {
  task: 'Tasks',
  evidence: 'Evidence',
  decision: 'Decisions',
  recipe: 'Recipes',
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

/** Stable order for the entity tabs and the grouped queue. */
export const APPROVAL_ENTITY_ORDER: ApprovalEntityType[] = [
  'task',
  'recipe',
  'decision',
  'evidence',
];

/**
 * How much sign-off the row's policy asks for. The payload carries `mode` and
 * `min_approvals` but not the policy's `required_role_codes`, so an `all` policy
 * has no denominator to print — it is described, not counted.
 */
export function approvalPolicyLabel(
  policy: ApprovalPolicySummary | null | undefined,
): string {
  if (!policy) return 'Single approver';
  if (policy.mode === 'n_of') {
    return `Any ${policy.min_approvals} of the required roles`;
  }
  return 'Every required role';
}

/** Short form for a chip: `All` / `1 of n`. */
export function approvalPolicyShortLabel(
  policy: ApprovalPolicySummary | null | undefined,
): string {
  if (!policy) return 'Single';
  return policy.mode === 'n_of' ? `${policy.min_approvals} of n` : 'All';
}
