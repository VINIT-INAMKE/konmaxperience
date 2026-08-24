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
  Prisma,
  ProductStatus,
  ProductType,
  RecipeStatus,
  StockMode,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DEFAULT_NODE_ID } from '../node/node.constants';
import {
  DomainEvent,
  domainEventBase,
  emitDomainEvent,
  userActor,
} from '../common/events/domain-events';
import { convertUnit } from '../common/utils/unit-conversion';
import { CatalogCacheService } from './catalog-cache.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { UpsertProductVariantDto } from './dto/upsert-product-variant.dto';
import { UpsertChannelModifierDto } from './dto/upsert-channel-modifier.dto';

/**
 * The `Product` fields worth keeping in an audit `before`/`after` snapshot,
 * JSON-safe.
 *
 * Deliberately **not** the whole row: `search_text` is a denormalised blob that
 * would bloat every `AuditEvent` and change on edits nobody made, and the
 * relations `STAFF_INCLUDE` pulls in (recipe cost, variants, media) belong to
 * their own entities. `Decimal` goes through `String()` because
 * `Prisma.InputJsonValue` has no decimal, and a `Number()` cast on money is how
 * a rounding bug gets into the audit trail.
 */
function productSnapshot(product: {
  name: string;
  slug: string;
  status: ProductStatus;
  type: ProductType;
  base_price: Prisma.Decimal;
  tax_rate: Prisma.Decimal;
  category_id: string;
}): Prisma.InputJsonValue {
  return {
    name: product.name,
    slug: product.slug,
    status: product.status,
    type: product.type,
    base_price: String(product.base_price),
    tax_rate: String(product.tax_rate),
    category_id: product.category_id,
  };
}

/** The `ProductCategory` fields worth keeping in an audit snapshot, JSON-safe. */
function categorySnapshot(category: {
  name: string;
  slug: string;
  status: ProductStatus;
  sort_order: number;
  brand_id: string;
  product_types: ProductType[];
}): Prisma.InputJsonValue {
  return {
    name: category.name,
    slug: category.slug,
    status: category.status,
    sort_order: category.sort_order,
    brand_id: category.brand_id,
    product_types: category.product_types,
  };
}

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

/**
 * Every public list route answers with this envelope (API appendix §A).
 * `next_cursor` is the `id` of the **last row on this page** — the caller passes
 * it straight back as `cursor` and Prisma's `skip: 1` steps past it.
 */
export interface CursorPage<T> {
  items: T[];
  next_cursor: string | null;
}

export interface SearchHit {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  /** Rupees as a JSON number — `CatalogCacheService` normalises the Decimal. */
  base_price: number;
  rating_avg: number | null;
  rating_count: number;
  rank: number;
}

export interface SearchFacets {
  types: Array<{ type: ProductType; count: number }>;
  categories: Array<{ category_id: string; name: string; count: number }>;
}

export interface SearchResult extends CursorPage<SearchHit> {
  facets: SearchFacets;
}

