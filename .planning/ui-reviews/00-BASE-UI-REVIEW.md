# Base UI Audit -- Design Tokens, Components, and Global Styles

**Audited:** 2026-03-22
**Baseline:** 01-UI-SPEC.md (Phase 1 design contract) + abstract standards
**Screenshots:** Not captured (no dev server running)
**Scope:** globals.css, layout files, all 41 shadcn/ui + magic-ui components, design tokens, theme system

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Core shadcn components have no hardcoded copy; page-level components handle copy well |
| 2. Visuals | 3/4 | Strong component hierarchy, data-slot system well implemented; some magic-ui components bypass design system |
| 3. Color | 2/4 | OKLCH tokens are well-structured but many components use hardcoded hex colors bypassing the theme system |
| 4. Typography | 3/4 | Geist font properly loaded; two-weight system mostly followed; a few magic-ui components force their own sizes |
| 5. Spacing | 3/4 | Consistent spacing via Tailwind scale; card/table spacing is cohesive; CSS keyframe uses camelCase property name |
| 6. Experience Design | 2/4 | No ThemeProvider configured; dark class hardcoded; public layout forces light mode with hardcoded colors |

**Overall: 16/24**

---

## Top 3 Priority Fixes

1. **No ThemeProvider / no suppressHydrationWarning on `<html>`** -- Theme switching is impossible; components using `useTheme()` (sonner.tsx, magic-card.tsx) get stale/incorrect values; hydration mismatches will occur in SSR -- Add `next-themes` ThemeProvider to providers.tsx and `suppressHydrationWarning` to the `<html>` tag in layout.tsx
2. **Hardcoded hex colors in 7+ UI components bypass the theme system** -- Colors like `#262626`, `#ffaa40`, `#9c40ff`, `text-black`, `text-white`, `bg-black`, `border-white`, `border-gray-800` will break in both dark and light modes -- Replace hardcoded values with CSS custom properties or Tailwind semantic tokens
3. **globals.css pulse keyframe uses camelCase `boxShadow` instead of CSS `box-shadow`** -- The `@keyframes pulse` animation will silently fail in all browsers because `boxShadow` is a JavaScript property name, not a CSS property -- Change `boxShadow` to `box-shadow` on lines 73 and 75

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Positive findings:**
- Base shadcn/ui components correctly contain zero hardcoded user-facing copy -- all text is passed via props
- Dialog close button has proper `<span className="sr-only">Close</span>` (dialog.tsx:75, sheet.tsx:75)
- TextAnimate component has accessibility support with `aria-label` and `sr-only` span for screen readers

**Issues:**

| # | File | Line | Severity | Description |
|---|------|------|----------|-------------|
| C1 | `app/page.tsx` | 1-65 | Low | Default Next.js boilerplate page remains with "To get started, edit the page.tsx file" copy and Vercel deployment links. Not a component issue but affects production readiness. |
| C2 | `components/ui/skeleton.tsx` | 3-9 | Low | Skeleton has no `aria-label` or `role="status"` to communicate loading state to screen readers. Consider adding `aria-busy="true"` or `role="status"`. |

---

### Pillar 2: Visuals (3/4)

**Positive findings:**
- Consistent `data-slot` attribute system across all core shadcn components for CSS targeting and debugging
- Button component has comprehensive variant system covering default, outline, secondary, ghost, destructive, and link
- Card component supports size variants via `data-size` with responsive slot-based styling
- Table component wraps in an overflow container for responsive horizontal scrolling
- Dialog and Sheet both include proper overlay/backdrop with blur support
- Avatar component has well-structured size system (sm/default/lg) with badge and group sub-components
- Progress component exposes label, value, track, and indicator as composable parts

**Issues:**

