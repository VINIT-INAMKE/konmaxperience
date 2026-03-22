import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWasteLogDto } from './dto/create-waste-log.dto';
import { convertUnit } from '../../common/utils/unit-conversion';

@Injectable()
export class WasteService {
  constructor(private readonly prisma: PrismaService) {}

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
        convertedQtyForCost = toPrice ?? 0;
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
      return this.prisma.$transaction(async (tx) => {
        // Check stock sufficiency before decrementing
        const existingStock = await tx.ingredientStock.findFirst({
          where: {
            ingredient_id: dto.ingredient_id!,
            zone_id: dto.zone_id,
          },
        });
        const currentQty = existingStock ? Number(existingStock.current_quantity) : 0;
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
            movement_type: 'waste',
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

      // cost_impact = (dto.quantity / quantity_produced) * computed_cost
      const quantityProduced = Number(prepBatch.quantity_produced);
      if (quantityProduced > 0) {
        cost_impact =
          (dto.quantity / quantityProduced) *
          Number(prepBatch.recipe.computed_cost ?? 0);
      }

      // Check sufficiency before decrementing
      if (Number(prepBatch.quantity_remaining) < dto.quantity) {
        throw new BadRequestException(
          'Waste quantity exceeds remaining prep batch quantity',
        );
      }

      // Transaction: create WasteLog + decrement PrepBatch quantity_remaining
      return this.prisma.$transaction(async (tx) => {
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
        const newRemaining = Number(prepBatch.quantity_remaining) - dto.quantity;
        await tx.prepBatch.update({
          where: { id: dto.prep_batch_id },
          data: {
            quantity_remaining: { decrement: dto.quantity },
            ...(newRemaining <= 0 ? { status: 'depleted' } : {}),
          },
        });

        return wasteLog;
      });
    }

    throw new BadRequestException(
      'waste_type must be either "ingredient" or "prep_batch"',
    );
  }
}
