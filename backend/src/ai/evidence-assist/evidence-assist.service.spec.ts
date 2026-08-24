import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  EvidenceAssistService,
  rejectedEvidenceFilter,
} from './evidence-assist.service';
import { AiProviderResolver } from '../ai-provider.resolver';
import { PrismaService } from '../../prisma/prisma.service';
import { NodeService } from '../../node/node.service';
import { SETTING_DEFAULTS } from '../../settings/settings.service';
import {
  mockAiProvider,
  mockAiResolver,
  mockNodeService,
  mockPrisma,
  provideAi,
  type MockPrisma,
} from '../../test-utils/mock-providers';

const NODE_ID = '11111111-1111-4111-8111-111111111111';
const EVIDENCE_ID = '22222222-2222-4222-8222-222222222222';
const TASK_ID = '33333333-3333-4333-8333-333333333333';

function pendingEvidence(overrides: Record<string, unknown> = {}) {
  return {
    id: EVIDENCE_ID,
    type: 'image',
    notes: 'Prep station photographed after the deep clean.',
    url: 'https://cdn.test/evidence.jpg',
    source: 'bridge',
    bridge_event: 'order.completed',
    reviewed_at: null,
    uploader: { name: 'Kitchen Lead' },
    task: {
      id: TASK_ID,
      title: 'Deep clean the prep station',
      description: 'Weekly deep clean, photographed before close.',
    },
    ...overrides,
  };
}

/**
 * `mockAiResolver` predates `AiProviderResolver.settings()` (it lives in
 * `test-utils`, which may not import from `src/ai/**`), so the block the service
 * reads is layered on here.
 */
function buildResolver(
  provider = mockAiProvider(),
  ai: Partial<(typeof SETTING_DEFAULTS)['ai']> = {},
) {
  return {
    ...mockAiResolver(provider),
    settings: jest.fn().mockResolvedValue({ ...SETTING_DEFAULTS.ai, ...ai }),
  };
}

async function build(
  prisma: MockPrisma,
  resolver: ReturnType<typeof buildResolver>,
) {
  const node = mockNodeService(NODE_ID);
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      EvidenceAssistService,
      { provide: PrismaService, useValue: prisma },
      { provide: NodeService, useValue: node },
      provideAi(AiProviderResolver, resolver),
    ],
  }).compile();
  return {
    service: moduleRef.get(EvidenceAssistService),
    prisma,
    resolver,
    node,
  };
}

/** The row shape `suggest` writes — typed so the assertions below stay checked. */
interface SuggestionWrite {
  node_id: string;
  evidence_id: string;
  verdict: string;
  confidence: Prisma.Decimal;
  reasons: string[];
  provider: string;
  model: string | null;
  latency_ms: number;
}

function createdSuggestion(prisma: MockPrisma): SuggestionWrite {
  const calls = prisma.evidenceReviewSuggestion.create.mock
    .calls as unknown as [{ data: SuggestionWrite }][];
  return calls[0][0].data;
}

function prismaFor(evidence: unknown, priorRejections = 0) {
  const prisma = mockPrisma();
  prisma.evidence.findUnique.mockResolvedValue(evidence);
  prisma.evidence.count.mockResolvedValue(priorRejections);
  prisma.evidenceReviewSuggestion.create.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'suggestion-1', created_at: new Date(), ...data }),
  );
  return prisma;
}

