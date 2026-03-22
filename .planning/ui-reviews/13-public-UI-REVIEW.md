# Phase 13 — Public-Facing Components UI Review

**Audited:** 2026-03-22
**Baseline:** `.planning/phases/13-customer-experience/13-UI-SPEC.md`
**Screenshots:** Not captured (no dev server running on ports 3000, 5173, or 8080)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Copy matches spec almost perfectly; one error message deviates from contracted wording |
| 2. Visuals | 2/4 | Missing ARIA labels on interactive elements; star rating has no accessible name; form inputs lack associated labels |
| 3. Color | 1/4 | Pervasive hard-coded `text-gray-*` classes instead of design tokens; booking success uses `green-*` and `blue-*` outside the declared palette |
| 4. Typography | 3/4 | Font sizes and weights match spec; one violation (`text-4xl` and `text-lg` not in spec scale) |
| 5. Spacing | 3/4 | Consistent use of spacing scale; touch targets correctly sized at 44px minimum |
| 6. Experience Design | 3/4 | Good state coverage (loading, empty, error, success); missing error state on events list page; no `<nav>` or skip link in public layout |

**Overall: 15/24**

---

## Top 3 Priority Fixes

1. **Hard-coded gray colors throughout all public components** -- Colors will not respond to theme changes and break the design token contract. Every `text-gray-500` should be `text-muted-foreground`, every `text-gray-900` should be `text-foreground`, every `bg-gray-100` should be `bg-muted`, and every `border-gray-*` should be `border-border` or `border-input`. This affects 30+ class instances across 10 files.

2. **Star rating and stepper buttons have no accessible labels** -- Screen reader users hear "button" with no context. Each star button needs `aria-label={`Rate ${star} out of 5`}` and the stepper buttons need `aria-label="Decrease guests"` / `aria-label="Increase guests"`. The guest number input also has no programmatic label association.

3. **Booking success confirmation uses hard-coded `green-*` and `blue-*` semantic colors not in the design palette** -- The UI-SPEC declares success should use `text-primary` and errors should use `text-destructive`. Using `bg-green-50 border-green-200 text-green-700` and `bg-blue-50 border-blue-200 text-blue-700` introduces undeclared colors that will not adapt to any theme.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Matches spec:**
- Feedback page title: "How was your experience?" -- MATCH
- Feedback form CTA: "Submit Feedback" -- MATCH
- Feedback sub-label: "Takes 30 seconds. Helps us improve." -- MATCH
- Star rating label: "Rate your meal" -- MATCH
- Comment placeholder: "Tell us what you loved or what we can do better..." -- MATCH
- Name placeholder: "Your name (optional)" -- MATCH
- Phone placeholder: "Your number (optional)" -- MATCH (feedback page) / "Your phone number" (booking form -- acceptable variant)
- Thank-you heading: "Thank you!" -- MATCH
- Thank-you body: "Your feedback helps us improve every meal." -- MATCH
- Events page title: "Upcoming Experiences" -- MATCH
- Events empty state heading: "No upcoming events" -- MATCH
- Events empty state body: "Check back soon -- we're always planning something new." -- MATCH
- Event detail CTA heading: "Book Your Spot" -- MATCH
- Booking form CTA: "Confirm Booking" -- MATCH
- Capacity badge available: "X spots left" -- MATCH
- Capacity badge sold out: "Sold Out" -- MATCH
- Booking success: "You're booked! We'll see you on [date]." -- MATCH
- Menu page title: "Our Menu" -- MATCH
- Availability badge available: "Available" -- MATCH
- Availability badge sold out: "Sold Out" -- MATCH
- Menu empty state: "Menu is being updated. Check back shortly." -- MATCH

**Deviations:**

| # | File | Line | Severity | Description |
|---|------|------|----------|-------------|
| C1 | `EventBookingForm.tsx` | 75 | Low | Booking error copy says "Sorry, this event just filled up. No spots remain for X guests." but spec says "Sorry, this event is full. No spots remain for [N] guests." The word "just filled up" deviates from contracted copy. |
| C2 | `EventBookingForm.tsx` | 99 | Low | Booking name input placeholder is "Your name" -- spec for booking does not declare this explicitly but feedback uses "Your name (optional)". The booking field is required, so omitting "(optional)" is correct behavior. No issue. |

