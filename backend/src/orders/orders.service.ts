import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { OrderFiltersDto } from './dto/order-filters.dto';
import { ConfirmRazorpayPaymentDto } from './dto/create-razorpay-order.dto';
import { convertUnit } from '../common/utils/unit-conversion';

/** Valid order status transitions (non-cancellation) */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  placed: ['preparing'],
  preparing: ['ready'],
  ready: ['served', 'dispatched'],
};

/** Terminal statuses that cannot be cancelled */
const TERMINAL_STATUSES = ['served', 'dispatched', 'cancelled'];

/** Valid delivery status progression */
const DELIVERY_STATUS_ORDER = [null, 'picked_up', 'in_transit', 'delivered'];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly razorpayService: RazorpayService,
  ) {}

  // ---------------------------------------------------------------
  // Create Order
  // ---------------------------------------------------------------
  async createOrder(dto: CreateOrderDto, userId: string) {
    const order = await this.prisma.$transaction(async (tx) => {
      // Look up authoritative prices for each menu item from the database
      const menuItemIds = dto.items.map((i) => i.menu_item_id);
      const menuItems = await tx.menuItem.findMany({
        where: { id: { in: menuItemIds } },
        select: { id: true, base_price: true },
      });

      const priceMap = new Map(
        menuItems.map((mi) => [mi.id, Number(mi.base_price)]),
      );

      // Validate all menu items exist
      for (const item of dto.items) {
        if (!priceMap.has(item.menu_item_id)) {
          throw new BadRequestException(
            `Menu item with ID ${item.menu_item_id} not found`,
          );
        }
      }

      // Look up channel modifier (null-check gracefully per Pitfall 5)
      const modifier = await tx.channelModifier.findFirst({
        where: { channel_type: dto.channel, status: 'active' },
      });

      // Compute subtotal using server-side prices
      const subtotal = dto.items.reduce((sum, item) => {
        const basePrice = priceMap.get(item.menu_item_id)!;
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
          status: 'placed',
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
              menu_item_id: i.menu_item_id,
              quantity: i.quantity,
              unit_price: priceMap.get(i.menu_item_id)!,
              item_notes: i.item_notes,
              status: 'pending',
            })),
          },
        },
        include: { items: true, payment: true },
      });

      return created;
    });

    // Fire-and-forget AFTER transaction commits (Pitfall 1 compliance)
    try {
      this.eventEmitter.emit('order.placed', {
        orderId: order.id,
        channel: order.channel,
        itemCount: order.items?.length ?? 0,
        total: String(order.total),
        createdBy: userId,
      });
    } catch (e) { /* event emission failed - non-critical */ }

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
      const createdAt: Record<string, unknown> = {};
      if (filters.date_from) {
        createdAt.gte = new Date(filters.date_from);
      }
      if (filters.date_to) {
        const endDate = new Date(filters.date_to);
        endDate.setHours(23, 59, 59, 999);
        createdAt.lte = endDate;
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
        payment: { select: { id: true, method: true, amount: true, status: true } },
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
      const createdAt: Record<string, unknown> = {};
      if (filters.dateFrom) {
        createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setHours(23, 59, 59, 999);
        createdAt.lte = endDate;
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
            menu_item: { select: { id: true, name: true } },
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
  async updateOrderStatus(orderId: string, newStatus: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Handle cancellation
    if (newStatus === 'cancelled') {
      if (TERMINAL_STATUSES.includes(order.status)) {
        throw new BadRequestException(
          `Cannot cancel order in "${order.status}" status`,
        );
      }
      const cancelResult = await this.prisma.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: 'cancelled' },
      });
      if (cancelResult.count === 0) {
        throw new ConflictException('Order status was changed by another request. Please retry.');
      }
      return this.prisma.order.findUnique({ where: { id: orderId } });
    }

    // Validate non-cancellation transition
    const allowed = STATUS_TRANSITIONS[order.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from "${order.status}" to "${newStatus}". ` +
          `Valid transitions: ${allowed.join(', ') || 'none'}`,
      );
    }

    const updateResult = await this.prisma.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: newStatus },
    });
    if (updateResult.count === 0) {
      throw new ConflictException('Order status was changed by another request. Please retry.');
    }
    return this.prisma.order.findUnique({ where: { id: orderId } });
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
    if (order.status === 'cancelled') {
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
        throw new ConflictException(
          'Payment already recorded for this order',
        );
      }

      return await this.prisma.payment.create({
        data: {
          order_id: orderId,
          method: dto.method,
          amount: dto.amount,
          status: 'paid',
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
        throw new ConflictException(
          'Payment already recorded for this order',
        );
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
      select: { id: true, channel: true, status: true, delivery_status: true, delivery_address: true, created_by: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.channel !== 'delivery') {
      throw new BadRequestException('Delivery updates only apply to delivery orders');
    }

    // Validate delivery_status progression if provided
    if (dto.delivery_status) {
      const currentIdx = DELIVERY_STATUS_ORDER.indexOf(
        order.delivery_status as string | null,
      );
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

    // Fire-and-forget AFTER update persists (Pitfall 1 compliance)
    try {
      this.eventEmitter.emit('delivery.updated', {
        orderId: order.id,
        deliveryStatus: dto.delivery_status ?? order.delivery_status,
        deliveryAddress: order.delivery_address,
        createdBy: order.created_by,
      });
    } catch (e) { /* event emission failed - non-critical */ }

    return updated;
  }

  // ---------------------------------------------------------------
  // Daily Summary
  // ---------------------------------------------------------------
  async getDailySummary(date: string) {
    // Parse as IST (UTC+05:30) per Research Pitfall 6
    const start = new Date(`${date}T00:00:00+05:30`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const dateFilter = {
      created_at: { gte: start, lt: end },
      status: { not: 'cancelled' as const },
    };

    const [totalOrders, paidAgg] = await Promise.all([
      this.prisma.order.count({ where: dateFilter }),
      this.prisma.order.aggregate({
        where: {
          ...dateFilter,
          payment: { status: 'paid' },
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
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Check order doesn't already have a paid payment
    const existingPayment = await this.prisma.payment.findFirst({
      where: { order_id: orderId, status: 'paid' },
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
        method: 'razorpay',
        amount: order.total,
        status: 'pending',
        razorpay_order_id: rzpOrder.id,
      },
      update: {
        method: 'razorpay',
        razorpay_order_id: rzpOrder.id,
        status: 'pending',
      },
    });

    return { razorpay_order_id: rzpOrder.id };
  }

  // ---------------------------------------------------------------
  // Confirm Razorpay Payment for POS (D-09, D-12)
  // ---------------------------------------------------------------
  async confirmRazorpayPayment(orderId: string, dto: ConfirmRazorpayPaymentDto) {
    // Step 1: Verify HMAC signature — BEFORE fetchPayment (D-09)
    const isValid = this.razorpayService.verifyPaymentSignature(
      dto.razorpay_order_id, dto.razorpay_payment_id, dto.razorpay_signature,
    );
    if (!isValid) {
      throw new BadRequestException('Invalid payment signature');
    }

    // Step 2: Re-fetch payment from Razorpay API (D-12 belt-and-suspenders)
    const payment = await this.razorpayService.fetchPayment(dto.razorpay_payment_id);
    if (payment.status !== 'captured') {
      throw new BadRequestException('Payment not captured');
    }

    // Step 3: Update Payment record
    const paymentRecord = await this.prisma.payment.findFirst({
      where: { order_id: orderId, razorpay_order_id: dto.razorpay_order_id },
    });
    if (!paymentRecord) {
      throw new NotFoundException('Payment record not found');
    }
    if (paymentRecord.status === 'paid') {
      return paymentRecord; // idempotent
    }

    return this.prisma.payment.update({
      where: { id: paymentRecord.id },
      data: {
        status: 'paid',
        razorpay_payment_id: dto.razorpay_payment_id,
      },
    });
  }

  // ---------------------------------------------------------------
  // Deduct Item Ingredients (called from KDS within $transaction)
  // ---------------------------------------------------------------
  /**
   * Deduct stock for an order item when marked "ready" on KDS.
   * Handles both ingredient-type (IngredientStock decrement + StockMovement)
   * and recipe-type (FIFO PrepBatch decrement) RecipeLines.
   * CRITICAL: tx must be the Prisma transaction client, NOT this.prisma.
   */
  async deductItemIngredients(
    tx: any,
    orderItem: {
      id: string;
      order_id: string;
      menu_item_id: string;
      quantity: number;
    },
    userId: string,
    /** Pass zone_id from the order to avoid an extra DB round-trip */
    zoneId?: string,
  ): Promise<void> {
    // 1. Load MenuItem with Recipe and RecipeLines (only fields needed for deduction)
    const menuItem = await tx.menuItem.findUniqueOrThrow({
      where: { id: orderItem.menu_item_id },
      select: {
        recipe: {
          select: {
            RecipeLines: {
              select: {
                input_type: true,
                quantity: true,
                unit: true,
                ingredient_id: true,
                ingredient: { select: { name: true, base_unit: true } },
                source_recipe_id: true,
                source_recipe: { select: { name: true, yield_unit: true } },
              },
            },
          },
        },
      },
    });

    const recipe = menuItem.recipe;

    // Only fetch order for zone_id if not passed by caller
    if (!zoneId) {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderItem.order_id },
        select: { zone_id: true },
      });
      zoneId = order.zone_id;
    }

    // 2. Multiply per-serving needs by quantity to avoid looping per serving.
    //    This eliminates N redundant stock lookups for N servings.
    const servings = orderItem.quantity;

    for (const line of recipe.RecipeLines) {
      const neededPerServing = Number(line.quantity);
      const totalNeeded = neededPerServing * servings;

      if (line.input_type === 'ingredient' && line.ingredient) {
        // Deduct raw ingredient from IngredientStock
        // CRITICAL: pass tx (not this.prisma) per Research Pitfall 2
        const neededBase = await convertUnit(
          totalNeeded,
          line.unit,
          line.ingredient.base_unit,
          tx,
        );
        if (neededBase === null) {
          throw new BadRequestException(
            `No unit conversion from ${line.unit} to ${line.ingredient.base_unit}`,
          );
        }

        const stock = await tx.ingredientStock.findFirst({
          where: { ingredient_id: line.ingredient_id, zone_id: zoneId },
        });
        if (!stock || Number(stock.current_quantity) < neededBase) {
          throw new BadRequestException(
            `Insufficient stock for ${line.ingredient.name}`,
          );
        }

        await tx.ingredientStock.update({
          where: { id: stock.id },
          data: { current_quantity: { decrement: neededBase } },
        });

        await tx.stockMovement.create({
          data: {
            ingredient_id: line.ingredient_id,
            zone_id: zoneId,
            movement_type: 'order_deducted',
            quantity: -neededBase,
            original_quantity: totalNeeded,
            unit: line.unit,
            reason: 'Order item deduction',
            reference_type: 'order',
            reference_id: orderItem.order_id,
            created_by: userId,
          },
        });
      }

      if (line.input_type === 'recipe' && line.source_recipe) {
        // FIFO deduct from PrepBatches — same pattern as PrepBatchesService
        const batches = await tx.prepBatch.findMany({
          where: {
            recipe_id: line.source_recipe_id,
            status: 'active',
            OR: [
              { expires_at: null },
              { expires_at: { gt: new Date() } },
            ],
          },
          orderBy: { created_at: 'asc' }, // FIFO — oldest first
        });

        // Convert total needed to batch yield unit — pass tx (Pitfall 2)
        let remainingNeed = await convertUnit(
          totalNeeded,
          line.unit,
          line.source_recipe.yield_unit,
          tx,
        );
        if (remainingNeed === null) {
          throw new BadRequestException(
            `No unit conversion from ${line.unit} to ${line.source_recipe.yield_unit}`,
          );
        }

        for (const batch of batches) {
          if (remainingNeed <= 0) break;
          const batchRemaining = Number(batch.quantity_remaining);
          const deduct = Math.min(batchRemaining, remainingNeed);
          const newRemaining = batchRemaining - deduct;

          await tx.prepBatch.update({
            where: { id: batch.id },
            data: {
              quantity_remaining: { decrement: deduct },
              ...(newRemaining <= 0 ? { status: 'depleted' } : {}),
            },
          });

          remainingNeed -= deduct;
        }

        if (remainingNeed > 0) {
          throw new BadRequestException(
            `Insufficient prep batch stock for ${line.source_recipe.name}`,
          );
        }
      }
    }
  }
}
