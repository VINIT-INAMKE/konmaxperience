import { Injectable } from '@nestjs/common';
import {
  FulfilmentType,
  OrderChannel,
  Prisma,
  ProductStatus,
  StockMode,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import type { ProductAvailability } from '../catalog/catalog.service';
import {
  clampPaise,
  inclusiveTaxPaise,
  percentOfPaise,
  sumPaise,
  toPaise,
  type Paise,
} from '../common/money/money';
import type {
  FulfilmentGroups,
  PricedCart,
  PricedLine,
  RejectedLine,
  TaxBucket,
} from './quote.types';

/**
 * The Redis cart line shape (`CustomerOrdersService.CartData['items'][number]`).
 *
 * `name`, `unitPrice` and `imageUrl` are whatever the client last cached. They
 * are read for error messages only — never for money (`CHK-01`).
 */
export interface CartLineInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  name?: string;
  unitPrice?: number;
  imageUrl?: string | null;
}

/** `clampPaise` needs an upper bound; "no cap" is the integer domain itself. */
const NO_CAP: Paise = Number.MAX_SAFE_INTEGER;

/** A channel price modifier as `ChannelModifier` stores it (`modifier_type` is a String column). */
interface ChannelModifierRow {
  modifier_type: string;
  modifier_value: Prisma.Decimal | number | string;
}

/** The product columns pricing reads. Structural so a mocked row satisfies it. */
interface PricedProduct {
  id: string;
  name: string;
  type: PricedLine['type'];
  fulfilment: FulfilmentType;
  stock_mode: StockMode;
  status: ProductStatus;
  base_price: Prisma.Decimal | number | string;
  tax_rate: Prisma.Decimal | number | string;
  weight_grams: number | null;
  hsn_code: string | null;
  event_id: string | null;
  variants: PricedVariant[];
}

interface PricedVariant {
  id: string;
  name: string;
  sku: string | null;
  price_delta: Prisma.Decimal | number | string;
  stock_on_hand: Prisma.Decimal | number | string;
  is_default: boolean;
  status: ProductStatus;
}

/**
 * Splits already-priced lines by `OrderItem.fulfilment`.
 *
 * A mixed cart is one order with three routes: `local` lines go to the kitchen,
 * `shipped` lines to a single `Shipment`, `booking` lines to their
 * `EventBooking`. Confirm-time code groups the *frozen* lines rather than
 * re-reading `Product.fulfilment`, so a catalog edit between quote and confirm
 * cannot silently re-route a paid line (decision 6).
 */
export function groupLinesByFulfilment(
  lines: readonly PricedLine[],
): FulfilmentGroups {
  const groups: FulfilmentGroups = { local: [], shipped: [], booking: [] };
  for (const line of lines) groups[line.fulfilment].push(line);
  return groups;
}

