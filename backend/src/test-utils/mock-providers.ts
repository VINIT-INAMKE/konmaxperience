/**
 * Shared jest factories for Nest TestingModule providers.
 * Every factory returns plain objects of jest.fn() so suites can assert on calls.
 * `jest.clearAllMocks()` keeps these implementations (it only clears call history).
 */
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PusherService } from '../chat/pusher.service';
import { QStashService } from '../notifications/qstash.service';
import { RedisService } from '../customer-auth/redis.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { EmailService } from '../email/email.service';
import { StorageService } from '../storage/storage.service';
import { TasksService } from '../tasks/tasks.service';
import { AuditService } from '../audit/audit.service';
import {
  SETTING_DEFAULTS,
  SettingsService,
} from '../settings/settings.service';
import { WhatsAppService } from '../customer-auth/whatsapp.service';

export const PRISMA_MODELS = [
  'auditEvent',
  'bridgeDispatch',
  'node',
  'zone',
  'order',
  'orderItem',
  'payment',
  'product',
  'productCategory',
  'productVariant',
  'productMedia',
  'channelModifier',
  'shipment',
  'shipmentEvent',
  'refund',
  'coupon',
  'couponRedemption',
  'loyaltyAccount',
  'loyaltyTransaction',
  'review',
  'brand',
  'customer',
  'customerAddress',
  'event',
  'eventBooking',
  'feedback',
  'task',
  'quest',
  'mission',
  'user',
  'role',
  'evidence',
  'approval',
  'approvalPolicy',
  'decision',
  'decisionVote',
  'taskReadinessEvent',
  'readinessMeter',
  'readinessSignal',
  'readinessSnapshot',
  'kpi',
  'notification',
  'systemSetting',
  'refreshToken',
  'passwordResetToken',
  'recipe',
  'recipeLine',
  'prepBatch',
  'wasteLog',
  'ingredientStock',
  'stockMovement',
  'ingredient',
  'ingredientCategory',
  'purchaseOrder',
  'vendorPrice',
  'guideSection',
  'guidePage',
] as const;

export const PRISMA_METHODS = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findMany',
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
] as const;

export type MockModel = Record<(typeof PRISMA_METHODS)[number], jest.Mock>;
export type MockPrisma = Record<(typeof PRISMA_MODELS)[number], MockModel> & {
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
  withReconnect: jest.Mock;
};

/**
 * A PrismaService stand-in: jest.fn() for every model method above.
 * `$transaction(cb)` invokes cb with the same mock (so `tx.x.y` === `prisma.x.y`);
 * `$transaction([...])` resolves the array. `withReconnect(fn)` invokes fn.
 * `overrides` are merged per model: mockPrisma({ task: { findMany: jest.fn().mockResolvedValue([]) } }).
 */
