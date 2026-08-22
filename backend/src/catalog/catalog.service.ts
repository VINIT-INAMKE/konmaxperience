import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  MediaKind,
  PrepBatchStatus,
  PreparationType,
  ProductStatus,
  ProductType,
  RecipeStatus,
  StockMode,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_NODE_ID } from '../node/node.constants';
import { convertUnit } from '../common/utils/unit-conversion';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { UpsertProductVariantDto } from './dto/upsert-product-variant.dto';
import { UpsertChannelModifierDto } from './dto/upsert-channel-modifier.dto';

/** Public storefront shape — never selects cost, yield, BOM or margin fields (SPEC §8). */
const PUBLIC_INCLUDE = {
  media: { orderBy: { sort_order: 'asc' as const } },
  variants: {
    where: { status: ProductStatus.active },
    select: {
      id: true,
      name: true,
      sku: true,
      price_delta: true,
      is_default: true,
    },
  },
  category: { select: { id: true, name: true, slug: true, brand_id: true } },
  recipe: { select: { id: true, preparation_type: true } },
  event: { select: { id: true, date: true, capacity: true } },
};

/** Staff shape — adds recipe cost/yield and variant stock for ops screens and POS. */
const STAFF_INCLUDE = {
  media: { orderBy: { sort_order: 'asc' as const } },
  variants: true,
  category: { select: { id: true, name: true, slug: true, brand_id: true } },
  recipe: {
    select: {
      id: true,
      name: true,
      computed_cost: true,
      yield_qty: true,
      preparation_type: true,
    },
  },
  event: { select: { id: true, date: true, capacity: true } },
};

/** The BOM line shape `computeServings` needs, whichever include produced it. */
interface ServingsLine {
  input_type: string;
  quantity: unknown;
  unit: string;
  ingredient_id: string | null;
  ingredient: { base_unit: string } | null;
  source_recipe_id: string | null;
  source_recipe: { yield_unit: string } | null;
}

/** The product shape `computeServings` needs (structural, so both includes fit). */
interface ServingsProduct {
  status: ProductStatus;
  stock_mode: StockMode;
  variants?: Array<{ stock_on_hand: unknown }> | null;
  event?: {
    capacity: number;
    bookings?: Array<{ guests: number }> | null;
  } | null;
  recipe?: {
    id: string;
    preparation_type: PreparationType;
    RecipeLines: ServingsLine[];
  } | null;
}

