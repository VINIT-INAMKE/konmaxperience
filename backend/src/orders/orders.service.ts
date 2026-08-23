import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ActorType,
  DeliveryStatus,
  OrderChannel,
  OrderItemStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { NodeService } from '../node/node.service';
import { nodeDayRange } from '../common/utils/node-time';
import { RazorpayService } from '../razorpay/razorpay.service';
import { PusherService } from '../chat/pusher.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { OrderFiltersDto } from './dto/order-filters.dto';
import { ConfirmRazorpayPaymentDto } from './dto/create-razorpay-order.dto';
import { FulfilmentService } from '../fulfilment/fulfilment.service';
import { AuditService } from '../audit/audit.service';
import {
  DomainEvent,
  domainEventBase,
  emitDomainEvent,
  userActor,
} from '../common/events/domain-events';
import {
  SERIALIZABLE_TX_OPTIONS,
  withSerializableRetry,
} from '../common/utils/transaction-retry';

/**
 * Valid order status transitions (non-cancellation).
 * `shipped`/`delivered`/`completed`/`refunded` belong to the shipment and refund
 * lifecycles and are wired up in P5 — the enum members already exist so that
 * extension needs no migration.
 */
const STATUS_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.placed]: [OrderStatus.confirmed, OrderStatus.preparing],
  [OrderStatus.confirmed]: [OrderStatus.preparing],
  [OrderStatus.preparing]: [OrderStatus.ready],
  [OrderStatus.ready]: [OrderStatus.served, OrderStatus.dispatched],
};

/** Terminal statuses that cannot be cancelled */
const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.served,
  OrderStatus.dispatched,
  OrderStatus.delivered,
  OrderStatus.completed,
  OrderStatus.cancelled,
  OrderStatus.refunded,
];

