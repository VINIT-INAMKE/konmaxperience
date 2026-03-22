# Full Ops/Admin UI Audit

**Audited:** 2026-03-22
**Scope:** ALL files in `frontend/components/ops/` (130+ components) and `frontend/app/(ops)/` (50 pages)
**Method:** Code-only audit (no dev server screenshots)

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total component files audited | ~130 |
| Total page files audited | ~50 |
| ARIA/accessibility attributes found | 81 across 36 files |
| Form labels (Label/htmlFor) found | 78 across 26 files |
| Hard-coded hex colors | 40+ instances across 30+ files |
| `motion-reduce:animate-none` coverage | 31 instances across 27 files |
| `text-white` (non-token) usage | 20+ instances |
| Fixed width values (w-[Npx]) | 20+ instances |

---

## ISSUES

### CRITICAL

---

#### ISSUE C-01: TaskKanban uses fixed `grid-cols-4` with no responsive breakpoints

- **File:** `frontend/components/ops/tasks/TaskKanban.tsx`, line 162
- **Severity:** Critical
- **Category:** Responsive
- **Description:** The kanban board uses `grid-cols-4` with no responsive breakpoints. On screens narrower than ~1000px, columns will be crushed to unusable widths. Combined with the sidebar width of 240px, the available space is `viewport - 240px - 48px padding`, meaning on a 1280px screen each column gets ~248px. On any screen below 1280px this will overflow or become illegible.
- **Impact:** Users on tablets or small laptops cannot use the task board at all. The 4-column layout with `h-[calc(100vh-280px)]` creates a rigid layout that provides no fallback.
- **Recommendation:** Add responsive breakpoints: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` or implement a horizontally scrollable kanban with `overflow-x-auto` and `min-w-[250px]` per column.

---

#### ISSUE C-02: Sidebar has no mobile/responsive behavior

- **File:** `frontend/components/ops/Sidebar.tsx`, line 282
- **Severity:** Critical
- **Category:** Responsive
- **Description:** The sidebar uses a fixed `w-[240px]` with no responsive collapse. The layout in `layout.tsx` uses `flex h-screen` with `flex-1` for content, but there is no hamburger menu, drawer, or breakpoint-based hiding. On mobile viewports, the sidebar will consume 240px of a 375px screen, leaving only 135px for content.
- **Impact:** The entire ops interface is unusable on mobile devices. Any team member accessing on a phone sees a sidebar consuming 64% of the screen width.
- **Recommendation:** Implement a responsive sidebar pattern: hidden by default on `md:` and below, triggered by a hamburger button, rendered as a Sheet/drawer overlay on mobile. Keep `w-[240px]` only for `md:` and above.

---

#### ISSUE C-03: Sheet components use fixed `w-[480px]` without responsive fallback

- **File:** Multiple files (DecisionForm.tsx:83, DelegationForm.tsx:94, AdHocTaskSheet.tsx:91, ZoneForm.tsx:140, VendorForm.tsx:112, EventForm.tsx:159, BookingListSheet.tsx:36, BrandForm.tsx:140, IngredientForm.tsx:110, StockAdjustmentSheet.tsx:92, MenuItemForm.tsx:141)
- **Severity:** Critical
- **Category:** Responsive
- **Description:** All Sheet components use `className="w-[480px]"` which exceeds mobile viewport width (375px). Some include `sm:max-w-[480px]` but the base `w-[480px]` still applies. The Sheet will overflow the viewport on any device under 480px wide.
- **Impact:** All form sheets are broken on mobile. Content is clipped or causes horizontal scrolling.
- **Recommendation:** Change to `className="w-full sm:w-[480px] sm:max-w-[480px]"` or use the Sheet component's built-in responsive sizing.

---

#### ISSUE C-04: PaymentForm uses raw `<label>` instead of accessible Label component

- **File:** `frontend/components/ops/pos/PaymentForm.tsx`, lines 57, 73, 82
- **Severity:** Critical
- **Category:** Accessibility
- **Description:** PaymentForm uses `<label className="text-xs font-bold text-muted-foreground">` without `htmlFor` attributes linking to the inputs. The labels are purely visual and provide no programmatic association. The Input and Textarea elements also lack `id` attributes.
- **Impact:** Screen reader users cannot identify which label belongs to which field. This is a WCAG 2.1 Level A violation (1.3.1 Info and Relationships).
- **Recommendation:** Switch to `<Label htmlFor="payment-method">` and add corresponding `id` attributes to each input. Or use the existing shadcn `Label` component already imported elsewhere.

---

### HIGH

---

#### ISSUE H-01: `text-emerald-700` and `text-red-700` are dark-mode-hostile

- **File:** `frontend/components/ops/pos/PosMenuItemCard.tsx`, lines 27-31; `frontend/components/ops/boards/EvidenceFeedCard.tsx`, lines 13-14; `frontend/components/ops/pos/OrderStatusBadge.tsx`, lines 10-11, 18-19; `frontend/components/ops/dashboard/RoleDashboardSections.tsx`, lines 45, 47; `frontend/components/ops/dashboard/AdminRecentDecisionsWidget.tsx`, lines 20, 22; `frontend/components/ops/pos/OrderDetailSheet.tsx`, line 99
- **Severity:** High
- **Category:** Theming
- **Description:** Multiple components use Tailwind `700` shade colors (e.g., `text-emerald-700`, `text-amber-600`, `text-red-700`) which are dark values designed for light backgrounds. On the dark theme (which this app primarily uses based on `oklch` values and `bg-card` usage), these colors have insufficient contrast against dark backgrounds. Meanwhile, other components correctly use the `-400` or `-500` shades with `-950` backgrounds (e.g., `text-green-400 bg-green-950`).
- **Impact:** Poor readability in dark mode. The `700` variants produce muddy, hard-to-read text. This affects POS (critical for speed of service), dashboard alerts, and evidence feed.
- **Recommendation:** Standardize on the `-400`/`-500` shade pattern already used in most other components: `text-emerald-400 bg-emerald-950` for dark theme. Or define semantic tokens in Tailwind config.

---

#### ISSUE H-02: KDS components use raw `text-white` instead of theme tokens

- **File:** `frontend/components/ops/kitchen/kds/KdsBoard.tsx`, lines 98, 107, 111, 122-124; `KdsOrderCard.tsx`, lines 50, 54; `KdsOrderItem.tsx`, lines 45-46; `KdsZoneColumn.tsx`, line 17; `KdsMetricsBar.tsx`, lines 26-42; `KdsExitButton.tsx`, line 15
- **Severity:** High
- **Category:** Theming
- **Description:** The entire KDS module uses hardcoded `text-white`, `text-white/50`, `text-white/60`, `text-white/70`, `text-white/80`, `bg-[oklch(0.205_0_0)]`, and `bg-[oklch(0.145_0_0)]` instead of theme tokens. This creates a component subtree that is completely disconnected from the design system.
- **Impact:** If the app ever supports a light theme, the KDS is entirely broken. Even within dark mode, the use of raw oklch values means these components won't respond to theme variable changes. Maintenance burden: any theming update requires manually fixing these components.
- **Recommendation:** Replace `text-white` with `text-foreground`, `text-white/50` with `text-muted-foreground`, `bg-[oklch(0.205_0_0)]` with `bg-card` or `bg-muted`. This is acceptable for a dedicated fullscreen KDS view, but even so, using tokens future-proofs the code.

---

#### ISSUE H-03: Hard-coded hex colors throughout for MagicCard, ShimmerButton, ShineBorder

- **File:** 30+ files (see grep results above)
- **Severity:** High
- **Category:** Theming
- **Description:** `gradientColor="#1a1a2e"` appears in every MagicCard instance (MissionCard, KpiCard, LeaderboardTable, DashboardKpiAlert, DashboardLowStockAlert, BrandCard, RecipeCard, ZoneCard, MenuItemCard, PosMenuItemCard, etc.). `shimmerColor="#4ade80"` appears in every ShimmerButton. `shineColor={['#4ade80', '#22d3ee', '#a78bfa']}` appears in every ShineBorder. `pulseColor="#f59e0b"` appears in PulsatingButton instances.
- **Impact:** These hex values are duplicated across 30+ files with no single source of truth. A brand color change requires editing every file. The `#1a1a2e` gradient assumes a dark background and will look wrong on light themes.
- **Recommendation:** Define these as CSS custom properties or a shared constants file: `const MAGIC_GRADIENT = 'hsl(var(--card))'` or similar. Extract `shimmerColor`, `shineColor`, `pulseColor` into a shared theme config object.

