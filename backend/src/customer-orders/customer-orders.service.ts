import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../customer-auth/redis.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { PusherService } from '../chat/pusher.service';
import {
  FulfilmentService,
  PendingOrderData,
} from '../fulfilment/fulfilment.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { SyncCartDto } from './dto/sync-cart.dto';
import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { renderOrderReceipt, renderBookingReceipt } from './receipt.template';

// ---------------------------------------------------------------
// Cart data shape (stored as JSON in Redis)
// ---------------------------------------------------------------
export interface CartData {
  items: Array<{
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    imageUrl: string | null;
  }>;
  channel: 'takeaway' | 'delivery' | null;
  deliveryAddressId: string | null;
  updatedAt: string;
}

const CART_TTL = 604800; // 7 days in seconds
const PENDING_ORDER_TTL = 1800; // 30 minutes

@Injectable()
export class CustomerOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly razorpayService: RazorpayService,
    private readonly pusherService: PusherService,
    private readonly fulfilmentService: FulfilmentService,
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

    return JSON.parse(raw) as CartData;
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

  async syncCart(
    customerId: string,
    localCart: SyncCartDto,
  ): Promise<CartData> {
    const existing = await this.getCart(customerId);

    let merged: CartData;

    if (existing && existing.items.length > 0 && localCart.items.length > 0) {
      // Both have items — keep the one with more items
      if (existing.items.length >= localCart.items.length) {
        merged = existing;
      } else {
        merged = {
          items: localCart.items.map((i) => ({
            menuItemId: i.menuItemId,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            imageUrl: i.imageUrl ?? null,
          })),
          channel: localCart.channel ?? null,
          deliveryAddressId: localCart.deliveryAddressId ?? null,
          updatedAt: new Date().toISOString(),
        };
      }
    } else if (localCart.items.length > 0) {
      // Only local cart has items
      merged = {
        items: localCart.items.map((i) => ({
          menuItemId: i.menuItemId,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          imageUrl: i.imageUrl ?? null,
        })),
        channel: localCart.channel ?? null,
        deliveryAddressId: localCart.deliveryAddressId ?? null,
        updatedAt: new Date().toISOString(),
      };
    } else if (existing) {
      // Only Redis cart has items (or both empty)
      merged = existing;
    } else {
      // Both empty
      merged = {
        items: [],
        channel: localCart.channel ?? null,
        deliveryAddressId: localCart.deliveryAddressId ?? null,
        updatedAt: new Date().toISOString(),
      };
    }

    await this.setCart(customerId, merged);
    return merged;
  }

  // ---------------------------------------------------------------
  // Serviceability Check (D-16)
  // ---------------------------------------------------------------

  isServiceable(pincode: string): boolean {
    const pincodes = (process.env.DELIVERY_PINCODES || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (pincodes.length === 0) return true; // no restriction if env not set
    return pincodes.includes(pincode);
  }

  // ---------------------------------------------------------------
  // Checkout — Create Razorpay Order from Cart (D-09)
  // ---------------------------------------------------------------

  async checkoutCart(
    customerId: string,
  ): Promise<{ razorpay_order_id: string }> {
    // 1. Read cart from Redis
    const cart = await this.getCart(customerId);
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // 2. Validate channel is set (D-04: takeaway or delivery only)
    if (!cart.channel || !['takeaway', 'delivery'].includes(cart.channel)) {
      throw new BadRequestException(
        'Please select a channel (takeaway or delivery)',
      );
    }

    // 3. If delivery, validate pincode serviceability
    if (cart.channel === 'delivery') {
      if (!cart.deliveryAddressId) {
        throw new BadRequestException('Please select a delivery address');
      }
      const address = await this.prisma.customerAddress.findFirst({
        where: { id: cart.deliveryAddressId, customer_id: customerId },
      });
      if (!address) {
        throw new BadRequestException('Delivery address not found');
      }
      if (!this.isServiceable(address.pincode)) {
        throw new BadRequestException(
          "Sorry, we don't deliver to this pincode yet",
        );
      }
    }

    // 4. Server-side price validation — fetch active, available menu items
    const menuItemIds = cart.items.map((i) => i.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        available: true,
        status: 'active',
      },
      select: { id: true, base_price: true },
    });

    const priceMap = new Map(
      menuItems.map((mi) => [mi.id, Number(mi.base_price)]),
    );

    // Check all items are still available
    for (const item of cart.items) {
      if (!priceMap.has(item.menuItemId)) {
        throw new BadRequestException(
          `Item "${item.name}" is no longer available`,
        );
      }
    }

    // 5. Calculate subtotal from SERVER prices (never trust cart prices)
    const subtotal = cart.items.reduce((sum, item) => {
      const serverPrice = priceMap.get(item.menuItemId)!;
      return sum + serverPrice * item.quantity;
    }, 0);

    // 6. Look up channel modifier
    const modifier = await this.prisma.channelModifier.findFirst({
      where: { channel_type: cart.channel, status: 'active' },
    });

    let modifierAmount = 0;
    if (modifier) {
      if (modifier.modifier_type === 'fixed') {
        modifierAmount = Number(modifier.modifier_value);
      } else if (modifier.modifier_type === 'percentage') {
        modifierAmount = (subtotal * Number(modifier.modifier_value)) / 100;
      }
    }

    // 7. Calculate total
    const total = subtotal + modifierAmount;

    // 8. Convert to paise
    const amountInPaise = Math.round(total * 100);

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

    // 12. Return Razorpay order ID
    return { razorpay_order_id: rzpOrder.id };
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
    const pending = JSON.parse(pendingRaw) as PendingOrderData;

    // 2. Verify customerId matches
    if (pending.customerId !== customerId) {
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

    // 5. Verify amount matches
    if (Number(payment.amount) !== Math.round(pending.total * 100)) {
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
        pending,
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
        status: 'placed',
      })
      .catch((err) =>
        console.error('[Pusher] Order placed trigger error:', err),
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
            menu_item: { select: { id: true, name: true } },
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
            menu_item: { select: { id: true, name: true } },
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
            menu_item: { select: { name: true } },
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

    return renderOrderReceipt({
      order_number: order.order_number,
      channel: order.channel,
      created_at: order.created_at,
      subtotal: Number(order.subtotal),
      channel_modifier_amount: Number(order.channel_modifier_amount),
      total: Number(order.total),
      delivery_address: order.delivery_address,
      items: order.items.map((item) => ({
        menu_item: item.menu_item,
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

    return renderBookingReceipt({
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
