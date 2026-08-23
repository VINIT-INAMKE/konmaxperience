import { Injectable, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MovementType, PrepBatchStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePrepBatchDto } from './dto/create-prep-batch.dto';
import { PreviewDeductionsDto } from './dto/preview-deductions.dto';
import { convertUnit } from '../../common/utils/unit-conversion';
import {
  DomainEvent,
  domainEventBase,
  emitDomainEvent,
  userActor,
} from '../../common/events/domain-events';

/**
 * One `prep_batch.depleted` event, collected inside the transaction and emitted
 * only once it commits (SPEC §4.1 — nothing is emitted from inside `tx`).
 */
interface DepletedBatch {
  prepBatchId: string;
  nodeId: string;
  recipeId: string;
  recipeName: string;
  zoneId: string;
}

const RECIPE_INCLUDE = {
  RecipeLines: {
    include: {
      ingredient: { select: { id: true, name: true, base_unit: true } },
      source_recipe: { select: { id: true, name: true, yield_unit: true } },
    },
  },
} as const;

/** WHERE clause to find active, non-expired prep batches */
function activeBatchWhere(recipeId: string, zoneId?: string) {
  const where: Record<string, unknown> = {
    recipe_id: recipeId,
    status: PrepBatchStatus.active,
    OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
  };
  if (zoneId) {
    where.zone_id = zoneId;
  }
  return where;
}

@Injectable()
export class PrepBatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(
    zoneId?: string,
    status?: string,
    page?: number,
    limit?: number,
  ) {
    const where: Record<string, unknown> = {};
    if (zoneId) where.zone_id = zoneId;
    if (status) where.status = status;

    const take = Math.min(Number(limit) || 50, 100);
    const skip = ((Number(page) || 1) - 1) * take;

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
    return this.prisma.prepBatch.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        recipe: { select: { name: true } },
        zone: { select: { name: true } },
        creator: { select: { name: true } },
      },
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

    // Collect all ingredient IDs and source recipe IDs from BOM lines
    const ingredientIds: string[] = [];
    const sourceRecipeIds: string[] = [];
    for (const line of recipe.RecipeLines) {
      if (line.input_type === 'ingredient' && line.ingredient) {
        ingredientIds.push(line.ingredient.id);
      } else if (line.input_type === 'recipe' && line.source_recipe) {
        sourceRecipeIds.push(line.source_recipe.id);
      }
    }

    // Batch-fetch all ingredient stocks and prep batches in parallel
    const [ingredientStocks, prepBatches] = await Promise.all([
      ingredientIds.length > 0
        ? this.prisma.ingredientStock.findMany({
            where: {
              ingredient_id: { in: ingredientIds },
              zone_id: dto.zone_id,
            },
          })
        : [],
      sourceRecipeIds.length > 0
        ? this.prisma.prepBatch.findMany({
            where: {
              recipe_id: { in: sourceRecipeIds },
              zone_id: dto.zone_id,
              status: PrepBatchStatus.active,
              OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
            },
          })
        : [],
    ]);

    // Build lookup maps
    const stockMap = new Map<string, number>();
    for (const stock of ingredientStocks) {
      stockMap.set(stock.ingredient_id, Number(stock.current_quantity));
    }
    const batchMap = new Map<string, number>();
    for (const batch of prepBatches) {
      batchMap.set(
        batch.recipe_id,
        (batchMap.get(batch.recipe_id) ?? 0) + Number(batch.quantity_remaining),
      );
    }

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

        const available = stockMap.get(line.ingredient.id) ?? 0;

        lines.push({
          input_name: line.ingredient.name,
          input_type: 'ingredient',
          available,
          required: neededBase,
          unit: line.ingredient.base_unit,
          sufficient: available >= neededBase,
        });
      } else if (line.input_type === 'recipe' && line.source_recipe) {
        const totalRemaining = batchMap.get(line.source_recipe.id) ?? 0;

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
    const depleted: DepletedBatch[] = [];

    const prepBatch = await this.prisma.$transaction(
      async (tx) => {
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
            status: PrepBatchStatus.active,
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
            await this.deductSubRecipeBatches(
              tx,
              {
                sourceRecipeId: line.source_recipe.id,
                sourceRecipeName: line.source_recipe.name,
                sourceYieldUnit: line.source_recipe.yield_unit,
                lineUnit: line.unit,
                needed,
                zoneId: dto.zone_id,
              },
              depleted,
            );
          }
        }

        return prepBatch;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // Emit AFTER the transaction commits (SPEC §4.1).
    emitDomainEvent(this.eventEmitter, DomainEvent.PREP_BATCH_CREATED, {
      ...domainEventBase(prepBatch.node_id, userActor(userId)),
      prepBatchId: prepBatch.id,
      recipeId: prepBatch.recipe_id,
      recipeName: prepBatch.recipe?.name ?? '',
      zoneId: prepBatch.zone_id,
      quantityProduced: String(prepBatch.quantity_produced),
      unit: prepBatch.unit,
    });

    for (const batch of depleted) {
      emitDomainEvent(this.eventEmitter, DomainEvent.PREP_BATCH_DEPLETED, {
        ...domainEventBase(batch.nodeId, userActor(userId)),
        prepBatchId: batch.prepBatchId,
        recipeId: batch.recipeId,
        recipeName: batch.recipeName,
        zoneId: batch.zoneId,
      });
    }

    return prepBatch;
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
        movement_type: MovementType.prep_deducted,
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
      zoneId: string;
    },
    depleted: DepletedBatch[],
  ) {
    // Fetch active, non-expired batches in FIFO order (oldest first), filtered by zone
    const batches = await tx.prepBatch.findMany({
      where: activeBatchWhere(params.sourceRecipeId, params.zoneId),
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
          ...(newRemaining <= 0 ? { status: PrepBatchStatus.depleted } : {}),
        },
      });

      // Recorded, not emitted — the caller fires these once the tx commits.
      if (newRemaining <= 0) {
        depleted.push({
          prepBatchId: batch.id,
          nodeId: batch.node_id,
          recipeId: params.sourceRecipeId,
          recipeName: params.sourceRecipeName,
          zoneId: params.zoneId,
        });
      }

      remainingNeed -= deduct;
    }

    if (remainingNeed > 0) {
      throw new BadRequestException(
        `Insufficient prep batch stock for ${params.sourceRecipeName}`,
      );
    }
  }
}