describe('EvidenceAssistService (RUN-05 — suggests, never decides)', () => {
  afterEach(() => jest.clearAllMocks());

  describe('rejectedEvidenceFilter', () => {
    it('resolves the decision column off the generated data model', () => {
      // The service may not spell this column (`ai-boundaries.spec.ts`); the
      // spec files are not scanned, so the contract is pinned here instead.
      expect(rejectedEvidenceFilter()).toEqual({
        approval_status: 'rejected',
      });
    });
  });

  describe('suggest', () => {
    it('persists a suggestion for pending evidence and returns it', async () => {
      const provider = mockAiProvider();
      const { service, prisma } = await build(
        prismaFor(pendingEvidence()),
        buildResolver(provider),
      );

      const created = await service.suggest(EVIDENCE_ID);

      expect(prisma.evidenceReviewSuggestion.create).toHaveBeenCalledTimes(1);
      const data = createdSuggestion(prisma);
      expect(data).toMatchObject({
        node_id: NODE_ID,
        evidence_id: EVIDENCE_ID,
        verdict: 'approve',
        provider: 'heuristic',
        model: null,
        latency_ms: 1,
        reasons: ['Written by the mission bridge from a real ops event.'],
      });
      expect(data.confidence).toBeInstanceOf(Prisma.Decimal);
      expect(data.confidence.toString()).toBe('0.75');
      expect(created).toMatchObject({ verdict: 'approve' });
    });

    it('stores the provider the resolver actually chose', async () => {
      const provider = mockAiProvider({
        reviewEvidence: jest.fn().mockResolvedValue({
          verdict: 'unsure',
          confidence: 0.35,
          reasons: ['The note does not tie the file to the task.'],
          provider: 'anthropic',
          model: 'claude-opus-5',
          latency_ms: 812,
        }),
      });
      const { service, prisma } = await build(
        prismaFor(pendingEvidence()),
        buildResolver(provider),
      );

      await service.suggest(EVIDENCE_ID);

      expect(createdSuggestion(prisma)).toMatchObject({
        verdict: 'unsure',
        provider: 'anthropic',
        model: 'claude-opus-5',
        latency_ms: 812,
      });
    });

    it('passes the stored evidence through to the port verbatim', async () => {
      const provider = mockAiProvider();
      const { service } = await build(
        prismaFor(pendingEvidence(), 2),
        buildResolver(provider),
      );

      await service.suggest(EVIDENCE_ID);

      expect(provider.reviewEvidence).toHaveBeenCalledWith({
        evidence_id: EVIDENCE_ID,
        task_title: 'Deep clean the prep station',
        task_description: 'Weekly deep clean, photographed before close.',
        evidence_type: 'image',
        evidence_notes: 'Prep station photographed after the deep clean.',
        evidence_url: 'https://cdn.test/evidence.jpg',
        source: 'bridge',
        bridge_event: 'order.completed',
        uploaded_by_name: 'Kitchen Lead',
        prior_rejections: 2,
      });
    });

    it('counts only rejected evidence on the same task as a prior rejection', async () => {
      const { service, prisma } = await build(
        prismaFor(pendingEvidence(), 3),
        buildResolver(),
      );

      await service.suggest(EVIDENCE_ID);

      expect(prisma.evidence.count).toHaveBeenCalledTimes(1);
      expect(prisma.evidence.count).toHaveBeenCalledWith({
        where: { task_id: TASK_ID, approval_status: 'rejected' },
      });
    });

    it('calls the resolved provider exactly once per request', async () => {
      const provider = mockAiProvider();
      const resolver = buildResolver(provider);
      const { service } = await build(prismaFor(pendingEvidence()), resolver);

      await service.suggest(EVIDENCE_ID);

      expect(resolver.get).toHaveBeenCalledTimes(1);
      expect(provider.reviewEvidence).toHaveBeenCalledTimes(1);
      expect(provider.writeMorningBrief).not.toHaveBeenCalled();
    });

    it('never writes a decision — no mutation of Evidence at all', async () => {
      const { service, prisma } = await build(
        prismaFor(pendingEvidence()),
        buildResolver(),
      );

      await service.suggest(EVIDENCE_ID);

      // SPEC §1.2: `EvidenceService` stays the only writer of a review outcome.
      expect(prisma.evidence.update).not.toHaveBeenCalled();
      expect(prisma.evidence.updateMany).not.toHaveBeenCalled();
      expect(prisma.evidence.upsert).not.toHaveBeenCalled();
      expect(prisma.evidence.delete).not.toHaveBeenCalled();
      expect(prisma.task.update).not.toHaveBeenCalled();
      expect(prisma.readinessMeter.update).not.toHaveBeenCalled();
    });

    it('throws when the evidence has already been reviewed', async () => {
      const provider = mockAiProvider();
      const { service, prisma } = await build(
        prismaFor(pendingEvidence({ reviewed_at: new Date() })),
        buildResolver(provider),
      );

      await expect(service.suggest(EVIDENCE_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(provider.reviewEvidence).not.toHaveBeenCalled();
      expect(prisma.evidenceReviewSuggestion.create).not.toHaveBeenCalled();
    });

    it('throws when the evidence does not exist', async () => {
      const provider = mockAiProvider();
      const { service } = await build(prismaFor(null), buildResolver(provider));

      await expect(service.suggest(EVIDENCE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(provider.reviewEvidence).not.toHaveBeenCalled();
    });

    it('throws — and reads nothing — when the assist is switched off', async () => {
      const provider = mockAiProvider();
      const { service, prisma } = await build(
        prismaFor(pendingEvidence()),
        buildResolver(provider, { evidence_assist_enabled: false }),
      );

      await expect(service.suggest(EVIDENCE_ID)).rejects.toThrow(
        'Evidence assist is disabled',
      );
      expect(prisma.evidence.findUnique).not.toHaveBeenCalled();
      expect(provider.reviewEvidence).not.toHaveBeenCalled();
    });

    it('clamps a confidence the column could not hold and rounds the latency', async () => {
      const provider = mockAiProvider({
        reviewEvidence: jest.fn().mockResolvedValue({
          verdict: 'approve',
          confidence: 42,
          reasons: ['  ', 'The bridge event names this exact task.'],
          provider: 'anthropic',
          model: 'claude-opus-5',
          latency_ms: 903.7,
        }),
      });
      const { service, prisma } = await build(
        prismaFor(pendingEvidence()),
        buildResolver(provider),
      );

      await service.suggest(EVIDENCE_ID);

      const data = createdSuggestion(prisma);
      expect(data.confidence.toString()).toBe('1');
      expect(data.latency_ms).toBe(904);
      expect(data.reasons).toEqual(['The bridge event names this exact task.']);
    });

    it('never stores an empty reason list', async () => {
      const provider = mockAiProvider({
        reviewEvidence: jest.fn().mockResolvedValue({
          verdict: 'unsure',
          confidence: 0.3,
          reasons: [],
          provider: 'heuristic',
          model: null,
          latency_ms: 0,
        }),
      });
      const { service, prisma } = await build(
        prismaFor(pendingEvidence()),
        buildResolver(provider),
      );

      await service.suggest(EVIDENCE_ID);

      expect(createdSuggestion(prisma).reasons).toHaveLength(1);
    });
  });

  describe('latest', () => {
    it('returns the newest suggestion without generating one', async () => {
      const prisma = mockPrisma();
      const row = { id: 'suggestion-1', verdict: 'approve' };
      prisma.evidenceReviewSuggestion.findFirst.mockResolvedValue(row);
      const resolver = buildResolver();
      const { service } = await build(prisma, resolver);

      await expect(service.latest(EVIDENCE_ID)).resolves.toBe(row);
      expect(prisma.evidenceReviewSuggestion.findFirst).toHaveBeenCalledWith({
        where: { evidence_id: EVIDENCE_ID },
        orderBy: { created_at: 'desc' },
      });
      expect(resolver.get).not.toHaveBeenCalled();
      expect(prisma.evidenceReviewSuggestion.create).not.toHaveBeenCalled();
    });

    it('returns null when nothing has been suggested yet', async () => {
      const prisma = mockPrisma();
      prisma.evidenceReviewSuggestion.findFirst.mockResolvedValue(null);
      const { service } = await build(prisma, buildResolver());

      await expect(service.latest(EVIDENCE_ID)).resolves.toBeNull();
    });
  });
});
