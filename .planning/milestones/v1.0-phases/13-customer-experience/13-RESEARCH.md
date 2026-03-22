# Phase 13: Customer Experience - Research

**Researched:** 2026-03-22
**Domain:** Public-facing pages (no auth), NestJS public endpoints, QR code generation, capacity enforcement, digital menu display
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** QR code per order (encodes order ID in URL) + shareable link. Customer scans to `/feedback/[orderId]` pre-linked to their order.
- **D-02:** Feedback fields: star rating (1-5), free-text comment, optional customer name, optional phone. Order auto-linked from URL param.
- **D-03:** After submission: animated thank-you screen with MagicUI confetti burst. No redirect — page is the end.
- **D-04:** Internal ops page at `/operations/feedback` — rating, comment, customer, order link, date. Filter by rating and date. Average rating card.
- **D-05:** Public event listing: card grid of upcoming events. Each card: title, date, type, price, capacity status, zone, brand. Click opens detail with booking form.
- **D-06:** Booking form: customer name, phone, number of guests. Capacity check: reject if guests would exceed remaining spots. Inline confirmation.
- **D-07:** Capacity enforcement: auto-full when sum of booking guest counts >= event capacity. "Sold Out" shown and booking form disabled. No waitlist.
- **D-08:** Internal ops CRUD at `/operations/events` for creating/editing events and viewing bookings. Fields: title, type, date, capacity, price, zone, brand, description, image.
- **D-09:** Digital menu structure: brand tabs → category sections → item cards. Each card: name, price, image, availability badge.
- **D-10:** Availability binary only — "Available" or "Sold Out". No serving count for customers.
- **D-11:** Pricing: base_price only. No channel modifier applied on public menu.
- **D-12:** Separate `(public)` route group at `frontend/app/(public)/`. Routes: `/feedback/[orderId]`, `/events`, `/events/[id]`, `/menu`.
- **D-13:** Public layout: minimal branded header (Konma logo/name). No sidebar. Footer with "Powered by Konma Xperience". Mobile-first.
- **D-14:** Fully responsive — equal effort on mobile and desktop/tablet.

### Claude's Discretion

- QR code generation approach (library, format, where generated)
- Feedback form validation and error states
- Event card design and detail page layout
- Menu item card sizing and image handling
- Public layout header/footer styling
- Responsive breakpoints
- Backend API endpoint design for public routes (auth bypass)

### Deferred Ideas (OUT OF SCOPE)

- Customer accounts/login — v2
- Online ordering from digital menu — v2
- Event payment integration (Razorpay) — v2
- Feedback sentiment analysis — v2
- Event waitlist when sold out — v2
- Social sharing from feedback/events — v2
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CUST-01 | Post-dining feedback via QR code or link — Feedback entity with optional order_id, rating (1-5), comment, customer name/phone. No auth required. | `@Public()` decorator pattern verified in codebase; NestJS public endpoint bypass works via existing `IS_PUBLIC_KEY` reflector. `qrcode` npm package (v1.5.4) generates Data URL server-side. |
| CUST-02 | Experience event management — Event entity (title, type, date, capacity, price, zone, brand), public display, EventBooking (name + phone + guests), capacity enforcement (auto-full when bookings >= capacity) | Capacity enforcement must use `$transaction` with select-for-update pattern to prevent race conditions. EventBooking.guests_count sum vs event.capacity checked in transaction. |
| CUST-03 | Digital menu display (non-interactive) — current menu with prices, available items, brand sections. For display screens or QR access. | Reuses existing `GET /menu/items?brand_id=X`, `GET /menu/categories?brand_id=X`, and `GET /menu/availability` endpoints — all currently unguarded (no `@RequiresPermission`). Only `@Public()` needed. |
</phase_requirements>

---

## Summary

Phase 13 introduces the first **public-facing** surfaces in the Konma Xperience OS. All three requirements share a structural pattern: create new NestJS modules with `@Public()` endpoints (bypassing the global `JwtAuthGuard`), add new Prisma models (Feedback, Event, EventBooking), and build a new `(public)` Next.js route group with its own layout — no sidebar, no auth, light theme.

