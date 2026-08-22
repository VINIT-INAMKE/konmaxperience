# P1-B Security, Config & Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the nine verified P1 security/config/safety defects in SPEC.md §8 with regression tests: env validation at boot, working named throttlers keyed by user, typed refresh tokens with a separate secret, a QStash webhook that is never public, missing permission guards, cost-free public menu payloads, a working forgot-password email, production-safe seeds with random demo passwords, and route-level error boundaries on the frontend.

**Architecture:** All backend changes are additive to the existing NestJS 11 module layout (`backend/src/<module>/`); cross-cutting pieces go under `backend/src/config/` (env schema, throttler config) and `backend/src/common/guards/`. Seeds move from one 2,317-line script into `prisma/seed-reference.ts` (idempotent, prod-safe) and `prisma/seed-demo.ts` (guarded), sharing data files under `prisma/seed-data/` and pure helpers in `prisma/seed-utils.ts`. Frontend adds Next 16 `error.tsx`/`global-error.tsx`/`not-found.tsx` conventions plus a `lib/report-error.ts` seam for Sentry later.

**Tech Stack:** NestJS 11, `@nestjs/throttler` 6.5.0, `@nestjs/config` 4, `@nestjs/jwt` 11, `class-validator` 0.15 + `class-transformer` 0.5 (no zod in backend), Prisma 6.19, Jest 30 + ts-jest (rootDir `src`), Next.js 16.2 / React 19.2, Tailwind 4, shadcn `Button` (`@base-ui/react`).

**Findings that changed the brief (all verified in code):**
- `JwtStrategy.validate` returns `{ id, roleCode, type }` for staff and `{ customerId, type }` for customers (`backend/src/auth/jwt.strategy.ts:35-40`). There is no `req.user.userId`; the tracker must read `req.user.id ?? req.user.customerId`.
- `Zone`, `Brand`, `Channel` have no unique on `name` (schema), so the reference seed must use `findFirst` + `update`/`create`, not `upsert`.
- `backend/src/customer-orders/customer-orders.service.spec.ts` does not provide `OrdersService`, which the service constructor requires (`customer-orders.service.ts:44`); the suite must be fixed while adding the 503 test. (If P1-A has already replaced `OrdersService` with `FulfilmentService` in that constructor, provide `FulfilmentService` instead.)
- `backend/src/customer-auth/customer-auth.service.spec.ts:161` asserts the exact `jwtService.sign` payload; adding `token_use` requires updating it.
- Next 16.2 `error.tsx` receives `{ error, unstable_retry }` (docs: `frontend/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`); `reset` is legacy.
- `@SkipThrottle()` defaults to `{ default: true }` (throttler.decorator.js), so once `default` exists the health check still counts against short/medium/long unless all names are skipped.
- `zod` is not a backend dependency; `class-validator` 0.15 and `class-transformer` 0.5 are.

**Verified facts the tasks rely on (read before starting):**
- Guards run in order `JwtAuthGuard → PermissionsGuard → ThrottlerGuard` (`backend/src/app.module.ts:116-118`), so `req.user` is already populated when the throttler runs on authenticated routes. `@Public()` routes with `@UseGuards(CustomerGuard)` (customer-orders) are authenticated *after* the global throttler, so those fall back to IP tracking.
- `JwtStrategy.validate` returns `{ id, roleCode, type:'staff' }` or `{ customerId, type:'customer' }` (`backend/src/auth/jwt.strategy.ts:35-40`). The tracker keys on `user.id ?? user.customerId`.
- Throttler metadata keys are `'THROTTLER:LIMIT' + name` / `'THROTTLER:TTL' + name` (`node_modules/@nestjs/throttler/dist/throttler.constants.js`), set on the method function (`throttler.decorator.js`).
- `EmailModule` is `@Global()` (`backend/src/email/email.module.ts`), so `AuthService` can inject `EmailService` without importing a module.
- `Zone`, `Brand`, `Channel` have no unique key on `name`; `UnitConversion` has `@@unique([from_unit, to_unit])`; `GuideSection.slug` is unique; `GuidePage` has `@@unique([section_id, slug])` (`backend/prisma/schema.prisma`).
- Jest `rootDir` is `src`, so the seed-utils spec lives at `backend/src/prisma/seed-utils.spec.ts` and imports `../../prisma/seed-utils` (ts-jest transforms files outside rootDir).
- `backend/tsconfig.json` has no `include`, so `npx tsc --noEmit` also type-checks `prisma/**/*.ts`.

## File structure

Backend (new):
- `backend/src/config/env.validation.ts` — `EnvironmentVariables` class + `validate()`
- `backend/src/config/env.validation.spec.ts`
- `backend/src/config/throttler.config.ts` — `THROTTLER_CONFIG` (default/short/medium/long)
- `backend/src/common/guards/user-aware-throttler.guard.ts` + `.spec.ts`
- `backend/src/auth/refresh-secret.ts` — `resolveRefreshSecret()`
- `backend/src/auth/jwt.strategy.spec.ts`
- `backend/src/notifications/notifications.controller.spec.ts`
- `backend/src/ingredient-categories/ingredient-categories.controller.spec.ts`
- `backend/src/menu/menu.service.spec.ts` (if P1-A already created this file, ADD the tests below to it instead of overwriting)
- `backend/src/prisma/seed-utils.spec.ts`
- `backend/prisma/seed-utils.ts`, `backend/prisma/seed-reference.ts`, `backend/prisma/seed-demo.ts`
- `backend/prisma/seed-data/roles.ts`, `backend/prisma/seed-data/reference.ts`, `backend/prisma/seed-data/guide-content.ts`

Backend (modified): `app.module.ts`, `app.controller.ts`, `auth/auth.service.ts`, `auth/auth.service.spec.ts`, `auth/jwt.strategy.ts`, `types/auth.ts`, `customer-auth/customer-auth.service.ts` (+ spec), `customer-orders/customer-orders.service.ts` (+ spec), `notifications/notifications.controller.ts`, `ingredient-categories/ingredient-categories.controller.ts`, `menu/menu.service.ts`, `menu/menu.controller.ts`, `prisma/seed.ts`, `package.json`, `.env.example`.

Frontend (new): `app/global-error.tsx`, `app/(ops)/error.tsx`, `app/(public)/error.tsx`, `app/not-found.tsx`, `lib/report-error.ts`.
Frontend (modified): `app/(ops)/pos/page.tsx`, `app/(ops)/operations/menu/page.tsx`, `.env.example`.

---

### Task 1: Env validation at boot + Redis-down 503 on checkout

**Files:**
- Create: `backend/src/config/env.validation.ts`, `backend/src/config/env.validation.spec.ts`
- Modify: `backend/src/app.module.ts:59`, `backend/src/customer-orders/customer-orders.service.ts:240-272`, `backend/src/customer-orders/customer-orders.service.spec.ts:70-82`, `backend/.env.example`, `frontend/.env.example`

- [ ] **Step 1: Write the failing env-validation test**

```ts
// backend/src/config/env.validation.spec.ts
import { validate } from './env.validation';

const LONG_SECRET = 'x'.repeat(32);
const base = { DATABASE_URL: 'postgresql://u:p@h/db', JWT_SECRET: LONG_SECRET };

describe('env validation', () => {
  it('throws when DATABASE_URL is missing', () => {
    expect(() => validate({ JWT_SECRET: LONG_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('throws when JWT_SECRET is shorter than 32 chars', () => {
    expect(() => validate({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('accepts the minimal development config', () => {
    expect(() => validate({ ...base, NODE_ENV: 'development' })).not.toThrow();
  });

  it('requires the production set when NODE_ENV=production', () => {
    expect(() => validate({ ...base, NODE_ENV: 'production' })).toThrow(
      /DIRECT_DATABASE_URL[\s\S]*JWT_REFRESH_SECRET[\s\S]*R2_ENDPOINT/,
    );
  });

  it('requires both QStash signing keys when QSTASH_TOKEN is set', () => {
    expect(() =>
      validate({ ...base, NODE_ENV: 'development', QSTASH_TOKEN: 'tok' }),
    ).toThrow(/QSTASH_CURRENT_SIGNING_KEY[\s\S]*QSTASH_NEXT_SIGNING_KEY/);
  });

  it('returns the config untouched on success', () => {
    const cfg = { ...base, NODE_ENV: 'test', EXTRA: '1' };
    expect(validate(cfg)).toBe(cfg);
  });
});
```