export function mockPrisma(
  overrides: Partial<Record<string, Record<string, unknown>>> = {},
): MockPrisma {
  const prisma: Record<string, any> = {};
  for (const model of PRISMA_MODELS) {
    const methods: Record<string, jest.Mock> = {};
    for (const method of PRISMA_METHODS) methods[method] = jest.fn();
    prisma[model] = methods;
  }
  prisma.$queryRaw = jest.fn().mockResolvedValue([]);
  prisma.$executeRaw = jest.fn().mockResolvedValue(0);
  prisma.$transaction = jest.fn((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(prisma)
      : Promise.all(arg as unknown[]),
  );
  prisma.withReconnect = jest.fn((fn: () => Promise<unknown>) => fn());
  for (const [model, methods] of Object.entries(overrides)) {
    const existing = (prisma[model] ?? {}) as Record<string, unknown>;
    prisma[model] = { ...existing, ...(methods ?? {}) };
  }
  return prisma as MockPrisma;
}

export function mockEventEmitter() {
  return {
    emit: jest.fn().mockReturnValue(true),
    emitAsync: jest.fn().mockResolvedValue([]),
  };
}

export function mockPusher() {
  return {
    trigger: jest.fn().mockResolvedValue(undefined),
    authorizeChannel: jest.fn(),
  };
}

export function mockQstash() {
  return { publish: jest.fn().mockResolvedValue(undefined) };
}

export function mockRedisClient() {
  return {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    getdel: jest.fn(),
    ttl: jest.fn(),
    mget: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
  };
}

export function mockRedis(client = mockRedisClient()) {
  return { client, getClient: jest.fn().mockReturnValue(client) };
}

export function mockRazorpay() {
  return {
    createOrder: jest.fn(),
    verifyPaymentSignature: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    fetchPayment: jest.fn(),
    createRefund: jest.fn(),
  };
}

export function mockEmail() {
  return {
    sendPasswordSetup: jest.fn().mockResolvedValue(undefined),
    sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    sendHtml: jest.fn().mockResolvedValue(undefined),
  };
}

export function mockStorage() {
  return {
    validatePresignRequest: jest.fn(),
    buildStorageKey: jest.fn((t: string, f: string) => `${t}/${f}`),
    generatePresignedPutUrl: jest
      .fn()
      .mockResolvedValue('https://example.test/put'),
    getPublicUrl: jest.fn((k: string) => `https://example.test/${k}`),
    putObjectDirect: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * An AuditService stand-in. `record` is the only instance method the wired services
 * call; the `AuditService.user`/`.customer` helpers are static and need no mock.
 */
export function mockAuditService() {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

export function mockTasksService() {
  return {
    recalculateQuestProgress: jest.fn().mockResolvedValue(undefined),
    recalculateMissionProgress: jest.fn().mockResolvedValue(undefined),
  };
}

/** A NodeService stand-in — `current()`/`currentId()`/`timezone()` are all the bridge needs. */
export function mockNodeService(
  nodeId = '11111111-1111-4111-8111-111111111111',
) {
  return {
    current: jest.fn().mockResolvedValue({
      id: nodeId,
      code: 'KX-VILLA-1',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    }),
    currentId: jest.fn().mockResolvedValue(nodeId),
    timezone: jest.fn().mockResolvedValue('Asia/Kolkata'),
  };
}

/**
 * An ApprovalPolicyService stand-in. Wire it in a spec with an explicit token:
 * `{ provide: ApprovalPolicyService, useValue: mockApprovalPolicyService() }`.
 * Declared here (not importing the class) so this file stays dependency-free.
 */
export function mockApprovalPolicyService() {
  return {
    resolve: jest.fn().mockResolvedValue({
      policy_id: null,
      scope: 'task',
      domain: null,
      required_role_codes: ['BACKEND_LEAD'],
      min_approvals: 1,
      mode: 'all',
    }),
    materialise: jest.fn().mockResolvedValue(1),
    isSatisfied: jest.fn().mockResolvedValue(true),
  };
}

/** Ready-made `providers` entries. Spread into Test.createTestingModule({ providers: [...] }). */
export const provideEventEmitter = (value = mockEventEmitter()) => ({
  provide: EventEmitter2,
  useValue: value,
});
export const providePusher = (value = mockPusher()) => ({
  provide: PusherService,
  useValue: value,
});
export const provideQstash = (value = mockQstash()) => ({
  provide: QStashService,
  useValue: value,
});
export const provideRedis = (value = mockRedis()) => ({
  provide: RedisService,
  useValue: value,
});
export const provideRazorpay = (value = mockRazorpay()) => ({
  provide: RazorpayService,
  useValue: value,
});
export const provideEmail = (value = mockEmail()) => ({
  provide: EmailService,
  useValue: value,
});
export const provideStorage = (value = mockStorage()) => ({
  provide: StorageService,
  useValue: value,
});
export const provideTasksService = (value = mockTasksService()) => ({
  provide: TasksService,
  useValue: value,
});
export const provideAuditService = (value = mockAuditService()) => ({
  provide: AuditService,
  useValue: value,
});

/** A SettingsService stand-in that returns the declared defaults unless overridden. */
export function mockSettings(overrides: Partial<typeof SETTING_DEFAULTS> = {}) {
  const values = { ...SETTING_DEFAULTS, ...overrides } as Record<
    string,
    unknown
  >;
  return {
    get: jest.fn((key: string) => Promise.resolve(values[key])),
    getSetting: jest.fn(),
    updateSetting: jest.fn(),
  };
}

/** A ShippingProvider stand-in — every method resolves, none touches the network. */
export function mockShippingProvider() {
  return {
    name: 'manual' as const,
    checkServiceability: jest.fn().mockResolvedValue({
      serviceable: true,
      rate: 0,
      courier_name: null,
      etd: null,
    }),
    createShipment: jest.fn().mockResolvedValue({
      provider_order_id: null,
      provider_shipment_id: null,
    }),
    assignAwb: jest.fn().mockResolvedValue({ awb: null, courier_name: null }),
    schedulePickup: jest
      .fn()
      .mockResolvedValue({ scheduled: true, pickup_token: null }),
    getLabel: jest.fn().mockResolvedValue({ label_url: null }),
    track: jest.fn().mockResolvedValue({ status: 'pending', events: [] }),
    cancel: jest.fn().mockResolvedValue({ cancelled: true }),
  };
}

export function mockWhatsApp() {
  return {
    sendOtp: jest.fn().mockResolvedValue(undefined),
    sendTemplate: jest.fn().mockResolvedValue(undefined),
  };
}

export const provideSettings = (value = mockSettings()) => ({
  provide: SettingsService,
  useValue: value,
});
export const provideWhatsApp = (value = mockWhatsApp()) => ({
  provide: WhatsAppService,
  useValue: value,
});
