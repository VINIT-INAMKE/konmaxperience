---
phase: 01-foundation-authentication
plan: 03
subsystem: frontend
tags: [nextjs, react, zustand, tanstack-query, jose, middleware, shadcn, rbac, auth-pages, sidebar, permission-matrix]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Next.js scaffold with shadcn/ui (15 components), Tailwind v4, shared types (RoleCode, Permission, auth)"
  - phase: 01-02
    provides: "JWT login/refresh/logout with httpOnly cookies, user/role management APIs, permission cache"
provides:
  - "Edge middleware verifying JWT with jose, redirecting unauthenticated users to /login with ?redirect= param"
  - "API client with credentials: include, auto-refresh on 401, typed fetch wrapper"
  - "Zustand auth store with sessionStorage persistence"
  - "Login page with email/password form, show/hide toggle, error and rate-limit states"
  - "Forgot/set/reset password pages following UI-SPEC interaction contracts"
  - "Ops layout with 240px sidebar + flex main content (max-w-1200px)"
  - "Role-scoped sidebar: Dashboard, Missions (disabled), Admin section for FOUNDER_ADMIN only"
  - "Sidebar user dropdown with Log out and Log out everywhere"
  - "Admin user management: team table, create user dialog, deactivate confirmation"
  - "Admin permission settings: 15x8 permission matrix, FOUNDER_ADMIN locked, unsaved changes banner"
  - "Dashboard shell with user name/role display and Phase 7 placeholder"