| # | File | Line | Severity | Description |
|---|------|------|----------|-------------|
| V1 | `components/ui/interactive-hover-button.tsx` | 12-29 | Medium | Uses raw `<button>` element instead of the project's Button primitive. Lacks focus-visible styles, disabled states, and ARIA support that the base Button provides. |
| V2 | `components/ui/shimmer-button.tsx` | 33-91 | Medium | Uses raw `<button>` element with `forwardRef` pattern. Missing focus-visible ring styles, disabled opacity handling, and aria-invalid support present in the base Button. |
| V3 | `components/ui/pulsating-button.tsx` | 25-43 | Medium | Same issue -- raw `<button>` without focus-visible ring or disabled state styling. Inconsistent with the base Button component's interaction contract. |
| V4 | `components/ui/hyper-text.tsx` | 169 | Low | Forces `text-4xl font-bold` as default className, overriding the project's typography scale. Consumers must always override. |
| V5 | `components/ui/skeleton.tsx` | 3-9 | Low | Missing `data-slot="skeleton"` attribute, breaking the consistent `data-slot` convention used by all other shadcn components. |

---

### Pillar 3: Color (2/4)

**Positive findings:**
- OKLCH color format used consistently across all `:root` and `.dark` custom properties
- Complete token coverage: background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, 5 chart colors, full sidebar token set
- Dark mode border and input use alpha transparency (`oklch(1 0 0 / 10%)`, `oklch(1 0 0 / 15%)`) for subtle layering
- Radius scale derived from single `--radius` base value with multipliers

**Issues:**

| # | File | Line | Severity | Category | Description |
|---|------|------|----------|----------|-------------|
| CO1 | `components/ui/number-ticker.tsx` | 66 | High | Theming | Hardcoded `text-black dark:text-white` bypasses the `--foreground` token. Should use `text-foreground`. |
| CO2 | `components/ui/avatar-circles.tsx` | 25 | High | Theming | Hardcoded `border-white dark:border-gray-800` bypasses `--background` and `--border` tokens. Should use `border-background` or `border-border`. |
| CO3 | `components/ui/avatar-circles.tsx` | 35 | High | Theming | Hardcoded `border-white bg-black text-white dark:border-gray-800 dark:bg-white dark:text-black`. Fully bypasses the token system. Should use `bg-foreground text-background border-background`. |
| CO4 | `components/ui/magic-card.tsx` | 62-70 | Medium | Theming | Default gradient colors are hardcoded hex values (`#262626`, `#9E7AFF`, `#FE8BBB`, `#ee4f27`, `#6b21ef`). These are configurable props but defaults don't reference the design system. |
| CO5 | `components/ui/border-beam.tsx` | 59-60 | Medium | Theming | Default `colorFrom="#ffaa40"` and `colorTo="#9c40ff"` are hardcoded and don't reference design tokens. |
| CO6 | `components/ui/shimmer-button.tsx` | 21-25 | Medium | Theming | Default `shimmerColor="#ffffff"` and `background="rgba(0, 0, 0, 1)"`. Forces black background with white shimmer regardless of theme. |
| CO7 | `components/ui/shimmer-button.tsx` | 45 | Medium | Theming | Hardcoded `text-white` and `border-white/10`. |
| CO8 | `components/ui/pulsating-button.tsx` | 18 | Low | Theming | Default `pulseColor="#808080"` is hardcoded hex instead of referencing `--ring` or `--muted`. |
| CO9 | `components/ui/shine-border.tsx` | 33 | Low | Theming | Default `shineColor="#000000"` doesn't adapt to theme. |
| CO10 | `components/ui/cool-mode.tsx` | 94 | Low | Theming | Particle colors generated with `hsl(random, 70%, 50%)` -- not theme-aware, but acceptable for a decorative effect. |
| CO11 | `app/(public)/layout.tsx` | 9-17 | High | Theming | Uses `bg-white`, `text-gray-900`, `text-gray-500` directly instead of semantic tokens. The `light` class forces light mode but the hardcoded colors mean semantic tokens are irrelevant here -- this is an anti-pattern. Should use `bg-background`, `text-foreground`, `text-muted-foreground`. |
| CO12 | `app/globals.css` | 85-118 vs 120-152 | Medium | Consistency | All light mode primary/accent/secondary colors are achromatic (zero chroma in OKLCH). The system has no brand color -- every semantic color is a shade of gray. The chart colors are the only chromatic values. This is intentional per the Notion/Linear aesthetic but worth noting that `--destructive` is the only non-gray accent, which limits UI expressiveness. |

