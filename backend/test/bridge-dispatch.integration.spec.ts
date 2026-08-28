/**
 * `QA-05` — the `BridgeDispatch` exactly-once ledger, under a duplicate event.
 *
 * SPEC §4.2 makes a replayed domain event a no-op, and the mechanism is not a
 * check-then-act in TypeScript: `dispatchOnce` *inserts* the ledger row first
 * and lets `@@unique([rule_key, source_type, source_id])` decide. That is a
 * database claim in the literal sense — the uniqueness, the P2002 it raises,
 * and the rollback that takes the bridge's own writes with it are all things
 * the index does, not things the service does. A mocked Prisma has no index,
 * so the unit suite can only assert that the code calls `create`.
 */
import { BridgeOutcome, TaskSubjectType } from '@prisma/client';
import type { Tx } from '../src/common/types/transaction';
import type { MissionBridgeService } from '../src/mission-bridge/mission-bridge.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { createTestPrisma, truncateAll } from './integration-setup';
import { buildMissionBridgeService } from './integration-services';
import { seedNode, TEST_NODE_ID } from './integration-fixtures';

/** A real rule key from `mission-bridge.rules.ts` — never renamed once shipped. */
const RULE_KEY = 'order_confirmed_v1';
const EVENT = 'order.confirmed';

describe('BridgeDispatch exactly-once ledger (integration — real Postgres)', () => {
  let prisma: PrismaService;
  let bridge: MissionBridgeService;

  beforeAll(() => {
    prisma = createTestPrisma();
    bridge = buildMissionBridgeService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    await seedNode(prisma);
  });

  it('runs the work once per (rule_key, source_type, source_id), however the duplicate arrives', async () => {
    // Stands in for a rule body: it writes inside the dispatch transaction, so
    // counting its rows counts how many times the bridge actually applied.
    const work = jest.fn(async (tx: Tx) => {
      await tx.auditEvent.create({
        data: {
          node_id: TEST_NODE_ID,
          entity_type: 'order',
          entity_id: 'bridge-work',
          action: 'bridge.applied',
        },
      });
      return { outcome: BridgeOutcome.skipped_no_task, detail: 'no open task' };
    });

    const subject = {
      subject_type: TaskSubjectType.order,
      subject_id: 'aaaaaaaa-0000-4000-8000-000000000001',
    };
    const dispatch = () =>
      bridge.dispatchOnce(RULE_KEY, EVENT, subject, TEST_NODE_ID, work);

    // ── first delivery ───────────────────────────────────────────────────────
    const first = await dispatch();
    expect(first).toEqual({
      outcome: BridgeOutcome.skipped_no_task,
      detail: 'no open task',
    });

    const ledger = await prisma.bridgeDispatch.findMany();
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      rule_key: RULE_KEY,
      event: EVENT,
      source_type: TaskSubjectType.order,
      source_id: subject.subject_id,
      // The claim is written as `applied` and updated to the decided outcome
      // in the same transaction, so the committed row is never provisional.
      outcome: BridgeOutcome.skipped_no_task,
      detail: 'no open task',
    });

    // ── the same event again, later ──────────────────────────────────────────
    expect(await dispatch()).toBeNull();
    expect(work).toHaveBeenCalledTimes(1);
    expect(await prisma.bridgeDispatch.count()).toBe(1);
    expect(
      await prisma.auditEvent.count({ where: { action: 'bridge.applied' } }),
    ).toBe(1);

    // ── the same event twice at once ─────────────────────────────────────────
    // A double emit races: both transactions try to insert the same claim, and
    // the unique index — not the code — picks the winner.
    const concurrentSubject = {
      subject_type: TaskSubjectType.order,
      subject_id: 'aaaaaaaa-0000-4000-8000-000000000002',
    };
    const raced = await Promise.all([
      bridge.dispatchOnce(
        RULE_KEY,
        EVENT,
        concurrentSubject,
        TEST_NODE_ID,
        work,
      ),
      bridge.dispatchOnce(
        RULE_KEY,
        EVENT,
        concurrentSubject,
        TEST_NODE_ID,
        work,
      ),
    ]);

    expect(raced.filter((r) => r !== null)).toHaveLength(1);
    expect(raced.filter((r) => r === null)).toHaveLength(1);
    expect(
      await prisma.bridgeDispatch.count({
        where: { source_id: concurrentSubject.subject_id },
      }),
    ).toBe(1);
    // Two subjects, two applications — never three, and never one.
    expect(await prisma.bridgeDispatch.count()).toBe(2);
    expect(
      await prisma.auditEvent.count({ where: { action: 'bridge.applied' } }),
    ).toBe(2);
  });
});
