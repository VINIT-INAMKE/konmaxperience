# Phase 24: Customer Marketplace - Research

**Researched:** 2026-03-26
**Domain:** Fullstack customer marketplace — Redis cart, Google Places, Pusher private channels, NestJS HTML receipts, Razorpay reuse
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Cart stored in Redis (Upstash) keyed by `cart:{customerId}`. JSON blob with items, channel, delivery address. 7-day TTL. No Prisma cart model.
- **D-02:** Pre-login cart lives in Zustand (local). On login/OTP verify, sync to Redis. Merge conflict: keep cart with more items or prompt user.
- **D-03:** Login required at checkout only. Browsing /menu and adding to cart do NOT require auth. Login prompt appears on "Pay".
- **D-04:** Takeaway and delivery only for customer self-ordering. Dine-in remains staff POS only.
- **D-05:** Channel modifier applied at checkout using existing ChannelModifier model — same logic as POS.
- **D-06:** Enhance existing `/menu` page (not a new page). Category tabs at top, item cards with +/- quantity controls.
- **D-07:** Floating cart bar at bottom of /menu. Expands into bottom sheet with channel selection, delivery address, total, [Pay] CTA.
- **D-08:** Item cards show name, price, description, image thumbnail, availability badge. Unavailable items cannot be added.
- **D-09:** New `POST /customer/orders` (CustomerGuard). Reads cart from Redis, validates items, calculates prices server-side, creates Razorpay order, returns `razorpay_order_id`.
- **D-10:** `POST /customer/orders/confirm` — verifies signature + API re-fetch, creates Order + OrderItems in Prisma transaction, deletes cart, triggers Pusher events.
- **D-11:** Tracking at `/orders/[id]/track`. Pusher channel: `private-customer-{customerId}`. Events: `order.status-changed`, `delivery.updated`.
- **D-12:** 4-step customer-facing statuses mapped from internal KDS statuses (see CONTEXT.md for full mapping).
- **D-13:** Existing `updateOrderStatus()` and `updateDelivery()` emit Pusher to `private-customer-{customerId}`. No new staff UI needed.
- **D-14:** New `CustomerAddress` Prisma model: id, customer_id, label, address, landmark (optional), pincode, lat (optional), lng (optional), is_default, created_at.
- **D-15:** Google Places Autocomplete for address input. Extract pincode and lat/lng from Place result.
- **D-16:** Pincode-based delivery zone check. `DELIVERY_PINCODES` env var. `isServiceable(pincode)` function. Simple design for Phase 25 API swap.
- **D-17:** Server-rendered receipt at `GET /customer/orders/:id/receipt` returns `text/html`. All data pre-rendered server-side. Print-optimized CSS. No client-side React rendering.
- **D-18:** Same pattern for `GET /customer/bookings/:id/receipt`. Both require CustomerGuard.
- **D-19:** `/profile` page enhanced with Orders tab: list with order number, date, items summary, total, status badge.
- **D-20:** Re-order adds same items to cart (checks availability, skips unavailable with toast, prompts if cart not empty).
- **D-21:** Profile also shows saved addresses with edit/delete/set-default, and event bookings list.

### Claude's Discretion
- Exact Redis key schema and cart JSON structure
- Google Places API key configuration
- Cart merge UX (when existing Redis cart vs local cart conflict)
- Loading states and skeleton designs
- Error handling for unavailable items during checkout
- Pusher channel authentication for customer channels
- Empty state designs for order history and addresses
- ETA calculation logic (or whether to show ETA at all)

### Deferred Ideas (OUT OF SCOPE)
- Porter/Shiprocket delivery integration — Phase 25
- Order detail page for staff — Phase 26
- Customer loyalty/rewards program — future phase
- Push notifications (web push / WhatsApp) for order status — future phase
- Customer ratings for delivery experience — future phase
- Estimated delivery time calculation — future phase
- Multi-restaurant/brand filtering on menu — future if multi-brand grows
</user_constraints>

---

## Summary

Phase 24 builds a full Swiggy-style customer ordering experience on top of the Phase 23 payment and auth infrastructure. The core technical challenge is integrating six distinct subsystems — Redis cart (ephemeral state), Google Places (address input), Pusher private channels (real-time customer tracking), NestJS HTML receipts (tamper-proof print view), Razorpay checkout (payment, reused from Phase 23), and a Zustand local cart store (pre-auth state) — all wiring into the existing NestJS backend and Next.js frontend.

All six subsystems have clear implementation patterns from the existing codebase and official docs. Redis cart is a JSON string stored with `set(key, JSON.stringify(cart), 'EX', 604800)` using the existing `RedisService`. Pusher private channel auth for customers requires a new `POST /customer/pusher-auth` endpoint that validates the `customerId` from the JWT matches the channel name prefix `private-customer-{id}`. Google Places uses `@react-google-maps/api`'s `Autocomplete` component + `getPlace()` to extract `address_components` for pincode and `geometry.location` for lat/lng. NestJS HTML receipts use `@Header('Content-Type', 'text/html')` on the controller method and return a template literal string. All payment logic reuses `RazorpayService` and `useRazorpay` hook from Phase 23.

