import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { RecipeStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CostCalculatorService } from './cost-calculator.service';
import { convertUnit } from '../common/utils/unit-conversion';

const RECIPE_INCLUDE = {
  brand: { select: { id: true, name: true } },
  zone: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true } },
  RecipeLines: {
    include: {
      ingredient: {
        select: { id: true, name: true, base_unit: true },
      },
      source_recipe: {
        select: {
          id: true,
          name: true,
          yield_qty: true,
          yield_unit: true,
          computed_cost: true,
          RecipeLines: {
            include: {
              ingredient: {
                select: { id: true, name: true, base_unit: true },
              },
              source_recipe: {
                select: {
                  id: true,
                  name: true,
                  yield_qty: true,
                  yield_unit: true,
                  computed_cost: true,
                  RecipeLines: {
                    include: {
                      ingredient: { select: { id: true, name: true } },
                      source_recipe: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { sort_order: 'asc' as const },
  },
} as const;

@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costCalculatorService: CostCalculatorService,
  ) {}

  async findAll(filters: {
    brand_id?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.brand_id) {
      where.brand_id = filters.brand_id;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    const take = Math.min(Number(filters.limit) || 50, 100);
    const skip = ((Number(filters.page) || 1) - 1) * take;

    return this.prisma.recipe.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
      take,
      skip,
    });
  }

  async findAllForExport() {
    return this.prisma.recipe.findMany({
      orderBy: { name: 'asc' },
      include: {
        RecipeLines: {
          include: {
            ingredient: { select: { name: true, base_unit: true } },
          },
          orderBy: { sort_order: 'asc' as const },
        },
        creator: { select: { name: true } },
      },
    });
  }

  async findOne(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: RECIPE_INCLUDE,
    });
    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${id} not found`);
    }
    return recipe;
  }

  async create(dto: CreateRecipeDto, userId: string) {
    const recipe = await this.prisma.$transaction(async (tx) => {
      const created = await tx.recipe.create({
        data: {
          name: dto.name,
          description: dto.description,
          prep_steps: dto.prep_steps,
          cooking_method: dto.cooking_method,
          yield_qty: dto.yield_qty,
          yield_unit: dto.yield_unit,
          portion_size: dto.portion_size,
          ...(dto.shelf_life_hours !== undefined && {
            shelf_life_hours: dto.shelf_life_hours,
          }),
          ...(dto.brand_id !== undefined && { brand_id: dto.brand_id }),
          ...(dto.zone_id !== undefined && { zone_id: dto.zone_id }),
          ...(dto.image_url !== undefined && { image_url: dto.image_url }),
          ...(dto.preparation_type !== undefined && {
            preparation_type: dto.preparation_type,
          }),
          created_by: userId,
        },
      });

      if (dto.bom_lines && dto.bom_lines.length > 0) {
        await this.checkBomLinesForCycles(created.id, dto.bom_lines);

        await tx.recipeLine.createMany({
          data: dto.bom_lines.map((line, index) => ({
            recipe_id: created.id,
            input_type: line.input_type,
            ingredient_id:
              line.input_type === 'ingredient' ? line.item_id : null,
            source_recipe_id:
              line.input_type === 'recipe' ? line.item_id : null,
            quantity: line.quantity,
            unit: line.unit,
            prep_notes: line.prep_notes,
            sort_order: index,
          })),
        });
      }

      return created;
    });

    await this.costCalculatorService.recalculateAndSave(recipe.id);
    return this.findOne(recipe.id);
  }

  async update(
    id: string,
    dto: UpdateRecipeDto,
    userId: string,
    isAdmin: boolean,
  ) {
    const existing = await this.findOne(id);

    if (!isAdmin && existing.created_by !== userId) {
      throw new ForbiddenException(
        'Only admin or the recipe creator can edit this recipe',
      );
    }

    // Approved recipes cannot be edited — only status change to archived is allowed
    if (existing.status === 'approved') {
      const dataKeys = Object.keys(dto).filter((k) => k !== 'status');
      if (dataKeys.length > 0) {
        throw new BadRequestException(
          'Cannot edit an approved recipe. Create a new version instead.',
        );
      }
    }

    // Status transition validation
    if (dto.status !== undefined && dto.status !== existing.status) {
      const ALLOWED_TRANSITIONS: Record<RecipeStatus, RecipeStatus[]> = {
        [RecipeStatus.draft]: [RecipeStatus.pending],
        [RecipeStatus.pending]: [RecipeStatus.approved, RecipeStatus.draft],
        [RecipeStatus.approved]: [RecipeStatus.archived],
        [RecipeStatus.archived]: [],
      };
      const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot transition recipe from '${existing.status}' to '${dto.status}'.`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.recipe.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.prep_steps !== undefined && { prep_steps: dto.prep_steps }),
          ...(dto.cooking_method !== undefined && {
            cooking_method: dto.cooking_method,
          }),
          ...(dto.yield_qty !== undefined && { yield_qty: dto.yield_qty }),
          ...(dto.yield_unit !== undefined && { yield_unit: dto.yield_unit }),
          ...(dto.portion_size !== undefined && {
            portion_size: dto.portion_size,
          }),
          ...(dto.shelf_life_hours !== undefined && {
            shelf_life_hours: dto.shelf_life_hours,
          }),
          ...(dto.brand_id !== undefined && { brand_id: dto.brand_id }),
          ...(dto.zone_id !== undefined && { zone_id: dto.zone_id }),
          ...(dto.image_url !== undefined && { image_url: dto.image_url }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.preparation_type !== undefined && {
            preparation_type: dto.preparation_type,
          }),
        },
      });

      if (dto.bom_lines !== undefined) {
        // BOM upsert: delete all existing lines, then create new ones
        await tx.recipeLine.deleteMany({ where: { recipe_id: id } });

        if (dto.bom_lines.length > 0) {
          await this.checkBomLinesForCycles(id, dto.bom_lines);

          await tx.recipeLine.createMany({
            data: dto.bom_lines.map((line, index) => ({
              recipe_id: id,
              input_type: line.input_type,
              ingredient_id:
                line.input_type === 'ingredient' ? line.item_id : null,
              source_recipe_id:
                line.input_type === 'recipe' ? line.item_id : null,
              quantity: line.quantity,
              unit: line.unit,
              prep_notes: line.prep_notes,
              sort_order: index,
            })),
          });
        }
      }
    });

    await this.costCalculatorService.recalculateAndSave(id);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);

    // Check if used as source_recipe in other RecipeLines
    const usageAsSource = await this.prisma.recipeLine.count({
      where: { source_recipe_id: id },
    });
    if (usageAsSource > 0) {
      throw new BadRequestException(
        `Cannot delete recipe — it is used as an ingredient in ${usageAsSource} other recipe(s). Remove those references first.`,
      );
    }

    // Check if referenced by any Product
    const productUsage = await this.prisma.product.count({
      where: { recipe_id: id },
    });
    if (productUsage > 0) {
      throw new BadRequestException(
        `Cannot delete: recipe is referenced by ${productUsage} product(s)`,
      );
    }

    return this.prisma.recipe.delete({ where: { id } });
  }

  async createNewVersion(id: string, userId: string): Promise<any> {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.recipe.findUniqueOrThrow({
        where: { id },
        include: { RecipeLines: true },
      });
      if (current.status !== RecipeStatus.approved) {
        throw new BadRequestException(
          'Only approved recipes can create a new version.',
        );
      }
      // Archive the current version
      await tx.recipe.update({
        where: { id },
        data: { status: RecipeStatus.archived },
      });
      // Create draft clone
      const clone = await tx.recipe.create({
        data: {
          name: current.name,
          description: current.description,
          prep_steps: current.prep_steps,
          cooking_method: current.cooking_method,
          yield_qty: current.yield_qty,
          yield_unit: current.yield_unit,
          portion_size: current.portion_size,
          shelf_life_hours: current.shelf_life_hours,
          brand_id: current.brand_id,
          zone_id: current.zone_id,
          image_url: current.image_url,
          preparation_type: current.preparation_type,
          created_by: userId,
          parent_recipe_id: current.parent_recipe_id ?? current.id,
          version: current.version + 1,
          status: RecipeStatus.draft,
        },
      });
      // Clone BOM lines
      if (current.RecipeLines.length > 0) {
        await tx.recipeLine.createMany({
          data: current.RecipeLines.map((line) => ({
            recipe_id: clone.id,
            input_type: line.input_type,
            ingredient_id: line.ingredient_id,
            source_recipe_id: line.source_recipe_id,
            quantity: line.quantity,
            unit: line.unit,
            prep_notes: line.prep_notes,
            sort_order: line.sort_order,
          })),
        });
      }
      return clone;
    });
    // Recalculate cost for clone (outside tx for performance)
    await this.costCalculatorService.recalculateAndSave(result.id);
    return this.findOne(result.id);
  }

  async calculateCostPreview(
    bom_lines: Array<{
      input_type: string;
      item_id: string;
      quantity: number;
      unit: string;
    }>,
  ): Promise<{
    cost: number | null;
    complete: boolean;
    missingPrices: string[];
  }> {
    if (bom_lines.length === 0) {
      return { cost: null, complete: true, missingPrices: [] };
    }

    let totalCost = 0;
    let allComplete = true;
    const missingPrices: string[] = [];

    for (const line of bom_lines) {
      if (line.input_type === 'ingredient') {
        const ingredient = await this.prisma.ingredient.findUnique({
          where: { id: line.item_id },
          select: {
            name: true,
            VendorPrices: {
              orderBy: { price: 'asc' as const },
              take: 1,
              select: { price: true, unit: true },
            },
          },
        });
        const price = ingredient?.VendorPrices?.[0];
        if (!price) {
          allComplete = false;
          if (ingredient) missingPrices.push(ingredient.name);
          continue;
        }
        const convertedQty = await convertUnit(
          Number(line.quantity),
          line.unit,
          price.unit,
          this.prisma,
        );
        if (convertedQty === null) {
          allComplete = false;
          continue;
        }
        totalCost += convertedQty * Number(price.price);
      } else if (line.input_type === 'recipe') {
        const result =
          await this.costCalculatorService.calculateRecipeCost(line.item_id);
        if (result === null) {
          allComplete = false;
          const subRecipe = await this.prisma.recipe.findUnique({
            where: { id: line.item_id },
            select: { name: true, yield_qty: true, yield_unit: true },
          });
          if (subRecipe) missingPrices.push(`${subRecipe.name} (sub-recipe)`);
          continue;
        }
        if (!result.complete) allComplete = false;
        const subRecipe = await this.prisma.recipe.findUnique({
          where: { id: line.item_id },
          select: { yield_qty: true, yield_unit: true },
        });
        if (!subRecipe || Number(subRecipe.yield_qty) === 0) {
          allComplete = false;
          continue;
        }
        const costPerUnit = result.cost / Number(subRecipe.yield_qty);
        const convertedQty = await convertUnit(
          Number(line.quantity),
          line.unit,
          subRecipe.yield_unit,
          this.prisma,
        );
        if (convertedQty === null) {
          allComplete = false;
          continue;
        }
        totalCost += costPerUnit * convertedQty;
      }
    }

    return {
      cost: totalCost > 0 ? totalCost : null,
      complete: allComplete,
      missingPrices,
    };
  }

  async getCostData(): Promise<{
    vendorPrices: Array<{
      ingredient_id: string;
      price: number;
      unit: string;
    }>;
    unitConversions: Array<{
      from_unit: string;
      to_unit: string;
      factor: number;
    }>;
  }> {
    // Lowest vendor price per ingredient
    const allPrices = await this.prisma.vendorPrice.findMany({
      orderBy: { price: 'asc' as const },
      select: { ingredient_id: true, price: true, unit: true },
    });
    // Deduplicate to lowest price per ingredient
    const priceMap = new Map<
      string,
      { ingredient_id: string; price: number; unit: string }
    >();
    for (const p of allPrices) {
      if (!priceMap.has(p.ingredient_id)) {
        priceMap.set(p.ingredient_id, {
          ingredient_id: p.ingredient_id,
          price: Number(p.price),
          unit: p.unit,
        });
      }
    }

    // Unit conversions
    const conversions = await this.prisma.unitConversion.findMany();

    return {
      vendorPrices: Array.from(priceMap.values()),
      unitConversions: conversions.map((c: any) => ({
        from_unit: c.from_unit,
        to_unit: c.to_unit,
        factor: Number(c.factor),
      })),
    };
  }

  async checkCycle(recipeId: string, sourceRecipeId: string): Promise<boolean> {
    return this.walkForCycle(sourceRecipeId, recipeId, new Set());
  }

  private async walkForCycle(
    currentId: string,
    targetId: string,
    visitedSet: Set<string>,
  ): Promise<boolean> {
    if (currentId === targetId) return true; // cycle detected
    if (visitedSet.has(currentId)) return false;
    visitedSet.add(currentId);

    const lines = await this.prisma.recipeLine.findMany({
      where: { recipe_id: currentId, input_type: 'recipe' },
      select: { source_recipe_id: true },
    });

    for (const line of lines) {
      if (!line.source_recipe_id) continue;
      const hasCycle = await this.walkForCycle(
        line.source_recipe_id,
        targetId,
        visitedSet,
      );
      if (hasCycle) return true;
    }

    return false;
  }

  private async checkBomLinesForCycles(
    recipeId: string,
    bomLines: Array<{ input_type: string; item_id: string }>,
  ): Promise<void> {
    for (const line of bomLines) {
      if (line.input_type === 'recipe') {
        const hasCycle = await this.checkCycle(recipeId, line.item_id);
        if (hasCycle) {
          throw new BadRequestException(
            `Adding recipe ${line.item_id} as a BOM input would create a circular dependency.`,
          );
        }
      }
    }
  }
}
