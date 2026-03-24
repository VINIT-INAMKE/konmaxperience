# Phase 22: Recipe Page Redesign - Research

**Researched:** 2026-03-24
**Domain:** React drag-and-drop, client-side cost calculation, Next.js app router navigation guards, Prisma clone transaction, inline-editable fields
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Page layout and editing model**
- D-01: Single scrollable page with two-column layout — main content (left, ~70%) scrolls, cost panel (right, ~30%) is sticky
- D-02: Dedicated routes: `/recipes/new` (empty builder), `/recipes/[id]` (loaded builder). List page "Create" button becomes a `<Link>`. Current `/recipes/[id]/edit` alias also supported. The sidebar wizard (`RecipeWizard.tsx`) and its 3 step components are removed entirely
- D-03: Inline-editable header — recipe name as a large editable text field at the top, metadata (brand, zone, yield qty/unit, portion size, shelf life, description) as compact inline fields in a grid below. Document-editing feel, not a form
- D-04: Browser `beforeunload` dialog on navigation with unsaved changes. Amber dot + "Unsaved changes" text in the page header next to the Save button. No custom discard modal

**BOM table experience**
- D-05: Drag-handle reordering on each row using `dnd-kit`. Grip handle (`GripVertical` icon) on the left column of each row
- D-06: Per-line cost column in the BOM table. Ingredient lines show `₹ X.XX` from vendor price calculation. Sub-recipe lines show cost derived from `computed_cost / yield_qty * quantity`. Lines without vendor prices show `—` with subtle amber text
- D-07: Both a persistent empty row at the bottom of the table (start typing to search) AND an explicit "+ Add Line" button below it for discoverability
- D-08: Sub-recipe BOM lines are expandable inline — chevron icon on the row, expanding shows the sub-recipe's ingredients indented below (read-only, tree view). Uses the same nesting logic as the existing `RecipeDependencyTree` component

**Live cost preview**
- D-09: Hybrid cost calculation — client-side instant estimate as user edits (using pre-fetched vendor prices and sub-recipe computed costs), plus server-side recalculation on a 3-second debounce to correct unit conversion edge cases. Client shows estimate immediately; server response replaces it with authoritative value. Subtle "estimated" badge until server confirms
- D-10: Partial costs displayed with `(partial)` label. Missing-price lines listed by name in the cost panel with amber warning icon. Call-to-action: "X ingredients missing prices"
- D-11: Cost panel shows three metrics: (1) total batch cost, (2) per-portion cost (batch cost / yield in portions), (3) food cost % if the recipe is linked to a menu item (recipe cost / selling price). Per-portion requires knowing portion count from yield

**Inline approval workflow**
- D-12: Colored status banner below the page header with contextual action buttons. Draft → `[Submit for Approval]`, Pending → `[Approve] [Reject]` (for approvers only), Approved → `[Create New Version] [Archive]`. No status dropdown anywhere
- D-13: New `pending` status added to the schema. Full flow: `draft → pending → approved → archived`. Reject sends back to `draft`. The existing backend rule "cannot revert approved to draft" stays — editing an approved recipe requires "Create New Version" which archives the current and creates a draft clone
- D-14: Approved recipes are locked (all fields read-only). "Create New Version" button archives the current recipe and creates a new draft clone with the same data. This preserves the approved version in history while allowing iteration

### Claude's Discretion
- Exact dnd-kit configuration and animation details
- Cost panel visual design and number formatting
- Empty state design for new recipe builder
- Loading skeleton design
- Keyboard shortcuts for common actions (if any)
- How the "estimated" vs "confirmed" cost badge looks
- Error state handling for failed saves

### Deferred Ideas (OUT OF SCOPE)
- Recipe version history / changelog — track all versions with diffs (future phase)
- Approval comments / rejection reason text field — would enhance the approval flow but adds scope
- Recipe image upload via R2 (currently just a URL field) — separate concern
- Recipe templates / "create from template" — future feature
- Batch scaling calculator ("double this recipe") — future feature
</user_constraints>

---

## Summary

Phase 22 replaces the sidebar 3-step wizard with a full-page recipe builder. All five core technical domains were verified directly against installed source code and the Next.js 16 docs bundled in `node_modules/next/dist/docs/`.

**Critical discovery:** `@dnd-kit/core@6.3.1` and `@dnd-kit/sortable@10.0.0` are already installed in the project (`frontend/package.json`). No new packages need to be installed. The `SortableContext` + `useSortable` + `arrayMove` pattern is the established API for this version.

