import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GuidesService } from '../guides.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('GuidesService', () => {
  let service: GuidesService;
  let prisma: {
    guideSection: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    guidePage: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      guideSection: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      guidePage: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuidesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<GuidesService>(GuidesService);
  });

  // ==================== GUIDE-01: Section CRUD ====================

  describe('GUIDE-01: Section CRUD', () => {
    it('createSection persists a GuideSection and returns it', async () => {
      const dto = { title: 'Kitchen Operations' };
      const created = {
        id: 'sec-1',
        title: 'Kitchen Operations',
        slug: 'kitchen-operations',
        role_codes: [],
        sort_order: 0,
        status: 'draft',
      };
      // uniqueSectionSlug calls findUnique to check slug collision
      prisma.guideSection.findUnique.mockResolvedValueOnce(null);
      prisma.guideSection.create.mockResolvedValue(created);

      const result = await service.createSection(dto);

      expect(prisma.guideSection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Kitchen Operations',
          slug: 'kitchen-operations',
          role_codes: [],
          sort_order: 0,
          status: 'draft',
        }),
      });
      expect(result).toEqual(created);
    });

    it('removeSection deletes the section and cascading pages', async () => {
      prisma.guideSection.findUnique.mockResolvedValue({ id: 'sec-1' });
      prisma.guideSection.delete.mockResolvedValue({ id: 'sec-1' });

      await service.removeSection('sec-1');

      expect(prisma.guideSection.delete).toHaveBeenCalledWith({
        where: { id: 'sec-1' },
      });
    });

    it('removeSection throws NotFoundException for non-existent section', async () => {
      prisma.guideSection.findUnique.mockResolvedValue(null);

      await expect(service.removeSection('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==================== GUIDE-02: Page CRUD ====================

  describe('GUIDE-02: Page CRUD', () => {
    it('createPage persists a GuidePage linked to section_id and returns it', async () => {
      const dto = {
        section_id: 'sec-1',
        title: 'Getting Started',
        content: 'Some guide content here with enough words.',
      };
      prisma.guideSection.findUnique.mockResolvedValue({ id: 'sec-1' });
      // uniquePageSlug check
      prisma.guidePage.findUnique.mockResolvedValueOnce(null);
      const created = {
        id: 'page-1',
        section_id: 'sec-1',
        title: 'Getting Started',
        slug: 'getting-started',
        content: 'Some guide content here with enough words.',
        estimated_read_time: 1,
        status: 'draft',
      };
      prisma.guidePage.create.mockResolvedValue(created);

      const result = await service.createPage(dto);

      expect(prisma.guidePage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          section_id: 'sec-1',
          title: 'Getting Started',
          slug: 'getting-started',
        }),
      });
      expect(result).toEqual(created);
    });

    it('createPage throws NotFoundException if section does not exist', async () => {
      prisma.guideSection.findUnique.mockResolvedValue(null);

      await expect(
        service.createPage({
          section_id: 'nonexistent',
          title: 'Test',
          content: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('removePage deletes the page', async () => {
      prisma.guidePage.findUnique.mockResolvedValue({ id: 'page-1' });
      prisma.guidePage.delete.mockResolvedValue({ id: 'page-1' });

      await service.removePage('page-1');

      expect(prisma.guidePage.delete).toHaveBeenCalledWith({
        where: { id: 'page-1' },
      });
    });
  });

  // ==================== GUIDE-03: Role-based filtering ====================

  describe('GUIDE-03: Role-based filtering', () => {
    it('findSections for KITCHEN_LEAD returns only sections with matching role_code', async () => {
      prisma.guideSection.findMany.mockResolvedValue([
        { id: 'sec-1', role_codes: ['KITCHEN_LEAD'], status: 'published' },
      ]);

      await service.findSections('KITCHEN_LEAD');

      expect(prisma.guideSection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'published',
            role_codes: { has: 'KITCHEN_LEAD' },
          },
        }),
      );
    });

    it('findSections for FOUNDER_ADMIN returns ALL sections regardless of role_codes', async () => {
      prisma.guideSection.findMany.mockResolvedValue([
        { id: 'sec-1', role_codes: ['KITCHEN_LEAD'] },
        { id: 'sec-2', role_codes: [] },
      ]);

      await service.findSections('FOUNDER_ADMIN');

      expect(prisma.guideSection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('findSections for TECH_LEAD returns ALL sections (admin bypass)', async () => {
      prisma.guideSection.findMany.mockResolvedValue([]);

      await service.findSections('TECH_LEAD');

      expect(prisma.guideSection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });
  });

  // ==================== GUIDE-04: Draft visibility ====================

  describe('GUIDE-04: Draft visibility', () => {
    it('findSections for non-admin excludes draft sections', async () => {
      prisma.guideSection.findMany.mockResolvedValue([]);

      await service.findSections('KITCHEN_LEAD');

      expect(prisma.guideSection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'published',
          }),
        }),
      );
    });

    it('findSections for FOUNDER_ADMIN includes draft sections', async () => {
      prisma.guideSection.findMany.mockResolvedValue([]);

      await service.findSections('FOUNDER_ADMIN');

      // Admin where clause should be empty (no status filter)
      expect(prisma.guideSection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('findPage throws NotFoundException for a draft page when roleCode is non-admin', async () => {
      prisma.guidePage.findUnique.mockResolvedValue({
        id: 'page-1',
        status: 'draft',
        section: { role_codes: ['KITCHEN_LEAD'], status: 'published' },
      });

      await expect(
        service.findPage('page-1', 'KITCHEN_LEAD'),
      ).rejects.toThrow(NotFoundException);
    });

    it('findPage returns draft page when roleCode is FOUNDER_ADMIN', async () => {
      const draftPage = {
        id: 'page-1',
        status: 'draft',
        section: { role_codes: [], status: 'draft' },
      };
      prisma.guidePage.findUnique.mockResolvedValue(draftPage);

      const result = await service.findPage('page-1', 'FOUNDER_ADMIN');

      expect(result).toEqual(draftPage);
    });
  });

  // ==================== GUIDE-05: Sort ordering ====================

  describe('GUIDE-05: Sort ordering', () => {
    it('updateSection updates sort_order', async () => {
      prisma.guideSection.findUnique.mockResolvedValue({ id: 'sec-1' });
      prisma.guideSection.update.mockResolvedValue({
        id: 'sec-1',
        sort_order: 5,
      });

      await service.updateSection('sec-1', { sort_order: 5 });

      expect(prisma.guideSection.update).toHaveBeenCalledWith({
        where: { id: 'sec-1' },
        data: { sort_order: 5 },
      });
    });

    it('findSections returns sections ordered by sort_order ascending', async () => {
      prisma.guideSection.findMany.mockResolvedValue([]);

      await service.findSections('FOUNDER_ADMIN');

      expect(prisma.guideSection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { sort_order: 'asc' },
        }),
      );
    });
  });

  // ==================== EDIT-04: Content sanitization ====================

  describe('EDIT-04: Content sanitization', () => {
    it('sanitizeContent strips <script> tags', () => {
      const result = service.sanitizeContent(
        '<p>Hello</p><script>alert(1)</script>',
      );
      expect(result).not.toContain('<script>');
      expect(result).toContain('<p>Hello</p>');
    });

    it('sanitizeContent removes javascript: hrefs', () => {
      const result = service.sanitizeContent(
        '<a href="javascript:alert(1)">Click</a>',
      );
      expect(result).not.toContain('javascript:');
    });

    it('createPage stores content with script tag stripped', async () => {
      prisma.guideSection.findUnique.mockResolvedValue({ id: 'sec-1' });
      prisma.guidePage.findUnique.mockResolvedValueOnce(null);
      prisma.guidePage.create.mockImplementation((args) => args.data);

      await service.createPage({
        section_id: 'sec-1',
        title: 'Test Page',
        content: '<p>Safe</p><script>alert("xss")</script>',
      });

      expect(prisma.guidePage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: expect.not.stringContaining('<script>'),
        }),
      });
    });
  });

  // ==================== Slug generation ====================

  describe('Slug generation', () => {
    it('createSection auto-generates slug from title', async () => {
      prisma.guideSection.findUnique.mockResolvedValue(null);
      prisma.guideSection.create.mockImplementation((args) => args.data);

      const result = await service.createSection({
        title: 'Kitchen Operations',
      });

      expect(prisma.guideSection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slug: 'kitchen-operations',
        }),
      });
    });

    it('handles slug collisions with numeric suffix', async () => {
      // First check: slug exists; second check: slug-2 does not
      prisma.guideSection.findUnique
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null);
      prisma.guideSection.create.mockImplementation((args) => args.data);

      await service.createSection({ title: 'Kitchen Operations' });

      expect(prisma.guideSection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slug: 'kitchen-operations-2',
        }),
      });
    });
  });

  // ==================== Read time computation ====================

  describe('Read time computation', () => {
    it('createPage sets estimated_read_time based on word count', async () => {
      prisma.guideSection.findUnique.mockResolvedValue({ id: 'sec-1' });
      prisma.guidePage.findUnique.mockResolvedValueOnce(null);
      prisma.guidePage.create.mockImplementation((args) => args.data);

      // Generate ~400 words of content
      const words = Array(400).fill('word').join(' ');
      await service.createPage({
        section_id: 'sec-1',
        title: 'Long Page',
        content: words,
      });

      expect(prisma.guidePage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          estimated_read_time: 2, // 400 words / 200 wpm = 2 min
        }),
      });
    });

    it('minimum read time is 1 minute', async () => {
      prisma.guideSection.findUnique.mockResolvedValue({ id: 'sec-1' });
      prisma.guidePage.findUnique.mockResolvedValueOnce(null);
      prisma.guidePage.create.mockImplementation((args) => args.data);

      await service.createPage({
        section_id: 'sec-1',
        title: 'Short Page',
        content: 'Brief content.',
      });

      expect(prisma.guidePage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          estimated_read_time: 1,
        }),
      });
    });
  });

  // ==================== Update with re-sanitize + re-compute ====================

  describe('updatePage', () => {
    it('re-sanitizes content and re-computes read time when content is updated', async () => {
      prisma.guidePage.findUnique.mockResolvedValue({ id: 'page-1' });
      prisma.guidePage.update.mockImplementation((args) => ({
        id: 'page-1',
        ...args.data,
      }));

      await service.updatePage('page-1', {
        content: '<p>Updated</p><script>bad</script>',
      });

      expect(prisma.guidePage.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: expect.objectContaining({
          content: expect.not.stringContaining('<script>'),
          estimated_read_time: expect.any(Number),
        }),
      });
    });

    it('does not re-compute read time when content is not updated', async () => {
      prisma.guidePage.findUnique.mockResolvedValue({ id: 'page-1' });
      prisma.guidePage.update.mockImplementation((args) => ({
        id: 'page-1',
        ...args.data,
      }));

      await service.updatePage('page-1', { sort_order: 3 });

      expect(prisma.guidePage.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: { sort_order: 3 },
      });
    });
  });
});