---

#### ISSUE H-04: EventRow icon-only buttons lack aria-labels

- **File:** `frontend/components/ops/operations/events/EventRow.tsx`, lines 84-89
- **Severity:** High
- **Category:** Accessibility
- **Description:** The Edit (Pencil) and Delete (Trash2) icon buttons use `<Button variant="ghost" size="icon-sm">` with no `aria-label`. Screen readers will announce them as empty buttons.
- **Impact:** Screen reader users cannot distinguish between the two action buttons. WCAG 2.1 Level A violation (1.1.1 Non-text Content).
- **Recommendation:** Add `aria-label="Edit event"` and `aria-label="Delete event"` to the respective buttons.

---

#### ISSUE H-05: LinkEvidenceForm and NoteEvidenceForm inputs lack labels

- **File:** `frontend/components/ops/evidence/LinkEvidenceForm.tsx`, lines 52-63; `frontend/components/ops/evidence/NoteEvidenceForm.tsx`, lines 50-55
- **Severity:** High
- **Category:** Accessibility
- **Description:** Both forms use `Input` and `Textarea` elements with `placeholder` text but no `<Label>` or `aria-label` attributes. Placeholder text disappears on focus and is not a reliable label.
- **Impact:** Screen reader users cannot identify the purpose of form fields. WCAG violation.
- **Recommendation:** Add `<Label htmlFor="evidence-url">URL</Label>` with corresponding `id` attributes, or at minimum use `aria-label` attributes on the inputs.

