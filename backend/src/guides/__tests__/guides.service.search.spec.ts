import { Test, TestingModule } from '@nestjs/testing';
import { GuidesService } from '../guides.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock DOMPurify (same pattern as guides.service.spec.ts)
jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((content: string, _opts?: any) => {
      // Pass through content (preserves <mark> tags like real config)
      return content
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/javascript:/gi, '');
    }),
  },
}));

describe('GuidesService - searchPages', () => {
  let service: GuidesService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuidesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<GuidesService>(GuidesService);
  });

  it('returns empty array for empty query', async () => {
    const result = await service.searchPages('', 'FOUNDER_ADMIN');
    expect(result).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns empty array for single character query', async () => {
    const result = await service.searchPages('a', 'BACKEND_LEAD');
    expect(result).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns empty array for null/undefined query', async () => {
    const result = await service.searchPages(null as any, 'FOUNDER_ADMIN');
    expect(result).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('calls $queryRaw for admin with valid query', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { pageId: '1', pageTitle: 'Test', pageSlug: 'test', sectionTitle: 'S', sectionSlug: 's', snippet: 'text' },
    ]);
    const result = await service.searchPages('kitchen prep', 'FOUNDER_ADMIN');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0].pageId).toBe('1');
  });

  it('calls $queryRaw for non-admin with valid query', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await service.searchPages('kitchen prep', 'BACKEND_LEAD');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('sanitizes snippets in results', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { pageId: '1', pageTitle: 'T', pageSlug: 't', sectionTitle: 'S', sectionSlug: 's', snippet: '<mark>match</mark> text' },
    ]);
    const result = await service.searchPages('match', 'FOUNDER_ADMIN');
    // sanitizeContent preserves <mark> tags (added to ALLOWED_TAGS)
    expect(result[0].snippet).toContain('mark');
  });
});