affects: [02-mission-execution, 03-evidence-validation, 04-approvals, 07-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [edge-jwt-verification-with-jose, api-client-auto-refresh-on-401, zustand-session-storage-persist, shared-password-setup-form-component]

key-files:
  created:
    - frontend/middleware.ts
    - frontend/lib/api-client.ts
    - frontend/lib/auth.ts
    - frontend/lib/stores/auth-store.ts
    - frontend/lib/providers.tsx
    - frontend/app/(auth)/layout.tsx
    - frontend/app/(auth)/login/page.tsx
    - frontend/app/(auth)/forgot-password/page.tsx
    - frontend/app/(auth)/set-password/page.tsx
    - frontend/app/(auth)/reset-password/page.tsx
    - frontend/components/auth/PasswordSetupForm.tsx
    - frontend/app/(ops)/layout.tsx
    - frontend/app/(ops)/dashboard/page.tsx
    - frontend/app/(ops)/admin/users/page.tsx
    - frontend/app/(ops)/admin/permissions/page.tsx
    - frontend/components/ops/Sidebar.tsx
    - frontend/components/ops/AdminUserFilter.tsx
    - frontend/components/ops/CreateUserDialog.tsx
    - frontend/components/ops/PermissionMatrix.tsx
  modified:
    - frontend/app/layout.tsx

key-decisions:
  - "Shared PasswordSetupForm component for set-password and reset-password pages -- avoids duplication, only copy differs"
  - "Suspense boundaries around all pages using useSearchParams (Next.js requirement)"
  - "Select onValueChange typed as unknown in base-ui, cast to string explicitly for type safety"
  - "Toast notifications implemented inline (fixed position) rather than adding a toast library -- Phase 1 scope"

patterns-established:
  - "Auth page pattern: Card-based centered layout with consistent heading/subtitle/form/CTA structure"
  - "Ops page pattern: h1 title + action button in header row, content below"
  - "API data fetching: useQuery from tanstack/react-query with queryKey for cache invalidation"
  - "Sidebar role gating: check user.roleCode === RoleCode.FOUNDER_ADMIN for admin-only sections"
  - "Dialog pattern: controlled open state from parent, form inside dialog, invalidate query on success"

requirements-completed: [AUTH-01, AUTH-02, AUTH-04, AUTH-05, AUTH-06]

# Metrics
duration: 13min
completed: 2026-03-19
---

# Phase 01 Plan 03: Frontend Auth & Ops UI Summary

**Next.js edge middleware with jose JWT verification, auth pages (login/forgot/set/reset password), ops layout with role-scoped sidebar, admin user management table, and 15x8 permission matrix**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-19T14:34:34Z
- **Completed:** 2026-03-19T14:47:46Z
- **Tasks:** 2 of 2 auto tasks (checkpoint pending)
- **Files modified:** 20

## Accomplishments

- Edge middleware using jose for JWT verification at edge runtime, with redirect to /login preserving ?redirect= param
- Complete auth page suite: login (with show/hide password, error states, rate-limit), forgot password (with success state + resend countdown), set/reset password (with 3-segment strength indicator, requirements checklist, token error states)
- Ops layout with 240px fixed sidebar featuring role-scoped navigation (FOUNDER_ADMIN sees Admin section with Team and Permissions)
- Admin user management with team table (avatar, name, email, role badge, status badge, actions), create user dialog, deactivate confirmation
- Admin permission settings with 15x8 matrix, FOUNDER_ADMIN column locked, unsaved changes detection with floating save banner
- Dashboard shell with user name/role display and AdminUserFilter for admin users

## Task Commits

Each task was committed atomically:

1. **Task 1: Edge middleware, auth utilities, API client, and auth pages** - `cc9064c` (feat)
2. **Task 2: Ops layout, sidebar, admin pages, dashboard** - `c783273` (feat)

## Files Created/Modified

- `frontend/middleware.ts` - Edge JWT verification with jose, PUBLIC_PATHS bypass, redirect with ?redirect= param
- `frontend/lib/api-client.ts` - Typed fetch wrapper with credentials: include, auto-refresh on 401
- `frontend/lib/auth.ts` - Auth helper functions: login, logout, logoutAll, forgotPassword, resetPassword, setPassword
- `frontend/lib/stores/auth-store.ts` - Zustand store with sessionStorage persistence for user session
- `frontend/lib/providers.tsx` - QueryClientProvider + TooltipProvider wrapper
- `frontend/app/layout.tsx` - Updated to wrap children with Providers
- `frontend/app/(auth)/layout.tsx` - Full-viewport centered layout for auth pages
- `frontend/app/(auth)/login/page.tsx` - Login with "Welcome back", email/password, show/hide toggle, error states
- `frontend/app/(auth)/forgot-password/page.tsx` - Forgot password with success state, resend countdown
- `frontend/app/(auth)/set-password/page.tsx` - Set password with strength indicator, requirements checklist
- `frontend/app/(auth)/reset-password/page.tsx` - Reset password (same form, different copy)
- `frontend/components/auth/PasswordSetupForm.tsx` - Shared password form with strength indicator and token error handling
- `frontend/app/(ops)/layout.tsx` - Two-column layout with sidebar, auto-fetch /auth/me
- `frontend/app/(ops)/dashboard/page.tsx` - Dashboard with user name/role, Phase 7 placeholder
- `frontend/app/(ops)/admin/users/page.tsx` - Team table with create/deactivate actions
- `frontend/app/(ops)/admin/permissions/page.tsx` - Permissions page with PermissionMatrix
- `frontend/components/ops/Sidebar.tsx` - 240px sidebar with role-scoped nav, user dropdown
- `frontend/components/ops/AdminUserFilter.tsx` - Placeholder select for admin user filtering
- `frontend/components/ops/CreateUserDialog.tsx` - Dialog with name/email/role form
- `frontend/components/ops/PermissionMatrix.tsx` - 15x8 matrix with checkboxes, unsaved changes banner

## Decisions Made

- **Shared PasswordSetupForm component:** Created a reusable component for set-password and reset-password pages that accepts heading, subtitle, CTA label, and submit action as props. Eliminates code duplication.
- **Suspense boundaries:** Wrapped all pages using useSearchParams in Suspense boundaries as required by Next.js App Router.
- **Inline toast notifications:** Used fixed-position div elements for toast notifications rather than adding a third-party toast library. Adequate for Phase 1 scope; can be upgraded to sonner/react-hot-toast later.
- **base-ui Select type cast:** The base-ui Select component's onValueChange passes `unknown`, so we cast to `string` explicitly to satisfy TypeScript.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed base-ui Select onValueChange type**
- **Found during:** Task 2 (CreateUserDialog)
- **Issue:** base-ui Select's `onValueChange` callback passes `unknown` type, not `string`, causing TS2345
- **Fix:** Added explicit `as string` cast: `onValueChange={(value) => setValue('roleId', value as string)}`
- **Files modified:** frontend/components/ops/CreateUserDialog.tsx
- **Verification:** npx tsc --noEmit passes
- **Committed in:** c783273 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Trivial type cast fix. No scope creep.

## Issues Encountered

None - all tasks completed without blocking issues.

## User Setup Required

Before running the frontend:
1. Set `JWT_SECRET` in `frontend/.env.local` (same value as backend)
2. Set `NEXT_PUBLIC_API_URL=http://localhost:4000` in `frontend/.env.local`
3. Backend must be running on port 4000 with database migrated and seeded

## Next Phase Readiness

- Complete frontend auth flow ready for end-to-end verification (Task 3 checkpoint)
- All pages match UI-SPEC contracts for copy, layout, and interaction states
- Ops layout structure ready for all future phase pages (missions, tasks, evidence, etc.)
- **Checkpoint:** Human verification of the full auth flow is the next step (Task 3)

## Self-Check: PASSED

All 19 key files verified present on disk. Both commit hashes (cc9064c, c783273) found in git log. TypeScript compilation passes (npx tsc --noEmit). All auto tasks complete, awaiting human verification checkpoint (Task 3).

---
*Phase: 01-foundation-authentication*
*Completed: 2026-03-19*