The two most complex integration points are: (1) the Pusher auth endpoint must handle both staff JWT (`type: 'staff'`) and customer JWT (`type: 'customer'`) — the existing `/chat/auth` only handles staff, so a new `/customer/pusher-auth` endpoint is needed; and (2) the cart sync-on-login flow where Zustand local state must merge into Redis on OTP verify, which requires `useCartStore` to expose a flush method called from `useCustomerAuth.verifyOtp`.

**Primary recommendation:** Implement in dependency order: Prisma migration (CustomerAddress) → Redis cart service → CustomerOrdersModule (checkout + confirm + addresses + receipt) → Pusher auth for customer channels → Pusher triggers in updateOrderStatus/updateDelivery → Frontend Zustand cart store → /menu page enhancement → checkout bottom sheet → order tracking page → profile enrichment.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ioredis | ^5.10.1 (already installed) | Redis cart storage via Upstash | Already in codebase — `RedisService` exposes `getClient()` |
| pusher (server) | ^5.3.3 (already installed) | Trigger Pusher events + authorize channels | Already in `PusherService.authorizeChannel()` |
| pusher-js (client) | ^8.4.3 (already installed) | Subscribe to `private-customer-{id}` channel | Already in `getPusherClient()` and `usePusherChannel` |
| @react-google-maps/api | 2.20.8 | Autocomplete component for delivery address | Supports React 19; provides `Autocomplete` + `useJsApiLoader` |
| use-places-autocomplete | 4.0.1 | Optional: headless hook alternative to @react-google-maps/api Autocomplete | Lighter if custom autocomplete UI is preferred |
| zustand | ^5.0.12 (already installed) | Local cart state before auth | Already in project; v5 `create()` syntax still `create(callback)` |
| razorpay SDK | already installed | Reuse Phase 23 `RazorpayService` | No new SDK install needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| immer | check frontend deps | Simplify cart mutations in Zustand store | If cart updates become complex; optional if simple spread updates suffice |

**Installation (new packages only):**
```bash
# Frontend only — @react-google-maps/api
cd frontend && npm install @react-google-maps/api@2.20.8
```

**Version verification (verified 2026-03-26):**
- `@react-google-maps/api`: 2.20.8 (npm view confirmed)
- `ioredis`: 5.10.1 (already installed in backend)
- `pusher-js`: 8.4.3 (already installed in frontend)
- `zustand`: 5.0.12 (already installed in frontend)

---

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── customer-orders/                 # NEW module
│   ├── customer-orders.module.ts
│   ├── customer-orders.controller.ts
│   ├── customer-orders.service.ts
│   └── dto/
│       ├── confirm-order.dto.ts
│       └── create-address.dto.ts
├── orders/orders.service.ts         # ADD: Pusher trigger in updateOrderStatus + updateDelivery
├── chat/pusher.service.ts           # REUSE: authorizeChannel() for customer endpoint
├── customer-auth/
│   ├── customer-auth.controller.ts  # ADD: POST /customer-auth/pusher-auth endpoint
│   └── redis.service.ts             # REUSE: getClient() for cart storage

frontend/
├── lib/stores/
│   └── cart-store.ts                # NEW: Zustand cart store (local pre-auth state)
├── lib/hooks/
│   └── use-cart.ts                  # NEW: cart CRUD + sync-on-login
├── app/(public)/
│   ├── menu/page.tsx                # MODIFY: add cart interactions
│   ├── orders/[id]/track/page.tsx   # NEW: real-time order tracking
│   └── profile/page.tsx             # MODIFY: add orders + addresses tabs
├── components/public/
│   ├── CartBar.tsx                  # NEW: floating bottom cart bar
│   ├── CartBottomSheet.tsx          # NEW: checkout sheet
│   ├── AddressAutocomplete.tsx      # NEW: Google Places input
│   ├── OrderTrackingTimeline.tsx    # NEW: checkpoint timeline
│   └── CustomerAddressManager.tsx  # NEW: address list + CRUD
```

---

### Pattern 1: Redis Cart — JSON Blob with TTL

**What:** Cart stored as serialized JSON at key `cart:{customerId}`, 7-day TTL. No database model.
**When to use:** All cart read/write operations on the backend.

```typescript
// Source: ioredis docs + existing RedisService pattern
// backend/src/customer-orders/customer-orders.service.ts

private readonly CART_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

// Cart JSON structure (Claude's discretion per CONTEXT.md)
interface CartData {
  items: Array<{
    menuItemId: string;
    name: string;         // denormalized for display
    quantity: number;
    unitPrice: number;    // server snapshot at add time (re-validated at checkout)
    imageUrl: string | null;
  }>;
  channel: 'takeaway' | 'delivery' | null;
  deliveryAddressId: string | null;   // FK to CustomerAddress
  updatedAt: string;                  // ISO timestamp
}