- [ ] **Step 2: Run it, expect module-not-found**

`cd backend && npx jest src/config/env.validation.spec.ts --silent` → fails: `Cannot find module './env.validation'`.

- [ ] **Step 3: Implement the schema**

```ts
// backend/src/config/env.validation.ts
import { plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

const inProduction = (o: EnvironmentVariables) => o.NODE_ENV === 'production';
const qstashEnabled = (o: EnvironmentVariables) => !!o.QSTASH_TOKEN;

export class EnvironmentVariables {
  @IsOptional() @IsString() NODE_ENV?: string;

  // Always required
  @IsString() @IsNotEmpty() DATABASE_URL: string;
  @IsString() @MinLength(32) JWT_SECRET: string;

  // Required in production
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() DIRECT_DATABASE_URL?: string;
  @ValidateIf(inProduction) @IsString() @MinLength(32) JWT_REFRESH_SECRET?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() FRONTEND_URL?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() R2_ENDPOINT?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() R2_ACCESS_KEY_ID?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() R2_SECRET_ACCESS_KEY?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() R2_BUCKET_NAME?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() R2_PUBLIC_URL?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() UPSTASH_REDIS_URL?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() RAZORPAY_KEY_ID?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() RAZORPAY_KEY_SECRET?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() RAZORPAY_WEBHOOK_SECRET?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() WHATSAPP_TOKEN?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() WHATSAPP_PHONE_ID?: string;

  // Required together with QSTASH_TOKEN
  @IsOptional() @IsString() QSTASH_TOKEN?: string;
  @ValidateIf(qstashEnabled) @IsString() @IsNotEmpty() QSTASH_URL?: string;
  @ValidateIf(qstashEnabled) @IsString() @IsNotEmpty() QSTASH_CURRENT_SIGNING_KEY?: string;
  @ValidateIf(qstashEnabled) @IsString() @IsNotEmpty() QSTASH_NEXT_SIGNING_KEY?: string;
}

export function validate(config: Record<string, unknown>): Record<string, unknown> {
  const instance = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(instance, { skipMissingProperties: false });
  if (errors.length > 0) {
    const lines = errors.map(
      (e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
    );
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return config;
}
```

- [ ] **Step 4: Wire it and run**

In `backend/src/app.module.ts` add `import { validate } from './config/env.validation';` and change line 59 to `ConfigModule.forRoot({ isGlobal: true, validate }),`.

`cd backend && npx jest src/config/env.validation.spec.ts --silent` → 6 passed. Then `npx tsc --noEmit` → clean. Note: local `.env` files with a `JWT_SECRET` shorter than 32 chars will now fail boot; the frontend `proxy.ts` shares the same secret, so update both local `.env` files together.

