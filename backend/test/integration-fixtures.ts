/**
 * The smallest set of rows the money path needs, written straight through
 * Prisma rather than through the seed scripts.
 *
 * `seed-reference.ts` and `seed-demo.ts` exist and work, but they write roles,
 * modules, settings and a demo catalog — hundreds of rows whose content would
 * become an invisible input to every assertion below. An integration spec that
 * asserts "the loyalty balance is 400" has to own the 500 it started from.
 *
 * Every helper is additive and returns the ids it created; nothing here reads
 * `SystemSetting`, so `SettingsService` answers from `SETTING_DEFAULTS`.
 */
import {
  CouponStatus,
  CouponType,
  EvidenceType,
  FulfilmentType,
  MissionScope,
  MissionStatus,
  ProductStatus,
  ProductType,
  TaskDomain,
} from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { DEFAULT_NODE_ID } from '../src/node/node.constants';

/** Every `node_id` column carries this as a Prisma-level `@default`. */
export const TEST_NODE_ID = DEFAULT_NODE_ID;

/**
 * The one node, plus the production kitchen `resolveMarketplaceZoneId` falls
 * back to when `SystemSetting['marketplace_fulfilment_zone_id']` is absent.
 */
export async function seedNode(prisma: PrismaService): Promise<{
  nodeId: string;
  zoneId: string;
}> {
  const node = await prisma.node.create({
    data: {
      id: TEST_NODE_ID,
      code: 'KX-TEST-1',
      name: 'Integration Node',
    },
  });
  const zone = await prisma.zone.create({
    data: { node_id: node.id, name: 'Main Kitchen', zone_type: 'kitchen' },
  });
  return { nodeId: node.id, zoneId: zone.id };
}

export interface SeededCatalog {
  brandId: string;
  categoryId: string;
  productId: string;
}

/**
 * One brand → one category → one **shipped** product. Shipped on purpose: it
 * keeps `applyPrepTypeOnCreate` out of the transaction (no recipe, no BOM, no
 * prep batch), so the confirm specs assert the commercial writes and nothing
 * else. `base_price` is in rupees, as the column is.
 */
export async function seedCatalog(
  prisma: PrismaService,
  opts: { basePrice?: string; taxRate?: string } = {},
): Promise<SeededCatalog> {
  const brand = await prisma.brand.create({
    data: { name: 'Integration Brand', brand_type: 'food' },
  });
  const category = await prisma.productCategory.create({
    data: {
      brand_id: brand.id,
      name: 'Pantry',
      slug: 'pantry',
      product_types: [ProductType.packaged],
    },
  });
  const product = await prisma.product.create({
    data: {
      brand_id: brand.id,
      category_id: category.id,
      type: ProductType.packaged,
      name: 'Cold Brew Concentrate',
      slug: 'cold-brew-concentrate',
      base_price: opts.basePrice ?? '500.00',
      tax_rate: opts.taxRate ?? '5.00',
      fulfilment: FulfilmentType.shipped,
      weight_grams: 500,
      status: ProductStatus.active,
    },
  });
  return {
    brandId: brand.id,
    categoryId: category.id,
    productId: product.id,
  };
}

export interface SeededCustomer {
  customerId: string;
  addressId: string;
}

/**
 * A customer with one address and, when `points` is given, a loyalty account
 * already carrying a balance — the state a returning buyer is in when they
 * redeem at checkout.
 */
export async function seedCustomer(
  prisma: PrismaService,
  opts: { phone?: string; points?: number } = {},
): Promise<SeededCustomer> {
  const customer = await prisma.customer.create({
    data: {
      phone: opts.phone ?? '9000000001',
      name: 'Integration Customer',
      email: 'integration.customer@example.test',
    },
  });
  const address = await prisma.customerAddress.create({
    data: {
      customer_id: customer.id,
      label: 'Home',
      address: '12 Test Street',
      landmark: 'Near the harness',
      pincode: '600096',
      is_default: true,
    },
  });
  if (opts.points !== undefined) {
    await prisma.loyaltyAccount.create({
      data: {
        customer_id: customer.id,
        points_balance: opts.points,
        lifetime_points: opts.points,
      },
    });
  }
  return { customerId: customer.id, addressId: address.id };
}

/** An active percent coupon, open now. */
export async function seedCoupon(
  prisma: PrismaService,
  opts: { code?: string; percent?: string } = {},
): Promise<{ couponId: string; code: string }> {
  const now = Date.now();
  const coupon = await prisma.coupon.create({
    data: {
      code: opts.code ?? 'INTEG10',
      type: CouponType.percent,
      value: opts.percent ?? '10.00',
      starts_at: new Date(now - 60 * 60 * 1000),
      ends_at: new Date(now + 24 * 60 * 60 * 1000),
      status: CouponStatus.active,
    },
  });
  return { couponId: coupon.id, code: coupon.code };
}

export interface SeededStaff {
  roleId: string;
  userId: string;
  missionId: string;
  taskId: string;
  evidenceId: string;
}

/**
 * The staff spine the two P6 `CHECK` constraints hang off: a signer for
 * `DailyClose.signed_by` and a piece of `Evidence` for a review suggestion to
 * point at. Role → User → Mission → Task → Evidence, one row each.
 */
export async function seedStaff(prisma: PrismaService): Promise<SeededStaff> {
  const role = await prisma.role.create({
    data: {
      code: 'INTEG_LEAD',
      name: 'Integration Lead',
      description: 'Harness-only role',
      permissions: ['MANAGE_OPS'],
    },
  });
  const user = await prisma.user.create({
    data: {
      name: 'Integration Lead',
      email: 'integration.lead@example.test',
      password_hash: 'not-a-real-hash',
      role_id: role.id,
      function: 'ops',
    },
  });
  const mission = await prisma.mission.create({
    data: {
      title: 'Integration Mission',
      description: 'Harness-only mission',
      scope: MissionScope.food,
      status: MissionStatus.active,
      start_date: new Date(),
      created_by: user.id,
    },
  });
  const task = await prisma.task.create({
    data: {
      mission_id: mission.id,
      title: 'Integration Task',
      description: 'Harness-only task',
      domain: TaskDomain.ops,
      owner_user_id: user.id,
      created_by: user.id,
    },
  });
  const evidence = await prisma.evidence.create({
    data: {
      task_id: task.id,
      uploaded_by: user.id,
      type: EvidenceType.note,
      url: 'https://example.test/evidence',
      notes: 'Harness-only evidence',
    },
  });
  return {
    roleId: role.id,
    userId: user.id,
    missionId: mission.id,
    taskId: task.id,
    evidenceId: evidence.id,
  };
}
