import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { MovementType, Prisma, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { convertUnit } from '../common/utils/unit-conversion';
import { parseEnum } from '../common/utils/parse-enum';

const PO_INCLUDE = {
  vendor: { select: { id: true, name: true } },
  zone: { select: { id: true, name: true } },
  ordered_by_user: { select: { id: true, name: true } },
  lines: {
    include: {
      ingredient: { select: { id: true, name: true, base_unit: true } },
    },
  },
  linked_task: { select: { id: true, title: true } },
} as const;

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: string) {
    const where: Prisma.PurchaseOrderWhereInput = {};
    if (status) {
      where.status = parseEnum(PurchaseOrderStatus, status, 'status');
    }
    return this.prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
        linked_task: { select: { id: true, title: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: PO_INCLUDE,
    });
    if (!po) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }
    return po;
  }

  async create(dto: CreatePurchaseOrderDto, userId: string) {
    const status = dto.status ?? PurchaseOrderStatus.draft;
    const totalAmount = dto.lines.reduce(
      (sum, line) => sum + line.quantity * line.unit_cost,
      0,
    );

    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          vendor_id: dto.vendor_id,
          zone_id: dto.zone_id,
          notes: dto.notes,
          status,
          total_amount: totalAmount,
          ordered_by: userId,
          ...(dto.linked_task_id && { linked_task_id: dto.linked_task_id }),
          ...(status === PurchaseOrderStatus.ordered && {
            ordered_at: new Date(),
          }),
          lines: {
            create: dto.lines.map((line) => ({
              ingredient_id: line.ingredient_id,
              quantity: line.quantity,
              unit: line.unit,
              unit_cost: line.unit_cost,
            })),
          },
        },
        include: PO_INCLUDE,
      });
      return po;
    });
  }

  async update(
    id: string,
    data: {
      notes?: string;
      status?: PurchaseOrderStatus;
      linked_task_id?: string;
    },
  ) {
    const po = await this.findOne(id);

    // Only allow transitioning from draft to ordered via PATCH
    if (data.status && data.status !== PurchaseOrderStatus.ordered) {
      throw new BadRequestException(
        'Only draft to ordered status transition is allowed via PATCH',
      );
    }
    if (
      data.status === PurchaseOrderStatus.ordered &&
      po.status !== PurchaseOrderStatus.draft
    ) {
      throw new BadRequestException(
        'Can only transition to ordered from draft status',
      );
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.linked_task_id !== undefined && { linked_task_id: data.linked_task_id || null }),
        ...(data.status === PurchaseOrderStatus.ordered && {
          status: PurchaseOrderStatus.ordered,
          ordered_at: new Date(),
        }),
      },
      include: PO_INCLUDE,
    });
  }

  async receivePurchaseOrder(
    poId: string,
    dto: ReceivePurchaseOrderDto,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id: poId },
        include: {
          lines: {
            include: {
              ingredient: { select: { id: true, base_unit: true } },
            },
          },
        },
      });
      if (po.status !== PurchaseOrderStatus.ordered) {
        throw new BadRequestException(
          'PO must be in ordered status to receive',
        );
      }

      for (const lineReceived of dto.lines) {
        if (!lineReceived.received_quantity || lineReceived.received_quantity <= 0) {
          continue;
        }

        const poLine = po.lines.find((l) => l.id === lineReceived.id);
        if (!poLine) continue;

        // Validate cumulative received does not exceed ordered quantity
        const currentReceived = Number(poLine.received_quantity ?? 0);
        if (currentReceived + lineReceived.received_quantity > Number(poLine.quantity)) {
          throw new BadRequestException(
            `Receiving ${lineReceived.received_quantity} for line ${poLine.id} would exceed ordered quantity of ${poLine.quantity} (already received ${currentReceived})`,
          );
        }

        const ingredient = poLine.ingredient;

        // Convert procurement unit to base_unit — pass tx, not this.prisma (Pitfall 2)
        const qtyBase = await convertUnit(
          lineReceived.received_quantity,
          poLine.unit,
          ingredient.base_unit,
          tx,
        );
        if (qtyBase === null) {
          throw new BadRequestException(
            `No unit conversion from ${poLine.unit} to ${ingredient.base_unit}`,
          );
        }

        // Upsert IngredientStock (getOrCreate pattern)
        await tx.ingredientStock.upsert({
          where: {
            ingredient_id_zone_id: {
              ingredient_id: poLine.ingredient_id,
              zone_id: po.zone_id,
            },
          },
          create: {
            ingredient_id: poLine.ingredient_id,
            zone_id: po.zone_id,
            current_quantity: qtyBase,
          },
          update: { current_quantity: { increment: qtyBase } },
        });

        // Create StockMovement
        await tx.stockMovement.create({
          data: {
            ingredient_id: poLine.ingredient_id,
            zone_id: po.zone_id,
            movement_type: MovementType.purchase_received,
            quantity: qtyBase,
            original_quantity: lineReceived.received_quantity,
            unit: poLine.unit,
            reference_type: 'purchase_order',
            reference_id: poId,
            created_by: userId,
          },
        });

        // Increment line received_quantity (not overwrite)
        await tx.purchaseOrderLine.update({
          where: { id: poLine.id },
          data: {
            received_quantity: { increment: lineReceived.received_quantity },
          },
        });
      }

      // Re-fetch lines to determine correct status after increments
      const updatedLines = await tx.purchaseOrderLine.findMany({
        where: { po_id: poId },
      });

      const allFullyReceived = updatedLines.every(
        (line) => Number(line.received_quantity ?? 0) >= Number(line.quantity),
      );

      const newStatus = allFullyReceived
        ? PurchaseOrderStatus.received
        : PurchaseOrderStatus.ordered;

      return tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: newStatus,
          ...(allFullyReceived && { received_at: new Date() }),
          // Do NOT overwrite total_amount — it should remain as the ordered total
        },
        include: PO_INCLUDE,
      });
    });
  }

  async findAllForExport(dateFrom?: string, dateTo?: string) {
    const where: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      where.created_at = {};
      if (dateFrom) (where.created_at as any).gte = new Date(dateFrom);
      if (dateTo)
        (where.created_at as any).lte = new Date(dateTo + 'T23:59:59.999Z');
    }
    return this.prisma.purchaseOrder.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        vendor: { select: { name: true } },
        zone: { select: { name: true } },
        ordered_by_user: { select: { name: true } },
        lines: {
          include: { ingredient: { select: { name: true, base_unit: true } } },
        },
      },
    });
  }

  async cancel(id: string) {
    const po = await this.findOne(id);
    if (
      po.status !== PurchaseOrderStatus.draft &&
      po.status !== PurchaseOrderStatus.ordered
    ) {
      throw new BadRequestException(
        'Can only cancel POs in draft or ordered status',
      );
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.cancelled },
      include: PO_INCLUDE,
    });
  }
}
