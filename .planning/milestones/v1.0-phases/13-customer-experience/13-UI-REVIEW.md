# Phase 13 -- UI Review (Public Components Re-Audit)

**Audited:** 2026-03-22
**Baseline:** 13-UI-SPEC.md (approved design contract)
**Screenshots:** Not captured (no dev server detected on ports 3000, 5173, 8080)
**Scope:** All 13 public-facing files (components + pages + layout)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Copy matches spec closely; minor placeholder and error copy deviations |
| 2. Visuals | 3/4 | Good hierarchy and semantic HTML; star rating lacks keyboard arrow-key nav |
| 3. Color | 2/4 | Three instances of hardcoded color (green-*, blue-*) break dark-mode and token contract |
| 4. Typography | 3/4 | Weights correctly limited to semibold+normal; one off-spec size (text-4xl, text-lg) |
| 5. Spacing | 4/4 | Consistent Tailwind scale; arbitrary values only for 44px touch targets (justified) |
| 6. Experience Design | 3/4 | All states covered (loading, error, empty, success); phone inputs lack tel type |

**Overall: 18/24**

---

## Top 3 Priority Fixes

1. **Hardcoded green/blue status colors will break in dark mode** -- The booking success message uses `bg-green-50 border-green-200 text-green-700` and the order-not-found banner uses `bg-blue-50 border-blue-200 text-blue-700`. These are raw Tailwind palette colors, not design tokens. In the `light` class wrapper they render fine, but they violate the color contract and will look wrong if the theme approach ever changes. Replace with semantic tokens or at minimum `dark:` overrides. **Files:** `EventBookingForm.tsx:45-47`, `feedback/[orderId]/page.tsx:77`.

2. **Star rating radiogroup has no keyboard arrow-key navigation** -- The star rating uses `role="radiogroup"` with `role="radio"` buttons, which is correct ARIA. However, the WAI-ARIA radiogroup pattern requires arrow keys to move between options. Currently only Tab + Enter/Space work, meaning a keyboard user must Tab through all 5 stars individually. Add `onKeyDown` handler that moves focus and selection with ArrowLeft/ArrowRight. **File:** `StarRatingInput.tsx:15-46`.

3. **Phone inputs lack `type="tel"` and `inputMode="tel"`** -- Both the booking form and feedback form collect phone numbers via plain text inputs. On mobile (the primary use case for QR-scanned pages), this means users get a full QWERTY keyboard instead of a numeric dialer. Add `type="tel"` to phone inputs. **Files:** `EventBookingForm.tsx:115-122`, `feedback/[orderId]/page.tsx:121-128`.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**What matches the spec well:**
- Page titles match exactly: "How was your experience?", "Upcoming Experiences", "Our Menu"
- CTAs match: "Submit Feedback", "Confirm Booking", "Book Your Spot"
- Empty states match: "No upcoming events", "Check back soon..."
- Capacity badge: "X spots left" / "Sold Out" -- correct
- Availability badge: "Available" / "Sold Out" -- correct
- Thank-you copy: "Thank you!" + "Your feedback helps us improve every meal." -- exact match
- Error messages: Booking error and feedback error match spec
- Sub-label: "Takes 30 seconds. Helps us improve." -- exact match

**Issues found:**

| # | File | Line | Severity | Issue |
|---|------|------|----------|-------|
| C1 | `feedback/[orderId]/page.tsx` | 109 | Low | Placeholder is `"Your name"` but spec says `"Your name (optional)"`. The `(optional)` hint is in the label, not the placeholder, so this is arguably fine but inconsistent with spec intent. Same for phone on line 123: `"Your number"` vs spec `"Your number (optional)"`. |
| C2 | `EventBookingForm.tsx` | 75 | Low | Error copy says "this event just filled up. No spots remain for N guests" but spec says "this event is full. No spots remain for [N] guests." Minor wording difference ("filled up" vs "is full"). |
| C3 | `EventBookingForm.tsx` | 103 | Low | Placeholder `"Your name"` duplicates the label. Consider removing or differentiating (e.g., "e.g. Priya"). Same with "Your phone number" on line 119. |

**Positive:** No generic "Submit", "Click Here", or "OK" labels anywhere. Copy is specific and contextual throughout.

---

### Pillar 2: Visuals (3/4)

