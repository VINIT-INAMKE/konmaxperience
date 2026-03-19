# Phase 1 — UI Review

**Audited:** 2026-03-19
**Baseline:** 01-UI-SPEC.md (Design Contract — Foundation & Authentication)
**Screenshots:** Not captured (no dev server detected on ports 3000, 5173, 8080)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | CTAs and errors mostly match spec; fallback "Processing..." and "Something went wrong" deviate |
| 2. Visuals | 2/4 | Broken font chain renders system font not Geist; auth card lacks brand mark; ops loading is "Loading..." text not spinner |
| 3. Color | 3/4 | Accent usage correct and constrained; status badge uses hardcoded `bg-green-500/10 text-green-500` instead of CSS variable |
| 4. Typography | 2/4 | Critical: `--font-sans: var(--font-sans)` is a circular self-reference — Geist never loads; multiple arbitrary px sizes outside spec |
| 5. Spacing | 3/4 | Main content missing right-side centering; ops layout `p-6` applies but `max-w-[1200px]` has no `mx-auto` — content left-hugs |
| 6. Experience Design | 3/4 | Loading, error, empty states present; no error boundary; CreateUserDialog silently swallows submit errors |

**Overall: 16/24**

---

## Top 3 Priority Fixes

1. **Circular font variable — Geist never loads** — Every user sees the browser default system font (Times New Roman or Arial) instead of the specified Geist Variable. Fix: in `globals.css` line 10, change `--font-sans: var(--font-sans)` to `--font-sans: var(--font-geist-sans)`. This is the single biggest visual regression in the entire codebase and explains the "bad fonts" complaint.

2. **Ops layout content is left-hugged, not centered** — At wide viewports the main content area starts at the left edge of the flex area with no centering. The `max-w-[1200px]` constraint in `(ops)/layout.tsx` line 66 has no `mx-auto`, so content never centers. Fix: change `<div className="p-6 max-w-[1200px]">` to `<div className="p-6 max-w-[1200px] mx-auto w-full">`.

3. **Auth card missing brand mark** — The spec requires a brand headline ("Konma Xperience" in Display 28px) at the top of every auth card. Currently the login page (`login/page.tsx` line 69) has only "Welcome back" as the `h1`. The sidebar has the brand name but auth pages have no brand context. Fix: add a `<p className="text-[28px] font-semibold leading-[1.1]">Konma Xperience</p>` above the `h1` in the `CardHeader` of the login page, and apply the same to the other auth pages via the `PasswordSetupForm` and `ForgotPasswordPage`.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Matching the spec (passing):**
- Login CTA: "Sign in" — correct (`login/page.tsx:167`)
- Rate limit error: "Too many attempts. Try again in 5 minutes." — correct (`login/page.tsx:50`)
- Invalid credentials: "Incorrect email or password. Check your details and try again." — correct (`login/page.tsx:52-54`)
- Forgot password CTA: "Send reset link" — correct (`forgot-password/page.tsx:174`)
- No account error: "No account found with that email address." — correct (`forgot-password/page.tsx:57`)
- Set password CTA: "Set password and sign in" — correct (`set-password/page.tsx:12`)
- Reset password CTA: "Reset password and sign in" — correct (`reset-password/page.tsx:12`)
- Create user CTA: "Add member" — correct (`CreateUserDialog.tsx:195`)
- Empty state: "No team members yet" / "Add your first team member to get started." — correct (`admin/users/page.tsx:131-133`)
- Deactivation dialog: "Deactivate [name]?" + "Keep active" + exact body copy — correct (`admin/users/page.tsx:237-249`)
- Permissions saved: "Permissions updated" — correct (`PermissionMatrix.tsx:127`)

**Deviations:**

- `PasswordSetupForm.tsx:316`: Loading state shows "Processing..." — spec requires the CTA label to be preserved as-is (e.g. "Set password and sign in" → spinner + same label). The generic "Processing..." breaks the identity of the action. Fix: pass `ctaLabel` prop into the loading state so it reads `<Loader2 /> {ctaLabel}`.

- `PasswordSetupForm.tsx:129`, `login/page.tsx:59`, `forgot-password/page.tsx:62`: Fallback error text "Something went wrong. Please try again." is a generic catch-all. The spec does not define this copy because it should never surface in normal use; however when it does appear on an internal tool it reads as low-quality. Minor issue — acceptable as a fallback for unhandled API errors.