async getCart(customerId: string): Promise<CartData | null> {
  const redis = this.redisService.getClient();
  if (!redis) return null;
  const raw = await redis.get(`cart:${customerId}`);
  return raw ? JSON.parse(raw) : null;
}

async setCart(customerId: string, cart: CartData): Promise<void> {
  const redis = this.redisService.getClient();
  if (!redis) return;
  // 'EX' sets TTL in seconds (ioredis v5 syntax)
  await redis.set(`cart:${customerId}`, JSON.stringify(cart), 'EX', this.CART_TTL);
}

async deleteCart(customerId: string): Promise<void> {
  const redis = this.redisService.getClient();
  if (!redis) return;
  await redis.del(`cart:${customerId}`);
}
```

**Key insight:** Prices are denormalized into cart for display only — `createOrder` always re-reads from `MenuItem.base_price` server-side. Client-sent prices are never trusted.

---

### Pattern 2: Pusher Private Channel Auth for Customers

**What:** A new `POST /customer-auth/pusher-auth` endpoint that verifies the `customerId` from the customer JWT matches the channel name, then calls `pusherService.authorizeChannel()`.

**Why new endpoint (not reuse /chat/auth):** `/chat/auth` uses staff JWT (`type: 'staff'`). Customer JWT has `type: 'customer'` and `customerId`. Mixing auth guards on one endpoint would create confusion. Separate endpoint is clean.

```typescript
// Source: Pusher docs + existing PusherService.authorizeChannel() + CustomerGuard pattern
// backend/src/customer-auth/customer-auth.controller.ts

@Post('pusher-auth')
@UseGuards(CustomerGuard)
@HttpCode(200)
async pusherAuth(
  @Body() body: { socket_id: string; channel_name: string },
  @Req() req: any,
) {
  const customerId: string = req.user.customerId; // from CustomerGuard JWT payload
  // channel name format: private-customer-{customerId}
  const expectedChannel = `private-customer-${customerId}`;
  if (body.channel_name !== expectedChannel) {
    throw new ForbiddenException('Not authorized for this channel');
  }
  return this.pusherService.authorizeChannel(body.socket_id, body.channel_name);
}
```

**Frontend — dedicated Pusher client for customer channels:**

The current `getPusherClient()` in `lib/pusher-client.ts` sends auth to `/chat/auth`. The customer tracking page needs a separate Pusher instance (or reconfigured one) that sends auth to `/customer-auth/pusher-auth`. The cleanest approach is a `getCustomerPusherClient()` function alongside the existing one, or pass the auth endpoint as a parameter.

```typescript
// Source: existing lib/pusher-client.ts pattern
// frontend/lib/customer-pusher-client.ts

import Pusher from 'pusher-js';

let customerPusherInstance: Pusher | null = null;

