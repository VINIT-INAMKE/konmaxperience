import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWasteLogDto } from './dto/create-waste-log.dto';
import { convertUnit } from '../../common/utils/unit-conversion';

@Injectable()
export class WasteService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(zoneId?: string) {
    const where: Record<string, unknown> = {};
    if (zoneId) {
      where.zone_id = zoneId;
    }

    return this.prisma.wasteLog.findMany({
      where,
      include: {
        ingredient: { select: { id: true, name: true, base_unit: true } },
        prep_batch: {
          include: {
            recipe: { select: { id: true, name: true, yield_unit: true, yield_qty: true } },
          },
        },
        zone: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
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

      // Fetch ingredient for base_unit
      const ingredient = await this.prisma.ingredient.findUniqueOrThrow({
        where: { id: dto.ingredient_id },
      });

      // Fetch latest VendorPrice for ingredient
      const latestPrice = await this.prisma.vendorPrice.findFirst({
        where: { ingredient_id: dto.ingredient_id },
        orderBy: { effective_date: 'desc' },
      });

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
      convertedQtyInBaseUnit = toBase ?? dto.quantity;

      // Transaction: create WasteLog + StockMovement + decrement IngredientStock
      return this.prisma.$transaction(async (tx) => {
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

        // Decrement PrepBatch quantity_remaining
        const updatedBatch = await tx.prepBatch.update({
          where: { id: dto.prep_batch_id },
          data: {
            quantity_remaining: { decrement: dto.quantity },
          },
        });

        // Mark as depleted if quantity_remaining <= 0
        if (Number(updatedBatch.quantity_remaining) <= 0) {
          await tx.prepBatch.update({
            where: { id: dto.prep_batch_id },
            data: { status: 'depleted' },
          });
        }

        return wasteLog;
      });
    }

    throw new BadRequestException(
      'waste_type must be either "ingredient" or "prep_batch"',
    );
  }
}