**Critical discovery:** The `beforeunload` pattern is already proven in the project — `GuideEditorClient.tsx` (lines 209-219) uses the exact pattern needed: `window.addEventListener('beforeunload', handler)` with `e.preventDefault(); e.returnValue = ''`. This is the authoritative in-project reference.

**Critical discovery:** `NumberTicker` uses `useInView` with `once: true`. For the live cost panel that updates as users type, `NumberTicker` is NOT suitable — it only animates once when it enters the viewport. The cost panel should use a plain animated number display (e.g., a simple CSS transition on a span, or the `useSpring`/`useMotionValue` primitives from `motion/react` directly without the once-in-view gate).

**Primary recommendation:** Build the new builder as a new `RecipeBuilderPage` component (replacing the detail page at `[id]/page.tsx`), add a new `app/(ops)/operations/recipes/new/page.tsx`, keep the list page intact but update buttons to `<Link>` navigation.

---

## Standard Stack

### Core (already installed — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/core` | 6.3.1 | DnD context, sensors, collision detection | Already installed, project standard |
| `@dnd-kit/sortable` | 10.0.0 | `SortableContext`, `useSortable`, `arrayMove` | Already installed, project standard |
| `@dnd-kit/utilities` | 3.2.2 | `CSS.Transform.toString` for drag transform styles | Already installed |
| `@tanstack/react-query` | 5.91.2 | Data fetching, mutations, query cache | Project standard for all data fetching |
| `motion/react` | 12.38.0 | `useSpring`, `useMotionValue` for cost panel animation | Already used by `NumberTicker` — reuse primitives directly |
| `lucide-react` | 0.577.0 | `GripVertical`, `ChevronDown`, `ChevronRight` icons | Project standard icon library |

### Supporting (existing)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sonner` | 2.0.7 | Toast notifications for save success/error | All mutation feedback |
| `zustand` | 5.0.12 | Auth store (`useAuthStore`) for role checks | Permission gating on approval buttons |
| `zod` | 4.3.6 | Input validation (if used) | Optional — current wizard uses plain strings |

### No New Packages Required

dnd-kit is fully installed. No install step needed in any plan.

**Version verification:** Confirmed from `frontend/node_modules/@dnd-kit/core/package.json` and `@dnd-kit/sortable/package.json` directly.

---

## Architecture Patterns

### Recommended Project Structure (new files)

```
frontend/app/(ops)/operations/recipes/
├── page.tsx                    # KEEP — update Create button to <Link href="/recipes/new">
├── new/
│   └── page.tsx               # NEW — empty builder, renders RecipeBuilderPage with no id
└── [id]/
    └── page.tsx               # REPLACE — loads recipe, renders RecipeBuilderPage with id

frontend/components/ops/operations/recipes/
├── RecipeBuilderPage.tsx      # NEW — main builder component (the full page)
├── builder/
│   ├── RecipeBomTable.tsx     # NEW — sortable BOM table with dnd-kit
│   ├── BomTableRow.tsx        # NEW — sortable row (replaces BomLineRow.tsx)
│   ├── RecipeCostPanel.tsx    # NEW — sticky right panel
│   ├── RecipeStatusBanner.tsx # NEW — approval workflow banner
│   └── RecipeMetaGrid.tsx     # NEW — inline editable header/metadata grid
├── wizard/                    # REMOVE after builder ships
│   ├── RecipeWizard.tsx       # REMOVE
│   ├── RecipeWizardStep1.tsx  # REMOVE
│   ├── RecipeWizardStep2.tsx  # REMOVE
│   ├── RecipeWizardStep3.tsx  # REMOVE
│   └── BomLineRow.tsx         # REMOVE
├── RecipeDependencyTree.tsx   # KEEP — reused for sub-recipe inline expansion
├── RecipeStatusBadge.tsx      # KEEP + extend for `pending` status
└── RecipeCard.tsx             # KEEP unchanged
```

### Pattern 1: dnd-kit Sortable List for Table Rows

**What:** `DndContext` wraps the table, `SortableContext` takes the item ID array, each row uses `useSortable`. `arrayMove` from `@dnd-kit/sortable` handles state update on drop.

**When to use:** Anytime rows need drag-handle reorder.

**Key API (from installed source `@dnd-kit/sortable/dist/sortable.esm.js`):**