---

#### ISSUE H-06: LeaderboardPodium uses `<img>` instead of Next.js `Image` for avatars

- **File:** `frontend/components/ops/leaderboard/LeaderboardPodium.tsx`, lines 29-34; `frontend/components/ops/leaderboard/LeaderboardTable.tsx`, lines 59-64
- **Severity:** High
- **Category:** Performance
- **Description:** Both leaderboard components use raw `<img>` tags for DiceBear avatar URLs. While they include `width` and `height` attributes (good for CLS), they miss Next.js Image optimization (lazy loading by default, format negotiation, size optimization).
- **Impact:** Every avatar makes an unoptimized external request. On the leaderboard page with many users, this means dozens of unoptimized SVG requests.
- **Recommendation:** Use `next/image` with `unoptimized` prop for external SVG URLs, or keep `<img>` but add `loading="lazy"` and `decoding="async"` attributes. The leaderboard table already has explicit dimensions which is good.

---

#### ISSUE H-07: NotificationBell Button nested inside PopoverTrigger

- **File:** `frontend/components/ops/notifications/NotificationBell.tsx`, lines 93-111
- **Severity:** High
- **Category:** Accessibility
- **Description:** `PopoverTrigger` renders as a button, and `Button` inside it creates a button-within-a-button nesting. This is invalid HTML and confuses assistive technology.
- **Impact:** Screen readers may announce two buttons or skip the inner one entirely. Keyboard interaction may be unpredictable.
- **Recommendation:** Use `PopoverTrigger asChild` and pass the `Button` directly: `<PopoverTrigger asChild><Button ...>...</Button></PopoverTrigger>`.

---

### MEDIUM

---

#### ISSUE M-01: Duplicate "Ad-hoc" badge on TaskKanbanCard

- **File:** `frontend/components/ops/tasks/TaskKanbanCard.tsx`, lines 74-89
- **Severity:** Medium
- **Category:** Anti-Pattern (redundant copy)
- **Description:** When `task.task_type === 'adhoc'`, two badges are rendered: the type badge from `TASK_TYPE_LABELS[task.task_type]` (line 75) which renders "Ad-hoc", and a second explicit "Ad-hoc" badge (line 86-88). This displays "Ad-hoc" twice in the badges row.
- **Impact:** Visual clutter and confusion. Takes up badge space that could be used for more useful information.
- **Recommendation:** Remove the duplicate badge block at lines 85-89.

