import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RecipeStatus } from '@prisma/client';
import { RecipesService } from './recipes.service';
import { PrismaService } from '../prisma/prisma.service';
import { CostCalculatorService } from './cost-calculator.service';
import { ApprovalPolicyService } from '../approvals/approval-policy.service';
import { DomainEvent } from '../common/events/domain-events';
import {
  mockApprovalPolicyService,
  mockAuditService,
  mockEventEmitter,
  provideAuditService,
  provideEventEmitter,
} from '../test-utils/mock-providers';

const NODE_ID = '11111111-1111-4111-8111-111111111111';

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
  approval: {
    findMany: jest.fn().mockResolvedValue([]),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  auditEvent: { create: jest.fn() },
});

type MockRecipePrisma = {
  recipe: { findUnique: jest.Mock };
  approval: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

describe('RecipesService — approval gate, audit and events', () => {
  let service: RecipesService;
  let prisma: MockRecipePrisma;
  let tx: ReturnType<typeof makeTx>;
  let audit: ReturnType<typeof mockAuditService>;
  let policy: ReturnType<typeof mockApprovalPolicyService>;
  let emitter: ReturnType<typeof mockEventEmitter>;
  let costCalculator: { recalculateAndSave: jest.Mock };

  const pendingRecipe = {
    id: 'r-1',
    node_id: NODE_ID,
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
      approval: { findMany: jest.fn() },
      $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
    };
    audit = mockAuditService();
    policy = mockApprovalPolicyService();
    emitter = mockEventEmitter();
    costCalculator = {
      recalculateAndSave: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipesService,
        { provide: PrismaService, useValue: prisma },
        { provide: CostCalculatorService, useValue: costCalculator },
        { provide: ApprovalPolicyService, useValue: policy },
        provideAuditService(audit),
        provideEventEmitter(emitter),
      ],
    }).compile();

    service = module.get(RecipesService);
    jest.clearAllMocks();
  });

  describe('update — status transitions', () => {
    it('refuses pending → approved and points at the approvals queue', async () => {
      prisma.recipe.findUnique.mockResolvedValue(pendingRecipe);

      await expect(
        service.update(
          'r-1',
          { status: RecipeStatus.approved },
          'user-1',
          true,
        ),
      ).rejects.toThrow(/approvals queue/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('still rejects draft → approved with the generic transition error', async () => {
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
      ).rejects.toThrow("Cannot transition recipe from 'draft' to 'approved'.");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('materialises the (recipe, food) gate on draft → pending', async () => {
      prisma.recipe.findUnique.mockResolvedValue({
        ...pendingRecipe,
        status: RecipeStatus.draft,
      });
      tx.recipe.update.mockResolvedValue(pendingRecipe);

      await service.update(
        'r-1',
        { status: RecipeStatus.pending },
        'user-1',
        true,
      );

      expect(policy.materialise).toHaveBeenCalledWith(
        tx,
        {
          entity_type: 'recipe',
          entity_id: 'r-1',
          scope: 'recipe',
          domain: 'food',
        },
        NODE_ID,
      );
    });

    it('clears a previous attempt so a resubmission after a rejection is not blocked', async () => {
      prisma.recipe.findUnique.mockResolvedValue({
        ...pendingRecipe,
        status: RecipeStatus.draft,
      });
      tx.recipe.update.mockResolvedValue(pendingRecipe);

      await service.update(
        'r-1',
        { status: RecipeStatus.pending },
        'user-1',
        true,
      );

      // Every row, not just the pending ones: `materialise` skips roles that
      // already hold a row, so a leftover `rejected` row would never clear.
      expect(tx.approval.deleteMany).toHaveBeenCalledWith({
        where: { entity_type: 'recipe', entity_id: 'r-1' },
      });
      expect(tx.approval.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
        policy.materialise.mock.invocationCallOrder[0],
      );
    });

    it('records recipe.status_changed inside the transaction', async () => {
      prisma.recipe.findUnique.mockResolvedValue({
        ...pendingRecipe,
        status: RecipeStatus.draft,
      });
      tx.recipe.update.mockResolvedValue(pendingRecipe);

      await service.update(
        'r-1',
        { status: RecipeStatus.pending },
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
        before: { status: RecipeStatus.draft, version: 2 },
        after: { status: RecipeStatus.pending, version: 2 },
      });
    });

    it('deletes the still-pending approvals when a submission is withdrawn', async () => {
      prisma.recipe.findUnique.mockResolvedValue(pendingRecipe);
      tx.recipe.update.mockResolvedValue({
        ...pendingRecipe,
        status: RecipeStatus.draft,
      });

      await service.update(
        'r-1',
        { status: RecipeStatus.draft },
        'user-1',
        true,
      );

      expect(tx.approval.deleteMany).toHaveBeenCalledWith({
        where: {
          entity_type: 'recipe',
          entity_id: 'r-1',
          status: 'pending',
        },
      });
      expect(policy.materialise).not.toHaveBeenCalled();
    });

    it('emits recipe.archived after the transaction on approved → archived', async () => {
      prisma.recipe.findUnique.mockResolvedValue({
        ...pendingRecipe,
        status: RecipeStatus.approved,
      });
      tx.recipe.update.mockResolvedValue({
        ...pendingRecipe,
        status: RecipeStatus.archived,
      });

      await service.update(
        'r-1',
        { status: RecipeStatus.archived },
        'user-1',
        true,
      );

      expect(emitter.emit).toHaveBeenCalledWith(DomainEvent.RECIPE_ARCHIVED, {
        node_id: NODE_ID,
        actor: { actor_type: 'user', actor_id: 'user-1' },
        occurred_at: expect.any(String),
        recipeId: 'r-1',
        name: 'Butter Chicken',
        version: 2,
      });
      // Committed before the emit — the transaction callback has already run.
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.$transaction.mock.invocationCallOrder[0]).toBeLessThan(
        emitter.emit.mock.invocationCallOrder[0],
      );
    });

    it('does not emit or touch approvals on a name-only edit', async () => {
      prisma.recipe.findUnique.mockResolvedValue({
        ...pendingRecipe,
        status: RecipeStatus.draft,
      });
      tx.recipe.update.mockResolvedValue(pendingRecipe);

      await service.update('r-1', { name: 'Renamed' }, 'user-1', true);

      expect(audit.record).not.toHaveBeenCalled();
      expect(policy.materialise).not.toHaveBeenCalled();
      expect(emitter.emit).not.toHaveBeenCalled();
    });

    it('still refuses to edit a non-status field on an approved recipe', async () => {
      prisma.recipe.findUnique.mockResolvedValue({
        ...pendingRecipe,
        status: RecipeStatus.approved,
      });

      await expect(
        service.update('r-1', { name: 'Renamed' }, 'user-1', true),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('submit', () => {
    it('is draft → pending and materialises the gate', async () => {
      prisma.recipe.findUnique.mockResolvedValue({
        ...pendingRecipe,
        status: RecipeStatus.draft,
      });
      tx.recipe.update.mockResolvedValue(pendingRecipe);

      await service.submit('r-1', 'user-1', true);

      expect(tx.recipe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r-1' },
          data: expect.objectContaining({ status: RecipeStatus.pending }),
        }),
      );
      expect(policy.materialise).toHaveBeenCalledTimes(1);
    });
  });

  describe('findApprovalState', () => {
    it('returns the recipe approval rows ordered by required_role_code', async () => {
      prisma.recipe.findUnique.mockResolvedValue({
        id: 'r-1',
        status: RecipeStatus.pending,
      });
      const rows = [
        { id: 'a-1', required_role_code: 'BACKEND_LEAD', status: 'pending' },
        { id: 'a-2', required_role_code: 'FRONTEND_LEAD', status: 'pending' },
      ];
      prisma.approval.findMany.mockResolvedValue(rows);

      await expect(service.findApprovalState('r-1')).resolves.toEqual(rows);
      expect(prisma.approval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entity_type: 'recipe', entity_id: 'r-1' },
          orderBy: { required_role_code: 'asc' },
        }),
      );
    });

    it('404s for an unknown recipe', async () => {
      prisma.recipe.findUnique.mockResolvedValue(null);

      await expect(service.findApprovalState('nope')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.approval.findMany).not.toHaveBeenCalled();
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

    it('emits recipe.archived for the superseded version', async () => {
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

      expect(emitter.emit).toHaveBeenCalledWith(DomainEvent.RECIPE_ARCHIVED, {
        node_id: NODE_ID,
        actor: { actor_type: 'user', actor_id: 'user-1' },
        occurred_at: expect.any(String),
        recipeId: 'r-1',
        name: 'Butter Chicken',
        version: 2,
      });
    });

    it('refuses to version a non-approved recipe', async () => {
      tx.recipe.findUniqueOrThrow.mockResolvedValue(pendingRecipe);

      await expect(service.createNewVersion('r-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(audit.record).not.toHaveBeenCalled();
      expect(emitter.emit).not.toHaveBeenCalled();
    });
  });
});