```typescript
// Source: frontend/node_modules/@dnd-kit/sortable/dist/sortable.esm.js
// Public API: SortableContext, arrayMove, useSortable, verticalListSortingStrategy

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Parent: BOM table
function RecipeBomTable({ lines, onReorder }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );
  const ids = lines.map((l) => l.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      onReorder(arrayMove(lines, oldIndex, newIndex));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {lines.map((line, index) => (
          <BomTableRow key={line.id} line={line} index={index} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

// Child: individual sortable row
function BomTableRow({ line, index }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: line.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="grid grid-cols-[auto_...] gap-2">
      {/* Drag handle — attach listeners to the grip icon, not the whole row */}
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>
      {/* Row content */}
    </div>
  );
}
```

**Key insight — `setActivatorNodeRef`:** Use `setActivatorNodeRef` on the grip handle button separately from `setNodeRef` on the row container. This means only the grip handle activates drag, not clicks anywhere in the row. The existing `BomLineRow.tsx` does NOT have this pattern.

### Pattern 2: Client-Side Cost Calculation

**What:** Pre-fetch a flat map of `{ ingredient_id → { price: number, unit: string } }` from the server once when the builder loads. Compute line costs synchronously using this map. For unit conversion, the client needs the conversion factors too.

**Client-side cost algorithm:**

```typescript
// For ingredient lines:
function calcIngredientLineCost(
  line: BomLineState,
  vendorPriceMap: Map<string, { price: number; unit: string }>,
  conversionMap: Map<string, number>  // from:to → factor
): number | null {
  const priceInfo = vendorPriceMap.get(line.item_id);
  if (!priceInfo) return null;  // missing price
  if (line.unit === priceInfo.unit) {
    return Number(line.quantity) * priceInfo.price;
  }
  // Try conversion
  const direct = conversionMap.get(`${line.unit}:${priceInfo.unit}`);
  if (direct !== undefined) return Number(line.quantity) * direct * priceInfo.price;
  const reverse = conversionMap.get(`${priceInfo.unit}:${line.unit}`);
  if (reverse !== undefined && reverse !== 0) return (Number(line.quantity) / reverse) * priceInfo.price;
  return null;  // unit conversion failed — partial
}

// For sub-recipe lines:
function calcSubRecipeLineCost(
  line: BomLineState,
  subRecipeMap: Map<string, { computed_cost: number | null; yield_qty: number; yield_unit: string }>
): number | null {
  const sub = subRecipeMap.get(line.item_id);
  if (!sub?.computed_cost || !sub.yield_qty) return null;
  // Assumes units match (client-side simplification; server corrects)
  return (sub.computed_cost / sub.yield_qty) * Number(line.quantity);
}
```

**Data needed on builder load:**
1. `GET /vendors/prices/ingredient/:id` — per-ingredient, but this is N+1. Need a new `GET /ingredients/prices` bulk endpoint that returns `{ ingredient_id, price, unit }[]` (lowest price per ingredient).
2. Sub-recipe costs are already in the fetched recipe's `RecipeLines[].source_recipe.computed_cost` via `RECIPE_INCLUDE`.
3. Unit conversion factors — new `GET /unit-conversions` endpoint OR include the map in the recipe response.

**3-second debounced server confirm:**

```typescript
// In RecipeBuilderPage
const [localCost, setLocalCost] = useState<number | null>(null);
const [costIsEstimate, setCostIsEstimate] = useState(false);
const serverConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// When BOM changes:
function handleBomChange(newLines: BomLineState[]) {
  setBomLines(newLines);
  setIsDirty(true);
  // Instant client-side estimate
  const est = computeClientCost(newLines, vendorPriceMap, conversionMap);
  setLocalCost(est.total);
  setCostIsEstimate(true);
  // Debounced server confirm (3s)
  if (serverConfirmTimerRef.current) clearTimeout(serverConfirmTimerRef.current);
  serverConfirmTimerRef.current = setTimeout(() => {
    triggerServerCostConfirm(newLines);
  }, 3000);
}
```

**CRITICAL:** The client-side estimate is an approximation. Unit conversion on the client replicates only the simple direct/reverse lookup. The server's `convertUnit` function is authoritative. The "estimated" badge must persist until server responds.

### Pattern 3: `beforeunload` in Next.js App Router

**What:** Native browser `beforeunload` event listener. The pattern already exists in this project at `frontend/components/ops/guide/admin/GuideEditorClient.tsx` lines 209-219.

**Established in-project pattern:**

```typescript
// Source: frontend/components/ops/guide/admin/GuideEditorClient.tsx (lines 209-219)
// Unsaved changes warning -- browser tab close
useEffect(() => {
  const handler = (e: BeforeUnloadEvent) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';  // Required for Chrome
    }
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [isDirty]);
```

