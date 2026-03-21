import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePrepBatchDto } from './dto/create-prep-batch.dto';
import { PreviewDeductionsDto } from './dto/preview-deductions.dto';
import { convertUnit } from '../../common/utils/unit-conversion';

const RECIPE_INCLUDE = {
  RecipeLines: {
    include: {
      ingredient: { select: { id: true, name: true, base_unit: true } },
      source_recipe: { select: { id: true, name: true, yield_unit: true } },
    },
  },
} as const;

/** WHERE clause to find active, non-expired prep batches */
function activeBatchWhere(recipeId: string) {
  return {
    recipe_id: recipeId,
    status: 'active',
    OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
  };
}

@Injectable()
export class PrepBatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(zoneId?: string, status?: string) {
    const where: Record<string, unknown> = {};
    if (zoneId) where.zone_id = zoneId;
    if (status) where.status = status;

    return this.prisma.prepBatch.findMany({
      where,
      include: {
        recipe: {
          select: {
            name: true,
            yield_unit: true,
            shelf_life_hours: true,
            computed_cost: true,
          },
        },
        zone: { select: { name: true } },
        creator: { select: { name: true } },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * Read-only availability check for the prep wizard (Step 2).
   * Returns one DeductionPreviewLine per BOM input showing available vs required.
   * Does NOT write any data.
   */
  async previewDeductions(dto: PreviewDeductionsDto) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: dto.recipe_id },
      include: RECIPE_INCLUDE,
    });
    if (!recipe) {
      throw new BadRequestException(`Recipe ${dto.recipe_id} not found`);
    }

    const multiplier = dto.quantity_to_prep / Number(recipe.yield_qty);
    const lines: Array<{
      input_name: string;
      input_type: string;
      available: number;
      required: number;
      unit: string;
      sufficient: boolean;
    }> = [];

    for (const line of recipe.RecipeLines) {
      const needed = Number(line.quantity) * multiplier;

      if (line.input_type === 'ingredient' && line.ingredient) {
        // Convert needed to base_unit — use this.prisma (read-only, no tx)
        const neededBase = await convertUnit(
          needed,
          line.unit,
          line.ingredient.base_unit,
          this.prisma,
        );
        if (neededBase === null) {
          throw new BadRequestException(
            `No unit conversion from ${line.unit} to ${line.ingredient.base_unit}`,
          );
        }

        const stock = await (this.prisma as any).ingredientStock.findUnique({
          where: {
            ingredient_id_zone_id: {
              ingredient_id: line.ingredient.id,
              zone_id: dto.zone_id,
            },
          },
        });
        const available = stock ? Number(stock.current_quantity) : 0;

        lines.push({
          input_name: line.ingredient.name,
          input_type: 'ingredient',
          available,
          required: neededBase,
          unit: line.ingredient.base_unit,
          sufficient: available >= neededBase,
        });
      } else if (line.input_type === 'recipe' && line.source_recipe) {
        // Fetch active non-expired prep batches for source recipe
        const batches = await this.prisma.prepBatch.findMany({
          where: activeBatchWhere(line.source_recipe.id),
          orderBy: { created_at: 'asc' },
        });
        const totalRemaining = batches.reduce(
          (sum, b) => sum + Number(b.quantity_remaining),
          0,
        );

        // Convert needed to source recipe's yield unit if different
        const convertedNeeded = await convertUnit(
          needed,
          line.unit,
          line.source_recipe.yield_unit,
          this.prisma,
        );
        if (convertedNeeded === null) {
          throw new BadRequestException(
            `No unit conversion from ${line.unit} to ${line.source_recipe.yield_unit}`,
          );
        }

        lines.push({
          input_name: line.source_recipe.name,
          input_type: 'recipe',
          available: totalRemaining,
          required: convertedNeeded,
          unit: line.source_recipe.yield_unit,
          sufficient: totalRemaining >= convertedNeeded,
        });
      }
    }