### Pillar 2: Visuals (2/4)

**Positive findings:**
- Semantic heading hierarchy is mostly correct: `h1` on pages, `h3` on EventCard, `h2` for sections
- MagicCard provides a clear visual focal point on event cards
- Image placeholders use a tasteful initial-letter approach
- Touch targets are correctly sized at 44x44px on star buttons and stepper buttons
- Loading states use Skeleton and Loader2 appropriately

**Issues:**

| # | File | Line | Severity | Category | Description | Impact | Recommendation |
|---|------|------|----------|----------|-------------|--------|----------------|
| V1 | `StarRatingInput.tsx` | 19-26 | Critical | Accessibility | Star rating buttons have no `aria-label`. Screen readers announce "button" with no context for what clicking does. | Blind and low-vision users cannot use the star rating at all. | Add `aria-label={`Rate ${star} out of 5 stars`}` to each button. |
| V2 | `StarRatingInput.tsx` | 15 | High | Accessibility | The star rating group has no `role="radiogroup"` or `aria-label="Rating"`. Individual stars should have `role="radio"` and `aria-checked`. | Screen readers have no context that these buttons form a rating selection. | Wrap in `<fieldset>` with `<legend>` or add `role="radiogroup" aria-label="Rating"` and `role="radio" aria-checked={star <= value}` per button. |
| V3 | `EventBookingForm.tsx` | 98-104 | High | Accessibility | Name input has `placeholder="Your name"` but no associated `<label>`. Placeholder is not a substitute for a label -- it disappears on input. | Screen reader users and users with cognitive impairments may not know what the field is for. | Add `<label htmlFor="booking-name">Your name</label>` and `id="booking-name"` on the input. |
| V4 | `EventBookingForm.tsx` | 108-114 | High | Accessibility | Phone input has `placeholder="Your phone number"` but no associated `<label>`. | Same as V3. | Add `<label htmlFor="booking-phone">Phone number</label>` and `id="booking-phone"` on the input. |
| V5 | `EventBookingForm.tsx` | 118 | High | Accessibility | Label "Number of guests" exists but has no `htmlFor` attribute and the input at line 130 has no `id`, so they are not programmatically associated. | Clicking the label does not focus the input. Screen readers may not announce the label for the input. | Add `htmlFor="booking-guests"` on the label and `id="booking-guests"` on the input. |
| V6 | `EventBookingForm.tsx` | 120-129 | Medium | Accessibility | Decrement button (`<Minus>` icon) has no `aria-label`. Screen reader announces "button". | Users relying on assistive technology cannot determine the button's purpose. | Add `aria-label="Decrease number of guests"`. |
| V7 | `EventBookingForm.tsx` | 143-152 | Medium | Accessibility | Increment button (`<Plus>` icon) has no `aria-label`. | Same as V6. | Add `aria-label="Increase number of guests"`. |
| V8 | `feedback/[orderId]/page.tsx` | 82-137 | High | Accessibility | Feedback form inputs (textarea line 91, name input line 100, phone input line 109) all use placeholder-only labeling with no `<label>` elements or `aria-label` attributes. | Screen reader users cannot identify what each field is for. Placeholder disappears once user starts typing. | Add visible `<label>` elements associated via `htmlFor`/`id`, or at minimum `aria-label` attributes on each input. |
| V9 | `EventCard.tsx` | 24-46 | Medium | Accessibility | The entire card is wrapped in a `<Link>` containing a `<MagicCard>` with `cursor-pointer`. The link has no descriptive text beyond what is visually inside -- but screen readers will read the entire card content as the link text, which is verbose. | Screen reader users hear a long string "Event Title Short Mon 12 DINNER Rs. 500 3 spots left Zone Brand" as a single link. | Consider adding `aria-label={event.title}` on the Link to provide a concise accessible name. |
| V10 | `layout.tsx` | 9 | Medium | Accessibility | Public layout has no skip-to-content link. The header is a `<header>` element (good), but there is no `<nav>` landmark and no skip link. | Keyboard users must tab through the header on every page load. Minor impact since the header only contains a logo/name with no links. | Add `<a href="#main-content" className="sr-only focus:not-sr-only">Skip to content</a>` and `id="main-content"` on `<main>`. |
| V11 | `layout.tsx` | 10-13 | Low | Accessibility | Header uses `<span>` for "Konma Xperience" text. This is acceptable since it is not a link, but there is no `<h1>` for the site name. Each page provides its own `<h1>`, which is correct. | No issue -- informational. | None needed. |
| V12 | `EventBookingForm.tsx` | 171-173 | Medium | Accessibility | Error message is a plain `<p>` with no `role="alert"` or `aria-live="assertive"`. When an error occurs after form submission, screen readers will not announce it. | Blind users will not know their booking failed. | Add `role="alert"` to the error paragraph. |
| V13 | `feedback/[orderId]/page.tsx` | 134-136 | Medium | Accessibility | Same issue -- feedback error message has no `role="alert"`. | Same as V12. | Add `role="alert"` to the error paragraph. |
| V14 | `MenuItemPublicCard.tsx` | 33 | Low | Semantics | Uses `<h4>` for item name. This is fine within the category `<h2>` hierarchy on the menu page, but skips `<h3>` level. | Minor heading hierarchy skip. Not a hard violation since the card is a leaf component. | Consider using `<h3>` for consistency, since the containing page has `<h1>` and `<h2>` for categories. |
| V15 | `EventBookingForm.tsx` | 130-140 | Low | Accessibility | Guest count number input has no `aria-label` or visible label association (label exists at line 118 but is not linked). The `min` and `max` attributes are set correctly. | Minor -- the visual layout implies association but it is not programmatic. | Link via `htmlFor`/`id` as noted in V5. |