The key architectural challenge is the **auth bypass**. The existing codebase already has the `@Public()` decorator (`backend/src/common/decorators/public.decorator.ts`) and the `JwtAuthGuard` checks for `IS_PUBLIC_KEY` before executing. All new public API endpoints use `@Public()` — this is already proven in the codebase for `POST /auth/login`.

Capacity enforcement for event bookings is the only transactional complexity. A `$transaction` with `findMany` + sum check + conditional `create` prevents overbooking under concurrent booking attempts. This is the same pattern used in PrepBatch deductions (Phase 9).

**Primary recommendation:** Build three NestJS modules (`feedback`, `events`, `public-menu`) with `@Public()`-decorated endpoints, three new Prisma models, one new `(public)` Next.js route group, and add Feedback + Events links to the existing `operationsNav` array in Sidebar.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS + Prisma | ^11 + ^6 | Public API endpoints + DB queries | Already the project stack |
| Next.js | 16.2.0 | `(public)` route group + public pages | Already installed |
| React Query (`@tanstack/react-query`) | ^5.91.2 | Data fetching on public pages | Already installed, established pattern |
| canvas-confetti | ^1.9.4 | Thank-you confetti burst | Already installed (`components/ui/confetti.tsx` present) |
| qrcode | 1.5.4 | Server-side QR generation as Data URL | Small, no deps, generates PNG/SVG Data URL. Latest stable Nov 2025. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-hook-form` | ^7.71.2 | Feedback + booking form management | Already installed |
| `zod` | ^4.3.6 | Client-side form validation | Already installed |
| `next/image` | built-in | Menu item images | Always use for images in Next.js |
| `motion/react` (framer-motion) | ^12.38.0 | BlurFade animations | Already installed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `qrcode` (server-side) | `react-qr-code` (client-side) | Server-side avoids shipping QR rendering to browser; QR URL is static so pre-generating at order creation time makes sense. BUT: for this project QR is just a link, so either works. Server-side via `qrcode` keeps the QR Data URL in the order response — simpler. |
| `qrcode` Data URL | SVG inline | Data URL is a single string returnable from API; SVG requires more frontend handling |

**Installation (new package only):**

```bash
cd backend && npm install qrcode @types/qrcode
```

**Version verification:** `qrcode@1.5.4` verified against npm registry (published 2025-11-13).

---

## Architecture Patterns

### Recommended Project Structure

```
backend/src/
├── feedback/
│   ├── feedback.module.ts
│   ├── feedback.controller.ts       # POST /feedback (public), GET /feedback (auth)
│   ├── feedback.service.ts
│   └── dto/
│       ├── create-feedback.dto.ts
│       └── feedback-filters.dto.ts
├── events/
│   ├── events.module.ts
│   ├── events.controller.ts         # GET /events (public), POST /events (auth), etc.
│   ├── events.service.ts
│   └── dto/
│       ├── create-event.dto.ts
│       ├── update-event.dto.ts
│       └── create-booking.dto.ts
└── public-menu/
    ├── public-menu.module.ts
    ├── public-menu.controller.ts    # GET /public-menu (public wrapper)
    └── public-menu.service.ts       # Delegates to MenuService

frontend/app/
├── (public)/
│   ├── layout.tsx                   # No sidebar, no auth, light theme
│   ├── feedback/
│   │   └── [orderId]/
│   │       └── page.tsx
│   ├── events/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   └── menu/
│       └── page.tsx
└── (ops)/
    └── operations/
        ├── feedback/
        │   └── page.tsx             # New ops feedback view
        └── events/
            └── page.tsx             # New ops events CRUD

frontend/components/
├── public/                          # New — public-facing components
│   ├── StarRatingInput.tsx
│   ├── FeedbackThankYou.tsx
│   ├── EventCard.tsx
│   ├── EventBookingForm.tsx
│   ├── CapacityBadge.tsx
│   ├── MenuBrandTabs.tsx
│   ├── MenuItemPublicCard.tsx
│   └── AvailabilityBadge.tsx
└── ops/
    └── operations/
        ├── feedback/
        │   ├── FeedbackRow.tsx
        │   ├── FeedbackStatsCard.tsx
        │   └── RatingFilterTabs.tsx
        └── events/
            ├── EventForm.tsx
            ├── EventRow.tsx
            └── BookingListSheet.tsx
