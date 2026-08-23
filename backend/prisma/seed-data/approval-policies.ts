import type { ApprovalMode, ApprovalScope, TaskDomain } from '@prisma/client';
import { RoleCode } from '../../src/types/roles';

const R = RoleCode;

export interface ApprovalPolicySeed {
  scope: ApprovalScope;
  /** `null` = the catch-all fallback for a scope (resolved to the task owner's domain lead in P3). */
  domain: TaskDomain | null;
  required_role_codes: string[];
  min_approvals: number;
  mode: ApprovalMode;
  is_default: boolean;
}

/**
 * SPEC §4.4 blueprint gates. One row per (scope, domain); the single
 * `is_default` row carries `domain: null` and is the fallback the policy
 * resolver falls back to when no specific (scope, domain) row matches.
 */
export const APPROVAL_POLICIES: ApprovalPolicySeed[] = [
  { scope: 'recipe', domain: 'food', required_role_codes: [R.BACKEND_LEAD, R.FRONTEND_LEAD], min_approvals: 2, mode: 'all', is_default: false },
  { scope: 'task', domain: 'food', required_role_codes: [R.BACKEND_LEAD, R.FRONTEND_LEAD], min_approvals: 2, mode: 'all', is_default: false },
  { scope: 'pricing', domain: 'bi', required_role_codes: [R.BI_LEAD, R.FRONTEND_LEAD], min_approvals: 2, mode: 'all', is_default: false },
  { scope: 'vendor', domain: 'procurement', required_role_codes: [R.PROCUREMENT_LEAD, R.BACKEND_LEAD], min_approvals: 2, mode: 'all', is_default: false },
  { scope: 'experience', domain: 'design', required_role_codes: [R.FRONTEND_LEAD, R.DESIGN_OUTREACH_LEAD], min_approvals: 2, mode: 'all', is_default: false },
  { scope: 'tech', domain: 'tech', required_role_codes: [R.TECH_LEAD, R.FOUNDER_ADMIN], min_approvals: 2, mode: 'all', is_default: false },
  { scope: 'hiring', domain: 'talent', required_role_codes: [R.TALENT_LEAD, R.FOUNDER_ADMIN], min_approvals: 2, mode: 'all', is_default: false },
  // Fallback: the task owner's domain lead, resolved at runtime in P3.
  { scope: 'task', domain: null, required_role_codes: [], min_approvals: 1, mode: 'n_of', is_default: true },
];