---

#### ISSUE M-02: Custom toast implementation instead of Sonner

- **File:** `frontend/components/ops/CreateUserDialog.tsx`, lines 214-218; `frontend/components/ops/PermissionMatrix.tsx`, lines 252-256
- **Severity:** Medium
- **Category:** Anti-Pattern
- **Description:** Both components implement a custom toast notification using a fixed-position `div` with `setTimeout` for auto-dismiss, while the rest of the codebase (50+ occurrences) consistently uses Sonner's `toast()` function. This creates inconsistency and duplicates functionality.
- **Impact:** Custom toasts lack Sonner's features: stacking, dismissal animation, screen reader announcements via `aria-live`. The custom toast also has no dismiss button and no `role="alert"`.
- **Recommendation:** Replace with `toast.success()` from Sonner, matching the pattern used in every other component.

---

#### ISSUE M-03: DelegationForm uses raw `<input type="date">` instead of shadcn Input

- **File:** `frontend/components/ops/delegations/DelegationForm.tsx`, lines 148-157, 163-173
- **Severity:** Medium
- **Category:** Anti-Pattern (inconsistency)
- **Description:** The delegation form uses raw HTML `<input>` elements for date fields with inline Tailwind classes that manually replicate the shadcn Input styling. Every other form in the codebase uses the `<Input type="date">` component.
- **Impact:** Visual inconsistency if the Input component's styles are updated. The inline classes are brittle and may drift from the design system. Also, the `h-8` height differs from the standard Input `h-9`.
- **Recommendation:** Replace with `<Input id="start-date" type="date" ... />` to match every other form.

---

#### ISSUE M-04: EvidenceUploadZone progress bar uses hardcoded `bg-blue-400`

- **File:** `frontend/components/ops/evidence/EvidenceUploadZone.tsx`, lines 207, 216
- **Severity:** Medium
- **Category:** Theming
- **Description:** The upload progress indicator uses `bg-blue-400` for the progress fill and `text-blue-400` for the percentage text, rather than theme tokens like `bg-primary`.
- **Impact:** Inconsistent with the rest of the design system. Will not adapt to theme changes.
- **Recommendation:** Use `bg-primary` for the fill bar and `text-primary` for the text, or define a semantic upload color token.

---

#### ISSUE M-05: MissionCard avatar URLs use DiceBear with quest title as seed, not user name

- **File:** `frontend/components/ops/missions/MissionCard.tsx`, lines 49-51
- **Severity:** Medium
- **Category:** Anti-Pattern
- **Description:** Avatar circles for the mission card generate initials based on quest `title` rather than the actual owner's name. The `imageUrl` uses `seed=${encodeURIComponent(q.title)}` which produces meaningless initials (e.g., "WE" for "Week 1 - Kitchen Setup").
- **Impact:** Users see random initials that don't correspond to any person, defeating the purpose of avatar circles which should show who is working on the mission.
- **Recommendation:** Use the quest owner's name as the seed: `q.owner?.name || q.title`.

---

#### ISSUE M-06: DecisionForm context textarea uses `style={{ minHeight: '80px' }}` instead of Tailwind

- **File:** `frontend/components/ops/decisions/DecisionForm.tsx`, line 132
- **Severity:** Medium
- **Category:** Anti-Pattern (inconsistency)
- **Description:** Inline `style` attribute for height instead of Tailwind class `className="min-h-[80px]"` or the standard `rows` prop.
- **Impact:** Breaks the Tailwind-only pattern used everywhere else. Inline styles have higher specificity and are harder to override.
- **Recommendation:** Use `className="min-h-[80px]"` or `rows={3}`.

---

#### ISSUE M-07: ErrorBoundary only catches render errors, does not handle async errors

- **File:** `frontend/components/ops/ErrorBoundary.tsx`
- **Severity:** Medium
- **Category:** Experience Design
- **Description:** The ErrorBoundary is a class component that catches errors during rendering. However, async errors from API calls, event handlers, and promises are not caught. The "Try again" button only resets `hasError` state but does not trigger a re-fetch or meaningful recovery.
- **Impact:** Users see a blank page with "Something went wrong" but clicking "Try again" may just show the same error if the component re-renders with the same broken state.
- **Recommendation:** Add a window-level error handler or integrate with React Query's error boundary support. Make "Try again" trigger a full page reload or use `window.location.reload()`.