export function getCustomerPusherClient(): Pusher {
  if (typeof window === 'undefined') {
    throw new Error('Pusher client only available in browser');
  }
  if (!customerPusherInstance) {
    customerPusherInstance = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      channelAuthorization: {
        endpoint: `${process.env.NEXT_PUBLIC_API_URL}/customer-auth/pusher-auth`,
        transport: 'ajax',
        customHandler: async (params, callback) => {
          try {
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/customer-auth/pusher-auth`,
              {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  socket_id: params.socketId,
                  channel_name: params.channelName,
                }),
              },
            );
            if (!res.ok) { callback(new Error('Auth failed'), null); return; }
            const data = await res.json();
            callback(null, data);
          } catch (err) {
            callback(err as Error, null);
          }
        },
      },
    });
  }
  return customerPusherInstance;
}
```

**Pusher event emission from orders.service.ts:**

```typescript
// Add to updateOrderStatus() AFTER update persists
// Source: D-13 decision + existing eventEmitter.emit pattern
await this.pusherService.trigger(
  `private-customer-${order.customer_id}`,
  'order.status-changed',
  { orderId, status: newStatus, updatedAt: new Date().toISOString() },
);

// Add to updateDelivery() AFTER update persists
await this.pusherService.trigger(
  `private-customer-${order.customer_id}`,
  'delivery.updated',
  { orderId, deliveryStatus: dto.delivery_status, updatedAt: new Date().toISOString() },
);
```

**CRITICAL:** Check `order.customer_id` is not null before triggering. Marketplace orders will have `customer_id` set; POS orders may not. Guard with `if (order.customer_id)`.

---

### Pattern 3: Google Places Autocomplete — React Integration

**What:** `@react-google-maps/api` `Autocomplete` component wrapping the input. On place selected: call `autocomplete.getPlace()` to get `address_components` (for pincode) and `geometry.location` (for lat/lng).

**Setup:** Load Google Maps script once via `useJsApiLoader` in the parent component/layout, specifying `libraries: ['places']`.

```typescript
// Source: @react-google-maps/api docs + Google Maps JS API docs
// frontend/components/public/AddressAutocomplete.tsx
'use client';

import { useCallback, useRef } from 'react';
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api';

const LIBRARIES: ('places')[] = ['places']; // define outside component — prevents re-render

interface PlaceResult {
  formattedAddress: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
}

interface AddressAutocompleteProps {
  onPlaceSelect: (result: PlaceResult) => void;
}

export function AddressAutocomplete({ onPlaceSelect }: AddressAutocompleteProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY!,
    libraries: LIBRARIES,
  });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const onLoad = useCallback((ac: google.maps.places.Autocomplete) => {
    autocompleteRef.current = ac;
  }, []);

  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    if (!place) return;

    // Extract pincode from address_components
    let pincode = '';
    for (const component of place.address_components ?? []) {
      if (component.types.includes('postal_code')) {
        pincode = component.long_name;
        break;
      }
    }

    // Extract lat/lng from geometry
    const lat = place.geometry?.location?.lat() ?? null;
    const lng = place.geometry?.location?.lng() ?? null;

    onPlaceSelect({
      formattedAddress: place.formatted_address ?? '',
      pincode,
      lat,
      lng,
    });
  }, [onPlaceSelect]);

  if (!isLoaded) return <input placeholder="Loading..." disabled />;

  return (
    <Autocomplete
      onLoad={onLoad}
      onPlaceChanged={onPlaceChanged}
      options={{
        componentRestrictions: { country: 'in' },  // restrict to India
        fields: ['address_components', 'formatted_address', 'geometry'],
        types: ['address'],
      }}
    >
      <input
        type="text"
        placeholder="Enter delivery address"
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
    </Autocomplete>
  );
}
```

**CRITICAL:** `LIBRARIES` array must be defined outside the component. If defined inside, it creates a new reference on every render, causing `useJsApiLoader` to reload the script infinitely.

**CRITICAL:** `fields` must explicitly include `'address_components'`, `'formatted_address'`, and `'geometry'`. Fields not listed are not returned and will be undefined. This affects billing — only request what you need.

---

### Pattern 4: NestJS HTML Receipt Controller

**What:** Return a `text/html` response from a NestJS GET endpoint. Use `@Header('Content-Type', 'text/html')` decorator and return the HTML string directly.

```typescript
// Source: NestJS docs + verified pattern
// backend/src/customer-orders/customer-orders.controller.ts

@Get(':id/receipt')
@UseGuards(CustomerGuard)
@Header('Content-Type', 'text/html')
async getOrderReceipt(
  @Param('id') orderId: string,
  @Req() req: any,
): Promise<string> {
  return this.customerOrdersService.generateOrderReceipt(orderId, req.user.customerId);
}

// In service:
async generateOrderReceipt(orderId: string, customerId: string): Promise<string> {
  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { menu_item: { select: { name: true } } } },
      payment: true,
      customer: { select: { name: true, phone: true } },
    },
  });

  if (!order) throw new NotFoundException('Order not found');
  if (order.customer_id !== customerId) throw new ForbiddenException('Not your order');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Order Receipt #${order.order_number}</title>
  <style>
    body { font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; }
    @media print {
      body { margin: 0; padding: 10px; }
    }
    table { width: 100%; border-collapse: collapse; }
    td, th { padding: 4px 8px; }
    .total { font-weight: bold; border-top: 2px solid #000; }
  </style>
</head>
<body>
  <h1>Konma Xperience</h1>
  <p>Order #${order.order_number}</p>
  <!-- ... full receipt HTML ... -->
</body>
</html>`;
}
```

**Alternative using @Res():** Works but disables NestJS interceptors/exception filters. Stick with `@Header()` + return string.

---

### Pattern 5: Zustand Cart Store (Pre-Auth Local State)

**What:** Zustand v5 store for cart items in local memory before login. On OTP verify, flush to Redis.

```typescript
// Source: Zustand v5 docs (create() syntax unchanged from v4, no breaking change to basic create)
// frontend/lib/stores/cart-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  imageUrl: string | null;
}

interface CartState {
  items: CartItem[];
  channel: 'takeaway' | 'delivery' | null;
  deliveryAddressId: string | null;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  setChannel: (channel: 'takeaway' | 'delivery') => void;
  setDeliveryAddress: (addressId: string | null) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      channel: null,
      deliveryAddressId: null,
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.menuItemId === item.menuItemId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.menuItemId === item.menuItemId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: 1 }] };
        }),
      removeItem: (menuItemId) =>
        set((state) => ({ items: state.items.filter((i) => i.menuItemId !== menuItemId) })),
      updateQuantity: (menuItemId, quantity) =>
        set((state) => ({
          items: quantity <= 0
            ? state.items.filter((i) => i.menuItemId !== menuItemId)
            : state.items.map((i) =>
                i.menuItemId === menuItemId ? { ...i, quantity } : i,
              ),
        })),
      setChannel: (channel) => set({ channel }),
      setDeliveryAddress: (addressId) => set({ deliveryAddressId: addressId }),
      clearCart: () => set({ items: [], channel: null, deliveryAddressId: null }),
      getTotalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      getSubtotal: () => get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    }),
    {
      name: 'cart-storage',   // localStorage key
      partialize: (state) => ({
        items: state.items,
        channel: state.channel,
        deliveryAddressId: state.deliveryAddressId,
      }),
    },
  ),
);
```

**Cart sync on login** — call in `use-customer-auth.ts` after OTP verify success:

```typescript
// In useCustomerAuth.verifyOtp(), after setCustomer(result.customer):
const localCart = useCartStore.getState();
if (localCart.items.length > 0) {
  await apiClient.post('/customer/cart/sync', {
    items: localCart.items,
    channel: localCart.channel,
    deliveryAddressId: localCart.deliveryAddressId,
  });
  // Backend handles merge logic (D-02): keep cart with more items
  useCartStore.getState().clearCart(); // clear local after sync
}
```

---

### Pattern 6: Customer Order Creation (Reusing Phase 23 Pattern)

**What:** `POST /customer/orders` reads cart from Redis, validates, calculates server-side, creates Razorpay order. `POST /customer/orders/confirm` verifies payment and creates Order in DB.

```typescript
// Source: Phase 23 events checkout pattern (events.service.ts checkout/confirm methods)
// Pattern: same belt-and-suspenders as event bookings