```

### Pattern 1: `@Public()` NestJS Endpoint

**What:** Applying the existing `@Public()` decorator skips `JwtAuthGuard` for that handler.
**When to use:** All endpoints called from public pages — POST /feedback, GET /events, GET /events/:id, POST /events/:id/bookings, GET /public-menu.

```typescript
// Source: backend/src/common/decorators/public.decorator.ts (verified in codebase)
import { Public } from '../common/decorators/public.decorator';

@Controller('feedback')
export class FeedbackController {
  @Post()
  @Public()  // Bypasses JwtAuthGuard — the guard checks IS_PUBLIC_KEY reflector
  async submitFeedback(@Body() dto: CreateFeedbackDto) {
    return this.feedbackService.submit(dto);
  }
}
```

**Critical note:** `@Public()` only bypasses `JwtAuthGuard`. The `PermissionsGuard` only activates when `@RequiresPermission()` is present — so public endpoints don't need anything else. Both guards are safe with public routes.

### Pattern 2: Capacity Enforcement with Transaction

**What:** Atomic read-check-write to prevent overbooking under concurrent requests.
**When to use:** `POST /events/:id/bookings` endpoint.

```typescript
// Source: Derived from Phase 9 PrepBatch deduction pattern (verified in STATE.md)
async createBooking(eventId: string, dto: CreateBookingDto) {
  return this.prisma.$transaction(async (tx) => {
    const event = await tx.event.findUniqueOrThrow({ where: { id: eventId } });

    // Sum existing guest bookings
    const agg = await tx.eventBooking.aggregate({
      where: { event_id: eventId },
      _sum: { guests: true },
    });
    const booked = agg._sum.guests ?? 0;

    if (booked + dto.guests > event.capacity) {
      throw new BadRequestException(
        `Sorry, this event is full. No spots remain for ${dto.guests} guests.`
      );
    }

    return tx.eventBooking.create({
      data: { event_id: eventId, ...dto },
    });
  });
}
```

**Why $transaction:** Without transaction, two concurrent requests can both read `booked=38` for a capacity-40 event, both pass the check, and both insert — resulting in 42 booked for a 40-capacity event. Same race condition pattern as PrepBatch deduction (solved with `$transaction` in Phase 9).

### Pattern 3: QR Code Generation (Server-Side)

**What:** Generate a QR code Data URL from an order ID and return it from the backend.
**When to use:** `GET /orders/:id/qr` endpoint (new endpoint on existing OrdersController) OR return QR data URL in order creation response.

**Recommended approach:** Add `GET /orders/:id/qr` endpoint to `OrdersController`. Returns `{ qr_data_url: string }`. Frontend renders `<img src={qr_data_url} />` in ops order detail.

```typescript
// Source: qrcode npm package docs (v1.5.4)
import * as QRCode from 'qrcode';