**Hardcoded color count in UI components:** 19 instances across 7 files (excluding overlay bg-black/10 which is a standard pattern for backdrops).

---

### Pillar 4: Typography (3/4)

**Positive findings:**
- Geist Sans and Geist Mono properly loaded via `next/font/google` with CSS custom properties (`--font-geist-sans`, `--font-geist-mono`)
- Font variables correctly mapped in globals.css: `--font-sans: var(--font-geist-sans)` and `--font-mono: var(--font-geist-mono)`
- `html` element receives `font-sans` via `@layer base` rule
- `antialiased` class applied on `<html>` for better font rendering
- Input component uses `text-base` on mobile and `md:text-sm` for desktop -- good responsive typography
- Textarea follows the same responsive text sizing pattern

**Issues:**

| # | File | Line | Severity | Description |
|---|------|------|----------|-------------|
| T1 | `components/ui/hyper-text.tsx` | 169 | Medium | Forces `text-4xl font-bold` as default class. The UI-SPEC declares only Regular (400) and Semibold (600) weights. `font-bold` (700) is outside the contract. |
| T2 | `components/ui/hyper-text.tsx` | 177 | Low | Forces `font-mono` on all characters -- this is by design for the scramble effect, but callers should be aware it overrides the font system. |
| T3 | `components/ui/shimmer-button.tsx` | 72 | Low | Contains `text-sm font-medium` in the highlight overlay div. The `font-medium` (500) weight is used in the base system, so this is acceptable. |
| T4 | `components/ui/interactive-hover-button.tsx` | 13 | Low | Uses `font-semibold` which is within the type system, but the component should inherit size from parent rather than being unsized. |
| T5 | `app/layout.tsx` | 29 | Low | The `dark` class is hardcoded on `<html>`. Combined with `h-full` class, this is fine structurally but see Experience Design for the theme issue. |

---

### Pillar 5: Spacing (3/4)

**Positive findings:**
- Consistent use of Tailwind spacing scale (multiples of 4px) throughout core components
- Card padding: `py-4`, `px-4` (16px) for default, `py-3`, `px-3` (12px) for `sm` size -- matches the md/sm spacing tokens
- Button sizes follow a clean scale: h-6 (xs), h-7 (sm), h-8 (default), h-9 (lg)
- Dialog content: `p-4` with `gap-4` -- consistent internal spacing
- Sheet content: `gap-4` with headers/footers using `p-4`
- Ops layout: `p-6 max-w-[1200px]` matches the UI-SPEC's lg (24px) padding and 1200px soft cap
- Table cells: uniform `p-2` padding

**Issues:**

| # | File | Line | Severity | Description |
|---|------|------|----------|-------------|
| S1 | `app/globals.css` | 73, 75 | High | CSS property `boxShadow` in `@keyframes pulse` should be `box-shadow`. This is a JavaScript property name, not valid CSS. The entire pulse animation is broken. |
| S2 | `app/globals.css` | 69-70 | Low | The `--animate-pulse` declaration has an awkward line break before the semicolon (line 69 ends with value, line 70 has just `;`). While this may still parse correctly, it's inconsistent with the formatting of other animation declarations. |
| S3 | `components/ui/shimmer-button.tsx` | 45-46 | Low | Uses `px-6 py-3` (24px/12px) which is larger than the base Button's `px-2.5` (10px). This is intentional for the shimmer button's display style but creates visual inconsistency when used alongside standard buttons. |
| S4 | `components/ui/animated-circular-progress-bar.tsx` | 28 | Low | Uses `size-40` (160px) as default size. This is fine as a default but hardcoded -- should document that callers will typically need to override. |

---

### Pillar 6: Experience Design (2/4)

