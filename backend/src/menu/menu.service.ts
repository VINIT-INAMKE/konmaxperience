import {
  Injectable,
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

  async findItems(categoryId?: string, brandId?: string) {
    const where: Record<string, unknown> = {};
    if (categoryId) {
      where.category_id = categoryId;
    }
    if (brandId) {
      where.category = { brand_id: brandId };
    }
    return this.prisma.menuItem.findMany({
      where,
      include: {
        recipe: {
          select: { id: true, name: true, computed_cost: true, yield_qty: true },
        },
        category: {
          select: { id: true, name: true, brand_id: true },
        },
      },
      orderBy: { name: 'asc' },
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
          select: { id: true, name: true, computed_cost: true, yield_qty: true },
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
          select: { id: true, name: true, computed_cost: true, yield_qty: true },
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
  // Menu Availability (backend-only for Phase 9; D-11 frontend deferred to Phase 10)
  // ----------------------------------------------------------------

  async getServingsAvailable(
    menuItemId: string,
  ): Promise<{ available: boolean; servings_remaining: number }> {
    const menuItem = await this.prisma.menuItem.findUniqueOrThrow({
      where: { id: menuItemId },
      include: {
        recipe: {
          include: {
            RecipeLines: {
              include: { ingredient: true, source_recipe: true },
            },
          },
        },
      },
    });

    if (!menuItem.available || menuItem.status !== 'active') {
      return { available: false, servings_remaining: 0 };
    }

    let minServings = Infinity;

    for (const line of menuItem.recipe.RecipeLines) {
      if (line.input_type === 'ingredient') {
        // Check raw ingredient stock across all zones
        const stocks = await this.prisma.ingredientStock.findMany({
          where: { ingredient_id: line.ingredient_id! },
        });
        const totalStock = stocks.reduce(
          (s, st) => s + Number(st.current_quantity),
          0,
        );
        const neededPerServing = await convertUnit(
          Number(line.quantity),
          line.unit,
          line.ingredient!.base_unit,
          this.prisma,
        );
        if (neededPerServing === null || neededPerServing === 0) continue;
        const servings = Math.floor(totalStock / neededPerServing);
        minServings = Math.min(minServings, servings);
      }

      if (line.input_type === 'recipe') {
        // Check active, non-expired prep batches
        const batches = await this.prisma.prepBatch.findMany({
          where: {
            recipe_id: line.source_recipe_id!,
            status: 'active',
            OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
          },
        });
        const totalRemaining = batches.reduce(
          (s, b) => s + Number(b.quantity_remaining),
          0,
        );
        const neededPerServing = await convertUnit(
          Number(line.quantity),
          line.unit,
          line.source_recipe!.yield_unit,
          this.prisma,
        );
        if (neededPerServing === null || neededPerServing === 0) continue;
        const servings = Math.floor(totalRemaining / neededPerServing);
        minServings = Math.min(minServings, servings);
      }
    }

    const remaining = minServings === Infinity ? 0 : minServings;
    return { available: remaining > 0, servings_remaining: remaining };
  }
}