- [ ] **Step 5: Write the failing Redis-503 test (and fix the suite's missing provider)**

In `backend/src/customer-orders/customer-orders.service.spec.ts`: add the import `ServiceUnavailableException` (from `@nestjs/common`). Check the service constructor: if it still injects `OrdersService`, import it from `'../orders/orders.service'`, declare `let ordersService: { deductItemIngredients: jest.Mock };`, set it in `beforeEach` to `{ deductItemIngredients: jest.fn().mockResolvedValue(undefined) }`, and add `{ provide: OrdersService, useValue: ordersService }` to the providers array. If P1-A has already switched the constructor to `FulfilmentService`, provide `{ provide: FulfilmentService, useValue: { confirmPaidOrder: jest.fn(), findOrderByRazorpayPaymentId: jest.fn().mockResolvedValue(null) } }` instead. Then add inside `describe('checkoutCart')`:

```ts
    it('throws 503 and does not create a Razorpay order when Redis drops mid-checkout', async () => {
      redisClient.get.mockResolvedValue(
        JSON.stringify({
          items: [{ menuItemId: 'm1', name: 'Burger', quantity: 1, unitPrice: 150, imageUrl: null }],
          channel: 'takeaway',
          deliveryAddressId: null,
          updatedAt: '',
        }),
      );
      prisma.menuItem.findMany.mockResolvedValue([{ id: 'm1', base_price: 150 }]);
      prisma.channelModifier.findFirst.mockResolvedValue(null);
      // First getClient() (cart read) returns a client; the second (pending-order write) returns null
      redisService.getClient.mockReturnValueOnce(redisClient).mockReturnValueOnce(null);

      await expect(service.checkoutCart(customerId)).rejects.toThrow(ServiceUnavailableException);
      expect(razorpayService.createOrder).not.toHaveBeenCalled();
    });
```

`cd backend && npx jest src/customer-orders --silent` → the new test fails (`createOrder` was called / no 503).

- [ ] **Step 6: Check Redis before creating the Razorpay order**

In `backend/src/customer-orders/customer-orders.service.ts`, add `ServiceUnavailableException` to the `@nestjs/common` import, then replace steps 9-10 (`// 9. Create Razorpay order` through the closing `}` of `if (redis) {`) with:

```ts
    // 9. Redis must be reachable BEFORE we create a Razorpay order — otherwise the
    //    pending-order record is lost and the payment can never be confirmed.
    const redis = this.redisService.getClient();
    if (!redis) {
      throw new ServiceUnavailableException(
        'Checkout is temporarily unavailable. Please try again in a moment.',
      );
    }

    // 10. Create Razorpay order
    const rzpOrder = await this.razorpayService.createOrder({
      amount: amountInPaise,
      receipt: `mkt_${customerId.slice(0, 8)}_${Date.now()}`,
      notes: { type: 'marketplace', entity_id: customerId },
    });

    // 11. Store pending order data in Redis with 30-min TTL (server-validated prices)
    const validatedItems = cart.items.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: priceMap.get(item.menuItemId)!,
      imageUrl: item.imageUrl,
    }));
    await redis.set(
      `pending_order:${rzpOrder.id}`,
      JSON.stringify({
        customerId,
        cart: { ...cart, items: validatedItems },
        subtotal,
        modifierAmount,
        total,
        channel: cart.channel,
        deliveryAddressId: cart.deliveryAddressId,
      }),
      'EX',
      PENDING_ORDER_TTL,
    );
```

Keep the existing `// 11. Return Razorpay order ID` return (renumber the comment to 12).

- [ ] **Step 7: Run, expect green**

`cd backend && npx jest src/customer-orders --silent` → all pass (including the previously unresolvable suite).

- [ ] **Step 8: Regenerate `backend/.env.example`**

Replace the file with the real variable list (every name below is read in `backend/src`; `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID` and the BullMQ comment are removed):

```dotenv
# ---- Always required (validated at boot: backend/src/config/env.validation.ts) ----
# Pooled Neon URL for app queries. Do NOT add channel_binding=require (breaks the pooler).
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require&connection_limit=5&connect_timeout=30&pool_timeout=30&statement_timeout=30000
# Access-token secret, min 32 chars. Must match frontend JWT_SECRET (proxy.ts verifies cookies).
JWT_SECRET=<64-char-random-string>

# ---- Required when NODE_ENV=production ----
DIRECT_DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
# Refresh-token secret, min 32 chars, DIFFERENT from JWT_SECRET. In development it
# defaults to "${JWT_SECRET}.refresh" with a logged warning.
JWT_REFRESH_SECRET=<64-char-random-string>
FRONTEND_URL=https://konma.store
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<key>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET_NAME=konma-evidence
R2_PUBLIC_URL=https://<bucket>.r2.dev
# Upstash Redis TCP URL (OTP, carts, pending orders). Checkout returns 503 when unreachable.
UPSTASH_REDIS_URL=rediss://default:<token>@<endpoint>.upstash.io:6379
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=

# ---- Optional integrations ----
MAILERSEND_API_KEY=<your-api-key>
MAILERSEND_FROM_EMAIL=noreply@konma.store
# EMAIL_DISABLED=true skips all outbound email (local dev)
EMAIL_DISABLED=false
PUSHER_APP_ID=<app_id>
PUSHER_KEY=<key>
PUSHER_SECRET=<secret>
PUSHER_CLUSTER=ap2
# QStash: when QSTASH_TOKEN is set, QSTASH_URL and BOTH signing keys are required.
# QSTASH_URL is this backend's public URL (QStash callback target).
QSTASH_URL=https://app.konma.store
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
# Development only: accept unsigned QStash callbacks (ignored in production).
QSTASH_ALLOW_UNSIGNED=false
# Comma-separated delivery pincodes for marketplace delivery serviceability
DELIVERY_PINCODES=560001,560002
# PRISMA_LOG=true logs every query (development only)
PRISMA_LOG=false

# ---- Server ----
PORT=4000
NODE_ENV=production
TZ=Asia/Kolkata
# Seeds: SEED_DEMO_FORCE=true lets `npm run seed:demo` run when NODE_ENV=production
SEED_DEMO_FORCE=false
```

- [ ] **Step 9: Update `frontend/.env.example`** (names verified by grep in `frontend/{app,components,hooks,lib,proxy.ts}`)

```dotenv
# API base URL (https://api.konma.store in production; set in Vercel dashboard)
NEXT_PUBLIC_API_URL=http://localhost:4000

# JWT access-token secret — must equal backend JWT_SECRET (proxy.ts verifies the access_token cookie)
JWT_SECRET=change-me-to-a-random-64-char-string

# Pusher (lib/pusher-client.ts, lib/customer-pusher-client.ts)
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=ap2

# Razorpay checkout (hooks/use-razorpay.ts) — the PUBLIC key id only
NEXT_PUBLIC_RAZORPAY_KEY_ID=

# Google Places autocomplete for delivery addresses (components/public/GooglePlacesInput.tsx)
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=
```

- [ ] **Step 10: Commit**

`git add backend/src/config backend/src/app.module.ts backend/src/customer-orders backend/.env.example frontend/.env.example && git commit -m "fix(p1b): validate env at boot, 503 checkout when Redis is down, regenerate .env.example"`

---

### Task 2: Named throttlers that actually apply, keyed by user

**Files:**
- Create: `backend/src/config/throttler.config.ts`, `backend/src/common/guards/user-aware-throttler.guard.ts`, `backend/src/common/guards/user-aware-throttler.guard.spec.ts`
- Modify: `backend/src/app.module.ts:4,60-64,118`, `backend/src/app.controller.ts:8`

- [ ] **Step 1: Write the failing tests**

```ts
// backend/src/common/guards/user-aware-throttler.guard.spec.ts
import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { UserAwareThrottlerGuard } from './user-aware-throttler.guard';
import { THROTTLER_CONFIG } from '../../config/throttler.config';
import { AuthController } from '../../auth/auth.controller';
import { AppController } from '../../app.controller';

// Exact key format from node_modules/@nestjs/throttler/dist/throttler.constants.js
const THROTTLER_LIMIT = 'THROTTLER:LIMIT';
const THROTTLER_TTL = 'THROTTLER:TTL';
const THROTTLER_SKIP = 'THROTTLER:SKIP';

function makeGuard() {
  // ctor: (options, storageService, reflector) — no side effects until onModuleInit
  return new UserAwareThrottlerGuard([] as any, {} as any, new Reflector());
}

describe('THROTTLER_CONFIG', () => {
  it('registers a throttler named "default" so @Throttle({ default }) overrides apply', () => {
    const names = THROTTLER_CONFIG.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['default', 'short', 'medium', 'long']));
  });

  it('raises the short window to 20 requests per second', () => {
    const short = THROTTLER_CONFIG.find((t) => t.name === 'short')!;
    expect(short).toMatchObject({ ttl: 1000, limit: 20 });
  });

  it('AuthController.login carries a "default" override of 5 per 5 minutes', () => {
    expect(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, AuthController.prototype.login)).toBe(5);
    expect(Reflect.getMetadata(`${THROTTLER_TTL}default`, AuthController.prototype.login)).toBe(300000);
  });

  it('health check skips every registered throttler', () => {
    for (const name of ['default', 'short', 'medium', 'long']) {
      expect(
        Reflect.getMetadata(`${THROTTLER_SKIP}${name}`, AppController.prototype.healthCheck),
      ).toBe(true);
    }
  });
});

describe('UserAwareThrottlerGuard.getTracker', () => {
  it('keys authenticated staff requests by user id', async () => {
    const req = { user: { id: 'user-1', roleCode: 'FOUNDER_ADMIN', type: 'staff' }, ip: '1.1.1.1', headers: {} };
    await expect(makeGuard()['getTracker'](req)).resolves.toBe('user:user-1');
  });

  it('keys authenticated customer requests by customer id', async () => {
    const req = { user: { customerId: 'cust-9', type: 'customer' }, ip: '1.1.1.1', headers: {} };
    await expect(makeGuard()['getTracker'](req)).resolves.toBe('user:cust-9');
  });

  it('prefers cf-connecting-ip for anonymous requests', async () => {
    const req = { ip: '10.0.0.1', headers: { 'cf-connecting-ip': '203.0.113.7' } };
    await expect(makeGuard()['getTracker'](req)).resolves.toBe('203.0.113.7');
  });

  it('falls back to req.ip when the Cloudflare header is absent', async () => {
    const req = { ip: '10.0.0.1', headers: {} };
    await expect(makeGuard()['getTracker'](req)).resolves.toBe('10.0.0.1');
  });
});
```

(If `AuthController.prototype.login` or `AppController.prototype.healthCheck` are named differently in the code, read the controllers and use the real method names.)

- [ ] **Step 2: Run, expect failure**

`cd backend && npx jest src/common/guards --silent` → `Cannot find module './user-aware-throttler.guard'`.

- [ ] **Step 3: Implement config and guard**

```ts
// backend/src/config/throttler.config.ts
import { ThrottlerOptions } from '@nestjs/throttler';

/**
 * Named throttlers. `@Throttle({ default: {...} })` overrides resolve BY NAME in
 * @nestjs/throttler 6.x, so a throttler literally named "default" must exist or
 * every per-route override in the codebase is silently ignored.
 */
export const THROTTLER_CONFIG: ThrottlerOptions[] = [
  { name: 'default', ttl: 60000, limit: 100 },
  { name: 'short', ttl: 1000, limit: 20 },
  { name: 'medium', ttl: 10000, limit: 20 },
  { name: 'long', ttl: 60000, limit: 100 },
];
```

```ts
// backend/src/common/guards/user-aware-throttler.guard.ts
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limit authenticated requests per principal (staff `user.id` or customer
 * `user.customerId` as set by JwtStrategy.validate) and anonymous requests per
 * client IP, preferring Cloudflare's `cf-connecting-ip` header.
 */
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const principalId: string | undefined =
      req.user?.id ?? req.user?.userId ?? req.user?.customerId;
    if (principalId) return `user:${principalId}`;

    const header = req.headers?.['cf-connecting-ip'];
    const cfIp = Array.isArray(header) ? header[0] : header;
    return cfIp ?? req.ip ?? 'unknown';
  }
}
```

- [ ] **Step 4: Wire into AppModule and AppController**

`backend/src/app.module.ts`: change line 4 to `import { ThrottlerModule } from '@nestjs/throttler';`, add `import { THROTTLER_CONFIG } from './config/throttler.config';` and `import { UserAwareThrottlerGuard } from './common/guards/user-aware-throttler.guard';`, replace lines 60-64 with `ThrottlerModule.forRoot(THROTTLER_CONFIG),`, and line 118 with `{ provide: APP_GUARD, useClass: UserAwareThrottlerGuard },`.

`backend/src/app.controller.ts:8`: `@SkipThrottle({ default: true, short: true, medium: true, long: true })`.

- [ ] **Step 5: Run, expect green**

`cd backend && npx jest src/common/guards src/app.controller.spec.ts --silent` → 9 passed. `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit**

`git add backend/src/config/throttler.config.ts backend/src/common/guards backend/src/app.module.ts backend/src/app.controller.ts && git commit -m "fix(p1b): register default throttler, raise short limit, key throttling by user id"`

---

### Task 3: Typed refresh tokens with a separate secret

**Files:**
- Create: `backend/src/auth/refresh-secret.ts`, `backend/src/auth/jwt.strategy.spec.ts`
- Modify: `backend/src/types/auth.ts:1-11`, `backend/src/auth/auth.service.ts`, `backend/src/auth/auth.service.spec.ts`, `backend/src/auth/jwt.strategy.ts:35-40`, `backend/src/customer-auth/customer-auth.service.ts:130-133`, `backend/src/customer-auth/customer-auth.service.spec.ts:161-164`

Decision recorded here: `JwtStrategy.validate` rejects any token whose `token_use !== 'access'`. Tokens issued before this deploy (staff 15-minute access tokens, customer 30-day tokens) lack the claim and will be rejected once, forcing one re-login/re-OTP. Accepted: the alternative (grandfathering untyped tokens) would keep legacy refresh tokens usable as access tokens for 7 days.

- [ ] **Step 1: Failing strategy test**

```ts
// backend/src/auth/jwt.strategy.spec.ts
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate', () => {
  const config = { get: jest.fn().mockReturnValue('x'.repeat(32)) } as unknown as ConfigService;
  const strategy = new JwtStrategy(config);

  it('maps a staff access token to the request user', async () => {
    await expect(
      strategy.validate({ userId: 'u1', roleCode: 'TECH_LEAD', type: 'staff', token_use: 'access' }),
    ).resolves.toEqual({ id: 'u1', roleCode: 'TECH_LEAD', type: 'staff' });
  });

  it('maps a customer access token to the request user', async () => {
    await expect(
      strategy.validate({ customerId: 'c1', type: 'customer', token_use: 'access' }),
    ).resolves.toEqual({ customerId: 'c1', type: 'customer' });
  });

  it('rejects a refresh token presented as a bearer token', async () => {
    await expect(
      strategy.validate({ userId: 'u1', roleCode: 'TECH_LEAD', type: 'staff', token_use: 'refresh' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects legacy tokens without token_use', async () => {
    await expect(
      strategy.validate({ userId: 'u1', roleCode: 'TECH_LEAD', type: 'staff' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
```

(If the `JwtStrategy` constructor takes different arguments, read `jwt.strategy.ts` and construct it accordingly.)

- [ ] **Step 2: Failing service tests** — edit `backend/src/auth/auth.service.spec.ts`:

Add imports `import { EmailService } from '../email/email.service';`. In `beforeEach`, change the jwt mock to:

```ts
    jwtService = {
      sign: jest.fn().mockReturnValue('mock-access-token'),
      verify: jest.fn().mockReturnValue({ userId: 'user-1', roleCode: 'FRONTEND_LEAD', type: 'staff', token_use: 'refresh' }),
    };
```

add `{ provide: EmailService, useValue: { sendPasswordReset: jest.fn().mockResolvedValue(undefined) } }` to providers (needed from Task 7 onward; adding it now keeps the suite compiling once `AuthService` injects it), and add these tests:

```ts
  describe('token typing', () => {
    it('signs access and refresh tokens with distinct token_use and secrets', async () => {
      prismaService.refreshToken.create.mockResolvedValue({});
      await authService.login(mockUser as any);

      expect(jwtService.sign).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ userId: 'user-1', token_use: 'access' }),
        { expiresIn: '15m' },
      );
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ userId: 'user-1', token_use: 'refresh' }),
        expect.objectContaining({ expiresIn: '7d', secret: expect.any(String) }),
      );
    });

    it('rejects an access token sent to the refresh endpoint', async () => {
      jwtService.verify.mockReturnValue({ userId: 'user-1', type: 'staff', token_use: 'access' });
      await expect(authService.refreshToken('an-access-token')).rejects.toThrow(UnauthorizedException);
      expect(prismaService.refreshToken.findFirst).not.toHaveBeenCalled();
    });

    it('rejects a refresh token that fails signature verification', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('invalid signature'); });
      await expect(authService.refreshToken('tampered')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a refresh token whose DB row belongs to a different user', async () => {
      prismaService.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-1', user_id: 'someone-else', revoked_at: null, user: { ...mockUser, id: 'someone-else' },
      });
      await expect(authService.refreshToken('valid')).rejects.toThrow(UnauthorizedException);
    });
  });