**Positive findings:**
- Ops layout has a proper loading state with centered spinner and `motion-reduce:animate-none` (line 61)
- Ops layout wraps children in `<ErrorBoundary>` for crash recovery
- Ops layout implements auth guard -- redirects to `/login` if unauthenticated
- Providers.tsx correctly configures React Query with `staleTime: 60s` and `retry: 1`
- TooltipProvider wraps the entire app for consistent tooltip behavior
- Toaster (Sonner) is globally configured with icon overrides for all states (success, info, warning, error, loading)
- Dialog and Sheet components include accessible close buttons with sr-only labels
- `motion-reduce:animate-none` is consistently applied across 40+ spinner instances in the codebase

**Issues:**

| # | File | Line | Severity | Category | Description |
|---|------|------|----------|----------|-------------|
| E1 | `app/layout.tsx` | 29 | **Critical** | Theming | `dark` class is hardcoded directly on `<html>`. There is no `ThemeProvider` from `next-themes` in the provider tree despite `next-themes` being installed (package.json). This means: (a) theme switching is impossible, (b) `useTheme()` calls in sonner.tsx and magic-card.tsx will return incorrect values, (c) the public layout's `light` class override on a child div (line 9 of public/layout.tsx) is a fragile workaround rather than proper theme scoping. |
| E2 | `app/layout.tsx` | 27-29 | **Critical** | SSR | Missing `suppressHydrationWarning` on the `<html>` tag. When `next-themes` ThemeProvider is eventually added, it modifies the `class` attribute on `<html>` at runtime, which will cause a React hydration mismatch error. This should be added proactively. |
| E3 | `app/(public)/layout.tsx` | 9 | High | Theming | Forces `light` mode by adding `light` class on a div, but also hardcodes `bg-white` and uses `text-gray-900`/`text-gray-500` instead of semantic tokens. This creates a parallel color system that bypasses the design tokens entirely. When a ThemeProvider is added, this layout won't respond to it. |
| E4 | `lib/providers.tsx` | 8-29 | High | Theming | Providers tree includes QueryClientProvider, TooltipProvider, and Toaster -- but no ThemeProvider from next-themes. This is the correct location to add it. |
| E5 | `components/ui/sonner.tsx` | 8 | Medium | Theming | Calls `useTheme()` which requires a ThemeProvider ancestor. Without it, `theme` will always be `"system"` and the Sonner toaster may not match the actual dark mode being forced via hardcoded class. |
| E6 | `components/ui/magic-card.tsx` | 75 | Medium | Theming | Calls `useTheme()` and `systemTheme` to determine `isDarkTheme`. Without ThemeProvider, this defaults to `true` on mount but may flash or behave incorrectly. |
| E7 | `components/ui/skeleton.tsx` | 3-9 | Medium | Accessibility | Skeleton lacks `role="status"` and `aria-label="Loading"` (or `aria-busy`). Screen readers will not announce loading state. |
| E8 | Multiple magic-ui components | - | Medium | Motion | blur-fade.tsx, text-animate.tsx, animated-list.tsx, number-ticker.tsx, hyper-text.tsx -- none of these respect `prefers-reduced-motion`. Only the core app-level Loader2 spinners use `motion-reduce:animate-none`. The motion/react library does not automatically disable animations for reduced-motion preference. |
| E9 | `components/ui/cool-mode.tsx` | 181-211 | Low | Performance | Runs a perpetual `requestAnimationFrame` loop even when no particles are active. The loop only breaks via cleanup interval. On pages where CoolMode is mounted but rarely interacted with, this is unnecessary CPU usage. |
| E10 | `components/ui/confetti.tsx` | 41 | Low | Performance | The `globalOptions` object is used as a dependency in `useCallback` but is created fresh on each render (destructured from props with defaults). This causes the callback ref to re-run unnecessarily. Should be memoized or compared by value. |

---

## Registry Safety

**Registries configured in components.json:**
- `@magicui` -> `https://magicui.design/r/{name}`
- `@spectrumui` -> `https://ui.spectrumhq.in/r/{name}.json`
- `@reui` -> `https://reui.io/r/{style}/{name}.json`