- `reset-password/page.tsx:10`: Heading passes "Choose a new password" — spec says "Choose a new password". Match. Subtitle "Enter a new password for your account." — spec says "Enter a new password for your account." Match.

- `reset-password/page.tsx:14`: Expired message passes "This setup link has expired. Ask your admin to resend the invitation." — but the spec copywriting table for expired token says "This link has expired. Ask your admin to send a new one." Minor wording divergence. Fix: align to spec copy.

- `PasswordSetupForm.tsx:84`: No-token card heading is "Invalid link" — not in the copywriting contract. Acceptable as a graceful degradation state not covered by the spec.

- `admin/users/page.tsx:237`: Deactivation dialog uses `showCloseButton={false}` — this is correct per spec (no dismiss-by-close for destructive actions).

**Score rationale:** Spec copy is met in the majority of cases. Two minor deviations: "Processing..." and the expired token wording difference.

---

### Pillar 2: Visuals (2/4)

**Critical: Brand mark absent from auth pages**

The spec (`Layout Contracts — Auth Layout`) requires: "Brand mark at top of card: 'Konma Xperience' in Display typography + small role context subtitle." No auth page implements this. The login page (`login/page.tsx:69`) opens directly with "Welcome back" as the `h1` — there is no product name on the screen. Users arriving via email links see no visual anchor to confirm they're on the right product.

**Critical: Ops layout loading state is text, not spinner**

`(ops)/layout.tsx:58-59` shows an `animate-pulse` div with "Loading..." text as the authenticated layout loading state. The spec's interaction states table specifies spinner for loading states. The spec also lists a `Spinner` component as implied by loading state treatment. A pulsing text label is significantly lower quality than a centered `Loader2` spinner. Fix: replace with `<Loader2 className="size-6 animate-spin text-muted-foreground" />`.

**Missing visual hierarchy on dashboard placeholder**

`dashboard/page.tsx:24` shows "Dashboard coming in Phase 7" as `text-muted-foreground` inside a card. While this is a Phase 1 placeholder, it has no visual hierarchy — it looks like an error state rather than a scaffolded UI. Minor for Phase 1 scope.

**Sidebar brand section minimal but acceptable**

The sidebar logo area (`Sidebar.tsx:89`) shows "Konma Xperience" in `text-sm font-semibold` — this is Label/Body weight not Display weight. However the spec does not explicitly require Display typography in the sidebar logo, so this is a minor variance.

**Password strength bar present and correct**

`PasswordSetupForm.tsx:194-216`: 3-segment strength bar with destructive/amber-500/green-500 progression — matches spec exactly.

**Icon accessibility correct**

Password show/hide toggles have correct `aria-label` toggling (`Show password`/`Hide password`) on all three pages that require it. Actions dropdown has `aria-label` for the trigger. Decorative icons lack `aria-hidden` in several cases (e.g. `Loader2` spinner icon next to button text) but this is a minor omission.

**Score rationale:** Broken font (scored under Typography) will visually degrade the entire UI, but even beyond that: missing brand mark on all auth pages and degraded loading state in the ops layout are direct spec violations that affect first impressions.

---

### Pillar 3: Color (3/4)

**Accent (`--primary`) usage audit:**

Accent is used on:
- Primary CTA buttons (via `bg-primary` in `button.tsx:13`) — correct per spec
- Active sidebar nav item (`Sidebar.tsx:191`: `bg-primary text-primary-foreground`) — correct per spec
- Password requirement check icons when met (`PasswordSetupForm.tsx:224, 242`: `text-primary`) — correct per spec
- Success state `CheckCircle` icon on forgot-password (`forgot-password/page.tsx:87`: `text-primary`) — acceptable (spec allows loading spinner; success icon is equivalent intent)

Accent is NOT used on informational text, secondary buttons, or table rows. Color discipline passes.

**Hardcoded color violation:**

`admin/users/page.tsx:183-185`:
```
'bg-green-500/10 text-green-500 border-green-500/20'
```
The spec defines semantic status colors via CSS variables: "Active: `#22C55E` (green-500 text on green-50 bg)". The hex target matches `green-500` but the spec intent is that these should be applied semantically. Since no `--status-active` CSS variable was established in `globals.css`, using `text-green-500` is the only practical option. This is a minor gap — the spec did not provide a CSS variable name for status colors, so the implementation is reasonable but not variable-driven.