**What this does NOT cover:** Next.js client-side navigation (clicking `<Link>` components or `router.push()`). The `beforeunload` event does NOT fire for SPA navigation.

**For Next.js SPA navigation guard:** There is no built-in Next.js 16 API for blocking SPA navigation (confirmed by reading `use-router.md` — `router.events` has been removed and not replaced with a navigation guard API). The app router has NO equivalent of the Pages Router's `Router.beforePopState`.

**Recommended approach for SPA navigation (D-04 says no custom modal — just the browser dialog):**
- The decision D-04 says "Browser `beforeunload` dialog... No custom discard modal". This means SPA navigation (clicking `<Link>`) is NOT blocked — only tab close / browser refresh triggers the dialog. This is the correct scoped interpretation of D-04. The Save button is visible at all times with the amber "Unsaved changes" indicator, which is the primary user cue.
- Do NOT attempt to intercept Next.js `<Link>` navigation — there is no supported API for this in Next.js 16 App Router.

**Confidence level:** HIGH — verified against `use-router.md` in `next/dist/docs/` (which documents the current router.events removal) and the existing `GuideEditorClient.tsx` pattern.

### Pattern 4: Prisma Clone Transaction ("Create New Version")

**What:** Archive the current recipe, create a new draft recipe with the same data, copy all BOM lines with updated `recipe_id`. All in one `$transaction`.

**Pattern (follows existing `recipes.service.ts` structure):**

```typescript
// New method in RecipesService
async createNewVersion(id: string, userId: string): Promise<Recipe> {
  return this.prisma.$transaction(async (tx) => {
    // 1. Fetch the current recipe with all lines
    const current = await tx.recipe.findUniqueOrThrow({
      where: { id },
      include: { RecipeLines: true },
    });

    if (current.status !== 'approved') {
      throw new BadRequestException('Only approved recipes can create a new version.');
    }

    // 2. Archive the current version
    await tx.recipe.update({
      where: { id },
      data: { status: 'archived' },
    });

    // 3. Create the draft clone (same fields, new id, status=draft)
    const clone = await tx.recipe.create({
      data: {
        name: current.name,
        description: current.description,
        prep_steps: current.prep_steps,
        cooking_method: current.cooking_method,
        yield_qty: current.yield_qty,
        yield_unit: current.yield_unit,
        portion_size: current.portion_size,
        shelf_life_hours: current.shelf_life_hours,
        brand_id: current.brand_id,
        zone_id: current.zone_id,
        image_url: current.image_url,
        created_by: userId,
        status: 'draft',
        // computed_cost starts null — recalculated after tx
      },
    });

    // 4. Clone all BOM lines
    if (current.RecipeLines.length > 0) {
      await tx.recipeLine.createMany({
        data: current.RecipeLines.map((line) => ({
          recipe_id: clone.id,
          input_type: line.input_type,
          ingredient_id: line.ingredient_id,
          source_recipe_id: line.source_recipe_id,
          quantity: line.quantity,
          unit: line.unit,
          prep_notes: line.prep_notes,
          sort_order: line.sort_order,
        })),
      });
    }

    return clone;
  });
  // After transaction: trigger cost recalculation (outside tx for performance)
}
```

**New endpoint:** `POST /recipes/:id/version` — calls `createNewVersion`, returns the new draft recipe object. Frontend redirects to `/recipes/[newId]`.

### Pattern 5: Inline Editable Fields (Document Editing Feel)

**What:** Plain HTML `<input>` and `<textarea>` elements styled to look like document content — no visible border/background until focused. This is NOT a rich text editor.

**Pattern:**

```typescript
// Recipe name — large "document heading" style
<input
  className={cn(
    "text-2xl font-bold bg-transparent border-0 outline-none w-full",
    "border-b border-transparent hover:border-border focus:border-primary",
    "transition-colors placeholder:text-muted-foreground/40",
    isApproved && "pointer-events-none opacity-70"  // locked when approved
  )}
  placeholder="Recipe name..."
  value={name}
  onChange={(e) => setName(e.target.value)}
  disabled={isApproved}
/>

// Compact metadata field (yield qty, portion size, etc.)
<div className="flex flex-col gap-0.5">
  <label className="text-xs text-muted-foreground uppercase tracking-wide">
    Yield
  </label>
  <input
    className="text-sm font-medium bg-transparent border-0 border-b border-transparent
               hover:border-border focus:border-primary outline-none transition-colors"
    value={yieldQty}
    onChange={...}
    disabled={isApproved}
  />
</div>
```

**Key principle:** Border appears only on hover/focus. Background is transparent. This matches the "document editing feel" in D-03.

