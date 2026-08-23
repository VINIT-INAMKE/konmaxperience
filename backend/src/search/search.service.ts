import { Injectable } from '@nestjs/common';
import { RecipeStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { GuidesService } from '../guides/guides.service';
import { Permission } from '../types/permissions';

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface SearchResults {
  tasks: SearchHit[];
  products: SearchHit[];
  recipes: SearchHit[];
  guides: SearchHit[];
}

/** The row shape `CatalogService.search` returns from its raw tsvector query. */
interface ProductSearchRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  base_price: unknown;
}

export const MIN_QUERY_LENGTH = 2;
export const DEFAULT_SEARCH_LIMIT = 5;
export const MAX_SEARCH_LIMIT = 20;

const EMPTY: SearchResults = {
  tasks: [],
  products: [],
  recipes: [],
  guides: [],
};

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly guides: GuidesService,
  ) {}

  /**
   * The ⌘K corpus. Every bucket is independently scoped and independently
   * failure-isolated: one bucket erroring returns `[]` for itself and never
   * takes the palette down.
   */
  async search(
    q: string,
    actor: { id: string; roleCode: string; permissions: string[] },
    limit = DEFAULT_SEARCH_LIMIT,
  ): Promise<SearchResults> {
    const query = (q ?? '').trim();
    if (query.length < MIN_QUERY_LENGTH) {
      return { ...EMPTY };
    }
    const take = Math.min(Math.max(limit, 1), MAX_SEARCH_LIMIT);

    const [tasks, products, recipes, guides] = await Promise.all([
      this.searchTasks(query, actor, take).catch(() => []),
      this.searchProducts(query, take).catch(() => []),
      this.searchRecipes(query, take).catch(() => []),
      this.searchGuides(query, actor.roleCode, take).catch(() => []),
    ]);

    return { tasks, products, recipes, guides };
  }

  private async searchTasks(
    query: string,
    actor: { id: string; permissions: string[] },
    take: number,
  ): Promise<SearchHit[]> {
    const seesAll = actor.permissions.includes(Permission.VIEW_ALL);
    const rows = await this.prisma.task.findMany({
      where: {
        title: { contains: query, mode: 'insensitive' },
        ...(seesAll ? {} : { owner_user_id: actor.id }),
      },
      select: { id: true, title: true, status: true, domain: true },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take,
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: `${row.domain} · ${row.status}`,
      href: `/tasks/${row.id}`,
    }));
  }

  private async searchProducts(
    query: string,
    take: number,
  ): Promise<SearchHit[]> {
    // P5a-04 changed CatalogService.search to (q, type?, categoryId?, cursor?, limit?)
    // returning a { items, facets, next_cursor } envelope.
    const { items: rows } = await this.catalog.search(
      query,
      undefined,
      undefined,
      undefined,
      take,
    );
    return rows.slice(0, take).map((row: ProductSearchRow) => ({
      id: row.id,
      title: row.name,
      subtitle: row.type,
      href: `/operations/menu?product=${row.id}`,
    }));
  }

  private async searchRecipes(
    query: string,
    take: number,
  ): Promise<SearchHit[]> {
    const rows = await this.prisma.recipe.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
      select: {
        id: true,
        name: true,
        status: true,
        preparation_type: true,
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      take,
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.name,
      subtitle:
        row.status === RecipeStatus.approved
          ? row.preparation_type
          : `${row.preparation_type} · ${row.status}`,
      href: `/operations/recipes/${row.id}`,
    }));
  }

  private async searchGuides(
    query: string,
    roleCode: string,
    take: number,
  ): Promise<SearchHit[]> {
    // `searchPages` is already role-filtered (unpublished + out-of-role sections
    // are excluded), so no extra scoping is applied here.
    const rows = await this.guides.searchPages(query, roleCode);
    return rows.slice(0, take).map((row) => ({
      id: row.pageId,
      title: row.pageTitle,
      subtitle: row.sectionTitle,
      href: `/guide/${row.sectionSlug}/${row.pageSlug}`,
    }));
  }
}