**`globals.css` dark mode status**: Dark mode CSS variables are properly defined (lines 85-116). The `dark` class is applied via `html` in `layout.tsx:29`. Color tokens are all OKLCH-based as generated by the Tailwind 4 / shadcn init.

**`components.json` style: `base-nova`**: The spec says `style=default`. The shadcn `base-nova` style was used instead. This is a notable divergence — `base-nova` is a different visual language (rounder avatars, different badge shape, different card ring treatment) than `default`. Visually the `base-nova` style uses `ring-1 ring-foreground/10` on cards instead of the spec's `border --border, shadow-sm` treatment. The card appearance will differ from the Notion/Linear aesthetic target.

**Score rationale:** Accent is well-constrained. One hardcoded green-500 is justified. The `base-nova` shadcn style instead of `default` creates unspecified card treatment.

---

### Pillar 4: Typography (2/4)

**Critical: Circular CSS variable — Geist font does not load**

`app/layout.tsx:6-8`: Geist Variable is loaded and injected as `--font-geist-sans` on the `<html>` element.

`app/globals.css:10`: `--font-sans: var(--font-sans)` — this is a **circular self-reference**. The property resolves to its own computed value, which is undefined/inherited. The Tailwind `font-sans` utility resolves to `--color-... / --font-sans` which is this broken variable. The browser falls back to its default sans-serif stack (system font — typically `ui-sans-serif, system-ui, Arial`).

The correct value should be `--font-sans: var(--font-geist-sans)`. This one line is why the typography looks broken and why the user reported "bad fonts."

The mono font is correctly mapped: `--font-mono: var(--font-geist-mono)` (line 11).

**Font size usage (from codebase scan):**

Sizes found in application code (excluding shadcn UI components):
- `text-[28px]` — login `h1` (`login/page.tsx:69`)
- `text-xl` (20px) — all page headings
- `text-lg` (18px) — empty state heading (`admin/users/page.tsx:131`)
- `text-sm` (14px) — body/labels throughout
- `text-xs` (12px) — error messages, badge annotations
- `text-[13px]` — sidebar admin section label, permission matrix role headers
- `text-[11px]` — sidebar badge
- `text-[10px]` — nav badge in sidebar

The spec declares four sizes: Body (14px), Label (13px), Heading (20px), Display (28px).

**Violations:**
- `text-lg` (18px) used on empty state heading (`admin/users/page.tsx:131`) — no 18px in spec. Fix: change to `text-xl font-semibold` (20px Heading).
- `text-xs` (12px) — used for error messages. Spec maps Label at 13px for "input labels, badge text"; 12px for errors is a minor undershoot but common in error message convention. Acceptable.
- `text-[11px]` and `text-[10px]` — sub-label sizes for badge text in sidebar not in spec. These are inside Badge components and represent de-emphasis of metadata; reasonable exception.
- `text-3xl` (`app/page.tsx:16`) — this is the Next.js boilerplate root page, not an application screen. Not counted.

**Font weight usage:**

Weights found: `font-semibold` (600), `font-medium` (500), `font-normal` (400 explicit).

The spec declares two weights only: Regular (400) and Semibold (600). `font-medium` (500) appears on:
- `Sidebar.tsx:89`: brand name "Konma Xperience" (`font-semibold` — correct)
- `Sidebar.tsx:128`: user name (`font-medium`) — not in spec's two-weight system
- `dashboard/page.tsx:26`: `<span className="font-medium">` for user name
- `admin/users/page.tsx:165`: user name in table row (`font-medium`)
- `label.tsx:12`: shadcn Label component uses `font-medium` internally

Using 500 weight for name display in sidebar and table is a minor variance. The spec says body and label use 400; headings use 600. Name emphasis via 500 is a reasonable design decision but technically out of spec. Three user-facing occurrences.

**Score rationale:** The circular `--font-sans` variable is a shipping bug that makes the entire product visually wrong. Even if fixed, there are minor type scale deviations. This pillar earns 2 because the root cause is a broken implementation of the fundamental spec requirement.

---

### Pillar 5: Spacing (3/4)

**Spacing scale compliance:**

The spec declares scale: xs(4px), sm(8px), md(16px), lg(24px), xl(32px), 2xl(48px), 3xl(64px). Tailwind 4 maps: `p-1`=4px, `p-2`=8px, `p-4`=16px, `p-6`=24px, `p-8`=32px.