@Injectable()
export class CartPricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  /**
   * CHK-01: re-prices every line from the database and re-checks availability per
   * product type (SPEC §3.3). Client-sent prices are never trusted; unavailable
   * lines are collected in `rejected` and excluded from every total.
   *
   * GST is inclusive (decision 1): `gross` already contains `tax`, so `tax` is
   * carved out per line at that line's own `Product.tax_rate` and grouped into
   * `tax_breakup`. It is reported, never added.
   */
  async price(
    items: CartLineInput[],
    channel: OrderChannel,
  ): Promise<PricedCart> {
    const productIds = [...new Set(items.map((i) => i.productId))];
    const products: PricedProduct[] = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            name: true,
            type: true,
            fulfilment: true,
            stock_mode: true,
            status: true,
            base_price: true,
            tax_rate: true,
            weight_grams: true,
            hsn_code: true,
            event_id: true,
            variants: {
              select: {
                id: true,
                name: true,
                sku: true,
                price_delta: true,
                stock_on_hand: true,
                is_default: true,
                status: true,
              },
            },
          },
        })
      : [];
    const byId = new Map(products.map((p) => [p.id, p]));

    // One availability pass for every product in the cart (batched inside CatalogService).
    const availability = await this.resolveAvailability(products);

    const modifier: ChannelModifierRow | null =
      await this.prisma.channelModifier.findFirst({
        where: { channel, status: 'active' },
      });

    const lines: PricedLine[] = [];
    const rejected: RejectedLine[] = [];
    let channelModifierTotal: Paise = 0;

    for (const item of items) {
      const product = byId.get(item.productId);
      const variantId = item.variantId ?? null;
      if (!product || product.status !== ProductStatus.active) {
        rejected.push({
          product_id: item.productId,
          variant_id: variantId,
          name: item.name ?? item.productId,
          reason: 'No longer available',
        });
        continue;
      }

      // A fractional or non-positive quantity would poison every integer-paise
      // assertion downstream, so it is a rejected line, not a 500.
      const quantity = item.quantity;
      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        rejected.push({
          product_id: product.id,
          variant_id: variantId,
          name: product.name,
          reason: 'Invalid quantity',
        });
        continue;
      }

      const variant = this.selectVariant(product, variantId);
      if (variantId && !variant) {
        rejected.push({
          product_id: product.id,
          variant_id: variantId,
          name: product.name,
          reason: 'Selected option is no longer available',
        });
        continue;
      }

      const reason = this.availabilityReason(
        product,
        variant,
        quantity,
        availability.get(product.id),
      );
      if (reason) {
        rejected.push({
          product_id: product.id,
          variant_id: variant?.id ?? null,
          name: product.name,
          reason,
        });
        continue;
      }

      const base = toPaise(product.base_price);
      const delta = variant ? toPaise(variant.price_delta) : 0;
      const beforeModifier = base + delta;
      const perUnitModifier = this.perUnitModifier(beforeModifier, modifier);
      // A `fixed` modifier can be negative (a channel discount); a line never
      // costs less than nothing.
      const unitPrice = clampPaise(beforeModifier + perUnitModifier, 0, NO_CAP);
      const gross = unitPrice * quantity;
      const rate = new Prisma.Decimal(product.tax_rate).toFixed(2);
      channelModifierTotal += (unitPrice - beforeModifier) * quantity;

      lines.push({
        product_id: product.id,
        variant_id: variant?.id ?? null,
        name: variant ? `${product.name} — ${variant.name}` : product.name,
        sku: variant?.sku ?? null,
        quantity,
        type: product.type,
        fulfilment: product.fulfilment, // decision 6
        unit_price: unitPrice,
        gross,
        tax_rate: rate,
        tax: inclusiveTaxPaise(gross, rate),
        weight_grams: product.weight_grams ?? 0,
        hsn_code: product.hsn_code,
        available: true,
        unavailable_reason: null,
        event_id: product.event_id,
      });
    }

    const subtotal = sumPaise(lines.map((l) => l.gross));
    const taxTotal = sumPaise(lines.map((l) => l.tax));

    const byRate = new Map<string, TaxBucket>();
    for (const line of lines) {
      const bucket = byRate.get(line.tax_rate) ?? {
        rate: line.tax_rate,
        taxable: 0,
        tax: 0,
      };
      bucket.taxable += line.gross - line.tax;
      bucket.tax += line.tax;
      byRate.set(line.tax_rate, bucket);
    }

    let shippedWeightGrams = 0;
    for (const line of lines) {
      if (line.fulfilment === FulfilmentType.shipped) {
        shippedWeightGrams += line.weight_grams * line.quantity;
      }
    }

    return {
      lines,
      subtotal,
      tax_total: taxTotal,
      tax_breakup: [...byRate.values()],
      channel,
      channel_modifier: channelModifierTotal,
      has_local: lines.some((l) => l.fulfilment === FulfilmentType.local),
      has_shipped: lines.some((l) => l.fulfilment === FulfilmentType.shipped),
      has_booking: lines.some((l) => l.fulfilment === FulfilmentType.booking),
      shipped_weight_grams: shippedWeightGrams,
      rejected,
    };
  }

  /**
   * The variant a line is priced against: the one the client picked, otherwise
   * the product's default, otherwise the first active one. A product with no
   * active variants prices on `base_price` alone.
   */
  private selectVariant(
    product: PricedProduct,
    variantId: string | null,
  ): PricedVariant | null {
    const active = (product.variants ?? []).filter(
      (v) => v.status === ProductStatus.active,
    );
    if (variantId) return active.find((v) => v.id === variantId) ?? null;
    return active.find((v) => v.is_default) ?? active[0] ?? null;
  }

  /** `fixed` modifiers apply once per unit; `percentage` scales the unit price. */
  private perUnitModifier(
    unitBase: Paise,
    modifier: ChannelModifierRow | null,
  ): Paise {
    if (!modifier) return 0;
    if (modifier.modifier_type === 'percentage')
      return percentOfPaise(unitBase, modifier.modifier_value);
    if (modifier.modifier_type === 'fixed')
      return toPaise(modifier.modifier_value);
    return 0;
  }

  /**
   * Availability for every cart product, reusing `CatalogService` rather than
   * re-deriving the rules (SPEC §3.3 lives there).
   *
   * `tracked` products answer from variant stock and need no catalog call.
   * Everything else reads the batched pass, which covers the recipe-backed
   * types; a `capacity` product (an experience) is absent from that map and
   * gets a single-product call. A call that throws — the product vanished
   * mid-quote — fails closed as sold out rather than selling an unknown.
   */
  private async resolveAvailability(
    products: PricedProduct[],
  ): Promise<Map<string, ProductAvailability>> {
    const resolved = new Map<string, ProductAvailability>();
    const needed = products.filter(
      (p) =>
        p.status === ProductStatus.active && p.stock_mode !== StockMode.tracked,
    );
    if (needed.length === 0) return resolved;

    const batch = (await this.catalog.getAllServingsAvailable()) ?? {};
    const missing: PricedProduct[] = [];
    for (const product of needed) {
      const hit = batch[product.id];
      if (hit) resolved.set(product.id, hit);
      else missing.push(product);
    }

    const extra = await Promise.all(
      missing.map(async (product) => {
        try {
          return [
            product.id,
            await this.catalog.getServingsAvailable(product.id),
          ] as const;
        } catch {
          return [
            product.id,
            {
              available: false,
              servings_remaining: 0,
              preparation_type: 'unknown',
            } satisfies ProductAvailability,
          ] as const;
        }
      }),
    );
    for (const [id, value] of extra) resolved.set(id, value);
    return resolved;
  }

  /** SPEC §3.3 availability per product type; `null` means the line is sellable. */
  private availabilityReason(
    product: Pick<PricedProduct, 'stock_mode'>,
    variant: Pick<PricedVariant, 'stock_on_hand'> | null,
    quantity: number,
    servings?: ProductAvailability,
  ): string | null {
    if (product.stock_mode === StockMode.tracked) {
      const onHand = variant ? Math.floor(Number(variant.stock_on_hand)) : 0;
      return onHand >= quantity ? null : `Only ${Math.max(onHand, 0)} left`;
    }
    if (!servings) return null; // no availability record -> treat as sellable
    if (!servings.available) return 'Sold out';
    return servings.servings_remaining >= quantity
      ? null
      : `Only ${servings.servings_remaining} left`;
  }
}