async generateOrderQr(orderId: string): Promise<{ qr_data_url: string }> {
  const url = `${process.env.FRONTEND_URL}/feedback/${orderId}`;
  const dataUrl = await QRCode.toDataURL(url, {
    width: 256,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
  return { qr_data_url: dataUrl };
}
```

### Pattern 4: Public Next.js Route Group (No Auth)

**What:** A `(public)` route group with its own `layout.tsx` that has no auth check, no sidebar, and forces light theme.
**When to use:** All customer-facing pages in Phase 13.

```typescript
// frontend/app/(public)/layout.tsx
// Source: Next.js route groups pattern — existing (ops)/layout.tsx for reference
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-theme="light" className="min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b bg-background/95 backdrop-blur sticky top-0 z-10 flex items-center px-4">
        {/* Konma logo + name */}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="h-10 flex items-center justify-center">
        <span className="text-xs text-muted-foreground">Powered by Konma Xperience</span>
      </footer>
    </div>
  );
}
```

**Note:** This layout does NOT import `useAuthStore` or call `/auth/me`. No `'use client'` auth check loop. Public pages fetch their data directly.

**Light theme isolation:** The UI-SPEC requires public pages to render in light mode even though the app defaults to dark. The `(public)` layout must apply `data-theme="light"` or the equivalent CSS class override at the layout level. The existing ops layout's dark mode comes from the global `<html className="dark">` — the public layout must neutralize this at the layout container level.

### Pattern 5: Public Menu — Reuse Existing Endpoints

**What:** The digital menu page reuses existing `GET /menu/items`, `GET /menu/categories`, and `GET /menu/availability` endpoints. These endpoints have NO `@RequiresPermission()` decorator (verified in `menu.controller.ts`) — they only need `@Public()` to bypass JWT.
**Decision:** Create a thin `PublicMenuController` that calls `MenuService` directly with `@Public()`, OR add `@Public()` to the existing read endpoints in `MenuController`.

**Recommended:** Add `@Public()` to the 3 read-only GET endpoints in `MenuController` (`findCategories`, `findItems`, `getAllServingsAvailable`). This avoids a new module for menu and keeps the service layer DRY.

### Anti-Patterns to Avoid

- **Skipping `$transaction` on capacity check:** Allows overbooking under concurrent load. Always wrap check + create in `$transaction`.
- **Client-only capacity validation:** Client passes guest count check, then server rejects. Always enforce server-side; client check is UX only.
- **Using auth middleware on public routes:** Do not apply `@UseGuards(JwtAuthGuard)` at the controller class level for public controllers — use `@Public()` per-handler instead, or skip the guard entirely.
- **Importing `useAuthStore` in public layout:** Public layout has no auth context. Importing the auth store causes unnecessary re-renders and potential redirect loops.
- **Auto-refresh availability too aggressively:** UI-SPEC specifies 60 seconds `refetchInterval` for menu availability. Don't poll faster — this hits the availability endpoint which does multi-query DB work per item.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR code image generation | Custom canvas/SVG renderer | `qrcode` npm package | Error correction, padding, color options, PNG/SVG/Data URL output all handled |
| Concurrency-safe capacity check | Application-level counter + optimistic update | Prisma `$transaction` with aggregate + conditional create | Transaction is atomic at DB level; application-level counter fails under concurrent requests |
| Confetti animation | Custom CSS keyframes | Existing `canvas-confetti` via `components/ui/confetti.tsx` | Already installed and used — `Confetti` component with `manualstart` prop + `ref.current.fire()` |
| Form state management | Manual `useState` chains | `react-hook-form` + `zod` | Already installed; consistent with ops form patterns |
| Theme switching for light layout | `document.body.classList` manipulation | `data-theme="light"` on layout container | Isolated to the layout subtree without affecting global dark default |

**Key insight:** QR generation and capacity enforcement are the only non-trivial implementations. Both have established solutions already in the project or easily added via `qrcode`.

---

## Common Pitfalls

### Pitfall 1: Overbooking Under Concurrent Requests

**What goes wrong:** Two users simultaneously book the last 2 spots; both pass the capacity check; total booked exceeds capacity.
**Why it happens:** `findMany` + arithmetic + `create` without transaction is not atomic.
**How to avoid:** Wrap capacity check + insert in `this.prisma.$transaction(async (tx) => {...})`. Always use `tx` client inside, not `this.prisma`.
**Warning signs:** Test with two simultaneous booking requests at full-minus-N capacity.

### Pitfall 2: QR Endpoint Exposes Order Without Auth

**What goes wrong:** `GET /orders/:id/qr` returns QR data URL — but orders are auth-protected. If the endpoint is `@Public()`, anyone who guesses an order UUID can generate the feedback link.
**Why it happens:** Misapplying `@Public()` to an endpoint that should stay auth-protected.
**How to avoid:** The QR endpoint `GET /orders/:id/qr` is **ops-only** (called from the order detail page by a logged-in staff member). It MUST remain auth-protected with `@RequiresPermission(Permission.MANAGE_POS)`. The QR code encodes the **public** feedback URL — anyone who has the QR/link can submit feedback (by design, D-01). The QR generation endpoint itself is not public.

### Pitfall 3: `(public)` Route Group Inheriting Dark Theme

**What goes wrong:** Public pages render in dark mode because the global `<html className="dark">` is set at the root layout level.
**Why it happens:** Next.js route groups share the root layout. The `(public)` layout wraps children but doesn't override the `html` element's class.
**How to avoid:** Apply `data-theme="light"` or wrap content in a div with explicit CSS variable overrides. The UI-SPEC explicitly requires: "Public layout is LIGHT theme. The `(public)` layout must NOT apply the dark class — set `data-theme='light'` or wrap children in a light-themed container."

### Pitfall 4: NestJS Route Shadowing on Events

**What goes wrong:** `GET /events/upcoming` is shadowed by `GET /events/:id` because NestJS matches `:id` first.
**Why it happens:** NestJS route resolution order — parameterized routes can shadow literal routes.
**How to avoid:** Register literal routes (`/upcoming`, `/stats`, `/count`) BEFORE parameterized routes (`:id`) in the controller — same as the `daily-summary` before `:id` pattern in `orders.controller.ts` (Phase 10 decision in STATE.md).

### Pitfall 5: `getAllServingsAvailable()` Performance on Menu Page

**What goes wrong:** The public menu triggers `GET /menu/availability` which loops over all active menu items and runs multiple DB queries per item (ingredient stocks, prep batches). With 60-second `refetchInterval`, this is acceptable. But calling it on every keystroke or tab switch would be too slow.
**Why it happens:** The availability endpoint is designed for POS use, not high-frequency display use.
**How to avoid:** Only call `GET /menu/availability` once on mount + via `refetchInterval: 60000`. Do NOT call it on brand tab changes — cache the full availability map and filter client-side by brand.

### Pitfall 6: Missing `order` Relation in Feedback Response

**What goes wrong:** Ops feedback page tries to render `feedback.order.id` but Prisma `findMany` returns `Feedback` without the related `Order`.
**Why it happens:** Prisma requires explicit `include` to load relations.
**How to avoid:** In `FeedbackService.findAll()`, always include `{ order: { select: { id: true } } }` so order link renders correctly on the ops page.

---

## Code Examples

Verified patterns from the codebase:

### Prisma New Models

```prisma
// Source: backend/prisma/schema.prisma — new models to add