### Anti-Patterns to Avoid

- **Using `router.beforePopState`:** Does not exist in Next.js App Router. Only worked in Pages Router.
- **Wrapping `<Link>` onClick with confirm():** Native `confirm()` is blocked in many browser contexts and breaks accessibility. Per D-04, SPA nav guard is not in scope — only the browser's beforeunload dialog.
- **Using `NumberTicker` in the cost panel:** It uses `useInView` with `once: true` — animates exactly once when the element enters the viewport, then never again. The cost panel updates live as user types, so the ticker would stay at the first-seen value after that. Use `useMotionValue` + `useSpring` directly from `motion/react` instead.
- **Calling `CostCalculatorService.recalculateAndSave` on every BOM edit:** This is the server-confirm path — only triggered after 3s debounce, not synchronously on every keystroke.
- **Putting dnd-kit state in a context or Zustand store:** Keep it in the component that owns the BOM lines array. dnd-kit communicates via its own events; just call `arrayMove` and update the local state.
- **Using `arraySwap` instead of `arrayMove`:** `arraySwap` swaps two items; `arrayMove` shifts items like a proper drag-to-position. `arrayMove` is correct for sortable lists.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-to-reorder table rows | Custom mouse event tracking, `mousedown` + `mousemove` + `mouseup` | `@dnd-kit/sortable` (already installed) | Touch support, keyboard accessibility, scroll-while-dragging, transform calculations are non-trivial |
| Animated number in cost panel | CSS transition on raw number state | `useSpring` + `useMotionValue` from `motion/react` | Physics-based spring animation, avoids jank on rapid updates |
| Unit conversion on client | Duplicate backend conversion logic | Pre-fetch unit conversion table once, use same map lookup as server | The `unit-conversion.ts` logic is only a map lookup — replicate the data structure, not a service |
| Deep clone with BOM lines | Recursive JS object clone + array map | Prisma `$transaction` with explicit field mapping | Transaction guarantees atomicity; Prisma's own types prevent field omissions |
| Per-line cost display | Complex nested React state for per-ingredient costs | Derive per-line cost in a `useMemo` from `vendorPriceMap + bomLines` | Derived state, not stored state — pure function of inputs |

**Key insight:** The most dangerous hand-roll is the drag-and-drop — at first glance it seems like "just drag" but includes scroll compensation, touch events, keyboard navigation, drop preview transforms, and collision detection. dnd-kit handles all of this.

---

## Backend Changes Required

This section is critical context for the planner — the backend needs modifications before the frontend can work.

### 1. Add `pending` to Recipe status

- **Schema:** `status` is a plain `String` field (no enum in Prisma). Adding `pending` means only updating the DTO validators and transition logic — no migration required for the field itself.
- **`UpdateRecipeDto`:** `@IsIn(['draft', 'pending', 'approved', 'archived'])` — add `'pending'`
- **`recipes.service.ts`:** Update status transition validation. Current rule: "cannot revert approved → draft". Extended rules:
  - `draft → pending`: allowed (submit for approval)
  - `pending → approved`: allowed (approver action)
  - `pending → draft`: allowed (reject — sends back to draft)
  - `approved → pending`: NOT allowed (must use Create New Version)
  - `approved → draft`: NOT allowed (existing rule kept)
  - `approved → archived`: allowed

### 2. New endpoint: `POST /recipes/:id/version`

Creates a new draft version of an approved recipe (archives the original).

### 3. New endpoint: `POST /recipes/:id/submit` (or inline as PATCH status)

Alternatively, the approval workflow buttons can all use the existing `PATCH /recipes/:id` with `{ status: 'pending' | 'approved' | 'archived' }` — no separate endpoints needed for status transitions, as the service already handles this via the PATCH endpoint. Only the "Create New Version" action needs a dedicated endpoint since it creates a new record.

### 4. New bulk endpoint: `GET /ingredients/prices/bulk`

Returns `{ ingredient_id: string; price: number; unit: string }[]` — the lowest vendor price per ingredient. Needed for client-side cost calculation pre-fetch. Otherwise the frontend would need to fetch each ingredient's price separately (N+1).

**Alternative:** A new `GET /recipes/cost-data` endpoint that returns vendor prices + unit conversions in one call. This is cleaner since both pieces of data are needed together for the builder.

### 5. Unit conversions endpoint

The `unit-conversion.ts` service loads conversions from the DB. The frontend needs the same data for client-side calculation. New endpoint: `GET /unit-conversions` that returns `{ from_unit: string; to_unit: string; factor: number }[]`.