### Pillar 3: Color (1/4)

This is the most significant area of concern. The UI-SPEC explicitly declares a design token approach using CSS variables (`text-foreground`, `text-muted-foreground`, `bg-muted`, `bg-background`, etc.), but the implementation uses hardcoded Tailwind gray scale classes almost exclusively.

**Hard-coded color violations (all files in `frontend/components/public/` and `frontend/app/(public)/`):**

| Token that should be used | Hard-coded class used instead | Count | Files |
|---------------------------|-------------------------------|-------|-------|
| `text-foreground` | `text-gray-900` | 8 | MenuItemPublicCard:34, EventBookingForm:103,113,141, feedback page:84, events page:31, event detail:40, menu page:119 |
| `text-muted-foreground` | `text-gray-500` | 10 | EventBookingForm:38, EventCard:28,37, FeedbackThankYou:18, feedback page:71, events page:34, event detail:43,89,105, menu page:91,108 |
| `text-muted-foreground` | `text-gray-400` | 4 | AvailabilityBadge:15, CapacityBadge:15, event detail:32,78 |
| `text-muted-foreground` | `text-gray-700` | 3 | EventBookingForm:118, MenuItemPublicCard:36, event detail:102 |
| `placeholder:text-muted-foreground` | `placeholder:text-gray-400` | 5 | EventBookingForm:103,113, feedback page:95,105,115 |
| `bg-muted` | `bg-gray-100` | 3 | StarRatingInput:22 (hover), MenuItemPublicCard:16, event detail:67 |
| `bg-muted` | `bg-gray-50` | 1 | EventBookingForm:37 |
| `border-input` or `border-border` | `border-gray-300` | 5 | EventBookingForm:103,113,124,141,147 |
| `border-border` | `border-gray-200` | 1 | EventBookingForm:37 |
| `text-muted-foreground` | `text-gray-300` | 2 | StarRatingInput:31, MenuItemPublicCard:27 |

**Total: ~42 hard-coded gray instances across 10 files.**

**Undeclared semantic color usage:**