Application spacing values found:
- Auth card: `px-6 pt-6 pb-0` / `px-6 pb-6 pt-4` — 24px/16px, within scale
- Form spacing: `space-y-4` (16px), `space-y-2` (8px) — within scale
- Dashboard: `space-y-6` (24px) — within scale
- Page headings: `space-y-4` and `space-y-6` — within scale
- Empty state: `py-16 space-y-4` — `py-16` is 64px (3xl) which is used here as vertical centering offset. Spec allows 3xl for page-level centering. Acceptable.

**Arbitrary values found (application code only):**
- `h-[44px] w-[44px]` — password show/hide buttons (`login/page.tsx:129`, `PasswordSetupForm.tsx:177, 285`) — required by spec accessibility contract (44px minimum touch target). Correct.
- `max-w-[400px]` — auth cards — spec says `max-w-[400px]`, exact match.
- `w-[240px]` — sidebar — spec says 240px fixed, exact match.
- `max-w-[1200px]` — main content — spec says `max-w-[1200px]`, exact match.
- `min-w-[40px] min-h-[40px]` — permission matrix checkbox cells — spec says 40px minimum. Exact match.
- `w-[260px]` — AdminUserFilter select — not in spec scale, but it is a UI constraint not a spacing value.
- `text-[13px]`, `text-[11px]`, `text-[28px]` — arbitrary text sizes (covered under Typography pillar).

**Layout centering gap:**

`(ops)/layout.tsx:66`: `<div className="p-6 max-w-[1200px]">` — the `max-w` constraint is present but `mx-auto` is absent. At viewports wider than 1200px + sidebar, the main content left-aligns rather than centering. The spec says "max-w-[1200px] soft cap for very wide screens" which implies centering behavior. Fix: add `mx-auto w-full`.

**Score rationale:** Spacing scale is well-followed. Touch targets and fixed dimensions are correct per spec. The missing `mx-auto` on the main content wrapper is the one structural gap.

---

### Pillar 6: Experience Design (3/4)

**Loading states — present:**
- Login: CTA shows `Loader2 animate-spin` + "Signing in..." when submitting (`login/page.tsx:162-164`)
- Forgot password: CTA shows spinner + "Sending..." (`forgot-password/page.tsx:168-170`)
- Password setup: CTA shows spinner + "Processing..." (`PasswordSetupForm.tsx:314-316`)
- Ops layout initial load: animate-pulse + "Loading..." text — functional but lower quality than spinner (see Visuals pillar)
- Users page: `Loader2` centered spinner while fetching (`admin/users/page.tsx:121-125`)
- Permissions page: `Loader2` centered spinner while fetching (`admin/permissions/page.tsx:32-36`)
- Deactivate button: spinner + "Deactivating..." (`admin/users/page.tsx:257-260`)
- Save permissions button: spinner + "Saving..." (`PermissionMatrix.tsx:240-242`)

**Error states — mostly present:**
- Login: API errors shown via `Alert variant="destructive"` above form
- Forgot password: API errors shown via `Alert variant="destructive"`
- Password setup: API errors + token errors both handled
- Users page: No error state when user list fetch fails — `useQuery` error is silently ignored; the loading spinner disappears and nothing is shown. Fix: add `isError` check with an error message.
- Permissions page: Same gap — `useQuery` error for roles silently disappears.

**Empty states — present and correct:**
- Users page: full empty state with `Users` icon, heading, body copy, and CTA (`admin/users/page.tsx:127-141`)

**Error boundary — absent:**
No `ErrorBoundary` component is defined or used anywhere in the application tree. The spec's Interaction States table implies error handling at all levels. Without an error boundary, an uncaught render error in the ops layout would crash the entire page with React's default error UI. Fix: wrap the ops layout with an ErrorBoundary.

**CreateUserDialog silently swallows submit errors:**
`CreateUserDialog.tsx:87-88`:
```tsx
} catch {
  // Error handling in a real implementation would show the error
}
```
A failed "Add member" submission shows no feedback to the user — the submit button re-enables and the form stays open with no message. The spec requires the loading button to return to normal state AND requires an error indication. This is a shipped TODO comment masquerading as a feature.