async checkoutCart(customerId: string): Promise<{ razorpay_order_id: string }> {
  const cart = await this.getCart(customerId);
  if (!cart || cart.items.length === 0) throw new BadRequestException('Cart is empty');
  if (!cart.channel) throw new BadRequestException('Select pickup or delivery');

  // Server-side price validation (NEVER trust client prices)
  const menuItemIds = cart.items.map((i) => i.menuItemId);
  const menuItems = await this.prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, available: true, status: 'active' },
    select: { id: true, base_price: true },
  });
  // Validate all items still available
  const priceMap = new Map(menuItems.map((m) => [m.id, Number(m.base_price)]));
  for (const item of cart.items) {
    if (!priceMap.has(item.menuItemId)) {
      throw new BadRequestException(`Item no longer available`);
    }
  }

  // Calculate total server-side (same as createOrder)
  const subtotal = cart.items.reduce((sum, i) => sum + priceMap.get(i.menuItemId)! * i.quantity, 0);
  const modifier = await this.prisma.channelModifier.findFirst({
    where: { channel_type: cart.channel, status: 'active' },
  });
  const modifierAmount = modifier
    ? (modifier.modifier_type === 'fixed' ? Number(modifier.modifier_value) : (subtotal * Number(modifier.modifier_value)) / 100)
    : 0;
  const total = subtotal + modifierAmount;
  const amountInPaise = Math.round(total * 100);

  // Create Razorpay order — notes.type must be 'marketplace' for webhook routing
  const rzpOrder = await this.razorpayService.createOrder({
    amount: amountInPaise,
    receipt: `mkt_${customerId.slice(0, 8)}_${Date.now()}`,
    notes: { type: 'marketplace', entity_id: customerId },
  });

  // Store pending order metadata in Redis for confirm step
  const redis = this.redisService.getClient();
  await redis?.set(
    `pending_order:${rzpOrder.id}`,
    JSON.stringify({ customerId, total, subtotal, modifierAmount, channel: cart.channel }),
    'EX', 60 * 30, // 30 min — matches Razorpay order expiry
  );

  return { razorpay_order_id: rzpOrder.id };
}
```

**CRITICAL:** `notes.entity_id` for marketplace uses `customerId` (not orderId — Order doesn't exist yet). The webhook handler at Phase 23 already has `case 'marketplace':` as a noop placeholder — implement it in Phase 24.

---

### Pattern 7: Prisma Schema — CustomerAddress Model

```prisma
// Source: D-14 decision
// backend/prisma/schema.prisma — ADD to Customer model relation and add new model

model CustomerAddress {
  id          String   @id @default(uuid())
  customer_id String
  customer    Customer @relation(fields: [customer_id], references: [id], onDelete: Cascade)
  label       String   // "Home" | "Work" | "Other"
  address     String   // full text address
  landmark    String?
  pincode     String
  lat         Float?
  lng         Float?
  is_default  Boolean  @default(false)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  @@index([customer_id])
}

