import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BookingStatus,
  FulfilmentType,
  OrderChannel,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../customer-auth/redis.service';
import { SettingsService } from '../settings/settings.service';
import { CouponsService } from '../promotions/coupons.service';
import { LoyaltyService, type RedeemPreview } from '../loyalty/loyalty.service';
import { ShippingProviderResolver } from '../shipping/shipping-provider.resolver';
import { hasPrismaCode } from '../common/utils/transaction-retry';
import { toDecimal, type Paise } from '../common/money/money';
import { CartPricingService, type CartLineInput } from './cart-pricing.service';
import { ServiceabilityService } from './serviceability.service';
import type {
  PricedLine,
  QuoteCoupon,
  QuoteHold,
  QuoteShipping,
  RejectedLine,
  StoredQuote,
} from './quote.types';
import { QuoteCheckoutDto } from './dto/quote-checkout.dto';
import { ServiceabilityDto } from './dto/serviceability.dto';

/** The address columns a quote needs: the id it freezes and the pincode it checks. */
export interface QuoteAddress {
  id: string;
  pincode: string;
}

/**
 * What `CheckoutService.quote` hands its caller.
 *
 * `quote` is *exactly* the artefact written to Redis — `StoredQuote` is frozen
 * by Task 5 and Task 9 re-reads it verbatim, so nothing extra may be smuggled
 * into it. The other two members are presentation-only: `rejected` is the
 * "these did not make it" list the storefront shows next to the cart, and
 * `loyalty` carries the balance/tier/cap context that the *stored* quote has no
 * reason to freeze (only the applied points and their value are money).
 */
export interface QuoteResult {
  quote: StoredQuote;
  rejected: RejectedLine[];
  loyalty: RedeemPreview;
}

/** One half of a serviceability answer: local delivery, or courier. */
export interface ServiceabilityHalf {
  serviceable: boolean;
  /** Present only when `serviceable` is false; rendered to the customer verbatim. */
  reason?: string;
  courier_name?: string;
  /** ISO-8601 estimated delivery date, when the provider offers one. */
  etd?: string;
  /**
   * Indicative forward shipping charge. `Prisma.Decimal` in paise-derived
   * rupees, serialised to a JSON number by `DecimalSerializationInterceptor` —
   * the same treatment `QuoteResponse.shipping_amount` gets.
   */
  amount?: Prisma.Decimal;
}

/**
 * `POST /customer/checkout/serviceability`. `shipped` is `null` when the cart
 * holds no shipped line — not `{ serviceable: false }`, which would read as
 * "we cannot ship there".
 */
export interface ServiceabilityResponse {
  local: ServiceabilityHalf;
  shipped: ServiceabilityHalf | null;
}

/**
 * `CHK-02` — the single composition point of the P5a checkout.
 *
 * One method calls, in order: re-price (Task 5) → local serviceability (Task 5)
 * → courier serviceability and rate (Task 3) → coupon (Task 6) → loyalty
 * preview (Task 7) → booking holds → Redis. Nothing downstream recomputes any
 * of it: `POST /customer/orders` copies the frozen numbers into
 * `pending_order:{rzp_order_id}` and the confirm transaction replays them
 * (plan decision 4). That is the whole defence against price drift between the
 * moment a customer sees a total and the moment they pay it.
 *
 * **Every money value in here is integer paise.** Rupees appear once, in
 * {@link toQuoteResponse}, on the way to the wire.
 */