**What works well:**
- Clear visual hierarchy on every page: `text-3xl` title > `text-xl` section headings > `text-base` body > `text-sm` labels
- Semantic HTML in layout: `<header>`, `<main>`, `<footer>` landmarks present
- Icon buttons have `aria-label` (Remove guest, Add guest)
- Star rating has proper `role="radiogroup"` + `role="radio"` + `aria-checked` + `aria-label`
- Star icons correctly have `aria-hidden="true"`
- Images have meaningful `alt` text (`item.name`, `event.title`)
- `role="alert"` on error messages for screen reader announcement
- `role="status"` on success messages
- Event detail page has clear 2-column layout (image | details) on desktop

**Issues found:**

| # | File | Line | Severity | Category | Issue |
|---|------|------|----------|----------|-------|
| V1 | `StarRatingInput.tsx` | 23-44 | High | Accessibility | No keyboard arrow-key navigation within the radiogroup. WAI-ARIA radio group pattern requires ArrowLeft/ArrowRight to move between options. Currently each star is separately Tab-focusable, which is the wrong interaction model for a radiogroup. Only one star should be in the tab order; arrows should move between them. |
| V2 | `FeedbackThankYou.tsx` | 15-27 | Low | Accessibility | The confetti canvas is `pointer-events-none` and `fixed inset-0 z-50` which is good. But there is no `aria-live` region wrapping the thank-you message to announce the state transition to screen readers. The `BlurFade` animation may delay content visibility. |
| V3 | `feedback/[orderId]/page.tsx` | 83-87 | Medium | Accessibility | The "Rate your meal" label (line 84) is not associated with the star rating widget via `htmlFor` or `aria-labelledby`. The label is a plain `<label>` without a `for` attribute and the `StarRatingInput` container has `aria-label="Rating"` instead of being linked to the visible label. Use `aria-labelledby` on the radiogroup pointing to an `id` on the label for proper association. |
| V4 | `EventCard.tsx` | 24-46 | Low | Accessibility | The entire card is wrapped in a `<Link>`. Screen readers will read the full card content as the link text, which can be verbose. Consider adding `aria-label` on the Link with the event title only. |

---

### Pillar 3: Color (2/4)

**What works well:**
- Public layout applies `className="light"` on the wrapper div, which overrides the root `dark` class. Design tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `text-destructive`, `bg-muted`, `bg-primary`) are used consistently throughout.
- No hardcoded hex values in component code.
- Star rating uses `fill-amber-500` / `text-amber-500` which is an acceptable semantic color per spec (amber for ratings).
- Accent usage is restrained: only on submit buttons and availability badge (default variant).

**Issues found:**

| # | File | Line | Severity | Category | Issue |
|---|------|------|----------|----------|-------|
| CL1 | `EventBookingForm.tsx` | 45-47 | High | Theming | Booking success uses hardcoded `border-green-200 bg-green-50 text-green-700`. These are not design tokens. The spec says success should use `text-primary` or be handled differently. If the `light` class ever fails to apply, or if the theme changes, these colors will clash. Replace with a semantic approach: e.g., a success variant of a component, or use `bg-primary/10 text-primary border-primary/20`. |
| CL2 | `feedback/[orderId]/page.tsx` | 77 | High | Theming | Order-not-found banner uses hardcoded `bg-blue-50 border-blue-200 text-blue-700`. Same issue as CL1. Replace with `bg-muted text-muted-foreground border-border` or a dedicated info pattern using design tokens. |
| CL3 | `layout.tsx` (public) | 10 | Medium | Theming | Header uses `bg-background/95 backdrop-blur`. The `bg-background/95` is fine as a token-based transparent background. However, this creates a glassmorphism pattern on the header, which is acceptable for a sticky nav but worth noting. The `backdrop-blur` has minimal performance impact since it is only on the thin header bar. |
| CL4 | `MenuItemPublicCard.tsx` | 27 | Low | Theming | Placeholder initial letter uses `text-muted-foreground/40` -- the `/40` opacity modifier is fine but means contrast against `bg-muted` may be very low. This is intentional (decorative placeholder) so it is acceptable. |

---

### Pillar 4: Typography (3/4)

**What works well:**
- Only two weights used across all public components: `font-semibold` (600) and `font-normal` (400). This exactly matches the spec contract.
- No `font-bold`, `font-medium`, `font-light`, `font-thin`, or `font-extrabold` anywhere.
- Size hierarchy is clean: `text-3xl` for page titles, `text-xl` for section headings, `text-base` for body, `text-sm` for labels/metadata, `text-xs` for footer.