**Third-party components identified (from magicui):**
number-ticker, magic-card, blur-fade, animated-list, confetti, avatar-circles, border-beam, shimmer-button, pulsating-button, shine-border, cool-mode, text-animate, hyper-text, interactive-hover-button, animated-circular-progress-bar

**Suspicious pattern scan:** 0 flags. No `fetch()`, `XMLHttpRequest`, `navigator.sendBeacon`, `process.env`, `eval()`, `new Function()`, or dynamic HTTPS imports found in any third-party component.

**Registry audit: 15 third-party blocks checked, no security flags.**

---

## Positive Findings Summary

These patterns are done well and should be maintained:

1. **data-slot convention** -- Consistent across all 26 core shadcn components, enabling CSS targeting and debugging
2. **cn() utility** -- Properly uses `clsx` + `tailwind-merge` for class composition; consistently used in every component
3. **base-ui primitives** -- Button, Checkbox, Switch, Select, Dialog, Sheet, Popover, Tooltip, ScrollArea, Separator, Progress, Tabs all use `@base-ui/react` primitives, ensuring proper ARIA roles and keyboard interaction out of the box
4. **CVA variants** -- Button, Badge, Tabs, Alert, Field all use `class-variance-authority` for type-safe variant management
5. **Responsive input sizing** -- Input and Textarea use `text-base md:text-sm` to prevent iOS zoom on focus (text-base = 16px prevents iOS auto-zoom)
6. **motion-reduce respect** -- Every Loader2 spinner instance (40+) includes `motion-reduce:animate-none`
7. **Auth guard in ops layout** -- Proper redirect-to-login with loading state
8. **ErrorBoundary wrapping** -- Ops layout has crash recovery
9. **OKLCH color system** -- Modern perceptually uniform color space throughout
10. **Composable card/progress/field components** -- Well-structured compound component patterns with slots

---

## Files Audited

### Core Design System
- `frontend/app/globals.css` -- Design tokens, keyframes, base styles
- `frontend/app/layout.tsx` -- Root layout, font loading, providers
- `frontend/app/(public)/layout.tsx` -- Public-facing layout
- `frontend/app/(ops)/layout.tsx` -- Ops (authenticated) layout
- `frontend/components.json` -- shadcn configuration and registries
- `frontend/lib/utils.ts` -- cn() utility
- `frontend/lib/providers.tsx` -- App-level provider tree
- `frontend/app/page.tsx` -- Root page (boilerplate)

### shadcn/ui Core Components (16)
- `frontend/components/ui/button.tsx`
- `frontend/components/ui/card.tsx`
- `frontend/components/ui/badge.tsx`
- `frontend/components/ui/input.tsx`
- `frontend/components/ui/label.tsx`
- `frontend/components/ui/table.tsx`
- `frontend/components/ui/checkbox.tsx`
- `frontend/components/ui/switch.tsx`
- `frontend/components/ui/select.tsx`
- `frontend/components/ui/alert.tsx`
- `frontend/components/ui/separator.tsx`
- `frontend/components/ui/tooltip.tsx`
- `frontend/components/ui/avatar.tsx`
- `frontend/components/ui/dropdown-menu.tsx`
- `frontend/components/ui/dialog.tsx`
- `frontend/components/ui/textarea.tsx`
- `frontend/components/ui/popover.tsx`
- `frontend/components/ui/progress.tsx`
- `frontend/components/ui/tabs.tsx`
- `frontend/components/ui/scroll-area.tsx`
- `frontend/components/ui/sheet.tsx`
- `frontend/components/ui/skeleton.tsx`
- `frontend/components/ui/sonner.tsx`

### Composite shadcn Components (3)
- `frontend/components/ui/input-group.tsx`
- `frontend/components/ui/field.tsx`
- `frontend/components/ui/combobox.tsx`

