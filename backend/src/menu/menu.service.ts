import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { UpsertChannelModifierDto } from './dto/upsert-channel-modifier.dto';
import { convertUnit } from '../common/utils/unit-conversion';

@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------------------
  // Categories
  // ----------------------------------------------------------------

  async findCategories(brandId?: string) {
    const where: Record<string, unknown> = {};
    if (brandId) {
      where.brand_id = brandId;
    }
    return this.prisma.menuCategory.findMany({
      where,
      include: {
        _count: { select: { MenuItems: true } },
      },
      orderBy: { sort_order: 'asc' },
    });
  }

  async createCategory(dto: CreateMenuCategoryDto) {
    return this.prisma.menuCategory.create({
      data: {
        name: dto.name,
        brand_id: dto.brand_id,
        ...(dto.sort_order !== undefined && { sort_order: dto.sort_order }),
      },
    });
  }

  async updateCategory(id: string, dto: UpdateMenuCategoryDto) {
    const existing = await this.prisma.menuCategory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Menu category with ID ${id} not found`);
    }
    return this.prisma.menuCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.brand_id !== undefined && { brand_id: dto.brand_id }),
        ...(dto.sort_order !== undefined && { sort_order: dto.sort_order }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async removeCategory(id: string) {
    const existing = await this.prisma.menuCategory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Menu category with ID ${id} not found`);
    }
    // Cascade: delete all menu items in this category first
    await this.prisma.menuItem.deleteMany({ where: { category_id: id } });
    return this.prisma.menuCategory.delete({ where: { id } });
  }

  // ----------------------------------------------------------------
  // Menu Items
  // ----------------------------------------------------------------

  private itemsQuery(
    categoryId?: string,
    brandId?: string,
    page?: number,
    limit?: number,
  ) {
    const where: Record<string, unknown> = {};
    if (categoryId) {
      where.category_id = categoryId;
    }
    if (brandId) {
      where.category = { brand_id: brandId };
    }

    const take = Math.min(Number(limit) || 50, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    return { where, take, skip, orderBy: { name: 'asc' as const } };
  }

  /** Public storefront shape — never exposes cost, yield, BOM or margin fields (SPEC §8). */
  async findItemsPublic(
    categoryId?: string,
    brandId?: string,
    page?: number,
    limit?: number,
  ) {
    return this.prisma.menuItem.findMany({
      ...this.itemsQuery(categoryId, brandId, page, limit),
      include: {
        recipe: {
          select: { id: true, preparation_type: true },
        },
        category: {
          select: { id: true, name: true, brand_id: true },
        },
      },
    });
  }

  /** Staff shape — includes recipe cost and yield for menu management and POS. */
  async findItemsStaff(
    categoryId?: string,
    brandId?: string,
    page?: number,
    limit?: number,
  ) {
    return this.prisma.menuItem.findMany({
      ...this.itemsQuery(categoryId, brandId, page, limit),
      include: {
        recipe: {
          select: {
            id: true,
            name: true,
            computed_cost: true,
            yield_qty: true,
            preparation_type: true,
          },
        },
        category: {
          select: { id: true, name: true, brand_id: true },
        },
      },
    });
  }

  async createItem(dto: CreateMenuItemDto) {
    // Validate: recipe must exist and be approved
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: dto.recipe_id },
      select: { id: true, status: true },
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${dto.recipe_id} not found`);
    }

    if (recipe.status !== 'approved') {
      throw new BadRequestException(
        'Only approved recipes can be added to the menu. Change the recipe status to Approved first.',
      );
    }

    return this.prisma.menuItem.create({
      data: {
        recipe_id: dto.recipe_id,
        category_id: dto.category_id,
        name: dto.name,
        base_price: dto.base_price,
        ...(dto.image_url !== undefined && { image_url: dto.image_url }),
        ...(dto.available !== undefined && { available: dto.available }),
      },
      include: {
        recipe: {
          select: {
            id: true,
            name: true,
            computed_cost: true,
            yield_qty: true,
            preparation_type: true,
          },
        },
        category: {
          select: { id: true, name: true, brand_id: true },
        },
      },
    });
  }

  async updateItem(id: string, dto: UpdateMenuItemDto) {
    const existing = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Menu item with ID ${id} not found`);
    }

    // Validate: if changing recipe, new recipe must be approved
    if (dto.recipe_id !== undefined) {
      const recipe = await this.prisma.recipe.findUnique({
        where: { id: dto.recipe_id },
        select: { id: true, status: true },
      });

      if (!recipe) {
        throw new NotFoundException(
          `Recipe with ID ${dto.recipe_id} not found`,
        );
      }

      if (recipe.status !== 'approved') {
        throw new BadRequestException(
          'Only approved recipes can be added to the menu. Change the recipe status to Approved first.',
        );
      }
    }

    return this.prisma.menuItem.update({
      where: { id },
      data: {
        ...(dto.recipe_id !== undefined && { recipe_id: dto.recipe_id }),
        ...(dto.category_id !== undefined && { category_id: dto.category_id }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.base_price !== undefined && { base_price: dto.base_price }),
        ...(dto.image_url !== undefined && { image_url: dto.image_url }),
        ...(dto.available !== undefined && { available: dto.available }),
      },
      include: {
        recipe: {
          select: {
            id: true,
            name: true,
            computed_cost: true,
            yield_qty: true,
            preparation_type: true,
          },
        },
        category: {
          select: { id: true, name: true, brand_id: true },
        },
      },
    });
  }

  async removeItem(id: string) {
    const existing = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Menu item with ID ${id} not found`);
    }
    return this.prisma.menuItem.delete({ where: { id } });
  }

  // ----------------------------------------------------------------
  // Export
  // ----------------------------------------------------------------

  async findAllForExport() {
    return this.prisma.menuItem.findMany({
      orderBy: { name: 'asc' },
      include: {
        recipe: { select: { name: true, computed_cost: true } },
        category: { select: { name: true } },
      },
    });
  }

  // ----------------------------------------------------------------
  // Channel Modifiers
  // ----------------------------------------------------------------

  async findModifiers() {
    return this.prisma.channelModifier.findMany({
      orderBy: { channel_type: 'asc' },
    });
  }

  async upsertModifier(dto: UpsertChannelModifierDto) {
    return this.prisma.channelModifier.upsert({
      where: { channel_type: dto.channel_type },
      create: {
        channel_type: dto.channel_type,
        modifier_type: dto.modifier_type,
        modifier_value: dto.modifier_value,
      },
      update: {
        modifier_type: dto.modifier_type,
        modifier_value: dto.modifier_value,
      },
    });
  }

  // ----------------------------------------------------------------
  // Menu Availability
  // ----------------------------------------------------------------

  /**
   * Compute servings available for a single menu item given its loaded recipe lines.
   * Uses pre-fetched stock and batch data when provided (batch mode) or queries individually.
   */
  private async computeServings(
    menuItem: {
      available: boolean;
      status: string;
      recipe: {
        id: string;
        preparation_type: string;
        RecipeLines: Array<{
          input_type: string;
          quantity: any;
          unit: string;
          ingredient_id: string | null;
          ingredient: { id: string; base_unit: string } | null;
          source_recipe_id: string | null;
          source_recipe: { id: string; yield_unit: string } | null;
        }>;
      };
    },
    prefetchedStocks?: Map<string, number>,
    prefetchedBatches?: Map<string, number>,
  ): Promise<{
    available: boolean;
    servings_remaining: number;
    preparation_type: string;
  }> {
    if (!menuItem.available || menuItem.status !== 'active') {
      return {
        available: false,
        servings_remaining: 0,
        preparation_type: menuItem.recipe?.preparation_type ?? 'scratch',
      };
    }

    const prepType = menuItem.recipe?.preparation_type ?? 'scratch';

    // batch_prepared: availability from active PrepBatch records for THIS recipe
    if (prepType === 'batch_prepared') {
      const batchTotal = prefetchedBatches?.get(menuItem.recipe.id) ?? 0;
      return {
        available: batchTotal > 0,
        servings_remaining: Math.floor(batchTotal),
        preparation_type: prepType,
      };
    }

    // assemble, scratch and ready_to_sell: min over BOM lines, unit-converted
    let minServings = Infinity;
    for (const line of menuItem.recipe?.RecipeLines ?? []) {
      const stockQty = await this.lineStockQty(
        line,
        prefetchedStocks,
        prefetchedBatches,
      );
      if (stockQty === null) continue;
      const servings = await this.servingsFromStock(line, stockQty);
      if (servings === null) {
        // Conversion failure means we cannot determine availability — treat as unavailable
        return {
          available: false,
          servings_remaining: 0,
          preparation_type: prepType,
        };
      }
      minServings = Math.min(minServings, servings);
    }

    const remaining = minServings === Infinity ? 0 : minServings;
    return {
      available: remaining > 0,
      servings_remaining: remaining,
      preparation_type: prepType,
    };
  }

  /**
   * Stock for one recipe line expressed in its target base unit (the ingredient's
   * base_unit or the sub-recipe's yield_unit). Returns null for unknown line types.
   */
  private async lineStockQty(
    line: {
      input_type: string;
      ingredient_id: string | null;
      source_recipe_id: string | null;
    },
    prefetchedStocks?: Map<string, number>,
    prefetchedBatches?: Map<string, number>,
  ): Promise<number | null> {
    if (line.input_type === 'ingredient' && line.ingredient_id) {
      if (prefetchedStocks)
        return prefetchedStocks.get(line.ingredient_id) ?? 0;
      const stocks = await this.prisma.ingredientStock.findMany({
        where: { ingredient_id: line.ingredient_id },
      });
      return stocks.reduce((s, st) => s + Number(st.current_quantity), 0);
    }
    if (line.input_type === 'recipe' && line.source_recipe_id) {
      if (prefetchedBatches)
        return prefetchedBatches.get(line.source_recipe_id) ?? 0;
      const batches = await this.prisma.prepBatch.findMany({
        where: {
          recipe_id: line.source_recipe_id,
          status: 'active',
          OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
        },
      });
      return batches.reduce((s, b) => s + Number(b.quantity_remaining), 0);
    }
    return null;
  }

  /**
   * Servings obtainable from `stockQtyBase` for one recipe line, converting the line's unit
   * to the stock's base unit. null = no conversion; Infinity = line needs zero quantity.
   */
  private async servingsFromStock(
    line: {
      input_type: string;
      quantity: unknown;
      unit: string;
      ingredient: { base_unit: string } | null;
      source_recipe: { yield_unit: string } | null;
    },
    stockQtyBase: number,
  ): Promise<number | null> {
    const targetUnit =
      line.input_type === 'ingredient'
        ? (line.ingredient?.base_unit ?? line.unit)
        : (line.source_recipe?.yield_unit ?? line.unit);
    const neededPerServing = await convertUnit(
      Number(line.quantity),
      line.unit,
      targetUnit,
      this.prisma,
    );
    if (neededPerServing === null) return null;
    if (neededPerServing === 0) {
      this.logger.warn(
        `Skipping recipe line with zero quantity (${line.input_type}) in unit ${line.unit}`,
      );
      return Infinity;
    }
    return Math.floor(stockQtyBase / neededPerServing);
  }

  async getServingsAvailable(menuItemId: string): Promise<{
    available: boolean;
    servings_remaining: number;
    preparation_type: string;
  }> {
    const menuItem = await this.prisma.menuItem.findUniqueOrThrow({
      where: { id: menuItemId },
      include: {
        recipe: {
          include: {
            RecipeLines: {
              include: {
                ingredient: { select: { id: true, base_unit: true } },
                source_recipe: { select: { id: true, yield_unit: true } },
              },
            },
          },
        },
      },
    });

    return this.computeServings(menuItem);
  }

  async getAllServingsAvailable(): Promise<
    Record<
      string,
      {
        available: boolean;
        servings_remaining: number;
        preparation_type: string;
      }
    >
  > {
    const menuItems = await this.prisma.menuItem.findMany({
      where: { status: 'active' },
      include: {
        recipe: {
          include: {
            RecipeLines: {
              include: {
                ingredient: { select: { id: true, base_unit: true } },
                source_recipe: { select: { id: true, yield_unit: true } },
              },
            },
          },
        },
      },
    });

    // Collect all ingredient_ids and recipe_ids needed across all items
    const ingredientIds = new Set<string>();
    const recipeIds = new Set<string>();

    for (const item of menuItems) {
      for (const line of item.recipe.RecipeLines) {
        if (line.input_type === 'ingredient' && line.ingredient_id) {
          ingredientIds.add(line.ingredient_id);
        }
        if (line.input_type === 'recipe' && line.source_recipe_id) {
          recipeIds.add(line.source_recipe_id);
        }
      }
    }

    // Also collect batch_prepared recipe IDs for direct batch lookup
    // (batch_prepared PrepBatches are keyed by the recipe's OWN id, not a BOM source_recipe_id)
    for (const item of menuItems) {
      if (item.recipe?.preparation_type === 'batch_prepared') {
        recipeIds.add(item.recipe.id);
      }
    }

    // Batch-fetch all IngredientStock records for needed ingredients
    const [allStocks, allBatches] = await Promise.all([
      ingredientIds.size > 0
        ? this.prisma.ingredientStock.findMany({
            where: { ingredient_id: { in: [...ingredientIds] } },
          })
        : [],
      recipeIds.size > 0
        ? this.prisma.prepBatch.findMany({
            where: {
              recipe_id: { in: [...recipeIds] },
              status: 'active',
              OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
            },
          })
        : [],
    ]);

    // Aggregate stocks by ingredient_id
    const stockMap = new Map<string, number>();
    for (const stock of allStocks) {
      const current = stockMap.get(stock.ingredient_id) ?? 0;
      stockMap.set(
        stock.ingredient_id,
        current + Number(stock.current_quantity),
      );
    }

    // Aggregate batches by recipe_id
    const batchMap = new Map<string, number>();
    for (const batch of allBatches) {
      const current = batchMap.get(batch.recipe_id) ?? 0;
      batchMap.set(batch.recipe_id, current + Number(batch.quantity_remaining));
    }

    const result: Record<
      string,
      {
        available: boolean;
        servings_remaining: number;
        preparation_type: string;
      }
    > = {};

    for (const item of menuItems) {
      result[item.id] = await this.computeServings(item, stockMap, batchMap);
    }

    return result;
  }
}
