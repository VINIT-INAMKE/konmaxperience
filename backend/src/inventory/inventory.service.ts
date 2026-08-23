import { Injectable, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { convertUnit } from '../common/utils/unit-conversion';
import {
  DomainEvent,
  domainEventBase,
  emitDomainEvent,
  systemActor,
} from '../common/events/domain-events';
import { DEFAULT_NODE_ID } from '../node/node.constants';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(page?: number, limit?: number) {
    const take = Math.min(Number(limit) || 50, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    const stocks = await this.prisma.ingredientStock.findMany({
      include: {
        ingredient: {
          select: {
            id: true,
            name: true,
            category_id: true,
            category_obj: { select: { id: true, name: true } },
            base_unit: true,
            min_stock_level: true,
          },
        },
        zone: { select: { id: true, name: true } },
      },
      orderBy: { ingredient: { name: 'asc' } },
      take,
      skip,
    });

    return stocks.map((s) => ({
      ...s,
      low_stock:
        Number(s.current_quantity) < Number(s.ingredient.min_stock_level),
    }));
  }

  async getMovements(ingredientId: string, page?: number, limit?: number) {
    const take = Math.min(Number(limit) || 50, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    return this.prisma.stockMovement.findMany({
      where: { ingredient_id: ingredientId },
      include: {
        creator: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
      take,
      skip,
    });
  }

  async adjust(dto: CreateStockAdjustmentDto, userId: string, referenceType?: string, referenceId?: string) {
    const stock = await this.prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.findUniqueOrThrow({
        where: { id: dto.ingredient_id },
      });

      // Convert the adjustment unit to base_unit — pass tx (Pitfall 2)
      const convertedQty = await convertUnit(
        dto.quantity,
        dto.unit,
        ingredient.base_unit,
        tx,
      );
      if (convertedQty === null) {
        throw new BadRequestException(
          `No unit conversion from ${dto.unit} to ${ingredient.base_unit}`,
        );
      }

      // For negative adjustments, verify sufficient stock
      if (convertedQty < 0) {
        const existingStock = await tx.ingredientStock.findUnique({
          where: {
            ingredient_id_zone_id: {
              ingredient_id: dto.ingredient_id,
              zone_id: dto.zone_id,
            },
          },
        });
        const currentQty = existingStock ? Number(existingStock.current_quantity) : 0;
        if (currentQty + convertedQty < 0) {
          throw new BadRequestException(
            `Insufficient stock: have ${currentQty} ${ingredient.base_unit}, adjustment would result in negative stock`,
          );
        }
      }

      // Upsert IngredientStock — increment by converted quantity
      await tx.ingredientStock.upsert({
        where: {
          ingredient_id_zone_id: {
            ingredient_id: dto.ingredient_id,
            zone_id: dto.zone_id,
          },
        },
        create: {
          ingredient_id: dto.ingredient_id,
          zone_id: dto.zone_id,
          current_quantity: convertedQty,
        },
        update: { current_quantity: { increment: convertedQty } },
      });

      // Create StockMovement record (H4: include reference atomically if provided)
      await tx.stockMovement.create({
        data: {
          ingredient_id: dto.ingredient_id,
          zone_id: dto.zone_id,
          movement_type: MovementType.adjustment,
          quantity: convertedQty,
          original_quantity: Math.abs(dto.quantity),
          unit: dto.unit,
          reason: dto.reason,
          created_by: userId,
          ...(referenceType ? { reference_type: referenceType } : {}),
          ...(referenceId ? { reference_id: referenceId } : {}),
        },
      });

      return tx.ingredientStock.findUnique({
        where: {
          ingredient_id_zone_id: {
            ingredient_id: dto.ingredient_id,
            zone_id: dto.zone_id,
          },
        },
        include: {
          ingredient: {
            select: {
              id: true,
              name: true,
              category_id: true,
              category_obj: { select: { id: true, name: true } },
              base_unit: true,
              min_stock_level: true,
            },
          },
          zone: { select: { id: true, name: true } },
        },
      });
    });

    // Emit stock.low AFTER the transaction commits (SPEC §4.1).
    // `IngredientStock` carries no `node_id`, so the default node is used.
    if (
      stock &&
      Number(stock.current_quantity) < Number(stock.ingredient.min_stock_level)
    ) {
      emitDomainEvent(this.eventEmitter, DomainEvent.STOCK_LOW, {
        ...domainEventBase(DEFAULT_NODE_ID, systemActor()),
        ingredientId: stock.ingredient_id,
        ingredientName: stock.ingredient.name,
        currentQty: Number(stock.current_quantity),
        minQty: Number(stock.ingredient.min_stock_level),
        unit: stock.ingredient.base_unit,
        zoneId: stock.zone_id,
      });
    }

    return stock;
  }

  async findAllForExport() {
    return this.prisma.ingredientStock.findMany({
      orderBy: [{ ingredient: { name: 'asc' } }],
      include: {
        ingredient: {
          select: {
            name: true,
            category_obj: { select: { name: true } },
            base_unit: true,
            min_stock_level: true,
          },
        },
        zone: { select: { name: true } },
      },
    });
  }

  async findMovementsForExport(dateFrom?: string, dateTo?: string) {
    const where: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      where.created_at = {};
      if (dateFrom) (where.created_at as any).gte = new Date(dateFrom);
      if (dateTo)
        (where.created_at as any).lte = new Date(dateTo + 'T23:59:59.999Z');
    }
    return this.prisma.stockMovement.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        ingredient: { select: { name: true } },
        zone: { select: { name: true } },
        creator: { select: { name: true } },
      },
    });
  }

  async getLowStock() {
    // Prisma doesn't support cross-field comparisons in WHERE clauses,
    // so we use $queryRaw to filter at DB level for efficiency
    const lowStockRows: Array<{ ingredient_id: string; zone_id: string }> =
      await this.prisma.$queryRaw`
        SELECT s.ingredient_id, s.zone_id
        FROM "IngredientStock" s
        JOIN "Ingredient" i ON i.id = s.ingredient_id
        WHERE s.current_quantity < i.min_stock_level
      `;

    if (lowStockRows.length === 0) return [];

    // Build composite key set for filtering
    const compositeKeys = lowStockRows.map((r) => ({
      ingredient_id: r.ingredient_id,
      zone_id: r.zone_id,
    }));

    return this.prisma.ingredientStock.findMany({
      where: {
        OR: compositeKeys.map((k) => ({
          ingredient_id: k.ingredient_id,
          zone_id: k.zone_id,
        })),
      },
      include: {
        ingredient: {
          select: {
            id: true,
            name: true,
            category_id: true,
            category_obj: { select: { id: true, name: true } },
            base_unit: true,
            min_stock_level: true,
          },
        },
        zone: { select: { id: true, name: true } },
      },
    });
  }
}
