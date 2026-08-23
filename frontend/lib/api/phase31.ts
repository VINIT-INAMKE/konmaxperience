/**
 * The P3 "mission bridge" endpoints Mission Control and My Day read.
 *
 * They were written against an assumed contract while P3 was in flight; P3 has
 * since landed and every path below is verified against the shipped controllers
 * (`approvals.controller.ts`, `readiness.controller.ts`,
 * `mission-bridge.controller.ts`, `decisions.controller.ts`). The indirection is
 * kept on purpose: if a path is ever renamed, this file is the only edit.
 *
 * Every caller goes through `optionalGet` — several of these routes are gated
 * (`/approvals*` needs `APPROVE_EVIDENCE`, `/mission-bridge/*` needs
 * `MANAGE_SYSTEM`), so a 403 is an ordinary outcome, not an error.
 */
export const P31 = {
  /** `GET /readiness-meters/:code/history?days=30` → `MeterHistoryResponse`. */
  readinessHistory: (code: string, days = 30) =>
    `/readiness-meters/${encodeURIComponent(code)}/history?days=${days}`,

  /** `GET /approvals?mine=1&status=pending` → `Approval[]`. */
  myPendingApprovals: '/approvals?mine=1&status=pending',

  /** `GET /approvals/count` → `{ count }` — the "waiting on me" badge. */
  myPendingApprovalCount: '/approvals/count',

  /** `POST /approvals/:id/decide { decision, note? }` → the updated approval. */
  decideApproval: (id: string) => `/approvals/${id}/decide`,

  /** `GET /mission-bridge/dispatches?limit=` → `BridgeDispatch[]`. */
  bridgeDispatches: (limit = 8) => `/mission-bridge/dispatches?limit=${limit}`,

  /** `GET /decisions?status=proposed` → `Decision[]`. */
  proposedDecisions: '/decisions?status=proposed',
} as const;

/** Prisma `BridgeOutcome` — every skip records *why* it skipped. */
export type BridgeOutcome =
  | 'applied'
  | 'skipped_no_task'
  | 'skipped_no_mission'
  | 'skipped_no_owner'
  | 'failed';

/** One row of the bridge dispatch ledger (`GET /mission-bridge/dispatches`). */
export interface BridgeDispatch {
  id: string;
  rule_key: string;
  event: string;
  source_type: string;
  source_id: string;
  task_id: string | null;
  evidence_id: string | null;
  outcome: BridgeOutcome;
  detail: string | null;
  created_at: string;
}