### Magic UI / Third-Party Components (15)
- `frontend/components/ui/number-ticker.tsx`
- `frontend/components/ui/magic-card.tsx`
- `frontend/components/ui/blur-fade.tsx`
- `frontend/components/ui/animated-list.tsx`
- `frontend/components/ui/confetti.tsx`
- `frontend/components/ui/avatar-circles.tsx`
- `frontend/components/ui/border-beam.tsx`
- `frontend/components/ui/shimmer-button.tsx`
- `frontend/components/ui/pulsating-button.tsx`
- `frontend/components/ui/shine-border.tsx`
- `frontend/components/ui/cool-mode.tsx`
- `frontend/components/ui/text-animate.tsx`
- `frontend/components/ui/hyper-text.tsx`
- `frontend/components/ui/interactive-hover-button.tsx`
- `frontend/components/ui/animated-circular-progress-bar.tsx`

---

## Issue Index by Severity

### Critical (2)
| ID | File | Issue |
|----|------|-------|
| E1 | `app/layout.tsx:29` | No ThemeProvider -- dark class hardcoded, useTheme() broken |
| E2 | `app/layout.tsx:27-29` | Missing suppressHydrationWarning on html tag |

### High (5)
| ID | File | Issue |
|----|------|-------|
| CO1 | `components/ui/number-ticker.tsx:66` | Hardcoded text-black/text-white |
| CO2 | `components/ui/avatar-circles.tsx:25` | Hardcoded border-white/border-gray-800 |
| CO3 | `components/ui/avatar-circles.tsx:35` | Fully hardcoded bg-black/text-white/border-white |
| CO11 | `app/(public)/layout.tsx:9-17` | Hardcoded bg-white, text-gray-900, text-gray-500 |
| S1 | `app/globals.css:73,75` | boxShadow (camelCase) in CSS keyframe -- animation broken |

### Medium (10)
| ID | File | Issue |
|----|------|-------|
| V1 | `interactive-hover-button.tsx:12-29` | Raw button, no focus/disabled states |
| V2 | `shimmer-button.tsx:33-91` | Raw button, no focus/disabled states |
| V3 | `pulsating-button.tsx:25-43` | Raw button, no focus/disabled states |
| CO4 | `magic-card.tsx:62-70` | Hardcoded hex gradient defaults |
| CO5 | `border-beam.tsx:59-60` | Hardcoded hex color defaults |
| CO6 | `shimmer-button.tsx:21-25` | Hardcoded black bg / white shimmer |
| CO7 | `shimmer-button.tsx:45` | Hardcoded text-white, border-white/10 |
| E5 | `sonner.tsx:8` | useTheme() without ThemeProvider |
| E6 | `magic-card.tsx:75` | useTheme() without ThemeProvider |
| E7 | `skeleton.tsx:3-9` | Missing role="status" for accessibility |
| E8 | Multiple magic-ui files | No prefers-reduced-motion support |
| T1 | `hyper-text.tsx:169` | Forces font-bold (700) outside weight contract |
| CO12 | `globals.css:85-152` | Fully achromatic palette -- no brand color |

### Low (10)
| ID | File | Issue |
|----|------|-------|
| C1 | `app/page.tsx` | Boilerplate Next.js page remains |
| C2 | `skeleton.tsx` | No aria-label for loading state |
| V4 | `hyper-text.tsx:169` | Forces text-4xl default |
| V5 | `skeleton.tsx` | Missing data-slot attribute |
| CO8 | `pulsating-button.tsx:18` | Hardcoded pulse color |
| CO9 | `shine-border.tsx:33` | Hardcoded shine color |
| CO10 | `cool-mode.tsx:94` | Random HSL particle colors |
| S2 | `globals.css:69-70` | Awkward line break in animation declaration |
| S3 | `shimmer-button.tsx:45-46` | Oversized padding vs base Button |
| E9 | `cool-mode.tsx:181` | Perpetual rAF loop |
| E10 | `confetti.tsx:41` | globalOptions not memoized |
| T2 | `hyper-text.tsx:177` | Forces font-mono on all characters |

**Total issues: 27** (2 Critical, 5 High, 12 Medium, 10 Low)