@Injectable()
export class CheckoutService {
  /** 15 minutes — the quote TTL *and* the booking hold window (SPEC §5.2). */
  static readonly QUOTE_TTL_SECONDS = 900;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
    private readonly pricing: CartPricingService,
    private readonly serviceability: ServiceabilityService,
    private readonly coupons: CouponsService,
    private readonly loyalty: LoyaltyService,
    private readonly shipping: ShippingProviderResolver,
  ) {}

  /** Redis key of a stored quote. Task 9 reads the same key through {@link readQuote}. */
  quoteKey(customerId: string, quoteId: string): string {
    return `quote:${customerId}:${quoteId}`;
  }

  /**
   * Prices a cart into a stored, expiring quote.
   *
   * Ordering is deliberate and load-bearing:
   * 1. **Redis first.** A quote that cannot be stored must not create booking
   *    holds or bill a courier lookup, so the connection is asserted before any
   *    side effect — the same fail-closed rule `checkoutCart` already applies.
   * 2. **Shipping before coupon**, because a `free_shipping` coupon zeroes a
   *    rate that must already have been fetched.
   * 3. **Coupon before loyalty**, because `max_redeem_percent` is a share of the
   *    *discounted* subtotal.
   * 4. **Holds last**, so a failure anywhere above leaves no orphan `held` row.
   */
  async quote(
    customerId: string,
    cart: CartLineInput[],
    dto: QuoteCheckoutDto,
  ): Promise<QuoteResult> {
    const redis = this.requireRedis();
    if (cart.length === 0) throw new BadRequestException('Cart is empty');

    const priced = await this.pricing.price(cart, dto.channel);
    if (priced.lines.length === 0) {
      throw new BadRequestException(
        `Nothing in your cart is available: ${priced.rejected
          .map((r) => `${r.name} — ${r.reason}`)
          .join('; ')}`,
      );
    }

    const address = await this.resolveAddress(customerId, dto);
    // Pickup means the customer collects at the villa, so the delivery
    // allow-list simply does not apply (SPEC §5.2).
    if (priced.has_local && !dto.pickup) {
      await this.serviceability.assertLocalServiceable(address);
    }

    // ── shipping (CHK-02) ───────────────────────────────────────────────────
    let shippingAmount: Paise = 0;
    let shippingInfo: QuoteShipping | null = null;
    if (priced.has_shipped) {
      if (!address) {
        throw new BadRequestException(
          'A delivery address is required for shipped items',
        );
      }
      const cfg = await this.settings.get('shipping');
      const provider = await this.shipping.get();
      const result = await provider.checkServiceability({
        // An unconfigured pickup code means "ship from wherever the customer
        // is" as far as the rate lookup is concerned — the manual provider
        // ignores both, and Shiprocket rejects an empty origin outright.
        pickup_pincode: cfg.pickup_location_code || address.pincode,
        delivery_pincode: address.pincode,
        weight_grams: Math.max(
          priced.shipped_weight_grams,
          cfg.default_weight_grams,
        ),
        declared_value_paise: priced.subtotal,
        cod: false,
      });
      if (!result.serviceable) {
        throw new BadRequestException(
          result.reason ?? 'We cannot ship to this pincode yet',
        );
      }
      // The port documents `rate` as paise; a provider that ever returns a
      // fractional or negative one must not poison the order total.
      shippingAmount = Math.max(0, Math.round(result.rate));
      shippingInfo = {
        provider: provider.name,
        courier_name: result.courier_name ?? null,
        courier_id: result.courier_id ?? null,
        etd: result.etd ? result.etd.toISOString() : null,
        serviceable: true,
      };
    }

    // ── coupon (PROMO-02) ───────────────────────────────────────────────────
    // One code, enforced by the DTO's `@IsString()`: `["A","B"]` cannot be said.
    let discount: Paise = 0;
    let coupon: QuoteCoupon | null = null;
    if (dto.coupon_code) {
      const evaluated = await this.coupons.evaluate(dto.coupon_code, {
        customerId,
        lines: priced.lines,
        subtotal: priced.subtotal,
        hasShipped: priced.has_shipped,
      });
      discount = evaluated.discount;
      if (evaluated.free_shipping) shippingAmount = 0;
      coupon = {
        id: evaluated.coupon.id,
        code: evaluated.coupon.code,
        type: evaluated.coupon.type,
        discount: evaluated.discount,
      };
    }

    // ── loyalty (LOYAL-02) ──────────────────────────────────────────────────
    const afterDiscount = Math.max(priced.subtotal - discount, 0);
    const redeem = await this.loyalty.previewRedeem(
      customerId,
      dto.redeem_points ?? 0,
      afterDiscount,
    );

    // ── booking holds (CHK-02) ──────────────────────────────────────────────
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + CheckoutService.QUOTE_TTL_SECONDS * 1000,
    );
    await this.releaseHolds(customerId);
    const holds = await this.createHolds(customerId, priced.lines, expiresAt);

    // `tax_amount` is carved *out* of `subtotal` (plan decision 1) and is never
    // a term here. Adding it would double-charge GST on every order.
    const net = Math.max(afterDiscount - redeem.redeem_amount, 0);
    const total = net + shippingAmount;

    const stored: StoredQuote = {
      v: 2,
      quote_id: randomUUID(),
      customer_id: customerId,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      channel: dto.channel,
      delivery_address_id: address?.id ?? null,
      pickup: dto.pickup ?? false,
      lines: priced.lines,
      holds,
      subtotal: priced.subtotal,
      discount_amount: discount,
      coupon,
      shipping_amount: shippingAmount,
      shipping: shippingInfo,
      tax_amount: priced.tax_total,
      tax_breakup: priced.tax_breakup,
      loyalty_points_redeemed: redeem.points_applied,
      loyalty_redeem_amount: redeem.redeem_amount,
      loyalty_points_earned_estimate: await this.loyalty.earnEstimate(net),
      total,
    };

    await redis.setex(
      this.quoteKey(customerId, stored.quote_id),
      CheckoutService.QUOTE_TTL_SECONDS,
      JSON.stringify(stored),
    );

    return { quote: stored, rejected: priced.rejected, loyalty: redeem };
  }

  /**
   * "Can you reach this pincode?", answered **before** a quote exists.
   *
   * The address step otherwise has no way to ask: `POST /customer/checkout/quote`
   * needs a saved `delivery_address_id`, and a customer typing a new address has
   * not saved one yet — so the only way to discover an unserviceable pincode was
   * to save the address, quote, and read the `400`. Trial and error.
   *
   * There is **no new rule here.** The local half re-reads the same
   * `ServiceabilityService.allowedPincodes()` allow-list that
   * `assertLocalServiceable` enforces inside the quote; the shipped half asks
   * the same `ShippingProviderPort.checkServiceability` with the same arguments
   * the quote builds. A pre-check that said "yes" and a quote that then said
   * "no" would be worse than no pre-check at all, so the two must not drift.
   *
   * The `shipped` half is `null` when the cart holds no shipped line: there is
   * nothing to courier, and asking a provider (or billing a Shiprocket lookup)
   * for an answer nobody will read is waste. Provider failures propagate as the
   * `503` the adapter raises, exactly as they would from the quote.
   */
  async checkServiceability(
    cart: CartLineInput[],
    dto: ServiceabilityDto,
  ): Promise<ServiceabilityResponse> {
    const pincode = dto.pincode.trim();

    const allowed = await this.serviceability.allowedPincodes();
    // An empty allow-list means "no restriction configured" (the seeded
    // default), which `ServiceabilityService` reads as serviceable.
    const local: ServiceabilityHalf =
      allowed.length === 0 || allowed.includes(pincode)
        ? { serviceable: true }
        : {
            serviceable: false,
            // Verbatim the message `assertLocalServiceable` throws.
            reason: "Sorry, we don't deliver to this pincode yet",
          };

    if (cart.length === 0) return { local, shipped: null };

    const priced = await this.pricing.price(
      cart,
      dto.channel ?? OrderChannel.delivery,
    );
    if (!priced.has_shipped) return { local, shipped: null };

    const cfg = await this.settings.get('shipping');
    const provider = await this.shipping.get();
    const result = await provider.checkServiceability({
      pickup_pincode: cfg.pickup_location_code || pincode,
      delivery_pincode: pincode,
      weight_grams: Math.max(
        priced.shipped_weight_grams,
        cfg.default_weight_grams,
      ),
      declared_value_paise: priced.subtotal,
      cod: false,
    });

    if (!result.serviceable) {
      return {
        local,
        shipped: {
          serviceable: false,
          reason: result.reason ?? 'We cannot ship to this pincode yet',
        },
      };
    }

    return {
      local,
      shipped: {
        serviceable: true,
        courier_name: result.courier_name ?? undefined,
        etd: result.etd ? result.etd.toISOString() : undefined,
        // Indicative only — the quote is what freezes the charge. Same
        // clamp the quote applies, so the two agree to the paise.
        amount: toDecimal(Math.max(0, Math.round(result.rate))),
      },
    };
  }

  /**
   * The pay step's read (Task 9). Scoping the key by `customerId` means one
   * customer can never spend another's quote — the id alone is not a bearer
   * token.
   */
  async readQuote(customerId: string, quoteId: string): Promise<StoredQuote> {
    const raw = await this.requireRedis().get(
      this.quoteKey(customerId, quoteId),
    );
    if (!raw) {
      throw new BadRequestException(
        'Your quote expired — please review your cart again',
      );
    }
    return JSON.parse(raw) as StoredQuote;
  }

  /**
   * The delivery address a quote is priced against: the one the client named,
   * otherwise the customer's default. `null` is legitimate — a takeaway or
   * pickup cart with no shipped line needs no address at all.
   */
  private async resolveAddress(
    customerId: string,
    dto: QuoteCheckoutDto,
  ): Promise<QuoteAddress | null> {
    if (dto.delivery_address_id) {
      // Scoped by `customer_id`: naming someone else's address id is a 400, not
      // a silent cross-customer read.
      const named = await this.prisma.customerAddress.findFirst({
        where: { id: dto.delivery_address_id, customer_id: customerId },
        select: { id: true, pincode: true },
      });
      if (!named) throw new BadRequestException('Delivery address not found');
      return named;
    }
    const fallback = await this.prisma.customerAddress.findFirst({
      where: { customer_id: customerId, is_default: true },
      select: { id: true, pincode: true },
    });
    return fallback ?? null;
  }

  /**
   * One 15-minute `held` booking per `booking` line, so an experience cannot be
   * sold twice while a customer is on the payment screen.
   *
   * Grouped by `fulfilment`, not by `ProductType`: routing is frozen on the line
   * (plan decision 6), and a product whose type says `experience` but whose
   * fulfilment says otherwise must follow its fulfilment.
   */
  private async createHolds(
    customerId: string,
    lines: readonly PricedLine[],
    expiresAt: Date,
  ): Promise<QuoteHold[]> {
    const bookingLines = lines.filter(
      (l) => l.fulfilment === FulfilmentType.booking && l.event_id,
    );
    if (bookingLines.length === 0) return [];

    // `EventBooking` carries the contact details denormalised (it predates
    // `Customer` being mandatory), so the hold needs the customer row.
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { name: true, phone: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const holds: QuoteHold[] = [];
    for (const line of bookingLines) {
      try {
        const booking = await this.prisma.eventBooking.create({
          data: {
            event_id: line.event_id as string,
            customer_id: customerId,
            customer_name: customer.name ?? 'Guest',
            customer_phone: customer.phone,
            guests: line.quantity,
            status: BookingStatus.held,
            hold_expires_at: expiresAt,
            payment_status: 'pending',
            payment_amount: toDecimal(line.gross),
          },
          select: { id: true },
        });
        holds.push({
          booking_id: booking.id,
          event_id: line.event_id as string,
          product_id: line.product_id,
          guests: line.quantity,
          expires_at: expiresAt.toISOString(),
        });
      } catch (err) {
        // `@@unique([event_id, customer_phone])` — the customer already holds a
        // live or confirmed seat on this event. That is a product rule, not a
        // server fault, so it gets the message the storefront shows.
        if (hasPrismaCode(err, 'P2002')) {
          throw new BadRequestException(
            `You already have a booking for "${line.name}"`,
          );
        }
        throw err;
      }
    }
    return holds;
  }

  /**
   * Drops this customer's outstanding holds so re-quoting cannot double-hold.
   *
   * **Deletes rather than cancels** (deviating from the plan sketch): a hold is
   * an ephemeral placeholder, and `EventBooking` is `@@unique([event_id,
   * customer_phone])` — a row left behind as `cancelled` would keep occupying
   * the slot and make every re-quote of the same experience fail with P2002.
   * Only `held` rows are touched; a `confirmed`, `cancelled` or `attended`
   * booking is a real record and is never removed.
   */
  private async releaseHolds(customerId: string): Promise<void> {
    await this.prisma.eventBooking.deleteMany({
      where: { customer_id: customerId, status: BookingStatus.held },
    });
  }

  /**
   * Fail closed when Redis is down. A quote that is not stored cannot be paid
   * for, and pretending otherwise would strand the customer between a Razorpay
   * charge and an order that never existed — the same reasoning as
   * `CustomerOrdersService.checkoutCart`.
   */
  private requireRedis() {
    const client = this.redis.getClient();
    if (!client) {
      throw new ServiceUnavailableException(
        'Checkout is temporarily unavailable. Please try again in a moment.',
      );
    }
    return client;
  }
}

