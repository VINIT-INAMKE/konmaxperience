import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import sanitizeHtml from 'sanitize-html';

export interface SearchResult {
  pageId: string;
  pageTitle: string;
  pageSlug: string;
  sectionTitle: string;
  sectionSlug: string;
  snippet: string;
}

@Injectable()
export class GuidesService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Admin bypass check (D-10) ---
  private isAdmin(roleCode: string): boolean {
    return roleCode === 'FOUNDER_ADMIN' || roleCode === 'TECH_LEAD';
  }

  // --- Slug generation ---
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
  }

  // --- Unique slug with suffix for sections ---
  private async uniqueSectionSlug(base: string): Promise<string> {
    let slug = base;
    let suffix = 2;
    while (await this.prisma.guideSection.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix}`;
      suffix++;
    }
    return slug;
  }

  // --- Unique slug with suffix for pages within a section ---
  private async uniquePageSlug(sectionId: string, base: string): Promise<string> {
    let slug = base;
    let suffix = 2;
    while (
      await this.prisma.guidePage.findUnique({
        where: { section_id_slug: { section_id: sectionId, slug } },
      })
    ) {
      slug = `${base}-${suffix}`;
      suffix++;
    }
    return slug;
  }

  // --- Content sanitization (D-14, EDIT-04) ---
  sanitizeContent(content: string): string {
    return sanitizeHtml(content, {
      allowedTags: [
        'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'blockquote', 'img', 'figure', 'figcaption',
        'mark',
      ],
      allowedAttributes: {
        a: ['href', 'target', 'rel'],
        img: ['src', 'alt', 'class'],
        '*': ['class', 'data-type'],
      },
    });
  }

  // --- Estimated read time (~200 words/min) ---
  private computeReadTime(content: string): number {
    const text = content.replace(/"text":"([^"]+)"/g, '$1 ');
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  // ==================== SECTIONS ====================

  async findSections(roleCode: string) {
    const admin = this.isAdmin(roleCode);

    return this.prisma.guideSection.findMany({
      where: admin
        ? {}
        : {
            status: 'published',
            role_codes: { has: roleCode },
          },
      include: {
        pages: {
          where: admin ? {} : { status: 'published' },
          orderBy: { sort_order: 'asc' },
          select: {
            id: true,
            title: true,
            slug: true,
            sort_order: true,
            status: true,
            summary: true,
            estimated_read_time: true,
          },
        },
      },
      orderBy: { sort_order: 'asc' },
    });
  }

  async findSection(id: string, roleCode: string) {
    const section = await this.prisma.guideSection.findUnique({
      where: { id },
      include: {
        pages: {
          where: this.isAdmin(roleCode) ? {} : { status: 'published' },
          orderBy: { sort_order: 'asc' },
        },
      },
    });

    if (!section) throw new NotFoundException('Section not found');

    const admin = this.isAdmin(roleCode);
    if (!admin) {
      if (section.status !== 'published') throw new NotFoundException('Section not found');
      if (!section.role_codes.includes(roleCode)) throw new NotFoundException('Section not found');
    }

    return section;
  }

  async createSection(dto: CreateSectionDto) {
    const slug = await this.uniqueSectionSlug(this.generateSlug(dto.title));

    return this.prisma.guideSection.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description,
        icon: dto.icon,
        accent_color: dto.accent_color,
        role_codes: dto.role_codes ?? [],
        sort_order: dto.sort_order ?? 0,
        status: dto.status ?? 'draft',
      },
    });
  }

  async updateSection(id: string, dto: UpdateSectionDto) {
    const existing = await this.prisma.guideSection.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Section not found');

    const data: Record<string, any> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.accent_color !== undefined) data.accent_color = dto.accent_color;
    if (dto.role_codes !== undefined) data.role_codes = dto.role_codes;
    if (dto.sort_order !== undefined) data.sort_order = dto.sort_order;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.slug !== undefined) data.slug = dto.slug;

    return this.prisma.guideSection.update({ where: { id }, data });
  }

  async removeSection(id: string) {
    const existing = await this.prisma.guideSection.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Section not found');

    return this.prisma.guideSection.delete({ where: { id } });
  }

  // ==================== PAGES ====================

  async findPage(id: string, roleCode: string) {
    const page = await this.prisma.guidePage.findUnique({
      where: { id },
      include: { section: { select: { role_codes: true, status: true } } },
    });

    if (!page) throw new NotFoundException('Page not found');

    const admin = this.isAdmin(roleCode);
    if (!admin) {
      const canAccess =
        page.status === 'published' &&
        page.section.status === 'published' &&
        page.section.role_codes.includes(roleCode);
      if (!canAccess) throw new NotFoundException('Page not found');
    }

    return page;
  }

  async createPage(dto: CreatePageDto) {
    // Verify section exists
    const section = await this.prisma.guideSection.findUnique({
      where: { id: dto.section_id },
    });
    if (!section) throw new NotFoundException('Section not found');

    const slug = await this.uniquePageSlug(dto.section_id, this.generateSlug(dto.title));
    const sanitizedContent = this.sanitizeContent(dto.content);
    const readTime = this.computeReadTime(sanitizedContent);

    return this.prisma.guidePage.create({
      data: {
        section_id: dto.section_id,
        title: dto.title,
        slug,
        content: sanitizedContent,
        summary: dto.summary,
        sort_order: dto.sort_order ?? 0,
        status: dto.status ?? 'draft',
        estimated_read_time: readTime,
      },
    });
  }

  async updatePage(id: string, dto: UpdatePageDto) {
    const existing = await this.prisma.guidePage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Page not found');

    const data: Record<string, any> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.summary !== undefined) data.summary = dto.summary;
    if (dto.sort_order !== undefined) data.sort_order = dto.sort_order;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.slug !== undefined) data.slug = dto.slug;

    if (dto.content !== undefined) {
      data.content = this.sanitizeContent(dto.content);
      data.estimated_read_time = this.computeReadTime(data.content);
    }

    return this.prisma.guidePage.update({ where: { id }, data });
  }

  async removePage(id: string) {
    const existing = await this.prisma.guidePage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Page not found');

    return this.prisma.guidePage.delete({ where: { id } });
  }

  // ==================== SEARCH ====================

  async searchPages(query: string, roleCode: string): Promise<SearchResult[]> {
    if (!query || query.trim().length < 2) return [];

    const safeQuery = query.trim();
    const isAdmin = this.isAdmin(roleCode);

    const results = isAdmin
      ? await this.prisma.$queryRaw<SearchResult[]>`
          SELECT
            p.id          AS "pageId",
            p.title       AS "pageTitle",
            p.slug        AS "pageSlug",
            s.title       AS "sectionTitle",
            s.slug        AS "sectionSlug",
            ts_headline(
              'english', p.search_text,
              websearch_to_tsquery('english', ${safeQuery}),
              'MaxWords=20,MinWords=10,StartSel=<mark>,StopSel=</mark>'
            ) AS snippet
          FROM "GuidePage" p
          JOIN "GuideSection" s ON s.id = p.section_id
          WHERE to_tsvector('english', p.search_text)
                @@ websearch_to_tsquery('english', ${safeQuery})
          ORDER BY ts_rank(
            to_tsvector('english', p.search_text),
            websearch_to_tsquery('english', ${safeQuery})
          ) DESC
          LIMIT 10
        `
      : await this.prisma.$queryRaw<SearchResult[]>`
          SELECT
            p.id          AS "pageId",
            p.title       AS "pageTitle",
            p.slug        AS "pageSlug",
            s.title       AS "sectionTitle",
            s.slug        AS "sectionSlug",
            ts_headline(
              'english', p.search_text,
              websearch_to_tsquery('english', ${safeQuery}),
              'MaxWords=20,MinWords=10,StartSel=<mark>,StopSel=</mark>'
            ) AS snippet
          FROM "GuidePage" p
          JOIN "GuideSection" s ON s.id = p.section_id
          WHERE p.status = 'published'
            AND s.status = 'published'
            AND s.role_codes @> ARRAY[${roleCode}]::text[]
            AND to_tsvector('english', p.search_text)
                @@ websearch_to_tsquery('english', ${safeQuery})
          ORDER BY ts_rank(
            to_tsvector('english', p.search_text),
            websearch_to_tsquery('english', ${safeQuery})
          ) DESC
          LIMIT 10
        `;

    // Sanitize snippets before returning (defense-in-depth)
    return results.map(r => ({
      ...r,
      snippet: this.sanitizeContent(r.snippet),
    }));
  }
}
