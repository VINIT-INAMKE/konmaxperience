import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CostCalculatorService } from './cost-calculator.service';

const RECIPE_INCLUDE = {
  brand: { select: { id: true, name: true } },
  zone: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true } },
  RecipeLines: {
    include: {
      ingredient: {
        select: { id: true, name: true, base_unit: true, category: true },
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
                select: { id: true, name: true, base_unit: true, category: true },
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

    // Status transition validation: cannot revert from approved to draft
    if (existing.status === 'approved' && dto.status === 'draft') {
      throw new BadRequestException(
        'Cannot revert an approved recipe back to draft. Archive it instead.',
      );
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

    // Check if referenced by any MenuItem
    const menuUsage = await this.prisma.menuItem.count({
      where: { recipe_id: id },
    });
    if (menuUsage > 0) {
      throw new BadRequestException(
        `Cannot delete recipe — it is referenced by ${menuUsage} menu item(s). Remove those menu items first.`,
      );
    }

    return this.prisma.recipe.delete({ where: { id } });
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