/**
 * Paise → the wire.
 *
 * Money leaves as `Prisma.Decimal`, which `DecimalSerializationInterceptor`
 * (`main.ts:119`) renders as a JSON **number** in rupees — `6403`, never
 * `"6403.00"` (plan decision 3). `tax_rate` stays the `"5.00"` string it is on
 * the line, because it is a rate, not an amount.
 *
 * Lives here rather than in `quote.types.ts`, which Task 5 froze.
 */
export function toQuoteResponse(result: QuoteResult) {
  const quote = result.quote;
  return {
    quote_id: quote.quote_id,
    expires_at: quote.expires_at,
    channel: quote.channel,
    pickup: quote.pickup,
    delivery_address_id: quote.delivery_address_id,
    lines: quote.lines.map((line) => ({
      product_id: line.product_id,
      variant_id: line.variant_id,
      name: line.name,
      sku: line.sku,
      quantity: line.quantity,
      type: line.type,
      fulfilment: line.fulfilment,
      unit_price: toDecimal(line.unit_price),
      gross: toDecimal(line.gross),
      tax_rate: line.tax_rate,
      tax: toDecimal(line.tax),
    })),
    rejected: result.rejected,
    subtotal: toDecimal(quote.subtotal),
    // The coupon's internal id stays server-side; the storefront needs the code.
    coupon: quote.coupon
      ? {
          code: quote.coupon.code,
          type: quote.coupon.type,
          discount: toDecimal(quote.coupon.discount),
        }
      : null,
    discount_amount: toDecimal(quote.discount_amount),
    shipping: quote.shipping,
    shipping_amount: toDecimal(quote.shipping_amount),
    tax_amount: toDecimal(quote.tax_amount),
    tax_breakup: quote.tax_breakup.map((bucket) => ({
      rate: bucket.rate,
      taxable: toDecimal(bucket.taxable),
      tax: toDecimal(bucket.tax),
    })),
    loyalty: {
      balance: result.loyalty.balance,
      tier: result.loyalty.tier,
      max_redeemable_points: result.loyalty.max_redeemable_points,
      points_applied: quote.loyalty_points_redeemed,
      redeem_amount: toDecimal(quote.loyalty_redeem_amount),
      redeem_value_per_point: result.loyalty.redeem_value_per_point,
      points_earned_estimate: quote.loyalty_points_earned_estimate,
    },
    holds: quote.holds,
    total: toDecimal(quote.total),
  };
}

/** The wire shape of a quote, for the controller and for Phase 34's client. */
export type QuoteResponse = ReturnType<typeof toQuoteResponse>;