**Issues found:**

| # | File | Line | Severity | Category | Issue |
|---|------|------|----------|----------|-------|
| T1 | `MenuItemPublicCard.tsx` | 27 | Low | Typography | Placeholder initial uses `text-4xl`. The spec only declares `text-3xl`, `text-xl`, `text-base`, `text-sm`, `text-xs`. `text-4xl` is not in the declared typography scale. Since it is a decorative placeholder, impact is minimal, but it adds an undeclared size. Consider using `text-3xl` instead. |
| T2 | `events/[id]/page.tsx` | 78 | Low | Typography | Event type placeholder text uses `text-lg font-semibold`. `text-lg` (18px) is not in the declared typography scale. Should be `text-base` (16px) for body-level text. |
| T3 | `layout.tsx` (public) | 11 | Low | Typography | Header brand name uses `text-sm font-semibold tracking-tight`. The `tracking-tight` is not in the typography contract but is reasonable for a brand name. Minor deviation. |

**Summary of sizes in use:** `text-xs`, `text-sm`, `text-base`, `text-lg` (off-spec), `text-xl`, `text-3xl`, `text-4xl` (off-spec) = 7 sizes. Spec declares 5. Two are off-spec but in low-impact decorative contexts.

---

### Pillar 5: Spacing (4/4)

**What works well:**
- All spacing uses standard Tailwind scale values: `p-4`, `p-6`, `px-4`, `py-8`, `py-16`, `gap-2`, `gap-3`, `gap-4`, `gap-6`, `gap-8`, `space-y-2`, `space-y-3`, `space-y-4`, `space-y-6`, `space-y-8`, `mb-6`, `mb-8`.
- These map cleanly to the spec's spacing scale: 8px (gap-2), 12px (gap-3), 16px (p-4), 24px (space-y-6), 32px (py-8), 64px (py-16).
- Touch targets are properly enforced at 44px minimum using `min-h-[44px] min-w-[44px]` on star rating buttons and booking stepper buttons.
- The `h-11` (44px) on submit buttons meets touch target requirements.
- The `[44px]` arbitrary values are the ONLY arbitrary spacing values, and they are justified by the spec's mobile touch target requirement.

**No issues found.** Spacing is exemplary.

---

### Pillar 6: Experience Design (3/4)

**What works well:**
- **Loading states:** Events page shows skeleton grid (4 items), menu page shows skeleton tabs + grid (6 items), event detail shows Loader2 spinner, feedback form shows Loader2 in submit button during submission. All pages have proper loading coverage.
- **Error states:** Events page and menu page both have "Something went wrong" + "Try again" button. Event detail has "Event not found" message. Booking form has inline error messages with `role="alert"`. Feedback form has inline error with `role="alert"`.
- **Empty states:** Events page: "No upcoming events" + encouraging body text. Menu page: "Menu is being updated. Check back shortly." (used for both no-brands and no-categories states). All contextual and non-generic.
- **Success states:** Booking form shows inline confirmation with `role="status"`. Feedback form transitions to FeedbackThankYou with confetti.
- **Disabled states:** Submit buttons properly disabled when form is invalid or submitting. Stepper buttons disabled at min/max bounds.
- **Auto-refresh:** Menu availability refreshes every 60 seconds via `refetchInterval`.
- **Race condition handling:** Booking form handles 400 errors from the server with specific capacity error messages.

**Issues found:**