| # | File | Line | Severity | Description | Spec says |
|---|------|------|----------|-------------|-----------|
| CL1 | `EventBookingForm.tsx` | 45-46 | High | Booking success uses `border-green-200 bg-green-50 text-green-700`. | Spec says success should use `text-primary`. Green is not in the declared color palette at all. |
| CL2 | `EventBookingForm.tsx` | 172 | Medium | Error uses `text-red-600`. | Spec says errors use `text-destructive`. The `red-600` value may not match the destructive token. |
| CL3 | `feedback/[orderId]/page.tsx` | 77 | Medium | Order-not-found info box uses `bg-blue-50 border-blue-200 text-blue-700`. | Blue is not in the declared color palette. No informational color is specified in the UI-SPEC. |
| CL4 | `feedback/[orderId]/page.tsx` | 135 | Medium | Error uses `text-red-600`. | Should be `text-destructive`. |
| CL5 | `StarRatingInput.tsx` | 30 | Low | Star fill uses `fill-amber-500 text-amber-500`. | Spec says accent should apply to "active star rating fill". Amber is an acceptable choice for stars but it is not declared in the public color palette -- the spec says "accent" for star fill which maps to `bg-primary`/`text-primary`. However, amber stars are a widely recognized convention, so this is a soft deviation. |
| CL6 | `layout.tsx` | 9 | Low | Layout uses `bg-white` directly instead of `bg-background`. In light mode these are equivalent, but `bg-background` is the correct token. The spec does mention both `bg-white` and `bg-background` as acceptable for the public context. |

**What IS done correctly:**
- Badge variants use the design system (`variant="default"`, `variant="secondary"`, `variant="outline"`) which map to CSS variable tokens
- The Button component uses design tokens internally
- The layout does set `text-foreground` (line 9) -- but this is the only token usage in all public code

### Pillar 4: Typography (3/4)

**Spec allows:** `text-3xl` (Display), `text-xl` (Heading), `text-base` (Body), `text-sm` (Label/Small), `text-xs` (footer only).
**Weights allowed:** `font-semibold` (600) and `font-normal` (400) only.

**Sizes found in public components:**

| Size | Usage | Spec-compliant? |
|------|-------|-----------------|
| `text-3xl` | Page titles, thank-you heading | Yes (Display) |
| `text-xl` | Section headings, event card title, empty state headings | Yes (Heading) |
| `text-base` | Form labels, body text, prices on badges | Yes (Body) |
| `text-sm` | Dates, prices, helper text, badge content | Yes (Label/Small) |
| `text-xs` | Footer, zone/brand metadata | Yes (Micro) |
| `text-4xl` | MenuItemPublicCard:27 -- placeholder letter | NO -- not in spec scale |
| `text-lg` | event detail page:78 -- placeholder text | NO -- not in spec scale |

**Weights found:**

| Weight | Usage | Spec-compliant? |
|--------|-------|-----------------|
| `font-semibold` | All headings, placeholder letters | Yes |
| `font-normal` | Form labels on feedback page | Yes |
| `tracking-tight` | Header brand name (layout:11) | Not declared in spec but not a weight violation |

**Issues:**

| # | File | Line | Severity | Description |
|---|------|------|----------|-------------|
| T1 | `MenuItemPublicCard.tsx` | 27 | Low | Uses `text-4xl` for the placeholder letter. Spec scale stops at `text-3xl`. This is a decorative element in a fallback state, so impact is minimal. Should use `text-3xl` to stay within spec. |
| T2 | `events/[id]/page.tsx` | 78 | Low | Uses `text-lg` for the event type label in the image placeholder. `text-lg` (18px) is not in the spec type scale. Should use `text-base` (16px). |

### Pillar 5: Spacing (3/4)

**Positive findings:**
- Consistent use of `space-y-2` (8px), `space-y-3` (12px), `space-y-4` (16px), `space-y-6` (24px), `space-y-8` (32px) -- all within the declared scale
- Page structure uses `max-w-4xl mx-auto px-4 py-8` consistently
- Touch targets correctly use `min-h-[44px] min-w-[44px]` on star buttons and stepper buttons
- Grid gaps use `gap-4` (16px) and `gap-6` (24px) consistently
- Empty states use `py-16` (64px) as spec declares

**Issues:**

| # | File | Line | Severity | Description |
|---|------|------|----------|-------------|
| S1 | `feedback/[orderId]/page.tsx` | 68 | Low | Feedback page uses `max-w-md` but spec says "centered `max-w-sm`" on mobile and "`max-w-md`" on desktop. There is no responsive breakpoint -- it is always `max-w-md`. This is a minor spec deviation -- `max-w-md` (448px) on mobile 375px will just be full width anyway due to `px-4`, so the practical impact is none. |
| S2 | `EventBookingForm.tsx` | 37 | Low | "Event is full" state uses `p-6` (24px) padding which is consistent. No issue. |
| S3 | `MenuBrandTabs.tsx` | 18 | Low | TabsList uses `overflow-x-auto flex-nowrap w-full justify-start` for horizontal scrolling. This is correct for many brand tabs but there is no scroll indicator (fade edge or scrollbar hint). Users may not realize there are more tabs offscreen. Not a spacing issue per se, but a UX concern related to horizontal overflow. |
| S4 | `EventCard.tsx` | 26 | Low | Card padding is `p-4` (16px) which matches "md" spacing for card internal padding on mobile. Correct. |

