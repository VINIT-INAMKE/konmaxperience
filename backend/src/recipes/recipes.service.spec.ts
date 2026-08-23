import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RecipeStatus } from '@prisma/client';
import { RecipesService } from './recipes.service';
import { PrismaService } from '../prisma/prisma.service';
import { CostCalculatorService } from './cost-calculator.service';
import {
  mockAuditService,
  provideAuditService,
} from '../test-utils/mock-providers';

const makeTx = () => ({
  recipe: {
    update: jest.fn(),
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  recipeLine: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  auditEvent: { create: jest.fn() },
});

type MockRecipePrisma = {
  recipe: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

describe('RecipesService — audit', () => {
  let service: RecipesService;
  let prisma: MockRecipePrisma;
  let tx: ReturnType<typeof makeTx>;
  let audit: ReturnType<typeof mockAuditService>;
  let costCalculator: { recalculateAndSave: jest.Mock };

  const pendingRecipe = {
    id: 'r-1',
    name: 'Butter Chicken',
    status: RecipeStatus.pending,
    version: 2,
    created_by: 'user-1',
    RecipeLines: [],
  };

  beforeEach(async () => {
    tx = makeTx();
    prisma = {
      recipe: { findUnique: jest.fn() },
      $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
    };
    audit = mockAuditService();
    costCalculator = {
      recalculateAndSave: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipesService,
        { provide: PrismaService, useValue: prisma },
        { provide: CostCalculatorService, useValue: costCalculator },
        provideAuditService(audit),
      ],
    }).compile();

    service = module.get(RecipesService);
    jest.clearAllMocks();
  });

  describe('update', () => {
    it('records recipe.status_changed inside the transaction', async () => {
      prisma.recipe.findUnique.mockResolvedValue(pendingRecipe);
      tx.recipe.update.mockResolvedValue({
        ...pendingRecipe,
        status: RecipeStatus.approved,
      });

      await service.update(
        'r-1',
        { status: RecipeStatus.approved },
        'user-1',
        true,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(tx, {
        entity_type: 'recipe',
        entity_id: 'r-1',
        action: 'recipe.status_changed',
        actor_type: 'user',
        actor_id: 'user-1',
        before: { status: RecipeStatus.pending, version: 2 },
        after: { status: RecipeStatus.approved, version: 2 },
      });
    });

    it('does not audit a name-only edit', async () => {
      prisma.recipe.findUnique.mockResolvedValue({
        ...pendingRecipe,
        status: RecipeStatus.draft,
      });
      tx.recipe.update.mockResolvedValue(pendingRecipe);

      await service.update('r-1', { name: 'Renamed' }, 'user-1', true);

      expect(audit.record).not.toHaveBeenCalled();
    });

    it('rejects an illegal transition before opening a transaction', async () => {
      prisma.recipe.findUnique.mockResolvedValue({
        ...pendingRecipe,
        status: RecipeStatus.draft,
      });

      await expect(
        service.update(
          'r-1',
          { status: RecipeStatus.approved },
          'user-1',
          true,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('createNewVersion', () => {
    it('records recipe.version_created against the clone', async () => {
      tx.recipe.findUniqueOrThrow.mockResolvedValue({
        ...pendingRecipe,
        status: RecipeStatus.approved,
        parent_recipe_id: null,
      });
      tx.recipe.update.mockResolvedValue({});
      tx.recipe.create.mockResolvedValue({
        id: 'r-2',
        version: 3,
        status: RecipeStatus.draft,
      });
      prisma.recipe.findUnique.mockResolvedValue({ id: 'r-2', version: 3 });

      await service.createNewVersion('r-1', 'user-1');

      expect(audit.record).toHaveBeenCalledWith(tx, {
        entity_type: 'recipe',
        entity_id: 'r-2',
        action: 'recipe.version_created',
        actor_type: 'user',
        actor_id: 'user-1',
        before: {
          recipe_id: 'r-1',
          status: RecipeStatus.approved,
          version: 2,
        },
        after: {
          recipe_id: 'r-2',
          status: RecipeStatus.draft,
          version: 3,
        },
      });
    });

    it('refuses to version a non-approved recipe', async () => {
      tx.recipe.findUniqueOrThrow.mockResolvedValue(pendingRecipe);

      await expect(service.createNewVersion('r-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
