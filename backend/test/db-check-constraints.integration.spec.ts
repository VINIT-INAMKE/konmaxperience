/**
 * `QA-05` — the hand-written `CHECK` constraints, actually rejecting rows.
 *
 * P5a and P6 added integrity rules that live only in raw SQL inside a
 * migration: Prisma's datamodel has no `CHECK` concept, so they are invisible
 * to the client, to `migrate diff` and — until this file existed — to the test
 * suite. A unit spec asserting "the service refuses to sign without a signer"
 * proves the service; it says nothing about the row a manual `UPDATE` or a
 * future code path could still write. These are the last line, so they are
 * asserted against the database that holds them.
 */
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import { createTestPrisma, truncateAll } from './integration-setup';
import { seedCustomer, seedNode, seedStaff } from './integration-fixtures';

/**
 * Postgres answers a `CHECK` failure with SQLSTATE 23514 and the constraint's
 * own name; Prisma passes the text straight through, so matching on the name
 * proves *which* constraint fired rather than merely that the write failed.
 * Constraint names are `[A-Za-z_]`, so they are their own regex.
 */
async function expectCheckViolation(
  work: Promise<unknown>,
  constraint: string,
): Promise<void> {
  await expect(work).rejects.toThrow(new RegExp(constraint));
}

describe('database CHECK constraints (integration — real Postgres)', () => {
  let prisma: PrismaService;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    await seedNode(prisma);
  });

  it('P5a `LoyaltyAccount_balance_non_negative` refuses a negative points balance', async () => {
    const customer = await seedCustomer(prisma, { points: 10 });

    await expectCheckViolation(
      prisma.loyaltyAccount.update({
        where: { customer_id: customer.customerId },
        data: { points_balance: -1 },
      }),
      'LoyaltyAccount_balance_non_negative',
    );
    await expectCheckViolation(
      prisma.loyaltyAccount.update({
        where: { customer_id: customer.customerId },
        data: { lifetime_points: -1 },
      }),
      'LoyaltyAccount_balance_non_negative',
    );

    // The failed writes changed nothing.
    const account = await prisma.loyaltyAccount.findUniqueOrThrow({
      where: { customer_id: customer.customerId },
    });
    expect(account.points_balance).toBe(10);
    expect(account.lifetime_points).toBe(10);
  });

  it('P6 `DailyClose_signed_has_signer` refuses a signed close with no signer', async () => {
    const staff = await seedStaff(prisma);
    const businessDate = new Date('2026-08-27T00:00:00.000Z');
    const metrics = { version: 1, orders: 0 } as Prisma.InputJsonObject;

    // `status: signed` with `signed_by`/`signed_at` still null — the shape a
    // raw SQL fix-up would produce, which P6 decision 16 forbids.
    await expectCheckViolation(
      prisma.dailyClose.create({
        data: { business_date: businessDate, status: 'signed', metrics },
      }),
      'DailyClose_signed_has_signer',
    );

    // An open close needs no signer …
    const open = await prisma.dailyClose.create({
      data: { business_date: businessDate, status: 'open', metrics },
    });
    expect(open.signed_by).toBeNull();

    // … and promoting it to `signed` is refused until both columns are filled …
    await expectCheckViolation(
      prisma.dailyClose.update({
        where: { id: open.id },
        data: { status: 'signed' },
      }),
      'DailyClose_signed_has_signer',
    );

    // … which is exactly what the sign endpoint writes.
    const signed = await prisma.dailyClose.update({
      where: { id: open.id },
      data: {
        status: 'signed',
        signed_by: staff.userId,
        signed_at: new Date(),
      },
    });
    expect(signed.status).toBe('signed');
    expect(signed.signed_by).toBe(staff.userId);
  });

  it('P6 `EvidenceReviewSuggestion_verdict_check` keeps the verdict inside its closed set', async () => {
    const staff = await seedStaff(prisma);
    const base = {
      evidence_id: staff.evidenceId,
      confidence: new Prisma.Decimal('0.350'),
      reasons: ['harness'],
      provider: 'heuristic',
      latency_ms: 1,
    };

    // `verdict` is deliberately a `String`, not an `ApprovalStatus`, so nothing
    // can mistake a suggestion for a decision — the CHECK is what keeps that
    // free-text column closed.
    await expectCheckViolation(
      prisma.evidenceReviewSuggestion.create({
        data: { ...base, verdict: 'maybe' },
      }),
      'EvidenceReviewSuggestion_verdict_check',
    );
    await expectCheckViolation(
      prisma.evidenceReviewSuggestion.create({
        data: { ...base, verdict: 'pending' },
      }),
      'EvidenceReviewSuggestion_verdict_check',
    );

    for (const verdict of ['approve', 'reject', 'unsure']) {
      const row = await prisma.evidenceReviewSuggestion.create({
        data: { ...base, verdict },
      });
      expect(row.verdict).toBe(verdict);
    }

    // The suggestions are a sidecar: the evidence they describe is untouched.
    const evidence = await prisma.evidence.findUniqueOrThrow({
      where: { id: staff.evidenceId },
    });
    expect(evidence.approval_status).toBe('pending');
    expect(evidence.reviewed_by).toBeNull();
  });
});