model Feedback {
  id            String   @id @default(uuid())
  order_id      String?
  order         Order?   @relation(fields: [order_id], references: [id])
  rating        Int      // 1-5
  comment       String?
  customer_name String?
  customer_phone String?
  created_at    DateTime @default(now())
}

model Event {
  id          String         @id @default(uuid())
  title       String
  event_type  String         // "dining" | "workshop" | "pop_up" | "tasting" | "other"
  date        DateTime
  capacity    Int
  price       Decimal
  zone_id     String?
  brand_id    String?
  description String?
  image_url   String?
  status      String         @default("upcoming") // upcoming | past | cancelled
  created_at  DateTime       @default(now())
  updated_at  DateTime       @updatedAt
  zone        Zone?          @relation(fields: [zone_id], references: [id])
  brand       Brand?         @relation(fields: [brand_id], references: [id])
  bookings    EventBooking[]
}

model EventBooking {
  id           String   @id @default(uuid())
  event_id     String
  event        Event    @relation(fields: [event_id], references: [id], onDelete: Cascade)
  customer_name String
  customer_phone String
  guests       Int
  created_at   DateTime @default(now())
}
```

**Note:** `Order` model needs a `Feedback` relation added:
```prisma
// In existing Order model, add:
feedbacks     Feedback[]
```

### `@Public()` on Feedback Submit

```typescript
// Source: backend/src/common/decorators/public.decorator.ts (verified)
// Pattern: Same as existing POST /auth/login which is also @Public()
@Controller('feedback')
export class FeedbackController {
  @Post()
  @Public()
  async submit(@Body() dto: CreateFeedbackDto) {
    return this.feedbackService.submit(dto);
  }