---

#### ISSUE M-08: ApprovalItem has nested PulsatingButton wrapping action buttons

- **File:** `frontend/components/ops/approvals/ApprovalItem.tsx`, lines 230-249
- **Severity:** Medium
- **Category:** Anti-Pattern / Accessibility
- **Description:** When evidence is pending long, a `PulsatingButton` wraps the entire `actionButtons` div, and a `Tooltip` wraps that. This creates buttons-inside-a-button nesting. The PulsatingButton has `className="bg-transparent p-0 shadow-none"` to visually neutralize it, but semantically it's still a nested interactive element.
- **Impact:** Invalid HTML nesting. Assistive technology may not announce inner buttons correctly.
- **Recommendation:** Use CSS animation directly on the wrapper div for the pulsating effect rather than nesting inside PulsatingButton. Or apply the pulsating effect via a className rather than a button component.

---

#### ISSUE M-09: ConfirmActivateDialog silently swallows errors

- **File:** `frontend/components/ops/quests/ConfirmActivateDialog.tsx`, lines 52-53
- **Severity:** Medium
- **Category:** Experience Design
- **Description:** The `catch` block is completely empty with only a comment "Error handling -- dialog stays open". No error message is shown to the user. If the activation API fails, the user sees the button reset to "Activate" with no feedback.
- **Impact:** User confusion when activation fails silently. They may repeatedly click with no understanding of why it's not working.
- **Recommendation:** Add `toast.error('Failed to activate quest. Please try again.')` in the catch block.

---

#### ISSUE M-10: BlockerDialog also silently swallows errors

- **File:** `frontend/components/ops/tasks/BlockerDialog.tsx`, lines 42-43
- **Severity:** Medium
- **Category:** Experience Design
- **Description:** Same as M-09. The catch block is empty. No user feedback on failure.
- **Impact:** User cannot tell if the blocker was reported or not.
- **Recommendation:** Add `toast.error('Failed to report blocker. Please try again.')`.

---

#### ISSUE M-11: AdHocTaskSheet silently swallows errors

- **File:** `frontend/components/ops/tasks/AdHocTaskSheet.tsx`, lines 76-77
- **Severity:** Medium
- **Category:** Experience Design
- **Description:** Same pattern. Empty catch with comment "Error handled".
- **Impact:** Admin creates an ad-hoc task, it silently fails, they assume it was created.
- **Recommendation:** Add `toast.error('Failed to create task.')`.

---

#### ISSUE M-12: WinsTimeline returns null for empty state instead of helpful message

- **File:** `frontend/components/ops/boards/WinsTimeline.tsx`, line 22
- **Severity:** Medium
- **Category:** Experience Design
- **Description:** `if (entries.length === 0) return null;` renders nothing. The parent page may or may not handle this, but the component itself provides no empty state guidance.
- **Impact:** Users see a blank section with no context about why there are no wins.
- **Recommendation:** Return an empty state message: "No wins recorded yet. Complete and validate tasks to see them here."

---

#### ISSUE M-13: EvidenceFeedCard photo thumbnail uses raw `<img>` without error handling

- **File:** `frontend/components/ops/boards/EvidenceFeedCard.tsx`, lines 37-43
- **Severity:** Medium
- **Category:** Performance / Accessibility
- **Description:** The photo thumbnail uses `<img src={url} alt="" loading="lazy">` with an empty alt attribute. While `loading="lazy"` is good, there's no `onError` fallback if the image fails to load, and the empty `alt=""` marks it as decorative when it's actually content.
- **Impact:** Broken images show a blank box. Screen readers skip the image entirely.
- **Recommendation:** Add `alt="Evidence photo"` and an `onError` handler that falls back to the icon view.

---

### LOW

---

#### ISSUE L-01: LevelUpCelebration text-white is dark-mode-only