---

## Common Pitfalls

### Pitfall 1: dnd-kit `setNodeRef` vs `setActivatorNodeRef`

**What goes wrong:** Attaching `{...listeners}` to the entire row container makes clicking anywhere in the row start a drag. Users cannot click the ingredient combobox or quantity input without triggering a drag.

**Why it happens:** The default pattern in dnd-kit docs attaches listeners to the draggable node. For rows with interactive children, the handle must be separate.

**How to avoid:** Use `setActivatorNodeRef` on ONLY the grip handle button. Attach `{...listeners}` and `{...attributes}` to the grip handle. Attach `setNodeRef` + `style` to the row container.

**Warning signs:** Clicking a select or input inside the BOM row triggers a drag action.

### Pitfall 2: `NumberTicker` is not a live counter

**What goes wrong:** Use `NumberTicker` in the cost panel. After the page loads and the element enters view, `NumberTicker` sets `once: true` in `useInView` and never re-animates when the value prop changes.

**Why it happens:** `NumberTicker` is designed for "count up when this section scrolls into view" use cases, not live-updating displays.

**How to avoid:** Use `useMotionValue` + `useSpring` directly from `motion/react` without the `useInView` gate. Update `motionValue.set(newCost)` whenever the cost changes.

**Warning signs:** Cost panel shows the initial value and never updates after the first render.

### Pitfall 3: SPA navigation not blocked by `beforeunload`

**What goes wrong:** User edits the recipe, clicks a `<Link>` to navigate away, and the `beforeunload` handler does NOT fire. The unsaved changes are silently lost.

**Why it happens:** `beforeunload` only fires on actual browser navigation (tab close, refresh, `window.location` change). Next.js `<Link>` uses client-side React state transition — it bypasses the browser's native navigation stack until the URL actually changes.

**How to avoid:** Per D-04, the design deliberately scopes the browser dialog to tab-close/refresh only. The amber "Unsaved changes" indicator + persistent Save button is the SPA navigation safety net. Do NOT attempt to intercept `<Link>` clicks — there is no supported hook in Next.js 16 App Router.

**Warning signs:** This is expected behavior, not a bug. If someone files a bug about "not warned on link click", the correct answer is: use the visible Save button before navigating.

### Pitfall 4: Recipe clone breaks cycle detection

**What goes wrong:** A cloned recipe that references its parent (or vice versa) as a sub-recipe creates a circular dependency.

**Why it happens:** The clone creates a new recipe ID but copies `source_recipe_id` references. The archived original still exists. A user editing the clone could re-add the archived parent as a sub-recipe.

**How to avoid:** Cycle detection in `checkBomLinesForCycles` already handles this — it walks the graph via DB queries, so the archived parent is still found. No special handling needed for clones.

### Pitfall 5: Client-side cost estimate with wrong unit

**What goes wrong:** Client estimates `X * price` when the line unit is `ml` and the vendor price is in `L`. Result is 1000x off.

**Why it happens:** Client-side unit conversion replicates only the simple direct/reverse map lookup. The conversion table must be pre-fetched.

**How to avoid:** Fetch the unit conversion table (`GET /unit-conversions`) on builder load along with vendor prices. If conversion is unavailable, show `—` for that line. The "estimated" badge stays until server confirms.

### Pitfall 6: Persistent empty BOM row causes phantom form submission

**What goes wrong:** D-07 specifies a persistent empty row at the bottom. On form save, this empty row is submitted and the backend returns a validation error (`quantity: @Min(0.001)` fails for empty string).

**How to avoid:** On save, filter BOM lines where `item_id` is empty before building the payload. The empty row is purely a UI affordance — it is never submitted.

### Pitfall 7: `pending` status not in frontend `RecipeStatus` type

**What goes wrong:** TypeScript errors everywhere because `RecipeStatus = 'draft' | 'approved' | 'archived'` in `lib/types/recipe.ts` does not include `'pending'`.

**How to avoid:** Update `RecipeStatus`, `RECIPE_STATUS_LABELS`, `RECIPE_STATUSES`, and `RecipeStatusBadge` in the same wave as the backend DTO change.

---

## Code Examples

### Sortable BOM table — complete pattern