  @Get()
  @RequiresPermission(Permission.MANAGE_POS)
  async findAll(@Query() filters: FeedbackFiltersDto) {
    return this.feedbackService.findAll(filters);
  }
}
```

### Public Menu Availability — React Query with refetchInterval

```typescript
// Source: Pattern from frontend/app/(ops)/operations/menu/page.tsx (verified)
const { data: availability = {} } = useQuery({
  queryKey: ['public-menu-availability'],
  queryFn: () => apiClient.get<Record<string, { available: boolean }>>('/menu/availability'),
  refetchInterval: 60_000, // 60 seconds per UI-SPEC D-10
  // No auth header — public endpoint
});
```

### apiClient for Public Pages

The existing `apiClient` sends the JWT cookie automatically. On public pages there is no cookie — but `apiClient` will gracefully get a 401 which won't happen on `@Public()` endpoints. However, for cleanliness, public pages can use `fetch` directly or use `apiClient` (it won't add auth headers if no cookie exists — it just makes the request).

```typescript
// Public pages use apiClient — it gracefully handles missing auth
// apiClient sends cookie if present, skips if not
// @Public() endpoints don't check auth so this is safe
const feedback = await apiClient.post('/feedback', dto);
```

### StarRatingInput Component Pattern

```typescript
// Custom component — 44px touch targets per UI-SPEC
// Source: UI-SPEC interaction contract (touch target requirement)
function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
        >
          <Star
            className={cn(
              'size-8',
              (hovered || value) >= star
                ? 'fill-primary text-primary'
                : 'fill-none text-muted-foreground'
            )}
          />
        </button>
      ))}
    </div>
  );
}
```

### Sidebar Navigation Update

```typescript
// Source: frontend/components/ops/Sidebar.tsx — operationsNav array (lines 203-216, verified)
// Add to END of operationsNav array:
const operationsNav: NavItem[] = [
  // ... existing items ...
  { label: 'Feedback', href: '/operations/feedback', icon: <MessageSquare className="size-4" /> },
  { label: 'Events', href: '/operations/events', icon: <CalendarDays className="size-4" /> },
];
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-rendered public pages (getServerSideProps) | Client-side fetch with React Query | Next.js 13+ app router | Public pages use `'use client'` + `useQuery`, no need for server-side data fetching |
| QR code on frontend (client-side canvas) | QR code Data URL from backend (`qrcode` npm) | N/A — both valid | Backend approach keeps QR logic out of browser bundle; cleaner ops UX |

**Note on Next.js 16.2.0 and route groups:** The `(public)` and `(ops)` route groups are standard Next.js App Router conventions. Both groups co-exist at the same URL depth — `(public)` and `(ops)` directory names are ignored in the URL path. This is the same mechanism already used for `(ops)` in the existing codebase.

---

## Open Questions

1. **Light theme isolation mechanism**
   - What we know: The root layout sets `dark` class on `<html>`. The `(public)` layout cannot modify the `<html>` element.
   - What's unclear: Whether `data-theme="light"` on the layout wrapper is sufficient to override CSS variables, or whether Tailwind v4's dark mode strategy needs a specific approach.
   - Recommendation: Use `className="light"` on the layout wrapper div if Tailwind's dark mode is class-based (verify in `tailwind.config.*`). If CSS variable-based, `data-theme="light"` on the wrapper. The AGENTS.md in frontend warns about Next.js breaking changes — verify the approach by reading `node_modules/next/dist/docs/` before implementing.

2. **QR endpoint placement**
   - What we know: QR generation needs `qrcode` installed in backend. The QR URL is `{FRONTEND_URL}/feedback/{orderId}`.
   - What's unclear: Whether `FRONTEND_URL` env var exists or needs to be added.
   - Recommendation: Add `GET /orders/:id/qr` to `OrdersController` with `@RequiresPermission(Permission.MANAGE_POS)`. Add `FRONTEND_URL` to `.env.example`. No new module needed — one endpoint on existing controller.

