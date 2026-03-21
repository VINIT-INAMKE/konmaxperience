import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { OrderFiltersDto } from './dto/order-filters.dto';

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
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------
  // Create Order
  // ---------------------------------------------------------------
  async createOrder(dto: CreateOrderDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Compute subtotal from items
      const subtotal = dto.items.reduce(
        (sum, item) => sum + item.unit_price * item.quantity,
        0,
      );

      // Look up channel modifier (null-check gracefully per Pitfall 5)
      const modifier = await tx.channelModifier.findFirst({
        where: { channel_type: dto.channel, status: 'active' },
      });

      // Compute modifier amount
      let modifierAmount = 0;
      if (modifier) {
        if (modifier.modifier_type === 'fixed') {
          modifierAmount = Number(modifier.modifier_value);
        } else if (modifier.modifier_type === 'percentage') {
          modifierAmount = (subtotal * Number(modifier.modifier_value)) / 100;
        }
      }

      // Create order with items
      const order = await tx.order.create({
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
              unit_price: i.unit_price,
              item_notes: i.item_notes,
              status: 'pending',
            })),
          },
        },
        include: { items: true, payment: true },
      });

      return order;
    });
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
        createdAt.lte = new Date(filters.date_to);
      }
      where.created_at = createdAt;
    }

    if (filters.payment_method) {
      where.payment = { method: filters.payment_method };
    }

    if (filters.search) {
      where.id = { contains: filters.search };
    }

    return this.prisma.order.findMany({
      where,
      include: {
        items: { select: { id: true } },
        payment: true,
      },
      orderBy: { created_at: 'desc' },
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
      return this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
      });
    }

    // Validate non-cancellation transition
    const allowed = STATUS_TRANSITIONS[order.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from "${order.status}" to "${newStatus}". ` +
          `Valid transitions: ${allowed.join(', ') || 'none'}`,
      );
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });
  }

  // ---------------------------------------------------------------
  // Record Payment
  // ---------------------------------------------------------------
  async recordPayment(orderId: string, dto: RecordPaymentDto) {
    // Check for existing payment (per Pitfall 7)
    const existing = await this.prisma.payment.findFirst({
      where: { order_id: orderId },
    });

    if (existing) {
      throw new ConflictException(
        'Payment already recorded for this order',
      );
    }

    return this.prisma.payment.create({
      data: {
        order_id: orderId,
        method: dto.method,
        amount: dto.amount,
        status: 'paid',
        notes: dto.notes,
      },
    });
  }

  // ---------------------------------------------------------------
  // Update Delivery
  // ---------------------------------------------------------------
  async updateDelivery(orderId: string, dto: UpdateDeliveryDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
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

    return this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });
  }

  // ---------------------------------------------------------------
  // Daily Summary
  // ---------------------------------------------------------------
  async getDailySummary(date: string) {
    // Parse as IST (UTC+05:30) per Research Pitfall 6
    const start = new Date(`${date}T00:00:00+05:30`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const orders = await this.prisma.order.findMany({
      where: {
        created_at: { gte: start, lt: end },
        status: { not: 'cancelled' },
      },
      include: { payment: true },
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => {
      if (order.payment && order.payment.status === 'paid') {
        return sum + Number(order.total);
      }
      return sum;
    }, 0);
    const averageOrderValue =
      totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      average_order_value: averageOrderValue,
    };
  }
}
