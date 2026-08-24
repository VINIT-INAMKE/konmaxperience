import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MovementType, PrepBatchStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWasteLogDto } from './dto/create-waste-log.dto';
import { convertUnit } from '../../common/utils/unit-conversion';
import {
  DomainEvent,
  domainEventBase,
  emitDomainEvent,
  userActor,
} from '../../common/events/domain-events';

/** The single `waste.logged` shape, fired after either transaction branch commits. */
type WasteLogRow = {
  id: string;
  node_id: string;
  waste_type: string;
  reason: string;
  cost_impact: unknown;
  zone_id: string;
  ingredient_id: string | null;
  prep_batch_id: string | null;
};

@Injectable()
export class WasteService {
  private readonly logger = new Logger(WasteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Emitted AFTER the write commits (SPEC §4.1); never called from inside `tx`. */
  private emitWasteLogged(wasteLog: WasteLogRow, userId: string) {
    emitDomainEvent(this.eventEmitter, DomainEvent.WASTE_LOGGED, {
      ...domainEventBase(wasteLog.node_id, userActor(userId)),
      wasteLogId: wasteLog.id,
      wasteType: wasteLog.waste_type,
      reason: wasteLog.reason,
      costImpact: String(wasteLog.cost_impact),
      zoneId: wasteLog.zone_id,
      ingredientId: wasteLog.ingredient_id ?? null,
      prepBatchId: wasteLog.prep_batch_id ?? null,
    });
  }

  async findAll(zoneId?: string, page?: number, limit?: number) {
    const where: Record<string, unknown> = {};
    if (zoneId) {
      where.zone_id = zoneId;
    }

    const take = Math.min(Number(limit) || 50, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    return this.prisma.wasteLog.findMany({
      where,
      include: {
        ingredient: { select: { id: true, name: true, base_unit: true } },
        prep_batch: {
          select: {
            id: true,
            quantity_produced: true,
            quantity_remaining: true,
            unit: true,
            recipe: { select: { id: true, name: true, yield_unit: true } },
          },
        },
        zone: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
      take,
      skip,
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
    return this.prisma.wasteLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        ingredient: { select: { name: true } },
        prep_batch: {
          select: {
            recipe: { select: { name: true } },
          },
        },
        zone: { select: { name: true } },
        creator: { select: { name: true } },
      },
    });
  }

  async createWasteLog(dto: CreateWasteLogDto, userId: string) {
    let cost_impact = 0;

    if (dto.waste_type === 'ingredient') {
      if (!dto.ingredient_id) {
        throw new BadRequestException(
          'ingredient_id is required when waste_type is ingredient',
        );
      }

      // Fetch ingredient + latest vendor price in parallel
      const [ingredient, latestPrice] = await Promise.all([
        this.prisma.ingredient.findUniqueOrThrow({
          where: { id: dto.ingredient_id },
          select: { id: true, base_unit: true },
        }),
        this.prisma.vendorPrice.findFirst({
          where: { ingredient_id: dto.ingredient_id },
          orderBy: { effective_date: 'desc' },
          select: { price: true, unit: true },
        }),
      ]);

      let convertedQtyForCost = 0;
      let convertedQtyInBaseUnit = 0;

      if (latestPrice) {
        // Convert waste quantity to price unit for cost calc
        const toPrice = await convertUnit(
          dto.quantity,
          dto.unit,
          latestPrice.unit,
          this.prisma,
        );
        if (toPrice === null) {
          this.logger.warn(
            `[Waste] No unit conversion from ${dto.unit} to ${latestPrice.unit} for ingredient ${dto.ingredient_id} — cost_impact set to 0`,
          );
          convertedQtyForCost = 0;
        } else {
          convertedQtyForCost = toPrice;
        }
        cost_impact = convertedQtyForCost * Number(latestPrice.price);
      }

      // Convert waste quantity to base_unit for stock deduction
      const toBase = await convertUnit(
        dto.quantity,
        dto.unit,
        ingredient.base_unit,
        this.prisma,
      );
      if (toBase === null) {
        throw new BadRequestException(
          `No unit conversion found from ${dto.unit} to ${ingredient.base_unit}`,
        );
      }
      convertedQtyInBaseUnit = toBase;

      // Transaction: create WasteLog + StockMovement + decrement IngredientStock
      const wasteLog = await this.prisma.$transaction(async (tx) => {
        // Check stock sufficiency before decrementing
        const existingStock = await tx.ingredientStock.findFirst({
          where: {
            ingredient_id: dto.ingredient_id!,
            zone_id: dto.zone_id,
          },
        });
        const currentQty = existingStock
          ? Number(existingStock.current_quantity)
          : 0;
        if (currentQty < convertedQtyInBaseUnit) {
          throw new BadRequestException(
            `Insufficient stock: have ${currentQty} ${ingredient.base_unit}, need ${convertedQtyInBaseUnit} for waste deduction`,
          );
        }

        const wasteLog = await tx.wasteLog.create({
          data: {
            waste_type: dto.waste_type,
            ingredient_id: dto.ingredient_id,
            quantity: dto.quantity,
            unit: dto.unit,
            reason: dto.reason,
            reason_notes: dto.reason_notes,
            cost_impact,
            logged_by: userId,
            zone_id: dto.zone_id,
          },
        });

        // Create StockMovement for waste
        await tx.stockMovement.create({
          data: {
            ingredient_id: dto.ingredient_id!,
            zone_id: dto.zone_id,
            movement_type: MovementType.waste,
            quantity: -convertedQtyInBaseUnit,
            original_quantity: dto.quantity,
            unit: dto.unit,
            reason: `Waste: ${dto.reason}`,
            reference_type: 'waste_log',
            reference_id: wasteLog.id,
            created_by: userId,
          },
        });

        // Decrement IngredientStock
        await tx.ingredientStock.updateMany({
          where: {
            ingredient_id: dto.ingredient_id!,
            zone_id: dto.zone_id,
          },
          data: {
            current_quantity: { decrement: convertedQtyInBaseUnit },
          },
        });

        return wasteLog;
      });

      this.emitWasteLogged(wasteLog, userId);
      return wasteLog;
    }

    if (dto.waste_type === 'prep_batch') {
      if (!dto.prep_batch_id) {
        throw new BadRequestException(
          'prep_batch_id is required when waste_type is prep_batch',
        );
      }

      // Fetch PrepBatch with recipe for cost calculation
      const prepBatch = await this.prisma.prepBatch.findUniqueOrThrow({
        where: { id: dto.prep_batch_id },
        include: {
          recipe: { select: { computed_cost: true, yield_qty: true } },
        },
      });

      // Validate unit match or convert to prep batch unit
      let wasteQtyInBatchUnit = dto.quantity;
      if (dto.unit !== prepBatch.unit) {
        const converted = await convertUnit(
          dto.quantity,
          dto.unit,
          prepBatch.unit,
          this.prisma,
        );
        if (converted === null) {
          throw new BadRequestException(
            `No unit conversion from ${dto.unit} to ${prepBatch.unit} — prep batch uses ${prepBatch.unit}`,
          );
        }
        wasteQtyInBatchUnit = converted;
      }

      // cost_impact = (wasteQtyInBatchUnit / quantity_produced) * computed_cost
      const quantityProduced = Number(prepBatch.quantity_produced);
      if (quantityProduced > 0) {
        cost_impact =
          (wasteQtyInBatchUnit / quantityProduced) *
          Number(prepBatch.recipe.computed_cost ?? 0);
      }

      // Check sufficiency before decrementing
      if (Number(prepBatch.quantity_remaining) < wasteQtyInBatchUnit) {
        throw new BadRequestException(
          'Waste quantity exceeds remaining prep batch quantity',
        );
      }

      // Transaction: create WasteLog + decrement PrepBatch quantity_remaining
      const wasteLog = await this.prisma.$transaction(async (tx) => {
        const wasteLog = await tx.wasteLog.create({
          data: {
            waste_type: dto.waste_type,
            prep_batch_id: dto.prep_batch_id,
            quantity: dto.quantity,
            unit: dto.unit,
            reason: dto.reason,
            reason_notes: dto.reason_notes,
            cost_impact,
            logged_by: userId,
            zone_id: dto.zone_id,
          },
        });

        // Decrement PrepBatch quantity_remaining and mark depleted if needed
        const newRemaining =
          Number(prepBatch.quantity_remaining) - wasteQtyInBatchUnit;
        await tx.prepBatch.update({
          where: { id: dto.prep_batch_id },
          data: {
            quantity_remaining: { decrement: wasteQtyInBatchUnit },
            ...(newRemaining <= 0 ? { status: PrepBatchStatus.depleted } : {}),
          },
        });

        return wasteLog;
      });

      this.emitWasteLogged(wasteLog, userId);
      return wasteLog;
    }

    throw new BadRequestException(
      'waste_type must be either "ingredient" or "prep_batch"',
    );
  }
}