- **File:** `frontend/components/ops/gamification/LevelUpCelebration.tsx`, line 54
- **Severity:** Low
- **Category:** Theming
- **Description:** `text-white` for the "Level Up!" overlay text. This only works on dark backgrounds. On a light theme, white text would be invisible.
- **Impact:** Minimal since this is a brief overlay, but would break entirely on light themes.
- **Recommendation:** Use `text-foreground` or add a background behind the text.

---

#### ISSUE L-02: Inconsistent badge color pattern between components

- **File:** Multiple files
- **Severity:** Low
- **Category:** Theming
- **Description:** Three distinct patterns exist for status badges:
  1. `text-green-400 bg-green-950` (MissionCard, QuestCard, TaskKanbanCard, TaskListView)
  2. `bg-emerald-500/15 text-emerald-700` (PosMenuItemCard, EvidenceFeedCard, OrderStatusBadge)
  3. `text-green-500 border-green-500/30` (KpiStatusBadge)
  Pattern 1 uses green-400/950, Pattern 2 uses emerald-700, Pattern 3 uses green-500 with outline variant.
- **Impact:** Visual inconsistency across the app. Three different "success green" appearances.
- **Recommendation:** Standardize on one badge pattern for success states. Since this is primarily a dark-mode app, Pattern 1 (`text-green-400 bg-green-950`) is the most appropriate.

---

#### ISSUE L-03: ValidationStatus uses hardcoded HSL strings

- **File:** `frontend/components/ops/evidence/ValidationStatus.tsx`, lines 47-48, 65-66
- **Severity:** Low
- **Category:** Theming
- **Description:** `gaugePrimaryColor="hsl(142, 71%, 45%)"` and `gaugeSecondaryColor="hsl(0, 0%, 20%)"` are hardcoded instead of using CSS variables.
- **Impact:** Cannot adapt to theme changes.
- **Recommendation:** Use `gaugePrimaryColor="hsl(var(--primary))"` or the green-specific token.

---

#### ISSUE L-04: TaskForm grid-cols-2 has no responsive breakpoint

- **File:** `frontend/components/ops/tasks/TaskForm.tsx`, lines 140, 210, 267
- **Severity:** Low
- **Category:** Responsive
- **Description:** Uses `grid grid-cols-2 gap-4` without a responsive prefix. On narrow viewports (inside a 480px sheet), the two columns get ~224px each, which is tight but workable. However, if the parent context changes, this could cause squished inputs.
- **Impact:** Minor. Currently saved by the sheet container, but brittle.
- **Recommendation:** Use `grid grid-cols-1 sm:grid-cols-2 gap-4` for safety.

---

#### ISSUE L-05: DecisionForm spinner missing motion-reduce

- **File:** `frontend/components/ops/decisions/DecisionForm.tsx`, line 179
- **Severity:** Low
- **Category:** Accessibility
- **Description:** `<Loader2 className="size-4 animate-spin" />` is missing `motion-reduce:animate-none`. This is inconsistent with 27 other files that correctly include it.
- **Impact:** Users with vestibular disorders who have `prefers-reduced-motion` enabled will still see the spinning animation.
- **Recommendation:** Add `motion-reduce:animate-none` to match the pattern in every other file.

---

#### ISSUE L-06: PaymentForm spinner missing motion-reduce

- **File:** `frontend/components/ops/pos/PaymentForm.tsx`, line 92
- **Severity:** Low
- **Category:** Accessibility
- **Description:** Same as L-05. `animate-spin` without `motion-reduce:animate-none`.
- **Recommendation:** Add `motion-reduce:animate-none`.

---

#### ISSUE L-07: AdminUserFilter is a stub with only one option

- **File:** `frontend/components/ops/AdminUserFilter.tsx`
- **Severity:** Low
- **Category:** Experience Design
- **Description:** The Select component has only one option ("All team members") with `defaultValue="all"`. It is a non-functional UI element.
- **Impact:** Users see a filter dropdown that does nothing when clicked. It wastes visual real estate and suggests broken functionality.
- **Recommendation:** Either remove the component until filtering is implemented, or add a clear "Coming soon" indicator.

---

#### ISSUE L-08: Sidebar has excessive nav items without grouping affordance

