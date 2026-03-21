# Phase 5: Governance & Decision Management - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Decision logging with proper categorization (individual/cross-function/strategic), admin approval override/escalation to break deadlocks, and approval delegation with audit trail. Builds on Phase 3's evidence approval workflow. No new task types, no new validation logic, no notification system (Phase 12).

</domain>

<decisions>
## Implementation Decisions

### Decision Logging Flow
- **D-01:** Any authenticated user with CREATE_DECISION permission can log a decision
- **D-02:** Dedicated `/decisions` page in sidebar under Work section — filterable list/table of all decisions
- **D-03:** Decisions move through statuses: proposed → approved / rejected. No comment thread — the context field captures rationale, and status changes carry no additional notes
- **D-04:** Approved decisions are locked — cannot be edited or deleted. Only admin can reopen a locked decision. This is the governance guarantee.
- **D-05:** Decision types from schema: individual, cross-function, strategic
- **D-06:** Decisions can optionally link to a mission (linked_mission_id) and/or task (linked_task_id) from existing schema fields

### Approval Override & Escalation
- **D-07:** Admin can force-approve any pending approval (evidence OR decision) at any time — no waiting period
- **D-08:** Override requires a mandatory reason. Recorded as: override_by (user_id), override_reason (text), override_at (timestamp) on the approval record
- **D-09:** Override is always available — admin decides when something is stalling, no system-imposed delay
- **D-10:** When an evidence approval is overridden, the full validation cascade fires (same as normal approval: task validity → XP → quest → mission → readiness)

### Approval Delegation
- **D-11:** Temporary delegation with date range — admin sets "User A delegates to User B from [start] to [end]". Auto-expires after end date.
- **D-12:** Only admin can create delegations. Users cannot self-delegate.
- **D-13:** During active delegation, User B can approve anything User A normally would (based on User A's role permissions)
- **D-14:** Attribution: "Approved by [delegate name] (on behalf of [original approver])" — both names visible
- **D-15:** New schema model needed: `ApprovalDelegation` with from_user_id, to_user_id, start_date, end_date, created_by (admin), active boolean

### Governance Audit Trail
- **D-16:** Inline display on each entity — override reason shown on approval card, delegation "on behalf of" shown on approvals, decision status history on decision detail page. No separate audit page.
- **D-17:** Visible to all users — transparency builds trust in the 8-person team. No admin-only governance views.

### Claude's Discretion
- Decision list page layout (table vs cards, filter/sort options)
- Decision detail page design
- Override button placement on approval cards
- Delegation management UI (admin settings subsection or standalone page)
- How to display "on behalf of" inline (badge, subtitle, tooltip)
- Schema migration details for override fields and ApprovalDelegation model

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Domain Model & Schema
- `contextdocs/dev_spec.md` §7.8 (decisions) — Decision schema with types, status, linked entities
- `contextdocs/dev_spec.md` §7.9 (approvals) — Approval schema with entity_type, approval_scope, required_role_code
- `contextdocs/dev_spec.md` §9 (Business rules) — Governance rules, approval requirements

### API Design
- `contextdocs/dev_spec.md` §11.6 (decisions API) — GET/POST/PATCH /decisions
- `contextdocs/dev_spec.md` §11.7 (approvals API) — Approval endpoints

### Existing Implementation
- `backend/prisma/schema.prisma` — Decision model (lines 185-199), Approval model (lines 170-183)
- `backend/src/evidence/evidence.service.ts` — approveEvidence() and validation cascade (override must trigger same cascade)
- `backend/src/types/permissions.ts` — CREATE_DECISION, APPROVE_DECISION already defined

### Governance Architecture
- `contextdocs/blueprint.md` §Governance — Decision types, approval gates, escalation tiers

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/evidence/evidence.service.ts` — approveEvidence() pattern for override implementation (override = approve with override metadata)
- `backend/src/permissions/permissions.guard.ts` — @RequiresPermission decorator for endpoint protection
- `backend/src/permissions/permissions.cache.ts` — 60-second TTL permission cache (delegation must respect this)
- `frontend/components/ops/approvals/ApprovalQueue.tsx` — Existing approval queue page (add override button here)
- `frontend/components/ops/approvals/ApprovalItem.tsx` — Existing approval card (add override reason display)
- `frontend/components/ui/magic-card.tsx` — MagicCard for decision cards
- `frontend/components/ui/shimmer-button.tsx` — ShimmerButton for create actions

### Established Patterns
- NestJS Module → Controller → Service → Prisma
- React Query for server state, Zustand for client state
- Sonner toast for notifications
- Sheet (slide-in) for create/edit forms
- Sidebar nav grouped by section (Work, Intelligence, Admin)

### Integration Points
- Sidebar: Add "Decisions" link under Work section
- Approval queue: Add override button (admin only) to existing ApprovalItem
- Evidence approval: Override path must call same validateTask cascade
- Admin settings or separate admin page: Delegation management
- Existing Approval model: Add override_by, override_reason, override_at, delegated_from_user_id fields

</code_context>

<specifics>
## Specific Ideas

- Override should feel decisive — one click + reason, then it's done. Not a multi-step process.
- Delegation management should be low-friction since it's a rare action (someone going on leave). Don't over-engineer the UI.
- The "on behalf of" attribution is important for trust — make it clear, not hidden in a tooltip.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-governance-decision-management*
*Context gathered: 2026-03-21*