```

Also fix the existing "returns new access token for valid non-revoked refresh token" test: its `findFirst` mock must include `user: mockUser` (the service reads `storedToken.user`, not `user.findUnique`):

```ts
      prismaService.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-1', user_id: 'user-1', token_hash: tokenHash, revoked_at: null,
        expires_at: new Date(Date.now() + 86400000), user: mockUser,
      });
```

- [ ] **Step 3: Run, expect failures**

`cd backend && npx jest src/auth --silent` → strategy spec fails (no rejection), service "token typing" tests fail.

- [ ] **Step 4: Implement**

`backend/src/types/auth.ts` — add to `JwtPayload` after `type`: `token_use?: 'access' | 'refresh';`

```ts
// backend/src/auth/refresh-secret.ts
export function resolveRefreshSecret(
  get: (key: string) => string | undefined,
  logger: { warn(message: string): void },
): string {
  const explicit = get('JWT_REFRESH_SECRET');
  if (explicit) return explicit;
  if (get('NODE_ENV') === 'production') {
    throw new Error('JWT_REFRESH_SECRET is required when NODE_ENV=production');
  }
  logger.warn('JWT_REFRESH_SECRET not set — deriving it from JWT_SECRET. Do not do this in production.');
  return `${get('JWT_SECRET')}.refresh`;
}
```

`backend/src/auth/auth.service.ts`:
- Imports: add `Logger` to the `@nestjs/common` import; add `import { EmailService } from '../email/email.service';` and `import { resolveRefreshSecret } from './refresh-secret';`.
- Class head:

```ts
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.refreshSecret = resolveRefreshSecret(
      (key) => this.configService.get<string>(key),
      this.logger,
    );
  }

  private signAccess(payload: JwtPayload): string {
    return this.jwtService.sign({ ...payload, token_use: 'access' }, { expiresIn: '15m' });
  }

  private signRefresh(payload: JwtPayload): string {
    return this.jwtService.sign(
      { ...payload, token_use: 'refresh' },
      { expiresIn: '7d', secret: this.refreshSecret },
    );
  }