// Also add to Customer model:
// addresses  CustomerAddress[]
```

**Migration approach (consistent with Phase 14/17/23):** Manual SQL + `prisma migrate deploy`.

---

### Anti-Patterns to Avoid

- **Storing prices from client in cart:** Never trust `unitPrice` from the cart for final billing. Re-read from `MenuItem.base_price` at checkout.
- **Using /chat/auth for customer Pusher auth:** Staff JWT and customer JWT have different payloads. Always use a separate customer auth endpoint.
- **Loading LIBRARIES array inside component:** Always define `const LIBRARIES = ['places']` outside the component, otherwise `useJsApiLoader` triggers on every render.
- **Triggering Pusher events inside a Prisma transaction:** Fire Pusher AFTER the transaction commits (existing `eventEmitter` pattern already handles this — apply same discipline for Pusher triggers in updateOrderStatus/updateDelivery).
- **Using @Res() for HTML receipt:** Bypasses NestJS interceptors and exception filters. Use `@Header('Content-Type', 'text/html')` + return string instead.
- **Global `isServiceable()` check on frontend only:** Always validate pincode on backend at `POST /customer/orders`. Frontend check is UX only — backend must enforce.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment signature verification | Custom HMAC | `RazorpayService.verifyPaymentSignature()` (Phase 23) | Already implemented, tested |
| Razorpay modal | Custom payment UI | `useRazorpay` hook (Phase 23) | Already handles all states + optionsRef stale closure fix |
| Cart expiry cleanup | Cron job | Redis TTL (`'EX', 604800`) | Automatic, zero-maintenance |
| Address input parsing | Manual text parse | Google Places `address_components` | Structured, accurate, handles international formats |
| Postal code extraction | Regex on address text | `address_components.find(c => c.types.includes('postal_code')).long_name` | Reliable, works with all Indian address formats |
| Pusher channel auth string | Custom HMAC | `PusherService.authorizeChannel()` | Cryptographic correctness, built-in |
| Pusher client subscription | Raw WebSocket | `usePusherChannel()` hook + `getCustomerPusherClient()` | Handles auth, reconnect, cleanup |
| Channel modifier calculation | Duplicate logic | `ChannelModifier` model lookup (reuse createOrder pattern from orders.service.ts) | Single source of truth for pricing |
| Webhook routing | New webhook endpoint | Existing webhook handler, add `case 'marketplace':` impl | Dedup, signature verification already in place |

---

## Common Pitfalls

### Pitfall 1: Pusher Events Inside Prisma Transaction
**What goes wrong:** Pusher trigger called inside `prisma.$transaction(async tx => { ... })`. Transaction rollbacks leave Pusher event already fired — customer sees "Order Placed" but no order exists.
**Why it happens:** Pusher trigger is synchronous from the caller's perspective but the HTTP call happens outside the DB transaction.
**How to avoid:** Fire Pusher events AFTER the transaction completes (like the existing `eventEmitter.emit` pattern in `createOrder`).
**Warning signs:** Pusher trigger call appears inside the `tx =>` callback block.

### Pitfall 2: `LIBRARIES` Array Inside Component
**What goes wrong:** `useJsApiLoader` with `libraries: ['places']` defined inside the component body — triggers script reload on every render, breaking the Autocomplete.
**Why it happens:** React's reference equality check sees a new array every render.
**How to avoid:** `const LIBRARIES: ('places')[] = ['places']` at module scope (outside the component function).
**Warning signs:** Console shows Google Maps script loading multiple times.

### Pitfall 3: Notes.entity_id for Marketplace Webhook
**What goes wrong:** Setting `notes.entity_id = orderId` — but the Order doesn't exist yet at Razorpay order creation time.
**Why it happens:** Mapping the event_booking pattern directly — event bookings already have an event_id, marketplace doesn't have an order_id yet.
**How to avoid:** Use `notes.entity_id = customerId` for marketplace. Store pending order data in Redis keyed by `pending_order:{razorpay_order_id}`. Retrieve at confirm time.
**Warning signs:** Webhook handler can't find the order because the entity_id lookup fails.

### Pitfall 4: Customer ID Null Check Before Pusher Trigger
**What goes wrong:** `updateOrderStatus()` triggers Pusher to `private-customer-${order.customer_id}` — but POS orders created by staff have no `customer_id`. Results in triggering `private-customer-null`.
**Why it happens:** `customer_id` is nullable on Order model.
**How to avoid:** Always guard: `if (order.customer_id) { await this.pusherService.trigger(...) }`.
**Warning signs:** Pusher logs show `private-customer-null` channel events.

### Pitfall 5: Google Places `getPlace()` Returns Incomplete Data
**What goes wrong:** `autocompleteRef.current.getPlace()` returns a Place with no `geometry` or no `address_components` — lat/lng and pincode extraction silently returns null/empty.
**Why it happens:** The `fields` option on the `Autocomplete` component must explicitly include `'address_components'`, `'formatted_address'`, and `'geometry'`. Default fields are minimal.
**How to avoid:** Set `options={{ fields: ['address_components', 'formatted_address', 'geometry'] }}` on the `<Autocomplete>` component.
**Warning signs:** `place.geometry` is undefined even after selection.

### Pitfall 6: Cart Merge Race Condition on Login
**What goes wrong:** Customer has local Zustand cart (3 items) + existing Redis cart from another device (5 items). Both are synced in parallel → one overwrites the other.
**Why it happens:** Frontend sends local cart in sync request; backend reads existing Redis cart — if not handled atomically, parallel requests can conflict.
**How to avoid:** Sync endpoint is called once on OTP verify success (guarded by `if (localCart.items.length > 0)`). Backend does a compare-and-swap: read existing Redis cart first, apply merge logic, write result once.
**Warning signs:** Customer reports items disappearing after login from multiple devices.

### Pitfall 7: apiClient 401 Not Bypassing Customer Order Endpoints
**What goes wrong:** `apiClient` redirects to `/login` on 401 for paths not starting with `/customer-auth`. Customer order endpoints at `/customer/...` will trigger the staff login redirect on session expiry.
**Why it happens:** Current bypass only checks `path.startsWith('/customer-auth')` — doesn't cover `/customer/orders`, `/customer/addresses`.
**How to avoid:** Update `apiClient` 401 handling to also bypass paths starting with `/customer/`. Throw `ApiError(401)` instead of redirecting for those paths.
**Warning signs:** Customer gets redirected to `/login` (staff login page) when session expires.

---

## Code Examples

### Redis Cart `set` with EX TTL (ioredis v5 syntax)
```typescript
// Source: ioredis docs — 'EX' option sets seconds TTL atomically with set
await redis.set(`cart:${customerId}`, JSON.stringify(cart), 'EX', 604800);
// 604800 = 60 * 60 * 24 * 7 (7 days)
```

### Extracting Postal Code from Place Result
```typescript
// Source: Google Maps JS API address_components spec + use-places-autocomplete docs
const pincode = place.address_components
  ?.find(c => c.types.includes('postal_code'))
  ?.long_name ?? '';
