import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { convertUnit } from '../common/utils/unit-conversion';

const PO_INCLUDE = {
  vendor: { select: { id: true, name: true } },
  zone: { select: { id: true, name: true } },
  ordered_by_user: { select: { id: true, name: true } },
  lines: {
    include: {
      ingredient: { select: { id: true, name: true, base_unit: true } },
    },
  },
} as const;

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: string) {
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }
    return this.prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
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
    const status = dto.status || 'draft';
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
          ...(status === 'ordered' && { ordered_at: new Date() }),
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

  async update(id: string, data: { notes?: string; status?: string }) {
    const po = await this.findOne(id);

    // Only allow transitioning from draft to ordered via PATCH
    if (data.status && data.status !== 'ordered') {
      throw new BadRequestException(
        'Only draft to ordered status transition is allowed via PATCH',
      );
    }
    if (data.status === 'ordered' && po.status !== 'draft') {
      throw new BadRequestException(
        'Can only transition to ordered from draft status',
      );
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status === 'ordered' && {
          status: 'ordered',
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
        include: { lines: true },
      });
      if (po.status !== 'ordered') {
        throw new BadRequestException('PO must be in ordered status');
      }

      let totalReceived = new Decimal(0);

      for (const lineReceived of dto.lines) {
        if (!lineReceived.received_quantity || lineReceived.received_quantity <= 0) {
          continue;
        }

        const poLine = po.lines.find((l) => l.id === lineReceived.id);
        if (!poLine) continue;

        const ingredient = await tx.ingredient.findUniqueOrThrow({
          where: { id: poLine.ingredient_id },
        });

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
            movement_type: 'received',
            quantity: qtyBase,
            original_quantity: lineReceived.received_quantity,
            unit: poLine.unit,
            reference_type: 'purchase_order',
            reference_id: poId,
            created_by: userId,
          },
        });

        // Update line received_quantity
        await tx.purchaseOrderLine.update({
          where: { id: poLine.id },
          data: { received_quantity: lineReceived.received_quantity },
        });

        totalReceived = totalReceived.add(
          new Decimal(lineReceived.received_quantity).mul(
            new Decimal(Number(poLine.unit_cost)),
          ),
        );
      }

      return tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: 'received',
          received_at: new Date(),
          total_amount: totalReceived,
        },
        include: {
          lines: { include: { ingredient: true } },
          vendor: true,
          zone: true,
        },
      });
    });
  }

  async cancel(id: string) {
    const po = await this.findOne(id);
    if (po.status !== 'draft' && po.status !== 'ordered') {
      throw new BadRequestException(
        'Can only cancel POs in draft or ordered status',
      );
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'cancelled' },
      include: PO_INCLUDE,
    });
  }
}