```

- `login()` lines 43-44 → `const accessToken = this.signAccess(payload); const refreshToken = this.signRefresh(payload);`
- `refreshToken()` — insert at the top of the method, before hashing:

```ts
    let decoded: JwtPayload;
    try {
      decoded = this.jwtService.verify<JwtPayload>(refreshTokenValue, { secret: this.refreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (decoded.token_use !== 'refresh' || decoded.type !== 'staff') {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
```

  and after `const user = storedToken.user;` add `if (storedToken.user_id !== decoded.userId) { throw new UnauthorizedException('Invalid or expired refresh token'); }`. Replace lines 117 and 120 with `this.signAccess(payload)` / `this.signRefresh(payload)`.

`backend/src/auth/jwt.strategy.ts` — add `UnauthorizedException` to the `@nestjs/common` import and make `validate`:

```ts
  async validate(payload: JwtPayload) {
    if (payload.token_use !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    if (payload.type === 'customer') {
      return { customerId: payload.customerId, type: 'customer' };
    }
    return { id: payload.userId, roleCode: payload.roleCode, type: 'staff' };
  }
```

`backend/src/customer-auth/customer-auth.service.ts:131` → `{ customerId: customer.id, type: 'customer', token_use: 'access' },` and update `customer-auth.service.spec.ts:161-164` to expect `{ customerId: 'cust-1', type: 'customer', token_use: 'access' }`.

- [ ] **Step 5: Run, expect green**

`cd backend && npx jest src/auth src/customer-auth --silent` → all pass. `npx tsc --noEmit` clean. (The frontend `proxy.ts` verifies with `JWT_SECRET` only; refresh tokens now fail there by construction and the cookie is scoped to `/auth` anyway — no frontend change.)

- [ ] **Step 6: Commit**

`git add backend/src/auth backend/src/types/auth.ts backend/src/customer-auth && git commit -m "fix(p1b): type JWTs with token_use and sign refresh tokens with JWT_REFRESH_SECRET"`

---

### Task 4: QStash webhook is 403 without a configured receiver

**Files:**
- Create: `backend/src/notifications/notifications.controller.spec.ts`
- Modify: `backend/src/notifications/notifications.controller.ts:13-15,73-81`

- [ ] **Step 1: Failing test**

```ts
// backend/src/notifications/notifications.controller.spec.ts
import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';

async function build(env: Record<string, string | undefined>) {
  const processor = { process: jest.fn().mockResolvedValue(undefined) };
  const module = await Test.createTestingModule({
    controllers: [NotificationsController],
    providers: [
      { provide: NotificationsService, useValue: {} },
      { provide: NotificationsProcessor, useValue: processor },
      { provide: ConfigService, useValue: { get: (key: string) => env[key] } },
    ],
  }).compile();
  return { controller: module.get(NotificationsController), processor };
}

const body = { jobName: 'send-email', data: { to: 'a@b.c' } };

describe('NotificationsController.handleQStashWebhook', () => {
  it('returns 403 when signing keys are not configured', async () => {
    const { controller, processor } = await build({ NODE_ENV: 'production' });
    await expect(controller.handleQStashWebhook(body, undefined as any)).rejects.toThrow(ForbiddenException);
    expect(processor.process).not.toHaveBeenCalled();
  });

  it('returns 403 in production even when QSTASH_ALLOW_UNSIGNED=true', async () => {
    const { controller } = await build({ NODE_ENV: 'production', QSTASH_ALLOW_UNSIGNED: 'true' });
    await expect(controller.handleQStashWebhook(body, undefined as any)).rejects.toThrow(ForbiddenException);
  });

  it('processes unsigned jobs only when QSTASH_ALLOW_UNSIGNED=true outside production', async () => {
    const { controller, processor } = await build({ NODE_ENV: 'development', QSTASH_ALLOW_UNSIGNED: 'true' });
    await expect(controller.handleQStashWebhook(body, undefined as any)).resolves.toEqual({ status: 'ok' });
    expect(processor.process).toHaveBeenCalledWith('send-email', { to: 'a@b.c' });
  });
});
```

(Read the controller first: use the real handler method name, constructor dependencies, and return shape; adapt the test accordingly.)

- [ ] **Step 2: Run, expect failure** — `cd backend && npx jest src/notifications/notifications.controller.spec.ts --silent` → first two tests fail (resolves with `{ status: 'ok' }`).

- [ ] **Step 3: Implement** — in `notifications.controller.ts` add `ForbiddenException` to the `@nestjs/common` import and replace lines 73-81 with:

```ts
    if (!this.receiver) {
      const allowUnsigned =
        this.config.get<string>('QSTASH_ALLOW_UNSIGNED') === 'true' &&
        this.config.get<string>('NODE_ENV') !== 'production';
      if (!allowUnsigned) {
        throw new ForbiddenException('QStash signing keys are not configured');
      }
      this.logger.warn('Processing UNSIGNED QStash webhook (QSTASH_ALLOW_UNSIGNED=true)');
    } else {
      if (!signature) throw new UnauthorizedException('Missing QStash signature');
      try {
        await this.receiver.verify({ signature, body: JSON.stringify(body) });
      } catch {
        throw new UnauthorizedException('Invalid QStash signature');
      }
    }
```

- [ ] **Step 4: Run, expect green** — same command → 3 passed.
- [ ] **Step 5: Commit** — `git add backend/src/notifications && git commit -m "fix(p1b): refuse unsigned QStash webhooks unless explicitly allowed outside production"`

---

### Task 5: Permission guard on ingredient-category writes

**Files:**
- Create: `backend/src/ingredient-categories/ingredient-categories.controller.spec.ts`
- Modify: `backend/src/ingredient-categories/ingredient-categories.controller.ts:1-3,14,19`

- [ ] **Step 1: Failing test**

```ts
// backend/src/ingredient-categories/ingredient-categories.controller.spec.ts
import 'reflect-metadata';
import { IngredientCategoriesController } from './ingredient-categories.controller';
import { REQUIRED_PERMISSION_KEY } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

describe('IngredientCategoriesController permissions', () => {
  it('requires MANAGE_INVENTORY to create', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSION_KEY, IngredientCategoriesController.prototype.create))
      .toBe(Permission.MANAGE_INVENTORY);
  });

  it('requires MANAGE_INVENTORY to delete', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSION_KEY, IngredientCategoriesController.prototype.remove))
      .toBe(Permission.MANAGE_INVENTORY);
  });

  it('leaves the list endpoint open to all staff', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSION_KEY, IngredientCategoriesController.prototype.findAll))
      .toBeUndefined();
  });
});
```

(Use the real method names from the controller.)

- [ ] **Step 2: Run, expect failure** — `cd backend && npx jest src/ingredient-categories --silent` → two tests fail (`undefined`).
- [ ] **Step 3: Implement** — add imports `import { RequiresPermission } from '../common/decorators/permissions.decorator';` and `import { Permission } from '../types/permissions';`; add `@RequiresPermission(Permission.MANAGE_INVENTORY)` directly under `@Post()` (line 14) and under `@Delete(':id')` (line 19).
- [ ] **Step 4: Run, expect green** — 3 passed.
- [ ] **Step 5: Commit** — `git add backend/src/ingredient-categories && git commit -m "fix(p1b): require MANAGE_INVENTORY for ingredient-category writes"`

---

### Task 6: Public menu never returns cost or yield

**Files:**
- Create or extend: `backend/src/menu/menu.service.spec.ts`
- Modify: `backend/src/menu/menu.service.ts:83-109`, `backend/src/menu/menu.controller.ts:64-72`, `frontend/app/(ops)/pos/page.tsx:71`, `frontend/app/(ops)/operations/menu/page.tsx:85`

- [ ] **Step 1: Failing test** (`MenuService` has exactly one dependency: `PrismaService`)

```ts
// backend/src/menu/menu.service.spec.ts  (append a new describe if the file already exists)
import { Test, TestingModule } from '@nestjs/testing';
import { MenuService } from './menu.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MenuService item queries', () => {
  let service: MenuService;
  let prisma: { menuItem: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { menuItem: { findMany: jest.fn().mockResolvedValue([]) } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [MenuService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(MenuService);
  });

  it('findItemsPublic selects only id and preparation_type from the recipe', async () => {
    await service.findItemsPublic('cat-1', 'brand-1');
    const args = prisma.menuItem.findMany.mock.calls[0][0];
    expect(args.include.recipe.select).toEqual({ id: true, preparation_type: true });
    expect(JSON.stringify(args)).not.toMatch(/computed_cost|yield_qty/);
    expect(args.where).toEqual({ category_id: 'cat-1', category: { brand_id: 'brand-1' } });
  });

  it('findItemsStaff keeps cost fields for ops screens', async () => {
    await service.findItemsStaff(undefined, 'brand-1');
    const args = prisma.menuItem.findMany.mock.calls[0][0];
    expect(args.include.recipe.select).toMatchObject({ computed_cost: true, yield_qty: true });
  });
});
```

- [ ] **Step 2: Run, expect failure** — `cd backend && npx jest src/menu --silent` → `service.findItemsPublic is not a function`.
- [ ] **Step 3: Implement** — replace `findItems` (`menu.service.ts:83-109`) with:

```ts
  private itemsQuery(categoryId?: string, brandId?: string, page?: number, limit?: number) {
    const where: Record<string, unknown> = {};
    if (categoryId) where.category_id = categoryId;
    if (brandId) where.category = { brand_id: brandId };
    const take = Math.min(Number(limit) || 50, 100);
    const skip = ((Number(page) || 1) - 1) * take;
    return { where, take, skip, orderBy: { name: 'asc' as const } };
  }

  /** Public storefront shape — never exposes cost, yield, BOM or margin fields (SPEC §8). */
  async findItemsPublic(categoryId?: string, brandId?: string, page?: number, limit?: number) {
    return this.prisma.menuItem.findMany({
      ...this.itemsQuery(categoryId, brandId, page, limit),
      include: {
        recipe: { select: { id: true, preparation_type: true } },
        category: { select: { id: true, name: true, brand_id: true } },
      },
    });
  }

  /** Staff shape — includes recipe cost and yield for menu management and POS. */
  async findItemsStaff(categoryId?: string, brandId?: string, page?: number, limit?: number) {
    return this.prisma.menuItem.findMany({
      ...this.itemsQuery(categoryId, brandId, page, limit),
      include: {
        recipe: {
          select: { id: true, name: true, computed_cost: true, yield_qty: true, preparation_type: true },
        },
        category: { select: { id: true, name: true, brand_id: true } },
      },
    });
  }
```

(Preserve whatever the existing `findItems` selected beyond these fields — e.g. `image_url`, `available`, `status` are scalar fields returned by default; if the existing include pulls additional relations used by POS, keep them in the staff shape.)

In `menu.controller.ts` replace lines 64-72 with:

```ts
  @Get('items')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async findItems(
    @Query('category_id') category_id?: string,
    @Query('brand_id') brand_id?: string,
  ) {
    return this.menuService.findItemsPublic(category_id, brand_id);
  }

  // Authenticated staff (any role) — includes recipe cost/yield for ops screens
  @Get('items/staff')
  async findItemsStaff(
    @Query('category_id') category_id?: string,
    @Query('brand_id') brand_id?: string,
  ) {
    return this.menuService.findItemsStaff(category_id, brand_id);
  }