```typescript
// Source: @dnd-kit/sortable/dist/sortable.esm.js (installed, verified)

'use client';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface BomLineState {
  id: string;  // Must be a stable unique string
  input_type: 'ingredient' | 'recipe';
  item_id: string;
  item_name: string;
  quantity: string;
  unit: string;
  prep_notes: string;
}

// Parent table component
export function RecipeBomTable({ lines, onChange }: { lines: BomLineState[], onChange: (l: BomLineState[]) => void }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = lines.map((l) => l.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    onChange(arrayMove(lines, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={lines.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        {lines.map((line, index) => (
          <BomTableRow key={line.id} line={line} index={index} onChange={onChange} lines={lines} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

// Individual sortable row
function BomTableRow({ line, index, onChange, lines }: RowProps) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging
  } = useSortable({ id: line.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="grid grid-cols-[auto_...] gap-2 items-center"
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        type="button"
        className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>
      {/* Rest of row content (Combobox, qty, unit, cost, remove) */}
    </div>
  );
}
```

**`activationConstraint: { distance: 5 }`** — prevents accidental drag start on click. The user must move 5px before drag activates. This is critical for rows with interactive children.

### Animated cost display (replaces NumberTicker)

```typescript
// Source: motion/react (already installed as `motion` package)
import { useMotionValue, useSpring } from 'motion/react';
import { useEffect } from 'react';

function AnimatedCost({ value }: { value: number }) {
  const motionValue = useMotionValue(value);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    return springValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = `₹ ${latest.toFixed(2)}`;
      }
    });
  }, [springValue]);

  return <span ref={ref} className="tabular-nums">₹ {value.toFixed(2)}</span>;
}
```

### beforeunload hook (extractable)

```typescript
// Source: established pattern from GuideEditorClient.tsx lines 209-219
// Reusable hook version for the recipe builder
function useBeforeUnload(isDirty: boolean) {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}
```

### 3-second debounced server cost confirm

```typescript
// Pattern from GuideSearchOverlay.tsx (300ms) scaled to 3s
const serverConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

function scheduleServerConfirm(lines: BomLineState[]) {
  if (serverConfirmTimer.current) clearTimeout(serverConfirmTimer.current);
  serverConfirmTimer.current = setTimeout(async () => {
    try {
      // POST to a dedicated cost-preview endpoint (not the full save)
      // This saves the BOM to the recipe and triggers recalculateAndSave
      const result = await apiClient.post<{ cost: number | null; complete: boolean }>(
        `/recipes/${recipeId}/cost-preview`,
        { bom_lines: lines.map(mapToDto) }
      );
      setServerCost(result.cost);
      setCostIsEstimate(false);
    } catch {
      // Server cost confirm failed — keep showing estimate
    }
  }, 3000);
}
```

---

## Approval Workflow: Governance Reference

From `.planning/PROJECT.md` (per CONTEXT.md canonical refs): food approvals require Sadhana+Anchitha roles. In the codebase, approver roles are `FOUNDER_ADMIN` (already has all permissions). The "Approve" button in the pending banner should only show for users with the `APPROVE_FOOD` permission (or `FOUNDER_ADMIN` fallback) — check `useAuthStore` for `user.roleCode` against the relevant permission.

**Status banner implementation pattern:**