**Disabled states — correct:**
Form fields are disabled during loading across all forms. The `Missions` nav item is disabled with `opacity-60 cursor-not-allowed` (`Sidebar.tsx:171`). The `FOUNDER_ADMIN` column checkboxes are disabled in the permission matrix.

**Destructive confirmation — correct:**
Deactivate user has a full Dialog with "Deactivate [name]?" heading, body explanation, and separate "Keep active" / "Deactivate" buttons. Matches spec exactly.

**Toast pattern — implemented but duplicated:**
Toast notifications are implemented in-component via local state in `admin/users/page.tsx`, `CreateUserDialog.tsx`, and `PermissionMatrix.tsx` — three separate implementations of the same pattern. No shared toast provider. This creates visual inconsistency (all three could show simultaneously) and maintenance burden. The spec implies a single toast system ("top-right, 3-second auto-dismiss"). Minor architectural debt.

**Unsaved changes banner — correct:**
`PermissionMatrix.tsx:229-248`: Fixed bottom banner with "Discard" + "Save changes" appears only when changes exist. Matches spec.

**Motion/animation — partially compliant:**
`animate-in slide-in-from-top-2 fade-in-0` on toast divs — these use tw-animate-css (imported in globals.css). Duration not explicitly set on these custom toasts (uses tw-animate defaults). The `prefers-reduced-motion` media query has no implementation — no `motion-reduce:` prefixes anywhere in application code. The spec requires all transitions to reduce to 0ms when OS motion setting is active.

**Score rationale:** Solid state coverage overall. Three gaps: missing error states for data-fetch failures on admin pages, no error boundary, and CreateUserDialog's swallowed errors are the material issues.

---

## Summary of All Issues Found

| Severity | File | Issue |
|----------|------|-------|
| Critical | `app/globals.css:10` | `--font-sans: var(--font-sans)` — circular reference, Geist never loads |
| High | `app/(ops)/layout.tsx:66` | Missing `mx-auto` on main content — content left-hugs at wide viewports |
| High | All auth pages | Missing brand mark ("Konma Xperience" in Display size) above page heading |
| High | `app/(ops)/layout.tsx:58-59` | Loading state is text "Loading..." not Loader2 spinner |
| Medium | `CreateUserDialog.tsx:87-88` | Submit errors silently swallowed — no user feedback on failure |
| Medium | `app/(ops)/admin/users/page.tsx` | No error state for failed `useQuery` fetch |
| Medium | `app/(ops)/admin/permissions/page.tsx` | No error state for failed `useQuery` fetch |
| Medium | `app/(auth)/reset-password/page.tsx:14` | Expired token copy diverges from spec |
| Medium | `components/auth/PasswordSetupForm.tsx:316` | Loading label "Processing..." should preserve CTA label |
| Medium | `app/(ops)/admin/users/page.tsx:131` | `text-lg` (18px) on empty state heading — spec only allows 20px heading |
| Minor | All pages | No `prefers-reduced-motion` implementation anywhere |
| Minor | No error boundary in ops layout | Uncaught render errors crash full page |
| Minor | Toast pattern duplicated 3x | No shared toast provider — three independent implementations |
| Minor | `components.json:3` | `style: "base-nova"` used instead of spec's `style: default` |
| Minor | `Sidebar.tsx:128`, `dashboard/page.tsx:26` | `font-medium` (500) used — spec allows only 400 and 600 |

---

## Files Audited

- `frontend/app/layout.tsx`
- `frontend/app/globals.css`
- `frontend/components.json`
- `frontend/app/(auth)/layout.tsx`
- `frontend/app/(auth)/login/page.tsx`
- `frontend/app/(auth)/forgot-password/page.tsx`
- `frontend/app/(auth)/set-password/page.tsx`
- `frontend/app/(auth)/reset-password/page.tsx`
- `frontend/app/(ops)/layout.tsx`
- `frontend/app/(ops)/dashboard/page.tsx`
- `frontend/app/(ops)/admin/users/page.tsx`
- `frontend/app/(ops)/admin/permissions/page.tsx`
- `frontend/components/ops/Sidebar.tsx`
- `frontend/components/ops/AdminUserFilter.tsx`
- `frontend/components/ops/CreateUserDialog.tsx`
- `frontend/components/ops/PermissionMatrix.tsx`
- `frontend/components/auth/PasswordSetupForm.tsx`

Registry audit: 0 third-party blocks checked (components.json confirms `"registries": {}` — all shadcn official only). No flags.