```

Frontend: in `app/(ops)/pos/page.tsx:71` and `app/(ops)/operations/menu/page.tsx:85` change the query string to `` `/menu/items/staff?brand_id=${effectiveBrandId}` `` (the public `/menu` and `/profile` pages keep `/menu/items` and do not read `recipe`). Grep the frontend for any other `/menu/items` consumer that reads `recipe.computed_cost` and switch it to the staff route.

- [ ] **Step 4: Run, expect green** — `cd backend && npx jest src/menu --silent` → passes; `npx tsc --noEmit`; `cd frontend && npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `git add backend/src/menu "frontend/app/(ops)/pos/page.tsx" "frontend/app/(ops)/operations/menu/page.tsx" && git commit -m "fix(p1b): strip cost and yield from public menu items; add staff items route"`

---

### Task 7: Forgot-password actually sends the email

**Files:**
- Modify: `backend/src/auth/auth.service.ts:173-204`, `backend/src/auth/auth.service.spec.ts` (mocks from Task 3 step 2 already provide `EmailService`)

- [ ] **Step 1: Failing tests** — in `auth.service.spec.ts`, add `updateMany: jest.fn()` to the `passwordResetToken` mock, capture the email mock in a variable (`emailService = { sendPasswordReset: jest.fn().mockResolvedValue(undefined) }` declared alongside `jwtService` and used in the provider), import `crypto` (`import * as crypto from 'crypto';`), and add:

```ts
  describe('forgotPassword', () => {
    it('stores a hashed token and emails the raw token to the user', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
      prismaService.passwordResetToken.create.mockResolvedValue({});

      const result = await authService.forgotPassword('test@example.com');

      expect(result).toBeUndefined();
      expect(emailService.sendPasswordReset).toHaveBeenCalledTimes(1);
      const [email, token, name] = emailService.sendPasswordReset.mock.calls[0];
      expect(email).toBe('test@example.com');
      expect(name).toBe('Test User');
      expect(token).toMatch(/^[0-9a-f]{64}$/);
      const storedHash = prismaService.passwordResetToken.create.mock.calls[0][0].data.token_hash;
      expect(storedHash).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    });

    it('does nothing (and does not leak) for unknown emails', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      await expect(authService.forgotPassword('nobody@example.com')).resolves.toBeUndefined();
      expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
    });
  });
```

(Match `mockUser.email`/`name` and the `sendPasswordReset` argument order to what `users.service.ts:185` and `email.service.ts` actually use.)

- [ ] **Step 2: Run, expect failure** — `cd backend && npx jest src/auth/auth.service.spec.ts --silent` → `sendPasswordReset` not called / result not undefined.
- [ ] **Step 3: Implement** — in `auth.service.ts` replace the tail of `forgotPassword` (`return { token, userName: user.name, userEmail: user.email };`) with:

```ts
    // EmailService swallows transport failures and logs them, so the 200 response
    // in AuthController.forgotPassword is unaffected (no enumeration signal).
    await this.emailService.sendPasswordReset(user.email, token, user.name);
```

and change the method signature to `async forgotPassword(email: string): Promise<void>`. `auth.controller.ts:157-160` already returns the fixed 200 message; leave it (remove any unused variable binding of the old return value).

- [ ] **Step 4: Run, expect green** — same command → all pass.
- [ ] **Step 5: Commit** — `git add backend/src/auth && git commit -m "fix(p1b): email the password-reset link from forgot-password"`

---

### Task 8: Split seeds into prod-safe reference and guarded demo

**Files:**
- Create: `backend/prisma/seed-utils.ts`, `backend/src/prisma/seed-utils.spec.ts`, `backend/prisma/seed-data/roles.ts`, `backend/prisma/seed-data/reference.ts`, `backend/prisma/seed-data/guide-content.ts`, `backend/prisma/seed-reference.ts`, `backend/prisma/seed-demo.ts`
- Modify: `backend/prisma/seed.ts` (becomes a 20-line orchestrator), `backend/package.json:8-22,99-101`

Line map of `backend/prisma/seed.ts` as of the P1 baseline (2,317 lines, verified): 1-8 imports/client; 10-19 `RoleSeed` interface; 21-140 `ROLE_SEEDS` (8 entries, each with a `password: '<name>@konma123'` line); 142-239 `READINESS_METERS`, `ZONES`, `BRANDS`, `CHANNELS`, `UNIT_CONVERSIONS`, `INGREDIENT_CATEGORIES`, `CATEGORY_MAPPING`; 241-289 Tiptap helpers + `computeReadTime`; 291-294 `ALL_ROLES`; 300-2152 `guideSections`; 2154-2308 `main()`; 2310-2317 runner. **P1-A Task 2 edits the zones block and adds a `marketplace_fulfilment_zone_id` upsert — re-check line numbers with `grep -n` before running the sed commands below, and carry the `marketplace_fulfilment_zone_id` upsert into `seed-reference.ts` (set it to the Main Kitchen zone id).**

- [ ] **Step 1: Failing utils test**

```ts
// backend/src/prisma/seed-utils.spec.ts
import { assertDemoSeedAllowed, generatePassword, isDemoSeedAllowed } from '../../prisma/seed-utils';

describe('generatePassword', () => {
  it('returns a 24-char URL-safe string by default', () => {
    const pw = generatePassword();
    expect(pw).toHaveLength(24);
    expect(pw).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('honours a custom length and is not deterministic', () => {
    expect(generatePassword(40)).toHaveLength(40);
    expect(generatePassword()).not.toBe(generatePassword());
  });
});

describe('demo seed production guard', () => {
  it('allows outside production', () => {
    expect(isDemoSeedAllowed({ NODE_ENV: 'development' })).toBe(true);
    expect(() => assertDemoSeedAllowed({})).not.toThrow();
  });

  it('refuses in production by default', () => {
    expect(isDemoSeedAllowed({ NODE_ENV: 'production' })).toBe(false);
    expect(() => assertDemoSeedAllowed({ NODE_ENV: 'production' })).toThrow(/SEED_DEMO_FORCE/);
  });

  it('allows in production only with SEED_DEMO_FORCE=true', () => {
    expect(isDemoSeedAllowed({ NODE_ENV: 'production', SEED_DEMO_FORCE: 'true' })).toBe(true);
    expect(isDemoSeedAllowed({ NODE_ENV: 'production', SEED_DEMO_FORCE: '1' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect failure** — `cd backend && npx jest src/prisma/seed-utils.spec.ts --silent` → cannot find module.
- [ ] **Step 3: Implement utils**

```ts
// backend/prisma/seed-utils.ts
import { randomBytes } from 'crypto';

/** Random URL-safe password (base64url alphabet, unbiased). */
export function generatePassword(length = 24): string {
  return randomBytes(length).toString('base64url').slice(0, length);
}

export type SeedEnv = Record<string, string | undefined>;

export function isDemoSeedAllowed(env: SeedEnv): boolean {
  return env.NODE_ENV !== 'production' || env.SEED_DEMO_FORCE === 'true';
}

export function assertDemoSeedAllowed(env: SeedEnv): void {
  if (!isDemoSeedAllowed(env)) {
    throw new Error(
      'seed:demo refuses to run when NODE_ENV=production. Set SEED_DEMO_FORCE=true to override deliberately.',
    );
  }
}
```

`cd backend && npx jest src/prisma/seed-utils.spec.ts --silent` → 5 passed.

- [ ] **Step 4: Move data out of seed.ts with sed (no retyping)** — run from `backend/` after confirming the line ranges with `grep -n "^const guideSections\|^const READINESS_METERS\|^async function main\|^interface RoleSeed\|^// --- Tiptap" prisma/seed.ts`:

```bash
mkdir -p prisma/seed-data
# Guide helpers + ALL_ROLES + guideSections, verbatim
sed -n '241,2152p' prisma/seed.ts > prisma/seed-data/guide-content.ts
sed -i 's/^function computeReadTime/export function computeReadTime/; s/^const guideSections = \[/export const guideSections = [/' prisma/seed-data/guide-content.ts
# Reference constants, verbatim, then exported
sed -n '142,239p' prisma/seed.ts > prisma/seed-data/reference.ts
sed -i 's/^const /export const /' prisma/seed-data/reference.ts
# Role definitions WITHOUT passwords
{ printf "import { RoleCode } from '../../src/types/roles';\nimport { Permission } from '../../src/types/permissions';\n\n"; sed -n '10,140p' prisma/seed.ts; } > prisma/seed-data/roles.ts
sed -i '/^  password: string;$/d; /^    password: /d; s/^interface RoleSeed/export interface RoleSeed/; s/^const ROLE_SEEDS/export const ROLE_SEEDS/' prisma/seed-data/roles.ts
grep -c "konma123" prisma/seed-data/roles.ts   # must print 0
```

Verify: `head -3 prisma/seed-data/guide-content.ts` shows the Tiptap helpers comment; `tail -1` is `];`; `grep -n "^export const" prisma/seed-data/reference.ts` lists 7 constants. Add any imports the moved files need (e.g. `RoleCode` in guide-content for `ALL_ROLES`).

- [ ] **Step 5: Write the reference seed** (every write is an upsert or find-then-update; no `deleteMany`)

```ts
// backend/prisma/seed-reference.ts
import { PrismaClient, Prisma } from '@prisma/client';
import { ROLE_SEEDS } from './seed-data/roles';
import {
  READINESS_METERS, ZONES, BRANDS, CHANNELS, UNIT_CONVERSIONS,
  INGREDIENT_CATEGORIES, CATEGORY_MAPPING,
} from './seed-data/reference';
import { guideSections, computeReadTime } from './seed-data/guide-content';