### Pillar 6: Experience Design (3/4)

**State coverage analysis:**

| State | Events page | Event detail | Booking form | Menu page | Feedback page |
|-------|-------------|--------------|--------------|-----------|---------------|
| Loading | Skeleton grid | Loader2 spinner | N/A (inline) | Skeleton tabs + grid | N/A |
| Empty | "No upcoming events" | N/A | "This event is full" | "Menu is being updated" | N/A |
| Error | MISSING | "Event not found" | Inline error | MISSING | Inline error |
| Success | N/A | N/A | Inline confirmation | N/A | Thank-you + confetti |
| Disabled | N/A | N/A | Submit disabled when invalid | N/A | Submit disabled until rating |

**Issues:**

| # | File | Line | Severity | Category | Description | Impact | Recommendation |
|---|------|------|----------|----------|-------------|--------|----------------|
| E1 | `events/page.tsx` | 11-14 | Medium | Experience Design | useQuery has no `error` state handling. If the API call fails, the page shows nothing -- it stays in a perpetual non-loading, non-empty state. | Users see a blank page if the API is down. | Destructure `error` from useQuery and show an error state: "Couldn't load events. Refresh the page to try again." |
| E2 | `menu/page.tsx` | 19-39 | Medium | Experience Design | Three parallel useQuery calls have no error handling. If any API call fails, the page silently shows loading then empty content. | Users see empty menu with no explanation if API fails. | Destructure `error` from each query, combine, and show an error state. |
| E3 | `feedback/[orderId]/page.tsx` | 28-37 | Medium | Experience Design | Order check uses raw `useEffect` + `try/catch` instead of `useQuery`. This means: no loading state while checking the order, no retry, and no caching. The `setOrderNotFound(true)` fires on ANY error (network, 500, etc.), not just 404. | A temporary network blip during page load permanently shows "We couldn't find your order" even though the order exists. | Use `useQuery` with `queryKey: ['public-order', orderId]` and check specifically for 404 status before setting orderNotFound. |
| E4 | `layout.tsx` | 8-22 | Low | Experience Design | Public layout has no error boundary. If any child component throws, users see the default Next.js error page. | Uncaught errors show a developer-facing error screen to customers. | Add an `error.tsx` file in `app/(public)/` to catch rendering errors gracefully. |
| E5 | `EventBookingForm.tsx` | 59-84 | Low | Performance | The form does not debounce the submit button. While the `submitting` state disables it, a fast double-click before state updates could fire two requests. | Unlikely but possible double booking. | The `disabled={!isValid || submitting}` guard is present and adequate for most cases. Low priority. |
| E6 | `menu/page.tsx` | 55-67 | Low | Performance | `itemsByCategory` memo creates new arrays with spread operator inside a loop (`[...existing, item]`). For a large menu this is O(n^2). | Only a concern for menus with hundreds of items. | Use `push` into a mutable array within the memo, then return the map. |
| E7 | `events/page.tsx` | 43 | Low | Performance | BlurFade wraps each event card with staggered delay `index * 0.05`. With many events (say 20+), the last card delays 1+ second to appear. This is unnecessary motion for cards already in viewport. | Users wait to see content that is already loaded. | Cap the delay at a maximum (e.g., `Math.min(index * 0.05, 0.3)`) or only stagger cards that enter the viewport. |

---

## Additional Anti-Pattern Checks

| Pattern | Status | Notes |
|---------|--------|-------|
| Generic card grid | Not present | Event cards use MagicCard with hover effects, not a plain card grid |
| Hero metric layout | Not present | No large number dashboards on public pages |
| Gradient text | Not present | Clean |
| Glassmorphism | Not present | `backdrop-blur` used only on header (appropriate for sticky nav) |
| Bounce easing | Not present | BlurFade uses `easeOut` |
| Gray on color | Not present | No colored backgrounds with gray text |
| Nested cards | Not present | Clean single-level card usage |
| Redundant copy | Not present | Copy is concise and purposeful |

