import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { GuidesService } from '../guides/guides.service';
import { mockPrisma, MockPrisma } from '../test-utils/mock-providers';
import { Permission } from '../types/permissions';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: MockPrisma;
  let catalog: { search: jest.Mock };
  let guides: { searchPages: jest.Mock };

  const actor = {
    id: 'user-1',
    roleCode: 'BACKEND_LEAD',
    permissions: [Permission.VIEW_ROLE_SCOPED as string],
  };

  const taskRows = [
    { id: 't-1', title: 'Coconut oil order', status: 'todo', domain: 'food' },
    { id: 't-2', title: 'Coconut prep sheet', status: 'doing', domain: 'food' },
  ];

  beforeEach(async () => {
    prisma = mockPrisma();
    prisma.task.findMany.mockResolvedValue(taskRows);
    prisma.recipe.findMany.mockResolvedValue([
      {
        id: 'r-1',
        name: 'Coconut chutney',
        status: 'approved',
        preparation_type: 'scratch',
      },
    ]);

    catalog = {
      search: jest.fn().mockResolvedValue([
        {
          id: 'p-1',
          name: 'Cold pressed coconut oil',
          slug: 'coconut-oil',
          type: 'retail',
          base_price: 450,
        },
      ]),
    };
    guides = {
      searchPages: jest.fn().mockResolvedValue([
        {
          pageId: 'g-1',
          pageTitle: 'Coconut sourcing',
          pageSlug: 'coconut-sourcing',
          sectionTitle: 'Procurement',
          sectionSlug: 'procurement',
          snippet: '…',
        },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: prisma },
        { provide: CatalogService, useValue: catalog },
        { provide: GuidesService, useValue: guides },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('returns four empty buckets for a query shorter than 2 characters', async () => {
    const result = await service.search('c', actor);

    expect(result).toEqual({
      tasks: [],
      products: [],
      recipes: [],
      guides: [],
    });
    expect(prisma.task.findMany).not.toHaveBeenCalled();
    expect(catalog.search).not.toHaveBeenCalled();
    expect(guides.searchPages).not.toHaveBeenCalled();
  });

  it('builds a hit per bucket with the ops href for each entity', async () => {
    const result = await service.search('coco', actor);

    expect(result.tasks[0]).toEqual({
      id: 't-1',
      title: 'Coconut oil order',
      subtitle: 'food · todo',
      href: '/tasks/t-1',
    });
    expect(result.products[0]).toEqual({
      id: 'p-1',
      title: 'Cold pressed coconut oil',
      subtitle: 'retail',
      href: '/operations/menu?product=p-1',
    });
    expect(result.recipes[0]).toEqual({
      id: 'r-1',
      title: 'Coconut chutney',
      subtitle: 'scratch',
      href: '/operations/recipes/r-1',
    });
    expect(result.guides[0]).toEqual({
      id: 'g-1',
      title: 'Coconut sourcing',
      subtitle: 'Procurement',
      href: '/guide/procurement/coconut-sourcing',
    });
  });

  it('scopes tasks to the caller unless they hold VIEW_ALL', async () => {
    await service.search('coco', actor);
    expect(prisma.task.findMany.mock.calls[0][0].where).toMatchObject({
      owner_user_id: 'user-1',
    });

    prisma.task.findMany.mockClear();
    await service.search('coco', {
      ...actor,
      permissions: [Permission.VIEW_ALL],
    });
    expect(prisma.task.findMany.mock.calls[0][0].where).not.toHaveProperty(
      'owner_user_id',
    );
  });

  it('yields [] for a throwing bucket and keeps the others populated', async () => {
    catalog.search.mockRejectedValue(new Error('tsvector blew up'));

    const result = await service.search('coco', actor);

    expect(result.products).toEqual([]);
    expect(result.tasks).toHaveLength(2);
    expect(result.recipes).toHaveLength(1);
    expect(result.guides).toHaveLength(1);
  });

  it('respects limit per bucket', async () => {
    guides.searchPages.mockResolvedValue([
      {
        pageId: 'g-1',
        pageTitle: 'A',
        pageSlug: 'a',
        sectionTitle: 'S',
        sectionSlug: 's',
        snippet: '',
      },
      {
        pageId: 'g-2',
        pageTitle: 'B',
        pageSlug: 'b',
        sectionTitle: 'S',
        sectionSlug: 's',
        snippet: '',
      },
    ]);

    const result = await service.search('coco', actor, 1);

    expect(prisma.task.findMany.mock.calls[0][0].take).toBe(1);
    expect(prisma.recipe.findMany.mock.calls[0][0].take).toBe(1);
    expect(catalog.search).toHaveBeenCalledWith('coco', undefined, 1);
    // `searchPages` has no limit parameter, so the bucket is trimmed after the call.
    expect(result.guides).toHaveLength(1);
  });

  it('clamps an absurd limit to MAX_SEARCH_LIMIT', async () => {
    await service.search('coco', actor, 5000);

    expect(prisma.task.findMany.mock.calls[0][0].take).toBe(20);
  });
});