type Tx = Prisma.TransactionClient;

export async function seedReference(prisma: PrismaClient): Promise<void> {
  console.log('[seed:reference] start');
  await prisma.$transaction(async (tx: Tx) => {
    for (const seed of ROLE_SEEDS) {
      const data = { name: seed.name, description: seed.description, permissions: seed.permissions };
      await tx.role.upsert({ where: { code: seed.code }, update: data, create: { code: seed.code, ...data } });
    }

    for (const meter of READINESS_METERS) {
      const data = { name: meter.name, description: meter.description };
      await tx.readinessMeter.upsert({ where: { code: meter.code }, update: data, create: { code: meter.code, ...data } });
    }

    // Zone/Brand/Channel have no unique on name (schema) — match by name, never reset status.
    let mainKitchenId: string | null = null;
    for (const zone of ZONES) {
      const existing = await tx.zone.findFirst({ where: { name: zone.name }, select: { id: true } });
      let id: string;
      if (existing) {
        await tx.zone.update({ where: { id: existing.id }, data: { zone_type: zone.zone_type } });
        id = existing.id;
      } else {
        id = (await tx.zone.create({ data: { name: zone.name, zone_type: zone.zone_type, status: 'planned' } })).id;
      }
      if (zone.name === 'Main Kitchen') mainKitchenId = id;
    }
    for (const brand of BRANDS) {
      const existing = await tx.brand.findFirst({ where: { name: brand.name }, select: { id: true } });
      if (existing) await tx.brand.update({ where: { id: existing.id }, data: { brand_type: brand.brand_type } });
      else await tx.brand.create({ data: brand });
    }
    for (const channel of CHANNELS) {
      const existing = await tx.channel.findFirst({ where: { name: channel.name }, select: { id: true } });
      if (existing) await tx.channel.update({ where: { id: existing.id }, data: { channel_type: channel.channel_type } });
      else await tx.channel.create({ data: channel });
    }

    for (const uc of UNIT_CONVERSIONS) {
      await tx.unitConversion.upsert({
        where: { from_unit_to_unit: { from_unit: uc.from_unit, to_unit: uc.to_unit } },
        update: { factor: uc.factor },
        create: uc,
      });
    }

    for (const cat of INGREDIENT_CATEGORIES) {
      await tx.ingredientCategory.upsert({
        where: { name: cat.name },
        update: { sort_order: cat.sort_order },
        create: { ...cat, is_default: true },
      });
    }

    // Backfill legacy string categories (unchanged from the original seed)
    const allCategories = await tx.ingredientCategory.findMany();
    const catNameToId = new Map(allCategories.map((c) => [c.name, c.id]));
    const ingredientsToUpdate = await tx.ingredient.findMany({
      where: { category_id: null, category: { not: null } },
      select: { id: true, category: true },
    });
    for (const ing of ingredientsToUpdate) {
      const mapped = CATEGORY_MAPPING[ing.category ?? ''];
      const catId = mapped ? catNameToId.get(mapped) : catNameToId.get('Dairy');
      if (catId) await tx.ingredient.update({ where: { id: ing.id }, data: { category_id: catId } });
    }

    await tx.systemSetting.upsert({
      where: { key: 'leaderboard_enabled' },
      update: {},
      create: { key: 'leaderboard_enabled', value: 'true' },
    });
    if (mainKitchenId) {
      await tx.systemSetting.upsert({
        where: { key: 'marketplace_fulfilment_zone_id' },
        update: { value: mainKitchenId },
        create: { key: 'marketplace_fulfilment_zone_id', value: mainKitchenId },
      });
    }

    for (const section of guideSections) {
      const { pages, ...sectionData } = section;
      const saved = await tx.guideSection.upsert({
        where: { slug: sectionData.slug },
        update: sectionData,
        create: sectionData,
      });
      for (const page of pages) {
        const pageData = { ...page, estimated_read_time: computeReadTime(page.content) };
        await tx.guidePage.upsert({
          where: { section_id_slug: { section_id: saved.id, slug: page.slug } },
          update: pageData,
          create: { ...pageData, section_id: saved.id },
        });
      }
    }
  }, { timeout: 60000 });

  console.log(
    `[seed:reference] done — ${ROLE_SEEDS.length} roles, ${READINESS_METERS.length} meters, ` +
      `${ZONES.length} zones, ${BRANDS.length} brands, ${CHANNELS.length} channels, ` +
      `${UNIT_CONVERSIONS.length} unit conversions, ${INGREDIENT_CATEGORIES.length} categories, ` +
      `${guideSections.length} guide sections`,
  );
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedReference(prisma)
    .catch((e) => { console.error('[seed:reference] failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
```

(Match the exact field names the original `main()` used for meters, brands, channels, categories and guide pages — read `seed.ts` lines 2154-2308 and keep the same data shapes.)

- [ ] **Step 6: Write the demo seed**

```ts
// backend/prisma/seed-demo.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ROLE_SEEDS } from './seed-data/roles';
import { assertDemoSeedAllowed, generatePassword } from './seed-utils';

const BCRYPT_ROUNDS = 12;

export async function seedDemo(prisma: PrismaClient): Promise<void> {
  assertDemoSeedAllowed(process.env);
  console.log('[seed:demo] start');

  const issued: Array<{ email: string; role: string; password: string }> = [];

  for (const seed of ROLE_SEEDS) {
    const role = await prisma.role.findUnique({ where: { code: seed.code }, select: { id: true } });
    if (!role) throw new Error(`[seed:demo] role ${seed.code} missing — run "npm run seed:reference" first`);

    const existing = await prisma.user.findUnique({ where: { email: seed.userEmail }, select: { id: true } });
    if (existing) {
      // Never reset an existing user's password on re-run.
      await prisma.user.update({
        where: { id: existing.id },
        data: { name: seed.userName, role_id: role.id, function: seed.functionDomain },
      });
      continue;
    }

    const password = generatePassword();
    await prisma.user.create({
      data: {
        name: seed.userName,
        email: seed.userEmail,
        password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        role_id: role.id,
        function: seed.functionDomain,
        status: 'active',
      },
    });
    issued.push({ email: seed.userEmail, role: seed.code, password });
  }

  if (issued.length === 0) {
    console.log('[seed:demo] all demo users already exist — no passwords issued');
    return;
  }
  console.log('[seed:demo] NEW demo credentials (shown once, never stored in plaintext):');
  for (const row of issued) console.log(`  ${row.role.padEnd(22)} ${row.email.padEnd(28)} ${row.password}`);
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedDemo(prisma)
    .catch((e) => { console.error('[seed:demo] failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
```

(Match the `User` field names in `schema.prisma` — e.g. `password_hash`, `role_id`, `function`, `status`.)

- [ ] **Step 7: Replace `backend/prisma/seed.ts` with the orchestrator**

```ts
// backend/prisma/seed.ts — `prisma db seed` entrypoint: reference always, demo only where allowed
import { PrismaClient } from '@prisma/client';
import { seedReference } from './seed-reference';
import { seedDemo } from './seed-demo';
import { isDemoSeedAllowed } from './seed-utils';

const prisma = new PrismaClient();

async function main() {
  await seedReference(prisma);
  if (isDemoSeedAllowed(process.env)) {
    await seedDemo(prisma);
  } else {
    console.log('[seed] NODE_ENV=production — skipping demo users (set SEED_DEMO_FORCE=true to force)');
  }
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
```

`grep -rn "konma123" backend/prisma` → no matches.

- [ ] **Step 8: package.json scripts** — in `backend/package.json` add to `scripts`:

```json
    "seed:reference": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed-reference.ts",
    "seed:demo": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed-demo.ts",
```

(`prisma.seed` keeps pointing at `prisma/seed.ts`.)

- [ ] **Step 9: Verify** — `cd backend && npx tsc --noEmit` (tsconfig covers `prisma/`), `npx jest src/prisma --silent`, and against a local database: `npm run seed:reference && npm run seed:reference` (second run must succeed with no deletes), then `npm run seed:demo` (prints 8 passwords), then `npm run seed:demo` again (prints "all demo users already exist"), then `NODE_ENV=production npm run seed:demo` → exits 1 with the SEED_DEMO_FORCE message.
- [ ] **Step 10: Commit** — `git add backend/prisma backend/src/prisma backend/package.json && git commit -m "fix(p1b): split seeds into prod-safe reference and guarded demo with random passwords"`

---

### Task 9: Frontend error boundaries and not-found

**Files:**
- Create: `frontend/lib/report-error.ts`, `frontend/app/global-error.tsx`, `frontend/app/(ops)/error.tsx`, `frontend/app/(public)/error.tsx`, `frontend/app/not-found.tsx`

Next 16.2 contract (from `frontend/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`): error files are client components receiving `{ error: Error & { digest?: string }, unstable_retry: () => void }`; `global-error.tsx` replaces the root layout and must render `<html>`/`<body>` and import its own styles; `not-found.tsx` renders for `notFound()` and unmatched routes under the root layout. The existing `components/ops/ErrorBoundary.tsx` inside `(ops)/layout.tsx` stays; route-level files additionally cover server-component and layout errors.

- [ ] **Step 1: Report seam**

```ts
// frontend/lib/report-error.ts
/** Single place to forward runtime errors. Sentry lands here in a later phase. */
export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
  console.error('[report-error]', error, context);
}
```

- [ ] **Step 2: Segment boundaries**

```tsx
// frontend/app/(ops)/error.tsx
'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportError } from '@/lib/report-error';

export default function OpsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: 'ops', digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <AlertCircle className="size-10 text-destructive" />
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">This page hit an error</h2>
          <p className="text-sm text-muted-foreground">
            Your work elsewhere is safe. Try again, or go back to the dashboard.
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => unstable_retry()}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.assign('/dashboard')}>
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
```

`frontend/app/(public)/error.tsx` is identical except: component name `PublicError`, boundary `'public'`, heading "Something went wrong", the secondary button label "Back to menu" navigating to `/menu`.

- [ ] **Step 3: Global boundary (replaces the root layout, so it owns `<html>`/`<body>` and styles)**

```tsx
// frontend/app/global-error.tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { reportError } from '@/lib/report-error';
import './globals.css';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: 'global', digest: error.digest });
  }, [error]);

  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="flex min-h-full items-center justify-center bg-background font-sans text-foreground">
        <div className="flex max-w-md flex-col items-center gap-4 px-6 text-center">
          <h1 className="text-xl font-semibold">Konma Xperience hit an unexpected error</h1>
          <p className="text-sm text-muted-foreground">
            Reload to continue. If it keeps happening, tell the tech lead and quote the reference below.
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
          )}
          <Button onClick={() => unstable_retry()}>Try again</Button>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Not found**

