# Phase 05: Governance & Decision Management - Research

**Researched:** 2026-03-21
**Domain:** NestJS governance module, Prisma schema migration, Next.js App Router pages
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- D-01: Any authenticated user with CREATE_DECISION permission can log a decision
- D-02: Dedicated `/decisions` page in sidebar under Work section — filterable list/table of all decisions
- D-03: Decisions move through statuses: proposed → approved / rejected. No comment thread.
- D-04: Approved decisions are locked — cannot be edited or deleted. Only admin can reopen a locked decision.
- D-05: Decision types from schema: individual, cross-function, strategic
- D-06: Decisions can optionally link to a mission (linked_mission_id) and/or task (linked_task_id)
- D-07: Admin can force-approve any pending approval (evidence OR decision) at any time — no waiting period
- D-08: Override requires a mandatory reason. Recorded as: override_by (user_id), override_reason (text), override_at (timestamp) on the approval record
- D-09: Override is always available — admin decides when something is stalling, no system-imposed delay
- D-10: When an evidence approval is overridden, the full validation cascade fires (same as normal approval)
- D-11: Temporary delegation with date range — admin sets "User A delegates to User B from [start] to [end]". Auto-expires after end date.
- D-12: Only admin can create delegations. Users cannot self-delegate.
- D-13: During active delegation, User B can approve anything User A normally would (based on User A's role permissions)
- D-14: Attribution: "Approved by [delegate name] (on behalf of [original approver])" — both names visible
- D-15: New schema model needed: `ApprovalDelegation` with from_user_id, to_user_id, start_date, end_date, created_by (admin), active boolean
- D-16: Inline display on each entity — override reason shown on approval card, delegation "on behalf of" shown on approvals, decision status history on decision detail page. No separate audit page.
- D-17: Visible to all users — transparency builds trust in the 8-person team. No admin-only governance views.

### Claude's Discretion

- Decision list page layout (table vs cards, filter/sort options)
- Decision detail page design
- Override button placement on approval cards
- Delegation management UI (admin settings subsection or standalone page)
- How to display "on behalf of" inline (badge, subtitle, tooltip)
- Schema migration details for override fields and ApprovalDelegation model

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GOVN-01 | Decisions can be logged with type (individual, cross-function, strategic), context, and status | Decision model already in schema (lines 185-199). Needs decisions NestJS module + /decisions frontend page + DecisionForm sheet. |
| GOVN-02 | Admin/founder can override or escalate any pending approval | Approval model needs override_by/override_reason/override_at fields (schema migration). OverrideDialog component + backend POST /approvals/:id/override endpoint. Override triggers existing validateTask cascade. |
| GOVN-03 | Approval delegation when primary approver is unavailable | New ApprovalDelegation model (schema migration). DelegationsModule backend. /admin/delegations frontend page. Permission check middleware must resolve delegate's effective permissions. |
</phase_requirements>

---

## Summary

Phase 5 is a three-concern phase: decision logging (GOVN-01), admin approval override (GOVN-02), and approval delegation (GOVN-03). All three are additive — they extend existing infrastructure rather than replacing it.

The `Decision` model already exists in `schema.prisma` (lines 185-199) and has all required fields for GOVN-01. The `Approval` model (lines 170-183) exists but needs three new override fields: `override_by`, `override_reason`, and `override_at`. A wholly new `ApprovalDelegation` model is required for GOVN-03.

The primary architectural challenge is delegation: during an active delegation, the permission check middleware must resolve User B's effective permissions as the union of their own permissions plus User A's role permissions. The existing `getPermissionsForRole` cache (60-second TTL) operates on role codes and does not natively support delegation — a delegation-aware lookup layer must wrap it. The permissions cache itself does not need to change; the check happens at the service layer when processing an approval action.

**Primary recommendation:** Structure this phase as four plans — (1) backend schema + NestJS modules (decisions + delegations + override), (2) decisions frontend, (3) override UI modifications to existing ApprovalItem/ApprovalQueue, (4) delegations frontend. Plans 2-4 are parallelizable once plan 1 is complete.

---

## Standard Stack

### Core (already in project, no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS | ^11.0.1 | Backend framework | Established in project |
| Prisma | ^6.19.2 | ORM + migrations | Established in project (v6 only per constraint) |
| `@nestjs/common` | ^11.0.1 | Decorators, exceptions | Established in project |
| React Query (`@tanstack/react-query`) | project version | Server state | Established — all data fetching uses this pattern |
| Zustand | project version | Client state (auth store) | Established in project |
| Sonner | project version | Toast notifications | Established from Phase 3 |
| shadcn (base-nova) | installed | UI components | Established design system |
| MagicUI (15 components) | pre-installed | Animated UI primitives | All 15 pre-installed per Phase 4 record |
| date-fns | project version | Date formatting / comparison | Already used in ApprovalItem.tsx |
| lucide-react | project version | Icons | Established icon library |

### No New Installs Required

All libraries needed for this phase are already installed. Phase 5 introduces no new third-party dependencies.

---

## Architecture Patterns

### Established NestJS Module Pattern

Every new backend domain follows: `module.ts` → `controller.ts` → `service.ts` → Prisma. Phase 5 needs two new modules: `DecisionsModule` and `DelegationsModule`. Override logic lives in the existing `ApprovalsModule` (or a new slim module for approvals if none exists — currently the Approval model is used by evidence flow but has no dedicated module).

```
backend/src/
├── decisions/
│   ├── decisions.module.ts
│   ├── decisions.controller.ts
│   ├── decisions.service.ts
│   └── dto/
│       ├── create-decision.dto.ts
│       └── update-decision.dto.ts
├── delegations/
│   ├── delegations.module.ts
│   ├── delegations.controller.ts
│   ├── delegations.service.ts
│   └── dto/
│       └── create-delegation.dto.ts
└── approvals/                   (NEW — slim override-focused module)
    ├── approvals.module.ts
    ├── approvals.controller.ts
    └── approvals.service.ts
```

### Schema Migration Plan

**Migration adds to existing Approval model:**
```prisma
model Approval {
  // existing fields...
  override_by         String?
  overrider           User?    @relation("ApprovalOverrider", fields: [override_by], references: [id])
  override_reason     String?
  override_at         DateTime?
  delegated_from_user_id String?        // for attribution: who was the original approver
  delegated_from_user    User?  @relation("ApprovalDelegate", fields: [delegated_from_user_id], references: [id])
}
```

**Migration adds new ApprovalDelegation model (D-15):**
```prisma
model ApprovalDelegation {
  id           String   @id @default(uuid())
  from_user_id String
  from_user    User     @relation("DelegationFrom", fields: [from_user_id], references: [id])
  to_user_id   String
  to_user      User     @relation("DelegationTo", fields: [to_user_id], references: [id])
  start_date   DateTime
  end_date     DateTime
  created_by   String
  creator      User     @relation("DelegationCreator", fields: [created_by], references: [id])
  active       Boolean  @default(true)
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
}
```

**User model requires back-relations for all four new relation fields.** This is a critical detail — Prisma requires explicit `@relation` name disambiguation when a model has multiple relations to the same target. The Approval model currently has one User relation (`ApprovalApprover`). Two new named relations are needed: `ApprovalOverrider` and `ApprovalDelegate`. The `User` model must add corresponding array fields.

### Override Flow (D-07, D-08, D-10)

Override is implemented as a new endpoint `POST /approvals/:id/override` that:
1. Verifies caller has `FOUNDER_ADMIN` role (not just APPROVE_EVIDENCE — this is admin-only)
2. Validates `override_reason` is present and non-empty
3. In a `$transaction`: updates Approval record (status → approved, override_by, override_reason, override_at), then if entity_type is evidence, calls `evidenceService.validateTask()` cascade

The override endpoint is distinct from the normal approve endpoint. The existing `POST /evidence/:id/approve` remains unchanged. The override path handles the same downstream cascade but bypasses the self-approval check and adds override metadata.

```typescript
// Source: evidence.service.ts approveEvidence() pattern adapted for override
async overrideApproval(
  approvalId: string,
  adminId: string,
  reason: string,
): Promise<OverrideResult> {
  return this.prisma.$transaction(async (tx) => {
    const approval = await tx.approval.findUnique({ where: { id: approvalId } });
    // validate existence, validate status is pending

    await tx.approval.update({
      where: { id: approvalId },
      data: {
        status: 'approved',
        approved_by: adminId,
        override_by: adminId,
        override_reason: reason,
        override_at: new Date(),
      },
    });

    // If this is an evidence approval, fire the validation cascade
    if (approval.entity_type === 'evidence') {
      const evidence = await tx.evidence.update({
        where: { id: approval.entity_id },
        data: { approval_status: 'approved', reviewed_by: adminId, reviewed_at: new Date() },
      });
      return this.evidenceService.validateTask(evidence.task_id, tx);
    }

    return { overridden: true };
  });
}
```

### Delegation Permission Resolution (D-13)

The critical logic: when User B takes an approval action, the system checks if an active delegation exists from User A to User B. If found, User B is permitted to act as if they have User A's role permissions.

**Where this check lives:** In the `DelegationsService.getEffectiveRoleCode(userId)` helper. Called in the approvals controller before processing any approval action.

```typescript
// DelegationsService
async getActiveDelegationForUser(toUserId: string): Promise<ApprovalDelegation | null> {
  const now = new Date();
  return this.prisma.approvalDelegation.findFirst({
    where: {
      to_user_id: toUserId,
      active: true,
      start_date: { lte: now },
      end_date: { gte: now },
    },
    include: { from_user: { select: { id: true, role_id: true } } },
  });
}
```

**Permission cache consideration (60-second TTL):** The permissions cache stores permissions by `roleCode`. Delegation does NOT change User B's `roleCode` — it temporarily grants them access based on User A's roleCode. The approval endpoint must explicitly check delegation when User B's own role would not permit the action. This is handled at the service/controller layer, not inside `getPermissionsForRole`. No cache modification needed.

**Attribution (D-14):** When a delegated approval is recorded, `delegated_from_user_id` is set to User A's id on the Approval record. The frontend reads this field to render "Approved by [B] (on behalf of [A])".

### Decision Status Locking (D-04)

In `DecisionsService.updateDecision()`:
- PATCH endpoint checks current status
- If `status === 'approved'` and caller is not `FOUNDER_ADMIN`, throw `ForbiddenException`
- If caller is `FOUNDER_ADMIN` and action is `reopen`, set status back to `proposed`
- The "locked" guarantee is enforced at the service layer, not schema level

### Frontend Route Structure

```
frontend/app/(ops)/
├── decisions/
│   └── page.tsx               (GOVN-01 — decision log page)
└── admin/
    └── delegations/
        └── page.tsx           (GOVN-03 — admin delegation management)
```

The `approvals/page.tsx` is modified (not replaced) — adds OverrideDialog to existing ApprovalItem.

### React Query Key Conventions (from existing codebase)

All data is fetched via `apiClient.get/post` and stored under typed query keys:
```typescript
// Decisions
queryKey: ['decisions']
queryKey: ['decisions', status]  // for filter tabs

// Delegations
queryKey: ['delegations']
queryKey: ['delegations', 'active']

// After override action — must invalidate approvals
queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] })
```

### Sidebar Integration (D-02)

The Sidebar in `components/ops/Sidebar.tsx` uses a `workNav: NavItem[]` array. "Decisions" is inserted after "Approvals":
```typescript
// New fetch for decisions count (proposed decisions only)
const { data: proposedDecisions } = useQuery({
  queryKey: ['decisions', 'proposed-count'],
  queryFn: () => apiClient.get<Decision[]>('/decisions?status=proposed'),
});
const proposedCount = proposedDecisions?.length ?? 0;

// Added to workNav after Approvals entry:
{
  label: 'Decisions',
  href: '/decisions',
  icon: <ClipboardCheck className="size-4" />,
  badge: proposedCount > 0 ? String(proposedCount) : undefined,
}
```

The `NumberTicker` for the decisions count badge is used per the UI-SPEC — but the NavLink component uses shadcn `Badge`, not a raw NumberTicker. The sidebar's existing badge rendering uses string values. Per UI-SPEC, the `NumberTicker` animates the count. This means the badge in the sidebar nav item likely needs to be rendered as a custom element, not a string badge — see UI-SPEC detail vs existing pattern tension below in Pitfalls.

### Admin Route Guard Pattern

Existing admin routes (`/admin/users`, `/admin/permissions`, etc.) are rendered conditionally via `isAdmin` check in Sidebar and use Next.js App Router. The `/admin/delegations` page should follow the same pattern — the sidebar `adminNav` array receives a new entry, and the page itself can client-side redirect if `!isAdmin`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Validation cascade on override | Custom cascade logic | `EvidenceService.validateTask()` already handles full cascade | Re-implementing XP + quest + mission + readiness cascade is error-prone |
| Permission checking | Custom role lookup | `getPermissionsForRole` from `permissions.cache.ts` | Already handles caching, DB queries, cache invalidation |
| Date comparison for delegation expiry | Manual date math | `end_date: { gte: new Date() }` in Prisma query | Prisma handles timezone-aware comparison |
| Toast notifications | Custom toast system | Sonner `toast.success / toast.error` | Established from Phase 3; Toaster already mounted in providers |
| Slide-in forms | Custom modal/drawer | shadcn `Sheet` (side right, `w-[480px]`) | Established pattern — used for task forms, evidence forms |
| Confirmation dialogs | Custom modal | shadcn `Dialog` | Established pattern — used for rejection, kill-switch |
| Animated list | Custom CSS | `AnimatedList` from MagicUI | Already installed, used in ApprovalQueue |
| Blur animations | Custom CSS keyframes | `BlurFade` from MagicUI | Already installed, used on all page entries |

---

## Common Pitfalls

### Pitfall 1: Prisma Multiple Relations to Same Model
**What goes wrong:** Adding `override_by` and `delegated_from_user_id` to `Approval` creates two unnamed relations to `User`. Prisma migration fails with "Relation name missing for ambiguous relation."
**Why it happens:** Prisma requires `@relation("name")` disambiguation when a model has more than one relation to the same target model.
**How to avoid:** Name all four new User relations explicitly: `ApprovalOverrider`, `ApprovalDelegate`. Add matching back-relation array fields to `User` model: `overridden_approvals Approval[] @relation("ApprovalOverrider")`, `delegated_approvals Approval[] @relation("ApprovalDelegate")`.
**Warning signs:** `prisma migrate dev` exits with "Error: Ambiguous self relation" or "Missing @relation" error.

### Pitfall 2: Override Endpoint Also Updating Evidence Record
**What goes wrong:** The Approval model is an abstract approval gate for any entity type. An approval override should approve the Approval record AND (for evidence approvals) update the Evidence record's `approval_status` to 'approved'. Forgetting the Evidence update means `validateTask` sees `approval_status: 'pending'` and marks the task invalid even though the Approval row says 'approved'.
**Why it happens:** The approval logic in `evidence.service.ts` checks `evidence.approval_status` directly (not via Approval join). Two separate records control task validity.
**How to avoid:** In `overrideApproval()`, when `entity_type === 'evidence'`, also update the Evidence record's `approval_status` to 'approved' before calling `validateTask`.
**Warning signs:** Override succeeds (201) but task remains invalid; XP not awarded.

### Pitfall 3: Sidebar NumberTicker vs Badge String Tension
**What goes wrong:** The existing `NavLink` component renders `item.badge` as a string inside a shadcn `Badge`. The UI-SPEC calls for `NumberTicker` to animate the count in the sidebar. If you try to pass a JSX element as `item.badge: string`, TypeScript rejects it.
**Why it happens:** `NavItem` interface has `badge?: string` — not `ReactNode`.
**How to avoid:** Either (a) extend `NavItem.badge` to `ReactNode` and update NavLink rendering, or (b) handle the Decisions nav item as a special-case inline element in the sidebar nav rendering (similar to how `isPending > 24h` is handled in ApprovalItem). Option (b) is lower risk — avoids changing the shared NavItem/NavLink interface.
**Warning signs:** TypeScript error "Type 'JSX.Element' is not assignable to type 'string'".

### Pitfall 4: Delegation Check on Every Approval vs. Only When Permission Fails
**What goes wrong:** Naively querying `ApprovalDelegation` table on every approval action, even when the user has their own permission, creates unnecessary DB overhead and complexity.
**Why it happens:** Over-engineering the delegation check.
**How to avoid:** The delegation check is only needed when the acting user does NOT have the required permission from their own role. The guard should follow: (1) check own permissions — if sufficient, proceed. (2) Only if own permissions fail, check for active delegation that grants the missing permission. This is short-circuit logic.
**Warning signs:** Every approval triggers a delegation DB query even for admin/lead users.

### Pitfall 5: Decision `decision_type` vs Schema Enum Values
**What goes wrong:** Dev spec §7.8 lists `decision_type: "enum(individual, cross_function, strategic)"` with underscore. But CONTEXT.md D-05 and the UI-SPEC use `cross-function` (hyphen) as the display label for a type value of `cross_function`. If the form sends `"cross-function"` to the API, Prisma insert fails with validation error.
**Why it happens:** Mismatch between display labels and storage values.
**How to avoid:** Store `cross_function` (underscore) in the database, display "Cross-function" (hyphenated) in the UI. The Select/DTO should map display → value explicitly in the DTO or form transformation.
**Warning signs:** 400 validation error on decision creation when selecting "Cross-function" type.

### Pitfall 6: `active` Boolean vs Date-Range Expiry
**What goes wrong:** A delegation with `active: true` but `end_date < now` is logically expired but not yet deactivated. If the query only checks `active: true` without checking `end_date >= now`, expired delegations still grant permissions.
**Why it happens:** Forgetting the date-range check.
**How to avoid:** Always query with `active: true AND start_date <= now AND end_date >= now`. The `active` boolean is for explicit manual deactivation; date range handles natural expiry. Always check both.
**Warning signs:** A delegation past its end_date still grants approval permissions to User B.

---

## Code Examples

### Pattern 1: NestJS Service Method Following Existing Pattern

```typescript
// Source: backend/src/evidence/evidence.service.ts — approveEvidence() adapted
// DecisionsService.updateDecisionStatus()
async updateDecisionStatus(
  id: string,
  status: 'approved' | 'rejected' | 'proposed',
  adminId: string,
  isAdmin: boolean,
): Promise<Decision> {
  const decision = await this.prisma.decision.findUnique({ where: { id } });
  if (!decision) throw new NotFoundException(`Decision ${id} not found`);

  // Lock enforcement (D-04)
  if (decision.status === 'approved' && !isAdmin) {
    throw new ForbiddenException('Approved decisions are locked');
  }

  return this.prisma.decision.update({
    where: { id },
    data: { status, updated_at: new Date() },
    include: { proposer: { select: { id: true, name: true } } },
  });
}
```

### Pattern 2: RequiresPermission Guard Usage

```typescript
// Source: backend/src/evidence/evidence.controller.ts
@Post()
@RequiresPermission(Permission.CREATE_DECISION)
async create(@Body() dto: CreateDecisionDto, @Req() req: express.Request) {
  const user = (req as any).user;
  return this.decisionsService.create(dto, user.id);
}

@Patch(':id/status')
@RequiresPermission(Permission.APPROVE_DECISION)
async updateStatus(/* ... */) { /* ... */ }
```

### Pattern 3: React Query + apiClient Pattern

```typescript
// Source: frontend/app/(ops)/approvals/page.tsx pattern
const { data: decisions, isLoading, isError } = useQuery({
  queryKey: ['decisions', statusFilter],
  queryFn: () =>
    apiClient.get<Decision[]>(`/decisions${statusFilter ? `?status=${statusFilter}` : ''}`),
});
```

### Pattern 4: Mutation + Cache Invalidation

```typescript
// Source: frontend/components/ops/approvals/ApprovalItem.tsx — handleApprove pattern
const handleOverride = async (reason: string) => {
  setIsOverriding(true);
  try {
    await apiClient.post(`/approvals/${approvalId}/override`, { reason });
    toast.success('Approval overridden. Validation cascade triggered.');
    void queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] });
    onAction();
  } catch {
    toast.error('Override failed. Try again or check permissions.');
  } finally {
    setIsOverriding(false);
  }
};
```

### Pattern 5: Admin-Only Route Enforcement (Frontend)

```typescript
// Source: Sidebar.tsx — isAdmin pattern; consistent with existing admin/* pages
'use client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import { redirect } from 'next/navigation';

export default function DelegationsPage() {
  const user = useAuthStore((s) => s.user);
  if (user && user.roleCode !== RoleCode.FOUNDER_ADMIN) {
    redirect('/dashboard');
  }
  // ... render page
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline toast (Phase 1 pattern) | Sonner Toaster (Phase 3+) | Phase 3-03 | All Phase 5 notifications use `toast.success/error` from sonner |
| Separate pages for details | Inline expand panel | Phase 4 (MeterDetailPanel) | Decision detail uses same expand-below pattern, not a new route |
| Manual `$transaction` raw SQL | Prisma interactive transactions (`$transaction`) | Phase 1 | Override cascade uses `$transaction(async (tx) => {...})` |

---

## Validation Architecture

nyquist_validation is enabled per `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest 29 |
| Config file | `backend/package.json` (jest key) |
| Quick run command | `cd backend && npm test -- --testPathPattern=decisions` |
| Full suite command | `cd backend && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GOVN-01 | Decision CRUD, lock on approve, reopen (admin only) | unit | `cd backend && npm test -- --testPathPattern=decisions.service` | Wave 0 |
| GOVN-02 | Override sets override fields, cascade fires for evidence approval | unit | `cd backend && npm test -- --testPathPattern=approvals.service` | Wave 0 |
| GOVN-03 | Active delegation check: date range, active flag, expired does not grant permission | unit | `cd backend && npm test -- --testPathPattern=delegations.service` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && npm test -- --testPathPattern="(decisions|approvals|delegations).service" --passWithNoTests`
- **Per wave merge:** `cd backend && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/src/decisions/__tests__/decisions.service.spec.ts` — covers GOVN-01 (create, lock, reopen)
- [ ] `backend/src/approvals/__tests__/approvals.service.spec.ts` — covers GOVN-02 (override + cascade)
- [ ] `backend/src/delegations/__tests__/delegations.service.spec.ts` — covers GOVN-03 (active delegation check, expired delegation does not grant)

---

## Open Questions

1. **Approval model's entity_type enum: does it currently support 'decision'?**
   - What we know: Dev spec §7.7 shows `entity_type: "enum(task,decision,evidence)"`. Current Prisma schema stores `entity_type` as `String`, no enum constraint. So 'decision' is valid at DB level now.
   - What's unclear: No existing code creates Approval records for decisions. The planner must decide whether Phase 5 creates Approval records for decisions (e.g., for cross-function decisions) or if decision approval is handled directly via Decision.status.
   - Recommendation: Per CONTEXT.md decisions (D-03), decision status is managed directly (proposed → approved/rejected). No Approval records are created for decisions in Phase 5. The Approval model's override logic only applies to existing evidence-based Approval records. Decision approval is handled inline via `PATCH /decisions/:id` with `APPROVE_DECISION` permission.

2. **Delegations: How does the frontend know if the current user has an active delegation TO them?**
   - What we know: The backend knows active delegations. The frontend currently has no mechanism to surface this.
   - What's unclear: Should the frontend show "You are approving on behalf of [name]" when User B is acting under delegation? Or is this attribution only visible in the audit trail after the fact?
   - Recommendation: Attribution is only shown in the audit trail (D-16 confirms inline display, not pre-action notification). No frontend state change needed for the current user's delegation status. The backend sets `delegated_from_user_id` at time of approval and the frontend reads it from the already-approved record.

3. **`impact_scope` field on Decision model: required or optional in the form?**
   - What we know: The Decision schema has `impact_scope: String` (not nullable in Prisma schema line 193). The UI-SPEC decision form does NOT include an `impact_scope` field.
   - What's unclear: Must the API require this field, or can it be omitted from the Phase 5 form?
   - Recommendation: The `impact_scope` field in the existing schema was designed for the 2+1 consensus voting rule (GOVN-04, which is v2 scope). For Phase 5, the form should omit it and the DTO should make it optional with a default value (e.g., `'ops'`). Alternatively, the migration could add a nullable default. The planner must decide.

---

## Sources

### Primary (HIGH confidence)
- `backend/prisma/schema.prisma` — Decision (lines 185-199), Approval (lines 170-183), User relations, all model structures
- `backend/src/evidence/evidence.service.ts` — approveEvidence(), validateTask(), full cascade pattern (authoritative for override implementation)
- `backend/src/permissions/permissions.cache.ts` — 60-second TTL cache, `getPermissionsForRole()` signature
- `backend/src/types/permissions.ts` — CREATE_DECISION, APPROVE_DECISION already defined
- `frontend/components/ops/Sidebar.tsx` — NavItem interface, workNav array, NumberTicker usage, isAdmin pattern
- `frontend/components/ops/approvals/ApprovalItem.tsx` — existing structure to be modified (override button location)
- `frontend/components/ops/approvals/ApprovalQueue.tsx` — existing queue structure
- `frontend/app/(ops)/approvals/page.tsx` — existing page pattern
- `contextdocs/dev_spec.md` §7.7, §7.8, §9, §11.7, §11.8 — Decision/Approval schema, governance rules, API structure
- `.planning/phases/05-governance-decision-management/05-CONTEXT.md` — all locked decisions (D-01 through D-17)
- `.planning/phases/05-governance-decision-management/05-UI-SPEC.md` — component inventory, page layouts, interaction contracts
- `.planning/config.json` — nyquist_validation: true confirmed

### Secondary (MEDIUM confidence)
- `backend/src/evidence/__tests__/cascade.spec.ts` — Jest + NestJS testing pattern with Prisma mock, confirmed test file naming and structure conventions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against installed package.json and existing codebase imports
- Architecture patterns: HIGH — derived directly from existing code; NestJS module pattern and React Query patterns are confirmed from live code
- Schema migration: HIGH — schema.prisma read directly; Prisma v6 multi-relation disambiguation is a known requirement
- Override cascade: HIGH — `validateTask` and `approveEvidence` read directly; override follows same Prisma `$transaction` pattern
- Delegation permission check: MEDIUM — logic design is sound but no existing delegation code to verify against; the short-circuit approach is the correct pattern but needs careful implementation
- Pitfalls: HIGH for schema pitfalls (confirmed), MEDIUM for delegation pitfall (reasoned from code patterns)

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (stable stack — dependencies unlikely to change)