/** Valid delivery status progression */
const DELIVERY_STATUS_ORDER: (DeliveryStatus | null)[] = [
  null,
  DeliveryStatus.picked_up,
  DeliveryStatus.in_transit,
  DeliveryStatus.delivered,
];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nodeService: NodeService,
    private readonly eventEmitter: EventEmitter2,
    private readonly razorpayService: RazorpayService,
    private readonly pusherService: PusherService,
    private readonly fulfilmentService: FulfilmentService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------
  // Create Order
  // ---------------------------------------------------------------
  async createOrder(dto: CreateOrderDto, userId: string) {
    const order = await withSerializableRetry(() =>
      this.prisma.$transaction(async (tx) => {
        // Look up authoritative prices for each product from the database
        const productIds = dto.items.map((i) => i.product_id);
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, base_price: true },
        });

        const priceMap = new Map(
          products.map((p) => [p.id, Number(p.base_price)]),
        );

        // Validate all products exist
        for (const item of dto.items) {
          if (!priceMap.has(item.product_id)) {
            throw new BadRequestException(
              `Product with ID ${item.product_id} not found`,
            );
          }
        }

        // Look up channel modifier (null-check gracefully per Pitfall 5)
        const modifier = await tx.channelModifier.findFirst({
          where: { channel: dto.channel, status: 'active' },
        });

        // Compute subtotal using server-side prices
        const subtotal = dto.items.reduce((sum, item) => {
          const basePrice = priceMap.get(item.product_id)!;
          return sum + basePrice * item.quantity;
        }, 0);

        // Compute modifier amount
        let modifierAmount = 0;
        if (modifier) {
          if (modifier.modifier_type === 'fixed') {
            modifierAmount = Number(modifier.modifier_value);
          } else if (modifier.modifier_type === 'percentage') {
            modifierAmount = (subtotal * Number(modifier.modifier_value)) / 100;
          }
        }

        // Create order with items using server-side prices
        const created = await tx.order.create({
          data: {
            channel: dto.channel,
            status: OrderStatus.placed,
            placed_via: OrderSource.pos,
            subtotal,
            channel_modifier_amount: modifierAmount,
            total: subtotal + modifierAmount,
            zone_id: dto.zone_id,
            created_by: userId,
            table_number: dto.table_number,
            customer_name: dto.customer_name,
            customer_phone: dto.customer_phone,
            delivery_address: dto.delivery_address,
            delivery_assigned_to: dto.delivery_assigned_to,
            notes: dto.notes,
            items: {
              create: dto.items.map((i) => ({
                product_id: i.product_id,
                variant_id: i.variant_id ?? null,
                quantity: i.quantity,
                unit_price: priceMap.get(i.product_id)!,
                item_notes: i.item_notes,
                status: OrderItemStatus.pending,
              })),
            },
          },
          include: { items: true, payment: true },
        });

        // Non-scratch items: auto-set to 'ready' and deduct immediately (D-04, D-05)
        await this.fulfilmentService.applyPrepTypeOnCreate(
          tx,
          { id: created.id, zone_id: created.zone_id },
          created.items,
          { actor_type: ActorType.user, actor_id: userId },
        );

        await this.auditService.record(tx, {
          entity_type: 'order',
          entity_id: created.id,
          action: 'order.created',
          ...AuditService.user(userId),
          after: {
            status: created.status,
            channel: created.channel,
            placed_via: created.placed_via,
            total: String(created.total),
            item_count: created.items?.length ?? 0,
          },
        });

        return created;
      }, SERIALIZABLE_TX_OPTIONS),
    );

    // Fire-and-forget AFTER the transaction commits (SPEC §4.1)
    emitDomainEvent(this.eventEmitter, DomainEvent.ORDER_PLACED, {
      ...domainEventBase(order.node_id, userActor(userId)),
      orderId: order.id,
      channel: order.channel,
      itemCount: order.items?.length ?? 0,
      total: String(order.total),
      createdBy: userId,
    });

    return order;
  }

  // ---------------------------------------------------------------
  // Get Orders (filtered, paginated)
  // ---------------------------------------------------------------
  async getOrders(filters: OrderFiltersDto) {
    const where: Record<string, unknown> = {};

    if (filters.channel) {
      where.channel = filters.channel;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.date_from || filters.date_to) {
      // Day boundaries are the node's, not the server's (SPEC 3.1 Node.timezone).
      const timeZone = await this.nodeService.timezone();
      const createdAt: Record<string, unknown> = {};
      if (filters.date_from) {
        createdAt.gte = nodeDayRange(timeZone, filters.date_from).start;
      }
      if (filters.date_to) {
        // Exclusive: the node-local midnight that ends `date_to`.
        createdAt.lt = nodeDayRange(timeZone, filters.date_to).end;
      }
      where.created_at = createdAt;
    }

    if (filters.payment_method) {
      where.payment = { method: filters.payment_method };
    }

    if (filters.search) {
      where.id = { contains: filters.search };
    }

    const take = Math.min(Number(filters.limit) || 50, 100);
    const skip = ((Number(filters.page) || 1) - 1) * take;

    return this.prisma.order.findMany({
      where,
      include: {
        _count: { select: { items: true } },
        payment: {
          select: { id: true, method: true, amount: true, status: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take,
      skip,
    });
  }

  // ---------------------------------------------------------------
  // Find All Orders for Export (no pagination cap)
  // ---------------------------------------------------------------
  async findAllForExport(filters: {
    dateFrom?: string;
    dateTo?: string;
    channel?: string;
    status?: string;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.channel) {
      where.channel = filters.channel;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.dateFrom || filters.dateTo) {
      // Day boundaries are the node's, not the server's (SPEC 3.1 Node.timezone).
      const timeZone = await this.nodeService.timezone();
      const createdAt: Record<string, unknown> = {};
      if (filters.dateFrom) {
        createdAt.gte = nodeDayRange(timeZone, filters.dateFrom).start;
      }
      if (filters.dateTo) {
        // Exclusive: the node-local midnight that ends `dateTo`.
        createdAt.lt = nodeDayRange(timeZone, filters.dateTo).end;
      }
      where.created_at = createdAt;
    }

    return this.prisma.order.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        creator: { select: { name: true } },
        payment: { select: { method: true } },
      },
    });
  }

  // ---------------------------------------------------------------
  // Get Single Order
  // ---------------------------------------------------------------
  async getOrderById(orderId: string) {
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
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    return order;
  }

  // ---------------------------------------------------------------
  // Update Order Status
  // ---------------------------------------------------------------
  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    userId: string | null,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, customer_id: true, order_number: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (newStatus === OrderStatus.cancelled) {
      if (TERMINAL_STATUSES.includes(order.status)) {
        throw new BadRequestException(
          `Cannot cancel order in "${order.status}" status`,
        );
      }
    } else {
      // Validate non-cancellation transition
      const allowed = STATUS_TRANSITIONS[order.status] || [];
      if (!allowed.includes(newStatus)) {
        throw new BadRequestException(
          `Cannot transition from "${order.status}" to "${newStatus}". ` +
            `Valid transitions: ${allowed.join(', ') || 'none'}`,
        );
      }
    }

    // The optimistic guard and the AuditEvent share one transaction so the audit
    // row rolls back with the status change it describes (SPEC §3).
    await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: newStatus, updated_by: userId },
      });
      if (updateResult.count === 0) {
        throw new ConflictException(
          'Order status was changed by another request. Please retry.',
        );
      }

      await this.auditService.record(tx, {
        entity_type: 'order',
        entity_id: orderId,
        action: 'order.status_changed',
        ...AuditService.user(userId),
        before: { status: order.status },
        after: { status: newStatus },
      });
    });

    // Pusher trigger for customer orders (D-13 + Pitfall 4: null-guard for POS orders)
    if (order.customer_id) {
      this.pusherService
        .trigger(
          `private-customer-${order.customer_id}`,
          'order.status-changed',
          {
            orderId: order.id,
            orderNumber: order.order_number,
            status: newStatus,
            updatedAt: new Date().toISOString(),
          },
        )
        .catch((err) => console.error('[Pusher] Status trigger error:', err));
    }

    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    // The two terminal fulfilment states the bridge listens for, emitted AFTER
    // the status transaction has committed (SPEC §4.1).
    if (
      updated &&
      (newStatus === OrderStatus.served || newStatus === OrderStatus.delivered)
    ) {
      emitDomainEvent(
        this.eventEmitter,
        newStatus === OrderStatus.served
          ? DomainEvent.ORDER_SERVED
          : DomainEvent.ORDER_DELIVERED,
        {
          ...domainEventBase(updated.node_id, userActor(userId)),
          orderId: updated.id,
          orderNumber: updated.order_number,
          channel: updated.channel,
          total: String(updated.total),
        },
      );
    }

    return updated;
  }

  // ---------------------------------------------------------------
  // Record Payment
  // ---------------------------------------------------------------
  async recordPayment(orderId: string, dto: RecordPaymentDto) {
    // Verify order exists — only fetch fields needed for validation
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, total: true },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Reject payment for cancelled orders
    if (order.status === OrderStatus.cancelled) {
      throw new BadRequestException(
        'Cannot record payment for a cancelled order',
      );
    }

    // Validate payment amount matches order total (allow small rounding tolerance)
    const orderTotal = Number(order.total);
    if (Math.abs(dto.amount - orderTotal) > 0.01) {
      throw new BadRequestException(
        `Payment amount (${dto.amount}) does not match order total (${orderTotal})`,
      );
    }

    // Check for existing payment and create atomically
    try {
      // Check for existing payment (per Pitfall 7)
      const existing = await this.prisma.payment.findFirst({
        where: { order_id: orderId },
      });

      if (existing) {
        throw new ConflictException('Payment already recorded for this order');
      }

      return await this.prisma.payment.create({
        data: {
          order_id: orderId,
          method: dto.method,
          amount: dto.amount,
          status: PaymentStatus.paid,
          notes: dto.notes,
        },
      });
    } catch (error) {
      // Re-throw known exceptions
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      // Handle unique constraint violation (P2002)
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as any).code === 'P2002'
      ) {
        throw new ConflictException('Payment already recorded for this order');
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------
  // Update Delivery
  // ---------------------------------------------------------------
  async updateDelivery(orderId: string, dto: UpdateDeliveryDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        channel: true,
        status: true,
        delivery_status: true,
        delivery_address: true,
        created_by: true,
        customer_id: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.channel !== OrderChannel.delivery) {
      throw new BadRequestException(
        'Delivery updates only apply to delivery orders',
      );
    }

    // Validate delivery_status progression if provided
    if (dto.delivery_status) {
      const currentIdx = DELIVERY_STATUS_ORDER.indexOf(order.delivery_status);
      const newIdx = DELIVERY_STATUS_ORDER.indexOf(dto.delivery_status);

      if (newIdx === -1 || newIdx !== currentIdx + 1) {
        throw new BadRequestException(
          `Cannot transition delivery status from "${order.delivery_status ?? 'null'}" to "${dto.delivery_status}". ` +
            `Must follow: null -> picked_up -> in_transit -> delivered`,
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.delivery_assigned_to !== undefined) {
      updateData.delivery_assigned_to = dto.delivery_assigned_to;
    }
    if (dto.delivery_status !== undefined) {
      updateData.delivery_status = dto.delivery_status;
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    // Fire-and-forget AFTER the update persists (SPEC §4.1)
    emitDomainEvent(this.eventEmitter, DomainEvent.DELIVERY_UPDATED, {
      ...domainEventBase(updated.node_id, userActor(order.created_by)),
      orderId: order.id,
      deliveryStatus: dto.delivery_status ?? order.delivery_status,
      deliveryAddress: order.delivery_address,
      createdBy: order.created_by,
    });

    // Pusher trigger for customer orders (D-13 + Pitfall 4: null-guard for POS orders)
    if (order.customer_id) {
      this.pusherService
        .trigger(`private-customer-${order.customer_id}`, 'delivery.updated', {
          orderId: order.id,
          deliveryStatus: dto.delivery_status ?? order.delivery_status,
          updatedAt: new Date().toISOString(),
        })
        .catch((err) => console.error('[Pusher] Delivery trigger error:', err));
    }

    return updated;
  }

  // ---------------------------------------------------------------
  // Daily Summary
  // ---------------------------------------------------------------
  async getDailySummary(date: string) {
    // The business day is the node's local day (SPEC 3.1 Node.timezone), so a
    // 23:30 IST order still counts against the day it was placed on.
    const { start, end } = nodeDayRange(
      await this.nodeService.timezone(),
      date,
    );

    const dateFilter = {
      created_at: { gte: start, lt: end },
      status: { not: OrderStatus.cancelled },
    };

    const [totalOrders, paidAgg] = await Promise.all([
      this.prisma.order.count({ where: dateFilter }),
      this.prisma.order.aggregate({
        where: {
          ...dateFilter,
          payment: { status: PaymentStatus.paid },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
    ]);

    const totalRevenue = Number(paidAgg._sum.total ?? 0);
    const paidCount = paidAgg._count.id;
    const averageOrderValue = paidCount > 0 ? totalRevenue / paidCount : 0;

    return {
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      average_order_value: averageOrderValue,
    };
  }

  // ---------------------------------------------------------------
  // Generate QR Code for Feedback
  // ---------------------------------------------------------------
  async generateQr(orderId: string): Promise<{ qr_data_url: string }> {
    // Verify order exists
    await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const url = `${frontendUrl}/feedback/${orderId}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    return { qr_data_url: dataUrl };
  }

  // ---------------------------------------------------------------
  // Create Razorpay Order for POS (D-22)
  // ---------------------------------------------------------------
  async createRazorpayOrder(orderId: string) {
    // Fetch order
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Check order doesn't already have a paid payment
    const existingPayment = await this.prisma.payment.findFirst({
      where: { order_id: orderId, status: PaymentStatus.paid },
    });
    if (existingPayment) {
      throw new BadRequestException('Order already paid');
    }

    // Calculate amount in paise (server-side only — never from frontend per D-11)
    const amountInPaise = Math.round(order.total.toNumber() * 100);

    // Create Razorpay order
    const rzpOrder = await this.razorpayService.createOrder({
      amount: amountInPaise,
      receipt: `ord_${String(order.order_number).slice(0, 8)}_${Date.now()}`,
      notes: { type: 'pos_order', entity_id: orderId },
    });

    // Upsert pending Payment record (Payment.order_id has @unique)
    await this.prisma.payment.upsert({
      where: { order_id: orderId },
      create: {
        order_id: orderId,
        method: PaymentMethod.razorpay,
        amount: order.total,
        status: PaymentStatus.pending,
        razorpay_order_id: rzpOrder.id,
      },
      update: {
        method: PaymentMethod.razorpay,
        razorpay_order_id: rzpOrder.id,
        status: PaymentStatus.pending,
      },
    });

    return { razorpay_order_id: rzpOrder.id };
  }

  // ---------------------------------------------------------------
  // Confirm Razorpay Payment for POS (D-09, D-12)
  // ---------------------------------------------------------------
  async confirmRazorpayPayment(
    orderId: string,
    dto: ConfirmRazorpayPaymentDto,
  ) {
    // Step 1: Verify HMAC signature — BEFORE fetchPayment (D-09)
    const isValid = this.razorpayService.verifyPaymentSignature(
      dto.razorpay_order_id,
      dto.razorpay_payment_id,
      dto.razorpay_signature,
    );
    if (!isValid) {
      throw new BadRequestException('Invalid payment signature');
    }

    // Step 2: Re-fetch payment from Razorpay API (D-12 belt-and-suspenders)
    // Accept both 'captured' (auto-capture on) and 'authorized' (auto-capture off / test mode)
    const payment = await this.razorpayService.fetchPayment(
      dto.razorpay_payment_id,
    );
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      throw new BadRequestException(
        `Payment not captured — status: ${payment.status}`,
      );
    }

    // Step 3: Update Payment record
    const paymentRecord = await this.prisma.payment.findFirst({
      where: { order_id: orderId, razorpay_order_id: dto.razorpay_order_id },
    });
    if (!paymentRecord) {
      throw new NotFoundException('Payment record not found');
    }
    if (paymentRecord.status === PaymentStatus.paid) {
      return paymentRecord; // idempotent
    }

    return this.prisma.payment.update({
      where: { id: paymentRecord.id },
      data: {
        status: PaymentStatus.paid,
        razorpay_payment_id: dto.razorpay_payment_id,
      },
    });
  }
}