| # | File | Line | Severity | Category | Issue |
|---|------|------|----------|----------|-------|
| E1 | `EventBookingForm.tsx` | 115-122 | High | Accessibility/UX | Phone number input has no `type="tel"`. On mobile (the primary surface -- users scan QR codes), this means a QWERTY keyboard appears instead of a numeric dialer. Same issue in `feedback/[orderId]/page.tsx:121-128`. Fix: add `type="tel"` and optionally `inputMode="tel"`. |
| E2 | `EventBookingForm.tsx` | 101-107 | Medium | Accessibility/UX | Name input has no `autoComplete="name"` attribute. Phone input has no `autoComplete="tel"`. Adding standard autocomplete attributes would let mobile browsers auto-fill from contacts, reducing friction on public-facing QR-scanned forms. Same for feedback form name and phone inputs. |
| E3 | `feedback/[orderId]/page.tsx` | 28-37 | Medium | Performance | The `checkOrder` effect fires on mount with no loading indicator. If the network is slow, the user sees the full form but the "order not found" banner may flash in after a delay. Consider showing a brief skeleton or loading state during the order check. |
| E4 | `events/page.tsx` | 59-63 | Low | Performance | BlurFade is applied to each card with `delay={index * 0.05}`. With many events (e.g., 20+), the last card's animation starts at 1+ second delay. Consider capping the stagger delay (e.g., `Math.min(index * 0.05, 0.3)`). |
| E5 | `EventCard.tsx` | 24-46 | Low | UX | The entire card is a link, but there is no visual hover indicator beyond the MagicCard gradient effect. On touch devices, there is no visual feedback that the card is tappable. Consider adding `active:scale-[0.98]` or similar touch feedback. |

---

## Registry Safety

Registry audit: shadcn initialized. UI-SPEC lists @magicui as the only third-party registry, but all MagicUI components (MagicCard, BlurFade, Confetti) were pre-installed in earlier phases and passed safety review on 2026-03-19 and 2026-03-20. No new third-party blocks introduced in Phase 13. No flags.

---

## Files Audited

| File | Path |
|------|------|
| AvailabilityBadge | `frontend/components/public/AvailabilityBadge.tsx` |
| CapacityBadge | `frontend/components/public/CapacityBadge.tsx` |
| EventBookingForm | `frontend/components/public/EventBookingForm.tsx` |
| EventCard | `frontend/components/public/EventCard.tsx` |
| MenuBrandTabs | `frontend/components/public/MenuBrandTabs.tsx` |
| MenuItemPublicCard | `frontend/components/public/MenuItemPublicCard.tsx` |
| StarRatingInput | `frontend/components/public/StarRatingInput.tsx` |
| FeedbackThankYou | `frontend/components/public/FeedbackThankYou.tsx` |
| Public Layout | `frontend/app/(public)/layout.tsx` |
| Events Page | `frontend/app/(public)/events/page.tsx` |
| Event Detail | `frontend/app/(public)/events/[id]/page.tsx` |
| Menu Page | `frontend/app/(public)/menu/page.tsx` |
| Feedback Page | `frontend/app/(public)/feedback/[orderId]/page.tsx` |
| Root Layout | `frontend/app/layout.tsx` (reference) |
| MagicCard | `frontend/components/ui/magic-card.tsx` (reference) |
| BlurFade | `frontend/components/ui/blur-fade.tsx` (reference) |
| Confetti | `frontend/components/ui/confetti.tsx` (reference) |
| Badge | `frontend/components/ui/badge.tsx` (reference) |

---

## Positive Findings (Things Done Well)

1. **Excellent ARIA implementation on StarRatingInput** -- Correct `radiogroup` / `radio` roles, per-star `aria-label`, `aria-checked` state tracking, `aria-hidden` on decorative SVGs. Just needs arrow-key nav to be complete.
2. **Consistent design token usage** -- Nearly all colors use semantic tokens (`text-foreground`, `bg-background`, `text-muted-foreground`, `bg-muted`, `text-destructive`, `bg-primary`). Only 3 instances of hardcoded palette colors.
3. **Full state coverage** -- Every page has loading, error, and empty states. No path leaves the user staring at a blank screen.
4. **Clean weight discipline** -- Only `font-semibold` and `font-normal` across all 13 files. No weight creep.
5. **Touch targets** -- All interactive elements on public pages meet the 44px minimum: star buttons, stepper buttons, submit buttons.
6. **Form labels** -- All inputs have associated `<label>` elements with `htmlFor` attributes (except the star rating, which uses `aria-label` instead).
7. **Error handling is inline, not toast** -- Follows the spec directive for public pages where toasts may be missed on mobile.
8. **Spacing is perfectly on-scale** -- Zero arbitrary spacing values outside the justified 44px touch targets.
9. **No AI slop patterns** -- No gradient text, no hero metric dashboards, no glassmorphism cards, no bounce easing, no nested cards, no gray-on-color badges. Clean and purposeful UI.
10. **Smart data fetching** -- Menu availability auto-refreshes at 60s intervals. Booking invalidates event query on success. Parallel queries on menu page.