3. **Event `status` field auto-transition**
   - What we know: Events have `status: upcoming | past | cancelled`.
   - What's unclear: Whether `past` should auto-set via cron (like PrepBatch expiry) or manually.
   - Recommendation: For v1, filter by `date >= now()` on the `GET /events` public endpoint rather than maintaining a `status` field transition. Simpler — no cron needed. Ops can still cancel manually.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (NestJS) |
| Config file | `backend/src` (rootDir in package.json jest config) |
| Quick run command | `cd backend && npx jest --testPathPattern=feedback\|events --no-coverage` |
| Full suite command | `cd backend && npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CUST-01 | `FeedbackService.submit()` persists Feedback with optional order_id | unit | `cd backend && npx jest feedback.service.spec -t "submit" --no-coverage` | Wave 0 |
| CUST-01 | `FeedbackService.findAll()` filters by rating + date | unit | `cd backend && npx jest feedback.service.spec -t "findAll" --no-coverage` | Wave 0 |
| CUST-02 | `EventsService.createBooking()` enforces capacity via $transaction | unit | `cd backend && npx jest events.service.spec -t "createBooking" --no-coverage` | Wave 0 |
| CUST-02 | `EventsService.createBooking()` throws when guests exceed remaining capacity | unit | `cd backend && npx jest events.service.spec -t "capacity" --no-coverage` | Wave 0 |
| CUST-03 | Public menu endpoint returns menu items without auth | manual smoke | N/A — no test infra for HTTP without auth | manual |

### Sampling Rate

- **Per task commit:** `cd backend && npx jest --testPathPattern=feedback\|events --no-coverage`
- **Per wave merge:** `cd backend && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/src/feedback/feedback.service.spec.ts` — covers CUST-01
- [ ] `backend/src/events/events.service.spec.ts` — covers CUST-02 capacity enforcement

*(No new test framework install needed — Jest already configured in `backend/package.json`)*

---

## Sources

### Primary (HIGH confidence)

- `backend/src/common/decorators/public.decorator.ts` — `@Public()` decorator verified
- `backend/src/auth/jwt-auth.guard.ts` — `IS_PUBLIC_KEY` reflector logic verified
- `backend/src/auth/permissions.guard.ts` — permissions guard only activates on `@RequiresPermission()` (verified)
- `backend/src/app.module.ts` — global guard registration confirmed
- `backend/src/menu/menu.controller.ts` — no `@RequiresPermission` on GET endpoints (verified)
- `backend/prisma/schema.prisma` — full schema read, no existing Feedback/Event/EventBooking models
- `frontend/package.json` — all dependency versions verified
- `frontend/app/(ops)/operations/menu/page.tsx` — brand tab + React Query pattern verified
- `frontend/components/ui/confetti.tsx` — Confetti API verified (`manualstart`, `ConfettiRef.fire()`)
- `frontend/components/ui/magic-card.tsx` — MagicCard props verified (`gradientColor`)
- `frontend/components/ui/blur-fade.tsx` — BlurFade props verified (`direction`, `delay`)
- `.planning/phases/13-customer-experience/13-UI-SPEC.md` — full UI spec read

### Secondary (MEDIUM confidence)

- npm registry: `qrcode@1.5.4` published 2025-11-13 — verified via `npm view` command
- npm registry: `react-qr-code@2.0.18` published 2025-07-06 — verified as alternative

### Tertiary (LOW confidence)

- Light theme isolation via `data-theme="light"` div wrapper — approach derived from Tailwind CSS variable architecture; exact behavior in Tailwind v4 not verified from official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against npm registry and codebase
- Architecture: HIGH — auth bypass pattern verified in existing codebase; route group pattern already used for `(ops)` group
- Pitfalls: HIGH — capacity race condition and route shadowing are known NestJS/Prisma patterns verified in STATE.md history
- Light theme isolation: MEDIUM — approach logical but Tailwind v4 behavior not verified from official docs

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack, 30-day validity)