/** Default and ceiling for the list routes (API appendix "Conventions"). */
const LIST_LIMIT_DEFAULT = 50;
const LIST_LIMIT_MAX = 200;
/** Search pages are smaller — ranking degrades fast past the first screen. */
const SEARCH_LIMIT_DEFAULT = 20;
const SEARCH_LIMIT_MAX = 50;

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  /**
   * `AuditModule` is `@Global()`, so `catalog.module.ts` needs no import change
   * for this — verified before it was left alone.
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CatalogCacheService,
    private readonly eventEmitter: EventEmitter2,
    private readonly audit: AuditService,
  ) {}

  // ----------------------------------------------------------------
  // Categories
  // ----------------------------------------------------------------

  /**
   * Archived categories are withheld: `removeCategory` archives instead of
   * deleting, and the ops screen refetches this list expecting the row to be
   * gone.
   */
  async findCategories(brandId?: string) {
    return this.cache.wrap(`categories:${brandId ?? ''}`, () =>
      this.prisma.productCategory.findMany({
        where: {
          ...(brandId ? { brand_id: brandId } : {}),
          status: { not: ProductStatus.archived },
        },
        include: { _count: { select: { products: true } } },
        orderBy: { sort_order: 'asc' },
      }),
    );
  }

  async createCategory(dto: CreateProductCategoryDto, userId?: string) {
    // node_id comes from the Prisma-level @default until Task 5 lands `Node`.
    const category = await this.prisma.$transaction(async (tx) => {
      const created = await tx.productCategory.create({ data: { ...dto } });
      await this.audit.record(tx, {
        entity_type: 'product_category',
        entity_id: created.id,
        action: 'product_category.created',
        node_id: created.node_id,
        ...AuditService.user(userId),
        after: categorySnapshot(created),
      });
      return created;
    });
    await this.cache.invalidate();
    return category;
  }

  async updateCategory(
    id: string,
    dto: UpdateProductCategoryDto,
    userId?: string,
  ) {
    const existing = await this.getCategoryOrThrow(id);
    const category = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.productCategory.update({
        where: { id },
        data: { ...dto },
      });
      await this.audit.record(tx, {
        entity_type: 'product_category',
        entity_id: id,
        action: 'product_category.updated',
        node_id: updated.node_id,
        ...AuditService.user(userId),
        before: categorySnapshot(existing),
        after: categorySnapshot(updated),
      });
      return updated;
    });
    await this.cache.invalidate();
    return category;
  }

  /** Archives the category's products rather than deleting them — orders reference products. */
  async removeCategory(id: string, userId?: string) {
    const existing = await this.getCategoryOrThrow(id);
    const category = await this.prisma.$transaction(async (tx) => {
      // The cascade is the audit-worthy half: a category delete quietly takes
      // every product in it off the storefront, so the count goes in `after`.
      const cascaded = await tx.product.updateMany({
        where: { category_id: id },
        data: { status: ProductStatus.archived },
      });
      const archived = await tx.productCategory.update({
        where: { id },
        data: { status: ProductStatus.archived },
      });
      await this.audit.record(tx, {
        entity_type: 'product_category',
        entity_id: id,
        action: 'product_category.deleted',
        node_id: archived.node_id,
        ...AuditService.user(userId),
        before: categorySnapshot(existing),
        after: {
          ...(categorySnapshot(archived) as Record<string, unknown>),
          products_archived: cascaded.count,
        },
      });
      return archived;
    });
    await this.cache.invalidate();
    return category;
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

  /**
   * Cursor pagination, not offset: `cursor` is the `id` of the last row the
   * caller already has, and `skip: 1` steps past it. `orderBy` carries `id` as
   * a tiebreak because two products may share a name — without it the cursor
   * row is not uniquely placed in the ordering and pages can repeat or skip.
   */
  private listArgs(
    categoryId?: string,
    brandId?: string,
    type?: ProductType,
    cursor?: string,
    limit?: number,
  ) {
    const take = Math.min(Number(limit) || LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX);
    return {
      where: {
        ...(categoryId ? { category_id: categoryId } : {}),
        ...(brandId ? { brand_id: brandId } : {}),
        ...(type ? { type } : {}),
      },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ name: 'asc' as const }, { id: 'asc' as const }],
    };
  }

  /**
   * Splits a `take + 1` fetch into the page plus the cursor for the next one.
   * The cursor is the **last row of this page**, never the peeked row — handing
   * back the peeked id would make the next request's `skip: 1` swallow it.
   */
  private toPage<T extends { id: string }>(
    rows: T[],
    take: number,
  ): CursorPage<T> {
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items,
      next_cursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /**
   * Public storefront list. **Returns `{ items, next_cursor }`, not a bare
   * array** (API appendix §A / §E.1) — cached 60 s and invalidated by every
   * catalog write.
   */
  async findProductsPublic(
    categoryId?: string,
    brandId?: string,
    type?: ProductType,
    cursor?: string,
    limit?: number,
  ) {
    const key = `products:${categoryId ?? ''}:${brandId ?? ''}:${type ?? ''}:${cursor ?? ''}:${limit ?? ''}`;
    return this.cache.wrap(key, async () => {
      const args = this.listArgs(categoryId, brandId, type, cursor, limit);
      const rows = await this.prisma.product.findMany({
        ...args,
        take: args.take + 1,
        where: { ...args.where, status: ProductStatus.active },
        include: PUBLIC_INCLUDE,
      });
      return this.toPage(rows, args.take);
    });
  }

  /**
   * Staff list — drafts included (the ops screen publishes from here), archived
   * withheld so `DELETE /catalog/products/:id` reads as a removal.
   *
   * Deliberately still a **bare array** and deliberately **uncached**: it is
   * authenticated, it must show an edit the instant it is saved, and the ops
   * menu + POS grids read it as `Product[]`. Only the public surface moved to
   * the envelope.
   */
  async findProductsStaff(
    categoryId?: string,
    brandId?: string,
    type?: ProductType,
    cursor?: string,
    limit?: number,
  ) {
    const args = this.listArgs(categoryId, brandId, type, cursor, limit);
    return this.prisma.product.findMany({
      ...args,
      where: { ...args.where, status: { not: ProductStatus.archived } },
      include: STAFF_INCLUDE,
    });
  }

  async findProductBySlug(slug: string) {
    return this.cache.wrap(`product:slug:${slug}`, async () => {
      const product = await this.prisma.product.findUnique({
        where: { node_id_slug: { node_id: DEFAULT_NODE_ID, slug } },
        include: PUBLIC_INCLUDE,
      });
      if (!product || product.status !== ProductStatus.active) {
        // Throwing from inside `wrap` caches nothing — a 404 must not stick.
        throw new NotFoundException(`Product "${slug}" not found`);
      }
      return product;
    });
  }

  /**
   * SRCH-01 — Postgres full-text search over `Product.search_text`.
   *
   * The predicate stays byte-identical to the P2 GIN index expression
   * (`to_tsvector('simple', search_text)`); change one character and Postgres
   * silently stops using the index. Facets are one extra grouped query over the
   * *same* predicate but **without** the `type`/`category_id` filters, so the
   * counts describe what the caller could still narrow to.
   */
  async search(
    q: string,
    type?: ProductType,
    categoryId?: string,
    cursor?: string,
    limit?: number,
  ): Promise<SearchResult> {
    const term = q.trim();
    if (!term)
      return {
        items: [],
        facets: { types: [], categories: [] },
        next_cursor: null,
      };

    const take = Math.min(
      Number(limit) || SEARCH_LIMIT_DEFAULT,
      SEARCH_LIMIT_MAX,
    );
    // Ranked results have no stable row key to page on, so the search cursor is
    // an opaque base64 offset rather than an id.
    const offset = Math.max(0, this.decodeSearchCursor(cursor));
    const typeFilter: string | null = type ?? null;
    const categoryFilter: string | null = categoryId ?? null;
    const key = `search:${term}:${typeFilter ?? ''}:${categoryFilter ?? ''}:${offset}:${take}`;

    return this.cache.wrap(key, async () => {
      const rows = await this.prisma.$queryRaw<SearchHit[]>`
        SELECT p.id, p.name, p.slug, p.type, p.base_price, p.rating_avg, p.rating_count,
               ts_rank(to_tsvector('simple', p.search_text), plainto_tsquery('simple', ${term})) AS rank
        FROM "Product" p
        WHERE p.status = 'active'
          AND (${typeFilter}::text IS NULL OR p.type::text = ${typeFilter}::text)
          AND (${categoryFilter}::text IS NULL OR p.category_id = ${categoryFilter}::text)
          AND to_tsvector('simple', p.search_text) @@ plainto_tsquery('simple', ${term})
        ORDER BY rank DESC, p.name ASC, p.id ASC
        LIMIT ${take + 1} OFFSET ${offset}`;

      const items = rows.slice(0, take);
      const next_cursor =
        rows.length > take
          ? Buffer.from(String(offset + take), 'utf8').toString('base64')
          : null;

      const facetRows = await this.prisma.$queryRaw<
        Array<{
          type: ProductType;
          category_id: string;
          name: string;
          count: bigint;
        }>
      >`
        SELECT p.type, p.category_id, c.name, count(*)::bigint AS count
        FROM "Product" p
        JOIN "ProductCategory" c ON c.id = p.category_id
        WHERE p.status = 'active'
          AND to_tsvector('simple', p.search_text) @@ plainto_tsquery('simple', ${term})
        GROUP BY p.type, p.category_id, c.name`;

      const types = new Map<ProductType, number>();
      const categories = new Map<
        string,
        { category_id: string; name: string; count: number }
      >();
      for (const row of facetRows) {
        const n = Number(row.count);
        types.set(row.type, (types.get(row.type) ?? 0) + n);
        const existing = categories.get(row.category_id);
        categories.set(row.category_id, {
          category_id: row.category_id,
          name: row.name,
          count: (existing?.count ?? 0) + n,
        });
      }

      return {
        items,
        facets: {
          types: [...types].map(([t, count]) => ({ type: t, count })),
          categories: [...categories.values()],
        },
        next_cursor,
      };
    });
  }

  /** A malformed or hostile cursor degrades to "first page", never to a crash. */
  private decodeSearchCursor(cursor?: string): number {
    if (!cursor) return 0;
    try {
      const decoded = Number(Buffer.from(cursor, 'base64').toString('utf8'));
      return Number.isSafeInteger(decoded) && decoded >= 0 ? decoded : 0;
    } catch {
      return 0;
    }
  }

  async createProduct(dto: CreateProductDto, userId: string) {
    await this.assertRecipeUsable(dto.type, dto.recipe_id);
    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        // node_id comes from the Prisma-level @default until Task 5 lands `Node`.
        data: { ...dto, created_by: userId, updated_by: userId },
        include: STAFF_INCLUDE,
      });
      await this.audit.record(tx, {
        entity_type: 'product',
        entity_id: created.id,
        action: 'product.created',
        node_id: created.node_id,
        ...AuditService.user(userId),
        after: productSnapshot(created),
      });
      return created;
    });
    await this.cache.invalidate();
    return product;
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
    const product = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: { ...dto, updated_by: userId },
        include: STAFF_INCLUDE,
      });
      await this.audit.record(tx, {
        entity_type: 'product',
        entity_id: id,
        action: 'product.updated',
        node_id: updated.node_id,
        ...AuditService.user(userId),
        before: productSnapshot(existing),
        after: productSnapshot(updated),
      });
      return updated;
    });
    await this.cache.invalidate();
    return product;
  }

  /** Publish/unpublish — SPEC §9 `catalog/products/:id/publish`. */
  async setStatus(id: string, status: ProductStatus, userId: string) {
    // Read the status first so `product.published` fires only on the real
    // draft|archived → active transition, never on a re-save of a live product.
    const before = await this.prisma.product.findUnique({ where: { id } });

    const product = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: { status, updated_by: userId },
        include: STAFF_INCLUDE,
      });
      // One method backs three verbs, and the audit trail has to say which one
      // happened: a publish and an archive are not the same act, and reading
      // "product.updated" on the row that took a product off the storefront is
      // how an audit trail stops being usable.
      await this.audit.record(tx, {
        entity_type: 'product',
        entity_id: id,
        action:
          status === ProductStatus.active
            ? 'product.published'
            : status === ProductStatus.archived
              ? 'product.archived'
              : 'product.updated',
        node_id: updated.node_id,
        ...AuditService.user(userId),
        before: before ? productSnapshot(before) : null,
        after: productSnapshot(updated),
      });
      return updated;
    });

    // A publish or an archive must be visible on the storefront immediately,
    // not up to 60 s later.
    await this.cache.invalidate();

    // Emit AFTER the update resolves (SPEC §4.1).
    if (
      status === ProductStatus.active &&
      before?.status !== ProductStatus.active
    ) {
      emitDomainEvent(this.eventEmitter, DomainEvent.PRODUCT_PUBLISHED, {
        ...domainEventBase(product.node_id, userActor(userId)),
        productId: product.id,
        name: product.name,
        slug: product.slug,
        type: product.type,
      });
    }

    return product;
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

  /**
   * CAT-02 — the low-stock signal. Emitted **after** the write, never inside
   * it, and only when the variant actually carries a threshold.
   */
  async upsertVariant(dto: UpsertProductVariantDto, userId?: string) {
    const variant = await this.prisma.productVariant.upsert({
      where: { sku: dto.sku },
      create: { ...dto },
      update: { ...dto },
      include: {
        product: { select: { id: true, node_id: true, name: true } },
      },
    });

    await this.cache.invalidate();
    this.emitIfLowStock(variant, userId);

    return variant;
  }

  /**
   * `stock.low` is the SPEC §4.1 name and it already has two live consumers —
   * `mission-bridge.rules.ts` (`stock_low_v1`, which moves the PROCUREMENT
   * meter) and `notifications.listener.ts` (which publishes `notify-low-stock`).
   * The catalog signal therefore reuses that registered payload instead of
   * inventing a parallel event nothing subscribes to.
   *
   * For a variant, the "ingredient" slot carries the variant: `stock_low_v1`
   * declares `evidence: false`, so the id is never rendered as a deep link, and
   * both `ReadinessSignal.source_id` and `BridgeDispatch.source_id` are
   * polymorphic `String` columns with no foreign key. `zoneId` is empty because
   * a catalog variant is not zoned — the field exists for the inventory emitter
   * (`inventory.service.ts:165`).
   */
  private emitIfLowStock(
    variant: {
      id: string;
      name: string;
      sku: string;
      stock_on_hand: unknown;
      low_stock_threshold: unknown;
      product: { node_id: string; name: string };
    },
    userId?: string,
  ): void {
    if (variant.low_stock_threshold === null) return;
    const onHand = Number(variant.stock_on_hand);
    const threshold = Number(variant.low_stock_threshold);
    if (!Number.isFinite(onHand) || !Number.isFinite(threshold)) return;
    if (onHand > threshold) return;

    emitDomainEvent(this.eventEmitter, DomainEvent.STOCK_LOW, {
      ...domainEventBase(variant.product.node_id, userActor(userId)),
      ingredientId: variant.id,
      ingredientName: `${variant.product.name} — ${variant.name} (${variant.sku})`,
      currentQty: onHand,
      minQty: threshold,
      unit: 'unit',
      zoneId: '',
    });
  }

  /**
   * `ProductVariant` and `ProductMedia` carry no `node_id`, so their audit rows
   * borrow the owning product's — a variant delete has to land in the same
   * node's trail as the product it took a SKU off.
   */
  async removeVariant(id: string, userId?: string) {
    // Read before the write: the pre-archive row *is* the `before` snapshot, and
    // a missing id becomes a 404 instead of an unhandled Prisma `P2025`.
    const existing = await this.prisma.productVariant.findUnique({
      where: { id },
      include: { product: { select: { node_id: true } } },
    });
    if (!existing) {
      throw new NotFoundException(`Product variant with ID ${id} not found`);
    }

    const variant = await this.prisma.$transaction(async (tx) => {
      const archived = await tx.productVariant.update({
        where: { id },
        data: { status: ProductStatus.archived },
      });
      await this.audit.record(tx, {
        entity_type: 'product_variant',
        entity_id: id,
        action: 'product_variant.deleted',
        node_id: existing.product.node_id,
        ...AuditService.user(userId),
        before: {
          product_id: existing.product_id,
          name: existing.name,
          sku: existing.sku,
          status: existing.status,
        },
        after: {
          product_id: archived.product_id,
          name: archived.name,
          sku: archived.sku,
          status: archived.status,
        },
      });
      return archived;
    });
    await this.cache.invalidate();
    return variant;
  }

  async addMedia(
    productId: string,
    data: { url: string; alt?: string; sort_order?: number; kind?: MediaKind },
  ) {
    const media = await this.prisma.productMedia.create({
      data: { product_id: productId, ...data },
    });
    await this.cache.invalidate();
    return media;
  }

  async removeMedia(id: string, userId?: string) {
    const existing = await this.prisma.productMedia.findUnique({
      where: { id },
      include: { product: { select: { node_id: true } } },
    });
    if (!existing) {
      throw new NotFoundException(`Product media with ID ${id} not found`);
    }

    const media = await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.productMedia.delete({ where: { id } });
      // A hard delete: `before` is the only record that this image ever
      // existed, so it carries the URL the row is about to lose.
      await this.audit.record(tx, {
        entity_type: 'product_media',
        entity_id: id,
        action: 'product_media.deleted',
        node_id: existing.product.node_id,
        ...AuditService.user(userId),
        before: {
          product_id: existing.product_id,
          url: existing.url,
          alt: existing.alt,
          kind: existing.kind,
          sort_order: existing.sort_order,
        },
      });
      return deleted;
    });
    await this.cache.invalidate();
    return media;
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