```

### PusherService.authorizeChannel Call Pattern (existing)
```typescript
// Source: backend/src/chat/pusher.service.ts — already implemented
// Returns: { auth: "$APP_KEY:$HMAC_SIGNATURE" }
return this.pusherService.authorizeChannel(dto.socket_id, dto.channel_name);
```

### usePusherChannel for Order Tracking
```typescript
// Source: frontend/lib/hooks/use-pusher-channel.ts (existing)
// But for customer, use getCustomerPusherClient() instead of getPusherClient()
// Create a parallel useCustomerPusherChannel hook:
export function useCustomerPusherChannel(channelName: string | null) {
  const channelRef = useRef<Channel | null>(null);
  useEffect(() => {
    if (!channelName) return;
    const pusher = getCustomerPusherClient();
    const channel = pusher.subscribe(channelName);
    channelRef.current = channel;
    return () => {
      pusher.unsubscribe(channelName);
      channelRef.current = null;
    };
  }, [channelName]);
  return channelRef;
}
```

### Prisma Serializable Transaction for Customer Order Confirm
```typescript
// Source: Phase 23 events service + existing createOrder pattern
// Use $transaction with isolationLevel to prevent duplicate order creation
const order = await this.prisma.$transaction(async (tx) => {
  // 1. Re-validate cart items
  // 2. Verify Razorpay payment
  // 3. Create Order + OrderItems
  // 4. Create Payment record
  // 5. Delete cart from Redis (can be outside tx — idempotent)
  return created;
}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
```

### NestJS HTML Receipt Endpoint
```typescript
// Source: NestJS docs — @Header decorator + string return
@Get(':id/receipt')
@UseGuards(CustomerGuard)
@Header('Content-Type', 'text/html')
async getReceipt(@Param('id') id: string, @Req() req: any): Promise<string> {
  return this.service.generateReceipt(id, req.user.customerId);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redux for cart state | Zustand v5 | v5 stable 2024 | Simpler API, no boilerplate, persist middleware built-in |
| Google Maps `PlacesAutocomplete` class | `@react-google-maps/api` `Autocomplete` component | 2020+ | React lifecycle managed, no direct DOM manipulation |
| Polling for order status | Pusher private channels | Phase 21 introduced Pusher | Already configured in codebase, zero new infra |
| Client-side PDF generation | Server-rendered HTML + browser print | Phase 17+ pattern | Tamper-proof, no jsPDF dependency, works on all devices |
| Separate cart database table | Redis TTL-based cart | Industry standard (Swiggy/Zomato pattern) | Auto-expiry, no cleanup cron, fast reads |

**Deprecated/outdated:**
- `react-places-autocomplete` (hibiken/react-places-autocomplete): No longer maintained since 2021. Use `@react-google-maps/api` Autocomplete or `use-places-autocomplete` instead.

---

## Open Questions

1. **`created_by` for customer orders**
   - What we know: `Order.created_by` is a required String FK to `User`. Customer orders don't have a staff creator (D-10 says "system user").
   - What's unclear: Does a system User record exist? The schema has `created_by String` with FK to User.
   - Recommendation: Create a seeded system user (`SYSTEM_USER_ID` in env or hardcoded UUID) used as `created_by` for all marketplace orders. OR make `created_by` nullable in a migration. Check existing data before deciding — adding nullable is a migration cost but cleaner.

2. **`zone_id` for customer orders**
   - What we know: `Order.zone_id` is required (non-nullable) FK to Zone.
   - What's unclear: Customer orders don't have a zone. Which zone to assign?
   - Recommendation: Use a default "Online" zone. Either use a seeded zone ID from env (`ONLINE_ZONE_ID`) or create the concept of a default zone for online orders. This needs a decision before migration.

3. **Google Places API billing and quota**
   - What we know: Places Autocomplete + Place Details = 2 API calls per address selection. Billed per request after free tier.
   - What's unclear: Is `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` already set up with Places API enabled in the Google Cloud project?
   - Recommendation: Document API key setup in phase notes. Restrict key to `http://localhost:3000` + production domain in Google Cloud Console. Enable "Places API" in the project.

4. **Pusher channel limit**
   - What we know: Pusher free tier supports 100 simultaneous connections and 200k messages/day.
   - What's unclear: If concurrent customer orders exceed this, events would be dropped.
   - Recommendation: Not a concern for the villa scale (single-location, small volume). Note it for Phase 25 when third-party delivery scaling is introduced.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (NestJS default) |
| Config file | `backend/jest.config.js` |
| Quick run command | `cd backend && npm test -- --testPathPattern="customer-orders" --no-coverage` |
| Full suite command | `cd backend && npm test -- --no-coverage` |

### Phase Requirements Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CART-01 | Cart CRUD via Redis (set/get/delete) | unit | `npm test -- customer-orders.service.spec.ts` | ❌ Wave 0 |
| CART-02 | Server-side price validation at checkout | unit | `npm test -- customer-orders.service.spec.ts` | ❌ Wave 0 |
| PAY-C01 | Razorpay order creation for marketplace | unit | `npm test -- customer-orders.service.spec.ts` | ❌ Wave 0 |
| PAY-C02 | Payment signature verify + Order creation | unit | `npm test -- customer-orders.service.spec.ts` | ❌ Wave 0 |
| PUSH-01 | Pusher auth endpoint rejects wrong customerId | unit | `npm test -- customer-auth.controller.spec.ts` | ❌ Wave 0 |
| ADDR-01 | CustomerAddress CRUD (create/list/delete/set-default) | unit | `npm test -- customer-orders.service.spec.ts` | ❌ Wave 0 |
| RECV-01 | Receipt HTML generation with correct order data | unit | `npm test -- customer-orders.service.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npm test -- --testPathPattern="customer-orders" --no-coverage`
- **Per wave merge:** `cd backend && npm test -- --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/customer-orders/customer-orders.service.spec.ts` — covers CART-01, CART-02, PAY-C01, PAY-C02, ADDR-01, RECV-01
- [ ] Update `backend/src/customer-auth/customer-auth.controller.spec.ts` (if exists) or create it — covers PUSH-01
- [ ] No framework install needed — Jest already configured in backend

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/src/chat/pusher.service.ts` — verified `authorizeChannel()` API
- Existing codebase: `frontend/lib/pusher-client.ts` — verified `customHandler` pattern for auth
- Existing codebase: `backend/src/customer-auth/redis.service.ts` — verified `getClient()` + ioredis `set` with `'EX'` option
- Existing codebase: `backend/src/orders/orders.service.ts` — verified `createOrder`, `updateOrderStatus`, `updateDelivery` patterns
- Existing codebase: `backend/src/razorpay/razorpay.service.ts` — verified `createOrder`, `verifyPaymentSignature` reuse
- Existing codebase: `frontend/hooks/use-razorpay.ts` — verified hook reuse pattern
- Pusher official docs (pusher.com/docs) — private channel auth format verified
- NestJS docs (docs.nestjs.com) — `@Header()` decorator for content-type verified
- ioredis GitHub + npm — `set(key, val, 'EX', seconds)` syntax confirmed for v5

### Secondary (MEDIUM confidence)
- `@react-google-maps/api` GitHub source — Autocomplete component props + `onLoad`/`onPlaceChanged` pattern
- Google Maps JS API docs — `address_components` structure for postal_code extraction
- `use-places-autocomplete` GitHub README — `getGeocode` + `getLatLng` utilities

### Tertiary (LOW confidence)
- WebSearch results for Zustand v5 `create()` — confirmed syntax unchanged; verified against zustand.docs.pmnd.rs migration guide

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already in project or verified via npm view
- Architecture: HIGH — patterns directly derived from existing codebase (Phase 21/23)
- Pitfalls: HIGH — derived from actual code inspection (null customer_id, apiClient bypass gap, LIBRARIES array)
- Google Places integration: MEDIUM — API verified from official docs but exact behavior with India pincode extraction needs smoke test

**Research date:** 2026-03-26
**Valid until:** 2026-04-25 (stable APIs — Google Places and Pusher change infrequently)
