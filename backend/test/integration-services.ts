/**
 * Real services on a real database.
 *
 * The services under test are constructed by hand rather than through a Nest
 * `TestingModule`. Both give the same object graph, but `new` gives it without
 * dragging in controllers, guards, cron registrations and the Redis/QStash
 * providers that sit further up the module tree — none of which a
 * transaction-level assertion has any use for. Nothing here is a mock: every
 * dependency below is the production class, wired to the production
 * constructor, and the only substitution in the whole harness is the database
 * URL.
 */
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { RazorpayService } from '../src/razorpay/razorpay.service';
import { RefundsService } from '../src/refunds/refunds.service';
import type { BackfillValidationPort } from '../src/approvals/backfill-validation.port';
import { AuditService } from '../src/audit/audit.service';
import { SettingsService } from '../src/settings/settings.service';
import { CouponsService } from '../src/promotions/coupons.service';
import { LoyaltyService } from '../src/loyalty/loyalty.service';
import { FulfilmentService } from '../src/fulfilment/fulfilment.service';
import { NodeService } from '../src/node/node.service';
import { ReadinessDerivationService } from '../src/readiness/readiness-derivation.service';
import { ApprovalPolicyService } from '../src/approvals/approval-policy.service';
import { MissionBridgeService } from '../src/mission-bridge/mission-bridge.service';

export interface MoneyPathServices {
  eventEmitter: EventEmitter2;
  audit: AuditService;
  settings: SettingsService;
  coupons: CouponsService;
  loyalty: LoyaltyService;
  fulfilment: FulfilmentService;
}

/** `FulfilmentService.confirmPaidOrder` and everything it calls inside its transaction. */
export function buildMoneyPathServices(
  prisma: PrismaService,
): MoneyPathServices {
  const eventEmitter = new EventEmitter2();
  const audit = new AuditService(prisma);
  const settings = new SettingsService(prisma);
  const coupons = new CouponsService(prisma, audit, settings, eventEmitter);
  const loyalty = new LoyaltyService(prisma, settings, audit);
  // RazorpayService reads its keys in onModuleInit, which `new` never calls —
  // these specs stay on the happy confirm path and never reach the gateway.
  const refunds = new RefundsService(
    prisma,
    new RazorpayService(new ConfigService()),
    audit,
    loyalty,
  );
  const fulfilment = new FulfilmentService(
    prisma,
    audit,
    eventEmitter,
    coupons,
    loyalty,
    refunds,
  );
  return { eventEmitter, audit, settings, coupons, loyalty, fulfilment };
}

/** `MissionBridgeService.dispatchOnce` and the services its constructor takes. */
export function buildMissionBridgeService(
  prisma: PrismaService,
): MissionBridgeService {
  const settings = new SettingsService(prisma);
  const node = new NodeService(prisma);
  const derivation = new ReadinessDerivationService(prisma, settings, node);
  const audit = new AuditService(prisma);
  // The backfill port is only reached by `backfillMissing`, which no
  // mission-bridge path calls; a throwing stand-in keeps that true by force.
  const neverBackfill: BackfillValidationPort = {
    validateTask: () => {
      throw new Error('backfill port must not be reached from mission-bridge specs');
    },
  };
  const approvalPolicy = new ApprovalPolicyService(prisma, audit, neverBackfill);
  return new MissionBridgeService(prisma, derivation, approvalPolicy, audit);
}