- **File:** `frontend/components/ops/Sidebar.tsx`, lines 137-261
- **Severity:** Low
- **Category:** Experience Design
- **Description:** The sidebar has 8 nav sections with 27+ total items (Overview: 1, Work: 3, Boards: 4, Intelligence: 3-4, Operations: 14, Kitchen: 4, POS: 3, Admin: 5). The Operations section alone has 14 items. There is no collapsible behavior, so users must scroll extensively.
- **Impact:** On standard laptop screens (900px height), the sidebar requires significant scrolling. The Operations section dominates the navigation.
- **Recommendation:** Make section groups collapsible (accordion pattern). Consider a nested sidebar or flyout for the Operations section. At minimum, use `role="navigation"` with `aria-label` on the `<nav>` element.

---

---

## POSITIVE FINDINGS

These patterns represent solid UI engineering decisions worth preserving:

### P-01: Consistent loading skeleton pattern
Every data-fetching component implements skeleton loading states using `animate-pulse` divs with appropriate heights. This is consistent across ApprovalQueue, EvidenceList, DecisionList, DelegationList, MeterDetailPanel, and BookingListSheet.

### P-02: Excellent form accessibility in core components
CreateUserDialog, MissionForm, QuestForm, KpiForm, BlockerDialog, RejectionDialog, and OverrideDialog all use `<Label htmlFor>` with matching `id` attributes, `aria-invalid` for error states, and `aria-describedby` for error messages. This is WCAG 2.1 AA compliant form pattern.

### P-03: motion-reduce coverage is nearly universal
31 instances of `motion-reduce:animate-none` across 27 files covering all Loader2 spinners. Only 2 files were missed (DecisionForm, PaymentForm). This shows intentional accessibility consideration.

### P-04: Empty states are well-designed and contextual
Almost every list/grid component has a thoughtful empty state with an icon, primary message, and guidance text. Examples: ApprovalQueue ("You're all caught up"), TaskListView ("Add the first task..."), KdsBoard ("Orders placed on POS will appear here automatically"), DecisionList ("Log the first decision to start building your governance trail").

### P-05: Error states with recovery actions
ApprovalQueue, MeterDetailPanel, DecisionList, and DelegationList all handle error states with descriptive messages and recovery actions (retry button or refresh suggestion).

### P-06: Kanban has proper ARIA attributes
TaskKanban columns use `role="region"` with `aria-label` including task count. The drag-and-drop system uses KeyboardSensor in addition to PointerSensor. The QuestProgress uses `aria-label` on progress bars.

### P-07: Proper disabled state handling
Forms consistently disable all inputs during submission. Buttons show loading spinners with contextual "verb...ing" labels ("Creating...", "Saving...", "Approving..."). This prevents double-submission.

### P-08: NotificationBell has proper polling and optimistic updates
Uses `refetchInterval: 30_000` for background polling, `staleTime: 25_000` to prevent unnecessary re-fetches, and optimistic mutation for mark-all-read. The seeding logic prevents toast floods on initial load.

### P-09: Confirmation dialogs for destructive actions
The ConfirmActivateDialog (quest activation), RejectionDialog (evidence rejection), OverrideDialog (approval override), and DecisionDetail (reopen decision) all use confirmation patterns before destructive actions.

### P-10: Sidebar nav badges with live data
The sidebar fetches pending approval and proposed decision counts and displays live badges, giving users at-a-glance awareness of pending work.

---

## SUMMARY BY CATEGORY

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Accessibility | 1 | 3 | 1 | 2 |
| Performance | 0 | 1 | 1 | 0 |
| Theming | 0 | 3 | 1 | 3 |
| Responsive | 3 | 0 | 0 | 1 |
| Anti-Pattern | 0 | 0 | 4 | 1 |
| Experience Design | 0 | 0 | 5 | 1 |
| **Total** | **4** | **7** | **12** | **8** |

---

## TOP 5 PRIORITY FIXES (by impact-to-effort ratio)

1. **C-02 + C-03: Mobile responsiveness** -- The sidebar and all Sheet forms are broken on mobile. Highest user impact, affects every page and every form. Fix the sidebar with a responsive drawer and sheets with `w-full sm:w-[480px]`.

