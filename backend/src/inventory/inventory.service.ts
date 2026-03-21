import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { convertUnit } from '../common/utils/unit-conversion';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const stocks = await this.prisma.ingredientStock.findMany({
      include: {
        ingredient: {
          select: {
            id: true,
            name: true,
            category: true,
            base_unit: true,
            min_stock_level: true,
          },
        },
        zone: { select: { id: true, name: true } },
      },
      orderBy: { ingredient: { name: 'asc' } },
    });

    return stocks.map((s) => ({
      ...s,
      low_stock:
        Number(s.current_quantity) < Number(s.ingredient.min_stock_level),
    }));
  }

  async getMovements(ingredientId: string) {
    return this.prisma.stockMovement.findMany({
      where: { ingredient_id: ingredientId },
      include: {
        creator: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async adjust(dto: CreateStockAdjustmentDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
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

      // Create StockMovement record
      await tx.stockMovement.create({
        data: {
          ingredient_id: dto.ingredient_id,
          zone_id: dto.zone_id,
          movement_type: 'adjustment',
          quantity: convertedQty,
          original_quantity: Math.abs(dto.quantity),
          unit: dto.unit,
          reason: dto.reason,
          created_by: userId,
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
              category: true,
              base_unit: true,
              min_stock_level: true,
            },
          },
          zone: { select: { id: true, name: true } },
        },
      });
    });
  }

  async getLowStock() {
    const stocks = await this.prisma.ingredientStock.findMany({
      include: {
        ingredient: {
          select: {
            id: true,
            name: true,
            category: true,
            base_unit: true,
            min_stock_level: true,
          },
        },
        zone: { select: { id: true, name: true } },
      },
    });

    return stocks.filter(
      (s) => Number(s.current_quantity) < Number(s.ingredient.min_stock_level),
    );
  }
}