    return lines;
  }

  /**
   * Create a PrepBatch with atomic deduction of raw ingredients and sub-recipe batches.
   * Uses $transaction — all deductions roll back on any failure.
   */
  async createPrepBatch(dto: CreatePrepBatchDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.findUnique({
        where: { id: dto.recipe_id },
        include: RECIPE_INCLUDE,
      });
      if (!recipe) {
        throw new BadRequestException(`Recipe ${dto.recipe_id} not found`);
      }

      const multiplier = dto.quantity_to_prep / Number(recipe.yield_qty);

      // Create PrepBatch first to get its ID for StockMovement references
      const prepBatch = await tx.prepBatch.create({
        data: {
          recipe_id: dto.recipe_id,
          zone_id: dto.zone_id,
          quantity_produced: dto.quantity_to_prep,
          quantity_remaining: dto.quantity_to_prep,
          unit: recipe.yield_unit,
          prepared_by: userId,
          expires_at: recipe.shelf_life_hours
            ? new Date(Date.now() + recipe.shelf_life_hours * 3600000)
            : null,
          status: 'active',
        },
        include: {
          recipe: { select: { name: true } },
          zone: { select: { name: true } },
        },
      });

      // Deduct inputs for each BOM line
      for (const line of recipe.RecipeLines) {
        const needed = Number(line.quantity) * multiplier;

        if (line.input_type === 'ingredient' && line.ingredient) {
          await this.deductIngredient(tx, {
            ingredientId: line.ingredient.id,
            ingredientName: line.ingredient.name,
            baseUnit: line.ingredient.base_unit,
            lineUnit: line.unit,
            needed,
            zoneId: dto.zone_id,
            prepBatchId: prepBatch.id,
            userId,
          });
        } else if (line.input_type === 'recipe' && line.source_recipe) {
          await this.deductSubRecipeBatches(tx, {
            sourceRecipeId: line.source_recipe.id,
            sourceRecipeName: line.source_recipe.name,
            sourceYieldUnit: line.source_recipe.yield_unit,
            lineUnit: line.unit,
            needed,
          });
        }
      }

      return prepBatch;
    });
  }

  /**
   * Deduct a raw ingredient from IngredientStock within a transaction.
   */
  private async deductIngredient(
    tx: any,
    params: {
      ingredientId: string;
      ingredientName: string;
      baseUnit: string;
      lineUnit: string;
      needed: number;
      zoneId: string;
      prepBatchId: string;
      userId: string;
    },
  ) {
    // Convert to base_unit — pass tx (Pitfall 2)
    const neededBase = await convertUnit(
      params.needed,
      params.lineUnit,
      params.baseUnit,
      tx,
    );
    if (neededBase === null) {
      throw new BadRequestException(
        `No unit conversion from ${params.lineUnit} to ${params.baseUnit}`,
      );
    }

    const stock = await tx.ingredientStock.findUnique({
      where: {
        ingredient_id_zone_id: {
          ingredient_id: params.ingredientId,
          zone_id: params.zoneId,
        },
      },
    });

    const available = stock ? Number(stock.current_quantity) : 0;
    if (available < neededBase) {
      throw new BadRequestException(
        `Insufficient stock for ${params.ingredientName}: need ${neededBase} ${params.baseUnit}, have ${available}`,
      );
    }

    await tx.ingredientStock.update({
      where: {
        ingredient_id_zone_id: {
          ingredient_id: params.ingredientId,
          zone_id: params.zoneId,
        },
      },
      data: { current_quantity: { decrement: neededBase } },
    });

    await tx.stockMovement.create({
      data: {
        ingredient_id: params.ingredientId,
        zone_id: params.zoneId,
        movement_type: 'prep_deducted',
        quantity: -neededBase,
        original_quantity: params.needed,
        unit: params.lineUnit,
        reference_type: 'prep_batch',
        reference_id: params.prepBatchId,
        created_by: params.userId,
      },
    });
  }

  /**
   * Deduct from sub-recipe PrepBatches in FIFO order within a transaction.
   */
  private async deductSubRecipeBatches(
    tx: any,
    params: {
      sourceRecipeId: string;
      sourceRecipeName: string;
      sourceYieldUnit: string;
      lineUnit: string;
      needed: number;
    },
  ) {
    // Fetch active, non-expired batches in FIFO order (oldest first)
    const batches = await tx.prepBatch.findMany({
      where: activeBatchWhere(params.sourceRecipeId),
      orderBy: { created_at: 'asc' },
    });

    // Convert needed to batch yield unit if different — pass tx (Pitfall 2)
    let remainingNeed = await convertUnit(
      params.needed,
      params.lineUnit,
      params.sourceYieldUnit,
      tx,
    );
    if (remainingNeed === null) {
      throw new BadRequestException(
        `No unit conversion from ${params.lineUnit} to ${params.sourceYieldUnit}`,
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
        `Insufficient prep batch stock for ${params.sourceRecipeName}`,
      );
    }
  }
}
