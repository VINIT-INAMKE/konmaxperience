import {
  Injectable,
  NotFoundException,
  GoneException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import {
  FulfilmentType,
  OrderChannel,
  OrderSource,
  OrderStatus,
  ProductType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../customer-auth/redis.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { PusherService } from '../chat/pusher.service';
import {
  ConfirmPaidOrderInput,
  FulfilmentService,
  PendingOrderData,
} from '../fulfilment/fulfilment.service';
import { CartPricingService } from '../checkout/cart-pricing.service';
import type {
  PendingOrderV2,
  PricedCart,
  PricedLine,
  StoredQuote,
} from '../checkout/quote.types';
import { toDecimal, type Paise } from '../common/money/money';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { SyncCartDto } from './dto/sync-cart.dto';
import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { CreateOrderFromQuoteDto } from './dto/create-order-from-quote.dto';
import { renderOrderReceipt, renderBookingReceipt } from './receipt.template';
import { NodeService } from '../node/node.service';

// ---------------------------------------------------------------
// Cart data shape (stored as JSON in Redis)
// ---------------------------------------------------------------
export interface CartData {
  items: Array<{
    productId: string;
    variantId?: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
    imageUrl: string | null;
  }>;
  channel: OrderChannel | null;
  deliveryAddressId: string | null;
  updatedAt: string;
}

/**
 * One cart line as the storefront now receives it (`CHK-01`).
 *
 * `unitPrice` is the **server** price in rupees, not the one the client cached;
 * `fulfilment` is derived from `Product.fulfilment`; `available` is false for a
 * line that could not be priced, and `unavailable_reason` carries the message to
 * show next to it.
 */
export interface PricedCartItem {
  productId: string;
  variantId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  imageUrl: string | null;
  fulfilment: FulfilmentType | null;
  available: boolean;
  unavailable_reason: string | null;
}

/** `GET /customer/cart` and `POST /customer/cart/sync` — the cart plus server totals. */
export interface PricedCartData {
  items: PricedCartItem[];
  channel: OrderChannel | null;
  deliveryAddressId: string | null;
  updatedAt: string;
  /** Rupees. `subtotal` is tax-inclusive and `tax_total` is contained in it (decision 1). */
  totals: { subtotal: number; tax_total: number };
}

/** `POST /customer/orders` — everything Razorpay Checkout needs to open. */
export interface CreateOrderFromQuoteResponse {
  razorpay_order_id: string;
  /** **Paise** — Razorpay's own unit, copied verbatim from the frozen quote. */
  amount: Paise;
  currency: 'INR';
  /** The publishable key, so the storefront need not carry it in its own env. */
  key_id: string | null;
  /** Echoed back so a client can correlate the payment with the quote it accepted. */
  quote_id: string;
}

/** The only channels a marketplace (customer app) cart may check out on — D-04. */
const CHECKOUT_CHANNELS: OrderChannel[] = [
  OrderChannel.takeaway,
  OrderChannel.delivery,
];

const CART_TTL = 604800; // 7 days in seconds
const PENDING_ORDER_TTL = 1800; // 30 minutes

/** Integer paise -> the rupee number the API contract puts on the wire. */
function rupees(paise: Paise): number {
  return toDecimal(paise).toNumber();
}

/**
 * A quote (`StoredQuote`) minus the two fields that only make sense while it is
 * still a quote, plus the payment identity — that is exactly `PendingOrderV2`.
 */
export function toPendingOrder(
  quote: StoredQuote,
  razorpayOrderId: string,
  idempotencyKey: string,
): PendingOrderV2 {
  const { quote_id: _quoteId, expires_at: _expiresAt, ...frozen } = quote;
  return {
    ...frozen,
    v: 2,
    razorpay_order_id: razorpayOrderId,
    idempotency_key: idempotencyKey,
  };
}

/**
 * Reads either pending-order shape (decision 5).
 *
 * A payload with no `v` was written by the pre-P5a `checkoutCart` and is upgraded
 * in memory: rupee floats become paise, every line routes `local`, and discount,
 * shipping, tax and loyalty are zero. The 30-minute TTL means at most one deploy
 * window of these exists, but dropping them would strand a paid customer.
 */
export function upgradePending(raw: string): PendingOrderV2 {
  const parsed = JSON.parse(raw) as PendingOrderV2 | PendingOrderData;
  if ((parsed as PendingOrderV2).v === 2) return parsed as PendingOrderV2;

  const v1 = parsed as PendingOrderData;
  const lines: PricedLine[] = (v1.cart?.items ?? []).map((item) => {
    const unitPrice = Math.round(item.unitPrice * 100);
    return {
      product_id: item.productId,
      variant_id: item.variantId ?? null,
      name: item.name,
      sku: null,
      quantity: item.quantity,
      type: ProductType.prepared_food,
      fulfilment: FulfilmentType.local,
      unit_price: unitPrice,
      gross: unitPrice * item.quantity,
      tax_rate: '0.00',
      tax: 0,
      weight_grams: 0,
      hsn_code: null,
      available: true,
      unavailable_reason: null,
      event_id: null,
    };
  });

  return {
    v: 2,
    razorpay_order_id: '',
    idempotency_key: '',
    customer_id: v1.customerId,
    created_at: new Date().toISOString(),
    channel: v1.channel,
    delivery_address_id: v1.deliveryAddressId,
    pickup: false,
    lines,
    holds: [],
    subtotal: Math.round(v1.subtotal * 100),
    discount_amount: 0,
    coupon: null,
    shipping_amount: 0,
    shipping: null,
    tax_amount: 0,
    tax_breakup: [],
    loyalty_points_redeemed: 0,
    loyalty_redeem_amount: 0,
    loyalty_points_earned_estimate: 0,
    total: Math.round(v1.total * 100),
  };
}

/**
 * Hands a `PendingOrderV2` to `FulfilmentService`.
 *
 * P5a Task 10 widens `ConfirmPaidOrderInput['pending']` to `PendingOrderV2`; until
 * that lands, `FulfilmentService` still declares the v1 shape and the two are
 * structurally unrelated. Writing the cast against `ConfirmPaidOrderInput['pending']`
 * rather than a hard-coded type means this function needs no edit when Task 10
 * merges — it simply becomes an identity.
 */
function pendingForFulfilment(
  pending: PendingOrderV2,
): ConfirmPaidOrderInput['pending'] {
  return pending as unknown as ConfirmPaidOrderInput['pending'];
}

@Injectable()
export class CustomerOrdersService {
  private readonly logger = new Logger(CustomerOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nodeService: NodeService,
    private readonly redisService: RedisService,
    private readonly razorpayService: RazorpayService,
    private readonly pusherService: PusherService,
    private readonly fulfilmentService: FulfilmentService,
    private readonly pricing: CartPricingService,
  ) {}

  // ---------------------------------------------------------------
  // Cart — Redis CRUD
  // ---------------------------------------------------------------

  private cartKey(customerId: string): string {
    return `cart:${customerId}`;
  }

  async getCart(customerId: string): Promise<CartData | null> {
    const redis = this.redisService.getClient();
    if (!redis) return null;

    const raw = await redis.get(this.cartKey(customerId));
    if (!raw) return null;

    // Carts written before P2-11 key their lines on the old catalog id, not
    // `productId`. Drop those rather than let syncCart/checkoutCart crash.
    const parsed = JSON.parse(raw) as CartData;
    const items = (parsed.items ?? []).filter(
      (i: { productId?: string }) => typeof i.productId === 'string',
    );
    return { ...parsed, items };
  }

  async setCart(customerId: string, cart: CartData): Promise<void> {
    const redis = this.redisService.getClient();
    if (!redis) return;

    await redis.set(
      this.cartKey(customerId),
      JSON.stringify(cart),
      'EX',
      CART_TTL,
    );
  }

  async deleteCart(customerId: string): Promise<void> {
    const redis = this.redisService.getClient();
    if (!redis) return;

    await redis.del(this.cartKey(customerId));
  }

  /**
   * `GET /customer/cart` (`CHK-01`) — the stored cart, re-priced from the
   * database on every read so the storefront can never render a stale price.
   */
  async getPricedCart(customerId: string): Promise<PricedCartData> {
    const cart = await this.getCart(customerId);
    return this.priceCart(
      cart ?? {
        items: [],
        channel: null,
        deliveryAddressId: null,
        updatedAt: new Date().toISOString(),
      },
    );
  }

  /**
   * Re-prices a cart through `CartPricingService` and folds the answer back into
   * the cart shape the storefront already renders (`CHK-01`).
   *
   * Matching a stored line to its priced line is not a plain key lookup: when the
   * client sends no `variantId` the pricer resolves the product's *default*
   * variant, so the priced line carries a variant id the cart line does not have.
   * Each priced line is therefore claimed at most once — exact product+variant
   * first, then product-only — which also keeps two identical cart lines from
   * both claiming the same price.
   */
  private async priceCart(cart: CartData): Promise<PricedCartData> {
    const priced = await this.pricing.price(
      cart.items,
      cart.channel ?? OrderChannel.delivery,
    );

    const pool = priced.lines.map((line) => ({ line, claimed: false }));
    const claim = (
      productId: string,
      variantId: string | null,
    ): PricedLine | null => {
      const exact = pool.find(
        (entry) =>
          !entry.claimed &&
          entry.line.product_id === productId &&
          (entry.line.variant_id ?? null) === variantId,
      );
      const hit =
        exact ??
        pool.find(
          (entry) => !entry.claimed && entry.line.product_id === productId,
        );
      if (!hit) return null;
      hit.claimed = true;
      return hit.line;
    };

    const items: PricedCartItem[] = cart.items.map((item) => {
      const variantId = item.variantId ?? null;
      const line = claim(item.productId, variantId);
      // A rejection is matched on the product alone: several of the rejection
      // branches never learn which variant the client asked for.
      const rejection = line
        ? undefined
        : priced.rejected.find((r) => r.product_id === item.productId);
      return {
        productId: item.productId,
        variantId: line?.variant_id ?? variantId,
        name: line?.name ?? item.name,
        quantity: item.quantity,
        unitPrice: line ? rupees(line.unit_price) : item.unitPrice,
        imageUrl: item.imageUrl ?? null,
        fulfilment: line?.fulfilment ?? null,
        available: Boolean(line),
        unavailable_reason: rejection?.reason ?? null,
      };
    });

    return {
      items,
      channel: cart.channel,
      deliveryAddressId: cart.deliveryAddressId,
      updatedAt: cart.updatedAt,
      totals: {
        subtotal: rupees(priced.subtotal),
        tax_total: rupees(priced.tax_total),
      },
    };
  }

  /**
   * `POST /customer/cart/sync` — **the incoming cart is authoritative.**
   *
   * The original rule kept whichever cart had *more* lines
   * (`existing.items.length >= localCart.items.length`). That made the endpoint
   * a one-way ratchet: removing a line, dropping a quantity to zero, or
   * changing only `channel`/`deliveryAddressId` was silently discarded and the
   * client got the old cart back. `/cart` cannot be built on that.
   *
   * The stored cart is now read for exactly the one case the merge was written
   * for — **the login merge**: an anonymous visitor signs in, the client posts
   * `{ items: [] }` with nothing else to say, and the cart they left behind
   * before logging out is restored. Anything else — a non-empty `items`, or an
   * empty one that also names a `channel` or a `deliveryAddressId` — is an
   * explicit statement of intent by a client that knows what the cart holds,
   * and is written through verbatim. An empty cart is therefore a real, storable
   * state.
   */
  async syncCart(
    customerId: string,
    localCart: SyncCartDto,
  ): Promise<PricedCartData> {
    const isLoginMerge =
      localCart.items.length === 0 &&
      localCart.channel === undefined &&
      localCart.deliveryAddressId === undefined;

    if (isLoginMerge) {
      const existing = await this.getCart(customerId);
      if (existing) {
        // Rewritten rather than just read, so the 7-day TTL rolls forward on a
        // login the way every other sync does.
        await this.setCart(customerId, existing);
        return this.priceCart(existing);
      }
    }

    const merged: CartData = {
      items: localCart.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? null,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        imageUrl: i.imageUrl ?? null,
      })),
      channel: localCart.channel ?? null,
      deliveryAddressId: localCart.deliveryAddressId ?? null,
      updatedAt: new Date().toISOString(),
    };

    await this.setCart(customerId, merged);
    // The merge decides *what* is in the cart; the database decides what it costs.
    return this.priceCart(merged);
  }

  // ---------------------------------------------------------------
  // Checkout — Create a Razorpay order from a frozen quote (CHK-03)
  // ---------------------------------------------------------------

  /** Redis `quote:{customerId}:{quoteId}` — written by `CheckoutService.quote`, TTL 15 min. */
  quoteKey(customerId: string, quoteId: string): string {
    return `quote:${customerId}:${quoteId}`;
  }

  /**
   * Loads the quote the customer accepted.
   *
   * A quote is a *stored artefact*, never a recomputation (decision 4): the
   * numbers the customer saw are the numbers that get charged. The key carries
   * the customer id, so another customer's quote id simply does not resolve.
   *
   * `404` when the quote is gone (never issued, already spent, or its TTL
   * reaped it); `410` when the payload is still in Redis but its own
   * `expires_at` has passed — a stale record must never be honoured just
   * because the TTL has not caught up.
   */
  async readQuote(customerId: string, quoteId: string): Promise<StoredQuote> {
    const raw = await this.requireRedis().get(
      this.quoteKey(customerId, quoteId),
    );
    if (!raw) {
      throw new NotFoundException(
        'Your quote expired — please review your cart again',
      );
    }
    const quote = JSON.parse(raw) as StoredQuote;
    if (Date.parse(quote.expires_at) <= Date.now()) {
      throw new GoneException(
        'Your quote expired — please review your cart again',
      );
    }
    return quote;
  }

  /**
   * `POST /customer/orders` (`CHK-03`).
   *
   * The float arithmetic this replaced re-derived the price at pay time, so a
   * catalog edit between "review order" and "pay" silently changed the amount.
   * Now the frozen quote is the price: the cart is re-priced only to *refuse*
   * the payment if anything moved, never to change what is charged.
   */
  async createOrderFromQuote(
    customerId: string,
    dto: CreateOrderFromQuoteDto,
  ): Promise<CreateOrderFromQuoteResponse> {
    // Redis must be reachable BEFORE a Razorpay order exists — otherwise the
    // pending record is lost and the payment can never be confirmed.
    const redis = this.requireRedis();

    // 1. The frozen quote (404 gone / 410 expired).
    const quote = await this.readQuote(customerId, dto.quote_id);
    if (quote.customer_id !== customerId) {
      throw new ForbiddenException('Quote does not belong to this customer');
    }

    // 2. D-04: a marketplace order is takeaway or delivery, never a POS channel.
    if (!CHECKOUT_CHANNELS.includes(quote.channel)) {
      throw new BadRequestException(
        'Please select a channel (takeaway or delivery)',
      );
    }
    if (quote.lines.length === 0) {
      throw new BadRequestException('Cart is empty');
    }
    if (quote.total <= 0) {
      throw new BadRequestException(
        'This order has nothing left to pay — please review your cart',
      );
    }

    // 3. Re-validate: prices, availability and stock can have moved in 15 minutes.
    const cart = await this.getCart(customerId);
    const reprice = await this.pricing.price(cart?.items ?? [], quote.channel);
    this.assertQuoteStillValid(quote, reprice);

    // 4. Razorpay order for the **quoted** total, already in paise — no float anywhere.
    const rzpOrder = await this.razorpayService.createOrder({
      amount: quote.total,
      receipt: `mkt_${customerId.slice(0, 8)}_${Date.now()}`,
      notes: { type: 'marketplace', entity_id: customerId },
    });

    // 5. Freeze the quote into the pending record (30 min TTL, unchanged contract).
    const pending = toPendingOrder(
      quote,
      rzpOrder.id,
      dto.idempotency_key ?? dto.quote_id,
    );
    await redis.set(
      `pending_order:${rzpOrder.id}`,
      JSON.stringify(pending),
      'EX',
      PENDING_ORDER_TTL,
    );
    // 6. The quote is spent. Re-quoting is cheap; paying twice off one quote is not.
    await redis.del(this.quoteKey(customerId, dto.quote_id));

    return {
      razorpay_order_id: rzpOrder.id,
      amount: quote.total,
      currency: 'INR',
      key_id: process.env.RAZORPAY_KEY_ID || null,
      quote_id: dto.quote_id,
    };
  }

  /**
   * A quote is honoured only if every line is still available at the same unit
   * price. Anything else sends the customer back to the cart rather than
   * charging a stale total.
   */
  private assertQuoteStillValid(quote: StoredQuote, reprice: PricedCart): void {
    const now = new Map(
      reprice.lines.map((l) => [`${l.product_id}:${l.variant_id ?? ''}`, l]),
    );
    for (const line of quote.lines) {
      const current = now.get(`${line.product_id}:${line.variant_id ?? ''}`);
      if (!current) {
        throw new BadRequestException(
          `"${line.name}" is no longer available — please review your cart`,
        );
      }
      if (current.unit_price !== line.unit_price) {
        throw new BadRequestException(
          `The price of "${line.name}" changed — please review your cart`,
        );
      }
      if (current.quantity < line.quantity) {
        throw new BadRequestException(
          `Only ${current.quantity} of "${line.name}" left — please review your cart`,
        );
      }
    }
  }

  /**
   * The checkout path fails closed: without Redis a pending order cannot be
   * written, so no Razorpay order may be created.
   */
  private requireRedis() {
    const redis = this.redisService.getClient();
    if (!redis) {
      throw new ServiceUnavailableException(
        'Checkout is temporarily unavailable. Please try again in a moment.',
      );
    }
    return redis;
  }

  // ---------------------------------------------------------------
  // Confirm Order — Verify payment + create Order (D-10)
  // ---------------------------------------------------------------

  async confirmOrder(customerId: string, dto: ConfirmOrderDto) {
    const redis = this.redisService.getClient();
    if (!redis) {
      throw new ServiceUnavailableException(
        'Order confirmation unavailable — retry later',
      );
    }
    const pendingKey = `pending_order:${dto.razorpay_order_id}`;

    // 1. Peek (non-consuming) so a rejected signature does not burn the session
    const pendingRaw = await redis.get(pendingKey);
    if (!pendingRaw) {
      // The webhook may already have confirmed this payment — idempotent return
      const existing =
        await this.fulfilmentService.findOrderByRazorpayPaymentId(
          dto.razorpay_payment_id,
        );
      if (existing && existing.customer_id === customerId) return existing;
      throw new BadRequestException(
        'Order session expired or not found. Please try again.',
      );
    }
    // Either shape parses; a pre-P5a payload is upgraded to v2 in memory.
    const pending = upgradePending(pendingRaw);

    // 2. Verify customerId matches
    if (pending.customer_id !== customerId) {
      throw new ForbiddenException('Order does not belong to this customer');
    }

    // 3. Verify payment signature
    const isValid = this.razorpayService.verifyPaymentSignature(
      dto.razorpay_order_id,
      dto.razorpay_payment_id,
      dto.razorpay_signature,
    );
    if (!isValid) {
      throw new BadRequestException('Invalid payment signature');
    }

    // 4. Re-fetch payment from Razorpay API (belt-and-suspenders)
    const payment = await this.razorpayService.fetchPayment(
      dto.razorpay_payment_id,
    );
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      throw new BadRequestException(
        `Payment not captured — status: ${payment.status}`,
      );
    }

    // 5. Verify amount matches. Both sides are already integer paise, so the
    //    `Math.round(total * 100)` float step this replaced is gone.
    if (Number(payment.amount) !== pending.total) {
      throw new BadRequestException('Payment amount mismatch');
    }

    // 6. Consume the pending key atomically — exactly one caller proceeds to create
    const consumed = await redis.getdel(pendingKey);
    if (!consumed) {
      const existing =
        await this.fulfilmentService.findOrderByRazorpayPaymentId(
          dto.razorpay_payment_id,
        );
      if (existing) return existing;
      throw new ConflictException(
        'Order confirmation already in progress. Please retry.',
      );
    }

    // 7. Create Order + Payment + fulfilment (Serializable, retried, P2002 -> existing order)
    let order;
    try {
      order = await this.fulfilmentService.confirmPaidOrder({
        customerId,
        razorpayOrderId: dto.razorpay_order_id,
        razorpayPaymentId: dto.razorpay_payment_id,
        pending: pendingForFulfilment({
          ...pending,
          razorpay_order_id: dto.razorpay_order_id,
        }),
        placedVia: OrderSource.storefront,
      });
    } catch (err) {
      // Restore the session so the webhook fallback or a retry can still create the order
      await redis.set(pendingKey, consumed, 'EX', PENDING_ORDER_TTL, 'NX');
      throw err;
    }

    // 8. AFTER transaction: clear cart
    await redis.del(this.cartKey(customerId));

    // 9. AFTER transaction: trigger Pusher event
    this.pusherService
      .trigger(`private-customer-${customerId}`, 'order.placed', {
        orderId: order.id,
        orderNumber: order.order_number,
        status: OrderStatus.placed,
      })
      .catch((err) =>
        this.logger.error(
          '[Pusher] Order placed trigger error',
          err instanceof Error ? err.stack : String(err),
        ),
      );

    return order;
  }

  // ---------------------------------------------------------------
  // Get Single Order by ID (ownership check)
  // ---------------------------------------------------------------

  async getOrderById(customerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order not found`);
    }

    if (order.customer_id !== customerId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return order;
  }

  /**
   * `GET /customer/orders/:id/shipment` (`SHIP-05`).
   *
   * One shipment per order (decision 8), covering every `shipped` line. Returns
   * `null` — not a 404 — when the order has no shipped lines: "this order is not
   * a parcel" is a normal answer, and the storefront renders nothing.
   */
  async getOrderShipment(customerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, customer_id: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.customer_id !== customerId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return this.prisma.shipment.findUnique({
      where: { order_id: orderId },
      include: { events: { orderBy: { occurred_at: 'desc' } } },
    });
  }

  // ---------------------------------------------------------------
  // Customer Order History
  // ---------------------------------------------------------------

  async getCustomerOrders(customerId: string) {
    return this.prisma.order.findMany({
      where: { customer_id: customerId },
      orderBy: { created_at: 'desc' },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
        payment: {
          select: {
            id: true,
            method: true,
            amount: true,
            status: true,
          },
        },
      },
    });
  }

  // ---------------------------------------------------------------
  // Customer Event Bookings
  // ---------------------------------------------------------------

  async getCustomerBookings(customerId: string) {
    return this.prisma.eventBooking.findMany({
      where: { customer_id: customerId },
      orderBy: { created_at: 'desc' },
      include: {
        event: {
          select: { id: true, title: true, date: true },
        },
      },
    });
  }

  // ---------------------------------------------------------------
  // Receipt Generation (D-17, D-18)
  // ---------------------------------------------------------------

  async generateOrderReceipt(
    customerId: string,
    orderId: string,
  ): Promise<string> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
        payment: true,
        customer: { select: { name: true, phone: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.customer_id !== customerId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return renderOrderReceipt(await this.nodeService.timezone(), {
      order_number: order.order_number,
      channel: order.channel,
      created_at: order.created_at,
      subtotal: Number(order.subtotal),
      channel_modifier_amount: Number(order.channel_modifier_amount),
      discount_amount: Number(order.discount_amount),
      shipping_amount: Number(order.shipping_amount),
      tax_amount: Number(order.tax_amount),
      total: Number(order.total),
      delivery_address: order.delivery_address,
      items: order.items.map((item) => ({
        product: item.product,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
      })),
      payment: order.payment
        ? {
            method: order.payment.method,
            razorpay_payment_id: order.payment.razorpay_payment_id,
          }
        : null,
      customer: order.customer,
    });
  }

  async generateBookingReceipt(
    customerId: string,
    bookingId: string,
  ): Promise<string> {
    const booking = await this.prisma.eventBooking.findUnique({
      where: { id: bookingId },
      include: {
        event: { select: { title: true, date: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customer_id !== customerId) {
      throw new ForbiddenException('You do not have access to this booking');
    }

    return renderBookingReceipt(await this.nodeService.timezone(), {
      id: booking.id,
      customer_name: booking.customer_name,
      customer_phone: booking.customer_phone,
      guests: booking.guests,
      payment_status: booking.payment_status,
      payment_amount: booking.payment_amount
        ? Number(booking.payment_amount)
        : null,
      razorpay_payment_id: booking.razorpay_payment_id,
      created_at: booking.created_at,
      event: booking.event,
    });
  }

  // ---------------------------------------------------------------
  // Address CRUD
  // ---------------------------------------------------------------

  async createAddress(customerId: string, dto: CreateAddressDto) {
    // Check if customer has any existing addresses
    const existingCount = await this.prisma.customerAddress.count({
      where: { customer_id: customerId },
    });

    const isDefault = existingCount === 0;

    // If this address is being set as default, unset other defaults first
    if (isDefault && existingCount > 0) {
      await this.prisma.customerAddress.updateMany({
        where: { customer_id: customerId, is_default: true },
        data: { is_default: false },
      });
    }

    return this.prisma.customerAddress.create({
      data: {
        customer_id: customerId,
        label: dto.label,
        address: dto.address,
        landmark: dto.landmark,
        pincode: dto.pincode,
        lat: dto.lat,
        lng: dto.lng,
        is_default: isDefault,
      },
    });
  }

  async listAddresses(customerId: string) {
    return this.prisma.customerAddress.findMany({
      where: { customer_id: customerId },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });
  }

  async updateAddress(
    customerId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ) {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customer_id: customerId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return this.prisma.customerAddress.update({
      where: { id: addressId },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.landmark !== undefined && { landmark: dto.landmark }),
        ...(dto.pincode !== undefined && { pincode: dto.pincode }),
        ...(dto.lat !== undefined && { lat: dto.lat }),
        ...(dto.lng !== undefined && { lng: dto.lng }),
      },
    });
  }

  async deleteAddress(customerId: string, addressId: string) {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customer_id: customerId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    await this.prisma.customerAddress.delete({ where: { id: addressId } });

    // If we deleted the default address, promote the next oldest
    if (address.is_default) {
      const next = await this.prisma.customerAddress.findFirst({
        where: { customer_id: customerId },
        orderBy: { created_at: 'asc' },
      });
      if (next) {
        await this.prisma.customerAddress.update({
          where: { id: next.id },
          data: { is_default: true },
        });
      }
    }
  }

  async setDefaultAddress(customerId: string, addressId: string) {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customer_id: customerId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // Unset all other defaults
    await this.prisma.customerAddress.updateMany({
      where: { customer_id: customerId, is_default: true },
      data: { is_default: false },
    });

    // Set this one as default
    return this.prisma.customerAddress.update({
      where: { id: addressId },
      data: { is_default: true },
    });
  }
}