export interface ProductAvailability {
  available: boolean;
  servings_remaining: number;
  preparation_type: string;
}

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------------------
  // Categories
  // ----------------------------------------------------------------

  /**
   * Archived categories are withheld: `removeCategory` archives instead of
   * deleting, and the ops screen refetches this list expecting the row to be
   * gone.
   */
  async findCategories(brandId?: string) {
    return this.prisma.productCategory.findMany({
      where: {
        ...(brandId ? { brand_id: brandId } : {}),
        status: { not: ProductStatus.archived },
      },
      include: { _count: { select: { products: true } } },
      orderBy: { sort_order: 'asc' },
    });
  }

  async createCategory(dto: CreateProductCategoryDto) {
    // node_id comes from the Prisma-level @default until Task 5 lands `Node`.
    return this.prisma.productCategory.create({ data: { ...dto } });
  }

  async updateCategory(id: string, dto: UpdateProductCategoryDto) {
    await this.getCategoryOrThrow(id);
    return this.prisma.productCategory.update({
      where: { id },
      data: { ...dto },
    });
  }

  /** Archives the category's products rather than deleting them — orders reference products. */
  async removeCategory(id: string) {
    await this.getCategoryOrThrow(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: { category_id: id },
        data: { status: ProductStatus.archived },
      });
      return tx.productCategory.update({
        where: { id },
        data: { status: ProductStatus.archived },
      });
    });
  }

  private async getCategoryOrThrow(id: string) {
    const existing = await this.prisma.productCategory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Product category with ID ${id} not found`);
    }
    return existing;
  }

  // ----------------------------------------------------------------
  // Products
  // ----------------------------------------------------------------

  private listArgs(
    categoryId?: string,
    brandId?: string,
    type?: ProductType,
    page?: number,
    limit?: number,
  ) {
    const take = Math.min(Number(limit) || 50, 200);
    return {
      where: {
        ...(categoryId ? { category_id: categoryId } : {}),
        ...(brandId ? { brand_id: brandId } : {}),
        ...(type ? { type } : {}),
      },
      take,
      skip: ((Number(page) || 1) - 1) * take,
      orderBy: { name: 'asc' as const },
    };
  }

  async findProductsPublic(
    categoryId?: string,
    brandId?: string,
    type?: ProductType,
    page?: number,
    limit?: number,
  ) {
    const args = this.listArgs(categoryId, brandId, type, page, limit);
    return this.prisma.product.findMany({
      ...args,
      where: { ...args.where, status: ProductStatus.active },
      include: PUBLIC_INCLUDE,
    });
  }

  /**
   * Staff list — drafts included (the ops screen publishes from here), archived
   * withheld so `DELETE /catalog/products/:id` reads as a removal.
   */
  async findProductsStaff(
    categoryId?: string,
    brandId?: string,
    type?: ProductType,
    page?: number,
    limit?: number,
  ) {
    const args = this.listArgs(categoryId, brandId, type, page, limit);
    return this.prisma.product.findMany({
      ...args,
      where: { ...args.where, status: { not: ProductStatus.archived } },
      include: STAFF_INCLUDE,
    });
  }

  async findProductBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { node_id_slug: { node_id: DEFAULT_NODE_ID, slug } },
      include: PUBLIC_INCLUDE,
    });
    if (!product || product.status !== ProductStatus.active) {
      throw new NotFoundException(`Product "${slug}" not found`);
    }
    return product;
  }

  /** Postgres full-text search over Product.search_text (GIN index + trigger, Task 15). */
  async search(q: string, type?: ProductType, limit = 20) {
    if (!q.trim()) return [];
    const typeFilter: string | null = type ?? null;
    return this.prisma.$queryRaw`
      SELECT p.id, p.name, p.slug, p.type, p.base_price
      FROM "Product" p
      WHERE p.status = 'active'
        AND (${typeFilter}::text IS NULL OR p.type::text = ${typeFilter}::text)
        AND to_tsvector('simple', p.search_text) @@ plainto_tsquery('simple', ${q})
      ORDER BY ts_rank(to_tsvector('simple', p.search_text), plainto_tsquery('simple', ${q})) DESC
      LIMIT ${Math.min(limit, 50)}`;
  }

  async createProduct(dto: CreateProductDto, userId: string) {
    await this.assertRecipeUsable(dto.type, dto.recipe_id);
    return this.prisma.product.create({
      // node_id comes from the Prisma-level @default until Task 5 lands `Node`.
      data: { ...dto, created_by: userId, updated_by: userId },
      include: STAFF_INCLUDE,
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto, userId: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing)
      throw new NotFoundException(`Product with ID ${id} not found`);
    if (dto.recipe_id !== undefined || dto.type !== undefined) {
      await this.assertRecipeUsable(
        dto.type ?? existing.type,
        dto.recipe_id ?? existing.recipe_id,
      );
    }
    return this.prisma.product.update({
      where: { id },
      data: { ...dto, updated_by: userId },
      include: STAFF_INCLUDE,
    });
  }

  /** Publish/unpublish — SPEC §9 `catalog/products/:id/publish`. */
  async setStatus(id: string, status: ProductStatus, userId: string) {
    return this.prisma.product.update({
      where: { id },
      data: { status, updated_by: userId },
      include: STAFF_INCLUDE,
    });
  }

  /** Archives rather than deletes: OrderItem.product_id is a hard FK. */
  async archiveProduct(id: string, userId: string) {
    return this.setStatus(id, ProductStatus.archived, userId);
  }

  /**
   * Preserves the v1 rule "only approved recipes can be sold" for the two
   * recipe-backed product types (menu.service.ts:154-160).
   */
  private async assertRecipeUsable(
    type: ProductType,
    recipeId?: string | null,
  ) {
    const needsRecipe =
      type === ProductType.prepared_food || type === ProductType.packaged;
    if (!needsRecipe) return;
    if (!recipeId) {
      throw new BadRequestException(
        `A ${type} product must reference a recipe`,
      );
    }
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true, status: true },
    });
    if (!recipe)
      throw new NotFoundException(`Recipe with ID ${recipeId} not found`);
    if (recipe.status !== RecipeStatus.approved) {
      throw new BadRequestException(
        'Only approved recipes can be sold. Change the recipe status to Approved first.',
      );
    }
  }

  // ----------------------------------------------------------------
  // Variants and media
  // ----------------------------------------------------------------

  async upsertVariant(dto: UpsertProductVariantDto) {
    return this.prisma.productVariant.upsert({
      where: { sku: dto.sku },
      create: { ...dto },
      update: { ...dto },
    });
  }

  async removeVariant(id: string) {
    return this.prisma.productVariant.update({
      where: { id },
      data: { status: ProductStatus.archived },
    });
  }

  async addMedia(
    productId: string,
    data: { url: string; alt?: string; sort_order?: number; kind?: MediaKind },
  ) {
    return this.prisma.productMedia.create({
      data: { product_id: productId, ...data },
    });
  }

  async removeMedia(id: string) {
    return this.prisma.productMedia.delete({ where: { id } });
  }

  // ----------------------------------------------------------------
  // Export
  // ----------------------------------------------------------------

  async findAllForExport() {
    return this.prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: {
        recipe: { select: { name: true, computed_cost: true } },
        category: { select: { name: true } },
        variants: { select: { name: true, sku: true, stock_on_hand: true } },
      },
    });
  }

  // ----------------------------------------------------------------
  // Channel Modifiers
  // ----------------------------------------------------------------

  async findModifiers() {
    return this.prisma.channelModifier.findMany({
      orderBy: { channel: 'asc' },
    });
  }

  async upsertModifier(dto: UpsertChannelModifierDto) {
    return this.prisma.channelModifier.upsert({
      where: {
        node_id_channel: { node_id: DEFAULT_NODE_ID, channel: dto.channel },
      },
      create: { node_id: DEFAULT_NODE_ID, ...dto },
      update: {
        modifier_type: dto.modifier_type,
        modifier_value: dto.modifier_value,
      },
    });
  }

  // ----------------------------------------------------------------
  // Availability
  // ----------------------------------------------------------------

  /**
   * Servings available for one product. `derived_from_recipe` products read
   * their BOM (pre-fetched stock/batch maps in batch mode, individual queries
   * otherwise); `tracked` products read variant stock; `capacity` products read
   * event capacity minus confirmed guests (SPEC §3.3).
   */
  private async computeServings(
    product: ServingsProduct,
    prefetchedStocks?: Map<string, number>,
    prefetchedBatches?: Map<string, number>,
  ): Promise<ProductAvailability> {
    if (product.status !== ProductStatus.active) {
      return {
        available: false,
        servings_remaining: 0,
        preparation_type: product.recipe?.preparation_type ?? 'scratch',
      };
    }

    if (product.stock_mode === StockMode.tracked) {
      const onHand = (product.variants ?? []).reduce(
        (s, v) => s + Number(v.stock_on_hand),
        0,
      );
      return {
        available: onHand > 0,
        servings_remaining: Math.floor(onHand),
        preparation_type: 'tracked',
      };
    }

    if (product.stock_mode === StockMode.capacity) {
      const capacity = product.event?.capacity ?? 0;
      const booked =
        product.event?.bookings?.reduce((s, b) => s + b.guests, 0) ?? 0;
      const left = Math.max(0, capacity - booked);
      return {
        available: left > 0,
        servings_remaining: left,
        preparation_type: 'capacity',
      };
    }

    const prepType = product.recipe?.preparation_type ?? 'scratch';

    // batch_prepared: availability from active PrepBatch records for THIS recipe
    if (prepType === PreparationType.batch_prepared && product.recipe) {
      const batchTotal = prefetchedBatches?.get(product.recipe.id) ?? 0;
      return {
        available: batchTotal > 0,
        servings_remaining: Math.floor(batchTotal),
        preparation_type: prepType,
      };
    }

    // assemble, scratch and ready_to_sell: min over BOM lines, unit-converted
    let minServings = Infinity;
    for (const line of product.recipe?.RecipeLines ?? []) {
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
          status: PrepBatchStatus.active,
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

  async getServingsAvailable(productId: string): Promise<ProductAvailability> {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: {
        variants: { where: { status: ProductStatus.active } },
        event: {
          include: { bookings: { where: { status: BookingStatus.confirmed } } },
        },
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

    return this.computeServings(product);
  }

  /**
   * Batch availability for the storefront and POS grids. Scoped to the
   * recipe-backed types — `tracked` and `capacity` products answer through the
   * single-product route, and the frontend treats a missing key as "no
   * constraint".
   */
  async getAllServingsAvailable(): Promise<
    Record<string, ProductAvailability>
  > {
    const products = await this.prisma.product.findMany({
      where: {
        status: ProductStatus.active,
        type: { in: [ProductType.prepared_food, ProductType.packaged] },
      },
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

    // Collect all ingredient_ids and recipe_ids needed across all products
    const ingredientIds = new Set<string>();
    const recipeIds = new Set<string>();

    for (const product of products) {
      for (const line of product.recipe?.RecipeLines ?? []) {
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
    for (const product of products) {
      if (product.recipe?.preparation_type === PreparationType.batch_prepared) {
        recipeIds.add(product.recipe.id);
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
              status: PrepBatchStatus.active,
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

    const result: Record<string, ProductAvailability> = {};

    for (const product of products) {
      result[product.id] = await this.computeServings(
        product,
        stockMap,
        batchMap,
      );
    }

    return result;
  }
}