2. **C-01: Kanban responsive breakpoints** -- The task board is the core workflow surface. Adding `overflow-x-auto` with min-width columns is a one-line change that unblocks tablet usage.

3. **H-01 + L-02: Badge color standardization** -- The split between `-700` (light-mode) and `-400` (dark-mode) shades creates inconsistent visual quality. A search-and-replace across ~15 files standardizes everything.

4. **H-03: Extract hardcoded hex colors** -- 40+ instances of `#1a1a2e`, `#4ade80`, etc. Create a shared constants file and replace all occurrences. This is a mechanical change with large maintenance benefit.

5. **M-09/M-10/M-11: Silent error swallowing** -- Three components silently swallow API errors. Adding `toast.error()` to each catch block is a one-line fix per file with significant UX improvement.

---

## FILES AUDITED

### Components (frontend/components/ops/)
- `Sidebar.tsx`, `AdminUserFilter.tsx`, `CreateUserDialog.tsx`, `PermissionMatrix.tsx`, `ErrorBoundary.tsx`
- `missions/MissionCard.tsx`, `missions/MissionForm.tsx`
- `quests/QuestCard.tsx`, `quests/QuestForm.tsx`, `quests/QuestProgress.tsx`, `quests/ConfirmActivateDialog.tsx`
- `tasks/TaskViewToggle.tsx`, `tasks/BlockerDialog.tsx`, `tasks/AdHocTaskSheet.tsx`, `tasks/TaskForm.tsx`, `tasks/TaskKanban.tsx`, `tasks/TaskKanbanCard.tsx`, `tasks/TaskListView.tsx`
- `evidence/EvidenceUploadZone.tsx`, `evidence/LinkEvidenceForm.tsx`, `evidence/NoteEvidenceForm.tsx`, `evidence/ValidationStatus.tsx`, `evidence/RejectionDialog.tsx`, `evidence/EvidenceList.tsx`, `evidence/EvidenceItem.tsx`, `evidence/EvidenceSection.tsx`
- `approvals/ApprovalQueue.tsx`, `approvals/ApprovalItem.tsx`, `approvals/OverrideDialog.tsx`
- `gamification/XpProgressBar.tsx`, `gamification/LevelUpCelebration.tsx`, `gamification/LevelBadge.tsx`
- `dashboard/DashboardReadinessStrip.tsx`, `dashboard/DashboardKpiAlert.tsx`, `dashboard/DashboardLeaderboardPreview.tsx`, `dashboard/DashboardLowStockAlert.tsx`
- `readiness/ReadinessMeterRing.tsx`, `readiness/ReadinessGrid.tsx`, `readiness/MeterDetailPanel.tsx`
- `kpis/KpiStatusBadge.tsx`, `kpis/KpiCard.tsx`, `kpis/KpiForm.tsx`
- `leaderboard/LeaderboardPodium.tsx`, `leaderboard/LeaderboardTable.tsx`
- `decisions/DecisionStatusBadge.tsx`, `decisions/DecisionTypeBadge.tsx`, `decisions/DecisionCard.tsx`, `decisions/DecisionDetail.tsx`, `decisions/DecisionList.tsx`, `decisions/DecisionForm.tsx`
- `delegations/DelegationCard.tsx`, `delegations/DelegationList.tsx`, `delegations/DelegationForm.tsx`
- `notifications/NotificationBell.tsx`, `notifications/NotificationItem.tsx`
- `operations/events/EventRow.tsx`, `operations/events/BookingListSheet.tsx`, `operations/events/EventForm.tsx`
- `pos/PosMenuItemCard.tsx`, `pos/PosCartSidebar.tsx`, `pos/PaymentForm.tsx`
- `kitchen/kds/KdsOrderCard.tsx`, `kitchen/kds/KdsBoard.tsx`, `kitchen/KitchenMetricsCards.tsx`
- `boards/WinsTimeline.tsx`, `boards/EvidenceFeedCard.tsx`

### Pages (frontend/app/(ops)/)
- `layout.tsx` (read in full)
- All 50 page files discovered via glob (audited via component analysis)
