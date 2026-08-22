import { Injectable, BadRequestException } from '@nestjs/common';
import { MovementType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplyUsageDto } from './dto/create-supply-usage.dto';

@Injectable()
export class SupplyUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.stockMovement.findMany({
      where: { movement_type: 'supply_usage' },
      orderBy: { created_at: 'desc' },
      include: {
        ingredient: { select: { id: true, name: true, base_unit: true } },
        zone: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    });
  }

  async create(dto: CreateSupplyUsageDto, userId: string) {
    // Validate ingredient is a supply
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id: dto.ingredient_id },
    });
    if (!ingredient) {
      throw new BadRequestException('Ingredient not found');
    }
    if (ingredient.usage_type !== 'supply') {
      throw new BadRequestException(
        'Only supplies can be logged here. This ingredient is a ' +
          ingredient.usage_type,
      );
    }

    // Use base quantity (simplified — unit conversion can be added if needed)
    const baseQty = dto.quantity;

    return this.prisma.$transaction(async (tx) => {
      // Create StockMovement
      const movement = await tx.stockMovement.create({
        data: {
          ingredient_id: dto.ingredient_id,
          zone_id: dto.zone_id,
          movement_type: MovementType.supply_usage,
          quantity: -baseQty, // negative = outgoing
          original_quantity: dto.quantity,
          unit: dto.unit,
          reason: dto.notes ?? 'Supply usage logged',
          reference_type: 'supply_usage',
          created_by: userId,
        },
      });

      // Decrement IngredientStock
      await tx.ingredientStock.updateMany({
        where: {
          ingredient_id: dto.ingredient_id,
          zone_id: dto.zone_id,
        },
        data: {
          current_quantity: { decrement: baseQty },
        },
      });

      return movement;
    });
  }
}