```tsx
// frontend/app/not-found.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="text-xl font-semibold">We could not find that page</h1>
        <p className="text-sm text-muted-foreground">It may have moved, or the link was mistyped.</p>
        <div className="flex gap-2">
          <Button render={<Link href="/" />}>Home</Button>
          <Button variant="outline" render={<Link href="/dashboard" />}>Dashboard</Button>
        </div>
      </div>
    </div>
  );
}
```

(`render={<Link … />}` is the existing base-ui pattern in `app/(ops)/missions/page.tsx`; if the project's `Button` uses a different composition prop, follow that.)

- [ ] **Step 5: Verify** — `cd frontend && npx tsc --noEmit && npm run lint`. Manual: `npm run dev`, visit `/this-does-not-exist` (404 page), then temporarily add `throw new Error('boom')` at the top of `app/(ops)/dashboard/page.tsx`, load `/dashboard`, confirm the ops boundary renders and "Try again" works, remove the throw, and confirm `git status` shows only the five new files.
- [ ] **Step 6: Commit** — `git add frontend/lib/report-error.ts frontend/app/global-error.tsx "frontend/app/(ops)/error.tsx" "frontend/app/(public)/error.tsx" frontend/app/not-found.tsx && git commit -m "fix(p1b): add route-level error boundaries, global error page and not-found"`

---

### Task 10: Final verification

- [ ] `cd backend && npx jest --silent src/config src/common/guards src/auth src/customer-auth src/notifications src/ingredient-categories src/menu src/customer-orders src/prisma src/app.controller.spec.ts` → all green.
- [ ] `cd backend && npx jest --silent` → every suite green (no suite may regress).
- [ ] `cd backend && npx tsc --noEmit` → clean (covers `prisma/**`).
- [ ] `cd backend && npx eslint "src/**/*.ts" "prisma/**/*.ts"` (no `--fix`) → no errors.
- [ ] `cd frontend && npx tsc --noEmit && npm run lint` → clean.
- [ ] `grep -rn "konma123" backend/` → nothing; `grep -rn "NEXT_PUBLIC_RAZORPAY_KEY_ID\|WHATSAPP_BUSINESS_ACCOUNT_ID\|BullMQ" backend/.env.example` → nothing.
- [ ] Boot smoke: `cd backend && JWT_SECRET=short npm run start` must exit with `Invalid environment configuration: - JWT_SECRET: …`; with a valid `.env` the log shows the `JWT_REFRESH_SECRET not set` warning only when the var is absent.
- [ ] HTTP smoke (local): `curl -s -o /dev/null -w '%{http_code}' -X POST localhost:4000/notifications/qstash-webhook -H 'content-type: application/json' -d '{}'` → `403` when signing keys are unset and `QSTASH_ALLOW_UNSIGNED` is not `true`; `curl -si localhost:4000/ | grep -i x-ratelimit` → no rate-limit headers (health skips all throttlers); `curl -s localhost:4000/menu/items | grep -c computed_cost` → `0`.
- [ ] `git log --oneline -9` shows nine `fix(p1b):` commits.

## Self-review

**Defect → task coverage:** 1 throttler → Task 2; 2 refresh tokens → Task 3; 3 QStash → Task 4; 4 ingredient-categories → Task 5; 5 public menu → Task 6; 6 env validation + Redis 503 + `.env.example` files → Task 1; 7 seed safety → Task 8; 8 error boundaries → Task 9; 9 forgot-password email → Task 7. Final gates → Task 10.

**Placeholder scan:** no "TBD"/"similar to"/"fill in" steps; every test lists every constructor dependency (`AuthService`: Prisma, Jwt, Config, Email; `CustomerOrdersService`: Prisma, Redis, Razorpay, Pusher, Orders-or-Fulfilment; `NotificationsController`: NotificationsService, NotificationsProcessor, ConfigService; `MenuService`: Prisma). The only non-code step is the sed-based file move in Task 8 step 4, which is deliberate (1,900 lines copied verbatim).

**Name consistency:** `validate` (env.validation.ts) ↔ `ConfigModule.forRoot({ isGlobal: true, validate })`; `THROTTLER_CONFIG` ↔ `ThrottlerModule.forRoot(THROTTLER_CONFIG)`; `UserAwareThrottlerGuard` ↔ `APP_GUARD`; `resolveRefreshSecret` ↔ `AuthService` constructor; `signAccess`/`signRefresh` used in both `login` and `refreshToken`; `findItemsPublic`/`findItemsStaff` ↔ controller + spec; `/menu/items/staff` ↔ both ops pages; `seedReference`/`seedDemo`/`isDemoSeedAllowed`/`assertDemoSeedAllowed`/`generatePassword` ↔ seed.ts, seed-demo.ts, spec; `reportError` ↔ all three error files; `token_use` ↔ `JwtPayload`, `JwtStrategy`, `AuthService`, `CustomerAuthService` and both specs.