---

## Registry Safety

Registry audit: No new third-party registry blocks introduced in Phase 13. All animation components (MagicCard, BlurFade, Confetti) were pre-installed and previously audited. No flags.

---

## Files Audited

| File | Path |
|------|------|
| Public Layout | `frontend/app/(public)/layout.tsx` |
| Events List Page | `frontend/app/(public)/events/page.tsx` |
| Event Detail Page | `frontend/app/(public)/events/[id]/page.tsx` |
| Menu Page | `frontend/app/(public)/menu/page.tsx` |
| Feedback Page | `frontend/app/(public)/feedback/[orderId]/page.tsx` |
| AvailabilityBadge | `frontend/components/public/AvailabilityBadge.tsx` |
| CapacityBadge | `frontend/components/public/CapacityBadge.tsx` |
| EventBookingForm | `frontend/components/public/EventBookingForm.tsx` |
| EventCard | `frontend/components/public/EventCard.tsx` |
| MenuBrandTabs | `frontend/components/public/MenuBrandTabs.tsx` |
| MenuItemPublicCard | `frontend/components/public/MenuItemPublicCard.tsx` |
| StarRatingInput | `frontend/components/public/StarRatingInput.tsx` |
| FeedbackThankYou | `frontend/components/public/FeedbackThankYou.tsx` |
| MagicCard (UI dep) | `frontend/components/ui/magic-card.tsx` |
| BlurFade (UI dep) | `frontend/components/ui/blur-fade.tsx` |
| Badge (UI dep) | `frontend/components/ui/badge.tsx` |
| Global CSS | `frontend/app/globals.css` |

---

## Summary of All Issues by Severity

### Critical (1)
| ID | File | Description |
|----|------|-------------|
| V1 | StarRatingInput.tsx:19 | Star buttons have no aria-label -- unusable for screen readers |

### High (7)
| ID | File | Description |
|----|------|-------------|
| V2 | StarRatingInput.tsx:15 | Star group has no radiogroup role or fieldset |
| V3 | EventBookingForm.tsx:98 | Name input has no label |
| V4 | EventBookingForm.tsx:108 | Phone input has no label |
| V5 | EventBookingForm.tsx:118 | Guest label not associated with input |
| V8 | feedback/[orderId]/page.tsx:82 | All feedback form inputs lack labels |
| CL1 | EventBookingForm.tsx:45 | Undeclared green-* colors for success state |
| -- | All public components | 42+ hard-coded gray-* classes instead of design tokens |

### Medium (8)
| ID | File | Description |
|----|------|-------------|
| V6 | EventBookingForm.tsx:120 | Decrement button has no aria-label |
| V7 | EventBookingForm.tsx:143 | Increment button has no aria-label |
| V9 | EventCard.tsx:24 | Link wrapping entire card is verbose for screen readers |
| V10 | layout.tsx:9 | No skip-to-content link |
| V12 | EventBookingForm.tsx:171 | Error message has no role="alert" |
| V13 | feedback/[orderId]/page.tsx:134 | Error message has no role="alert" |
| E1 | events/page.tsx:11 | No error state for failed API call |
| E2 | menu/page.tsx:19 | No error state for failed API calls |
| E3 | feedback/[orderId]/page.tsx:28 | Order check uses raw useEffect, no retry, wrong error handling |
| CL2-CL4 | Multiple | red-600 and blue-* colors instead of design tokens |

### Low (8)
| ID | File | Description |
|----|------|-------------|
| C1 | EventBookingForm.tsx:75 | Booking error copy slightly deviates from spec |
| T1 | MenuItemPublicCard.tsx:27 | text-4xl not in spec type scale |
| T2 | events/[id]/page.tsx:78 | text-lg not in spec type scale |
| S3 | MenuBrandTabs.tsx:18 | No scroll indicator for horizontal overflow |
| V14 | MenuItemPublicCard.tsx:33 | h4 skips h3 level |
| E4 | layout.tsx | No error boundary (error.tsx) for public routes |
| E6 | menu/page.tsx:55 | O(n^2) array spread in memo for large menus |
| E7 | events/page.tsx:43 | Unbounded stagger delay for long event lists |