```typescript
const isApprover = user?.roleCode === 'FOUNDER_ADMIN' || hasPermission(user, Permission.APPROVE_FOOD);
const isLocked = recipe.status === 'approved' || recipe.status === 'archived';

// In the banner:
{recipe.status === 'draft' && (
  <Button onClick={() => updateStatus('pending')}>Submit for Approval</Button>
)}
{recipe.status === 'pending' && isApprover && (
  <>
    <Button variant="success" onClick={() => updateStatus('approved')}>Approve</Button>
    <Button variant="destructive" onClick={() => updateStatus('draft')}>Reject</Button>
  </>
)}
{recipe.status === 'approved' && (
  <>
    <Button onClick={handleCreateNewVersion}>Create New Version</Button>
    <Button variant="outline" onClick={() => updateStatus('archived')}>Archive</Button>
  </>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router `Router.beforePopState` | No SPA nav guard (App Router) | Next.js 13 App Router | Browser `beforeunload` covers tab close only; SPA nav guard not possible |
| `react-beautiful-dnd` | `@dnd-kit` | ~2021 | dnd-kit is the current standard; react-beautiful-dnd is unmaintained |
| Separate status change endpoints | PATCH with status field | This project's existing pattern | Consistent with existing `UpdateRecipeDto` |
| `NumberTicker` for live values | Direct `useMotionValue` + `useSpring` | This phase | `NumberTicker` is view-triggered once; live panels need direct spring |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Officially unmaintained; dnd-kit is the ecosystem replacement.
- `router.events` (Next.js Pages Router): Removed in App Router. No equivalent.

---

## Open Questions

1. **Does an `APPROVE_FOOD` permission exist?**
   - What we know: The RBAC system has a `Permission` enum in `backend/src/types/permissions.ts`. The current recipe update endpoint uses `MANAGE_OPS`.
   - What's unclear: Whether a specific food-approval permission exists or if `FOUNDER_ADMIN` role check is sufficient.
   - Recommendation: Check `permissions.ts` during Plan Wave 1. If no food-specific permission exists, use `roleCode === 'FOUNDER_ADMIN'` as the approver gate.

2. **Cost preview endpoint — new endpoint or inline with save?**
   - What we know: The hybrid approach (D-09) requires a server-side cost calculation triggered during editing, before the user saves.
   - What's unclear: Whether this should be a dedicated read-only cost-preview endpoint or whether the debounced server confirm actually saves the BOM temporarily.
   - Recommendation: New `POST /recipes/:id/cost-preview` endpoint that accepts BOM lines, runs `calculateRecipeCost` in memory (without saving to DB), and returns `{ cost, complete, missingPrices: string[] }`. This avoids partial-save side effects.

3. **Unit conversion endpoint — already exists?**
   - What we know: `unit-conversion.ts` reads from `prisma.unitConversion`. No existing public endpoint for `GET /unit-conversions` was found in the codebase.
   - What's unclear: Whether there's a unit conversions controller that wasn't checked.
   - Recommendation: Verify in the backend src directory. If none exists, add a simple `GET /unit-conversions` endpoint alongside the cost-data work.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (NestJS backend) |
| Config file | `backend/package.json` (jest config via NestJS defaults) |
| Quick run command | `cd backend && npx jest --testPathPattern=recipes` |
| Full suite command | `cd backend && npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RECIPE-01 | `pending` status transitions enforced | unit | `cd backend && npx jest --testPathPattern=recipes.service` | ❌ Wave 0 |
| RECIPE-02 | `createNewVersion` archives original and creates clone with all BOM lines | unit | `cd backend && npx jest --testPathPattern=recipes.service` | ❌ Wave 0 |
| RECIPE-03 | Clone does not include `computed_cost` (recalculated after tx) | unit | Same spec | ❌ Wave 0 |
| RECIPE-04 | Cost preview endpoint returns `{ cost, complete, missingPrices }` | unit | `cd backend && npx jest --testPathPattern=recipes.controller` | ❌ Wave 0 |
| RECIPE-05 | Approved recipe rejects direct edits (locked) | unit | `cd backend && npx jest --testPathPattern=recipes.service` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npx jest --testPathPattern=recipes --passWithNoTests`
- **Per wave merge:** `cd backend && npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/recipes/__tests__/recipes.service.spec.ts` — covers RECIPE-01 through RECIPE-05 (status transitions, clone logic)
- [ ] Prisma mock pattern: follow existing `approvals.service.spec.ts` pattern (mock `PrismaService`, inject into `TestingModule`)

---

## Sources

### Primary (HIGH confidence)
- `frontend/node_modules/@dnd-kit/sortable/dist/sortable.esm.js` — verified exports, `useSortable` signature, `arrayMove`/`arraySwap` semantics
- `frontend/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md` — confirmed `router.events` removed, no SPA nav guard API
- `frontend/components/ops/guide/admin/GuideEditorClient.tsx` — in-project `beforeunload` pattern (lines 209-219)
- `frontend/components/ui/number-ticker.tsx` — confirmed `useInView` with `once: true` limitation
- `backend/src/recipes/cost-calculator.service.ts` — algorithm reference for client-side replication
- `backend/src/common/utils/unit-conversion.ts` — unit conversion map logic
- `frontend/package.json` — confirmed `@dnd-kit/*` already installed

### Secondary (MEDIUM confidence)
- `backend/src/recipes/recipes.service.ts` — existing transaction patterns for clone model
- `frontend/components/ops/guide/GuideSearchOverlay.tsx` — debounce-via-setTimeout pattern

### Tertiary (LOW confidence)
- dnd-kit `activationConstraint: { distance: 5 }` recommendation: based on dnd-kit docs knowledge from training data — should be verified against the installed source if in doubt. The `PointerSensor` in the installed version accepts this option (confirmed by type signature).

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from installed `package.json` and `node_modules` source
- Architecture: HIGH — based on direct inspection of existing service/component code
- Pitfalls: HIGH — NumberTicker limitation and dnd-kit handle pattern verified from source; SPA nav guard verified from official Next.js 16 docs
- Backend changes: HIGH — based on direct reading of existing DTOs, service, and schema

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable libraries, no fast-moving dependencies)
