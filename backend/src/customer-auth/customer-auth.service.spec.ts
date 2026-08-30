import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  GoneException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ActorType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerAuthService } from './customer-auth.service';
import { WhatsAppService } from './whatsapp.service';
import { RedisService } from './redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('CustomerAuthService', () => {
  let service: CustomerAuthService;
  let prisma: any;
  let jwtService: any;
  let redisService: any;
  let whatsAppService: any;
  let auditService: { record: jest.Mock };
  let mockRedisClient: any;

  beforeEach(async () => {
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
    };

    prisma = {
      customer: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      order: { updateMany: jest.fn() },
      eventBooking: { updateMany: jest.fn() },
      feedback: { updateMany: jest.fn() },
      // `updateProfile` runs inside a transaction so the consent AuditEvent
      // rolls back with the row it describes; the mock hands the callback the
      // same client, which is what a real interactive transaction does.
      $transaction: jest.fn((cb: any) => cb(prisma)),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    redisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    whatsAppService = {
      sendOtp: jest.fn().mockResolvedValue(undefined),
    };

    auditService = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerAuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: () => 'test' } },
        { provide: RedisService, useValue: redisService },
        { provide: WhatsAppService, useValue: whatsAppService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<CustomerAuthService>(CustomerAuthService);
  });

  describe('sendOtp', () => {
    it('should generate 6-digit OTP, hash with bcrypt, store in Redis with 300s TTL', async () => {
      mockRedisClient.incr.mockResolvedValue(1);

      const result = await service.sendOtp('9876543210');

      expect(result).toEqual({ message: 'OTP sent' });
      // Verify Redis set was called with otp: key, hashed value, EX, 300
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'otp:9876543210',
        expect.any(String), // bcrypt hash
        'EX',
        300,
      );
      // Verify rate limit key was incremented
      expect(mockRedisClient.incr).toHaveBeenCalledWith('otp_rate:9876543210');
      // Verify WhatsApp was called
      expect(whatsAppService.sendOtp).toHaveBeenCalledWith(
        '9876543210',
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('should reject 4th OTP attempt within hour with 429 Too Many Requests', async () => {
      mockRedisClient.incr.mockResolvedValue(4);

      await expect(service.sendOtp('9876543210')).rejects.toThrow(
        HttpException,
      );
      try {
        await service.sendOtp('9876543210');
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('should set expiry on rate limit key on first attempt', async () => {
      mockRedisClient.incr.mockResolvedValue(1);

      await service.sendOtp('9876543210');

      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        'otp_rate:9876543210',
        3600,
      );
    });
  });

  describe('verifyOtp', () => {
    const mockRes = {
      cookie: jest.fn(),
    } as any;

    it('should throw GoneException for expired/missing OTP', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await expect(
        service.verifyOtp('9876543210', '123456', mockRes),
      ).rejects.toThrow(GoneException);
    });

    it('should throw UnauthorizedException for wrong OTP', async () => {
      const hash = await bcrypt.hash('654321', 10);
      mockRedisClient.get.mockResolvedValue(hash);

      await expect(
        service.verifyOtp('9876543210', '123456', mockRes),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return customer + JWT cookie for correct OTP', async () => {
      const otp = '123456';
      const hash = await bcrypt.hash(otp, 10);
      mockRedisClient.get.mockResolvedValue(hash);

      const now = new Date();
      const customer = {
        id: 'cust-1',
        phone: '9876543210',
        name: null,
        email: null,
        created_at: new Date(now.getTime() - 60000), // created 1min ago (returning customer)
      };
      prisma.customer.upsert.mockResolvedValue(customer);

      const result = await service.verifyOtp('9876543210', otp, mockRes);

      expect(result.customer.id).toBe('cust-1');
      expect(result.customer.phone).toBe('9876543210');
      expect(mockRedisClient.del).toHaveBeenCalledWith('otp:9876543210');
      expect(jwtService.sign).toHaveBeenCalledWith(
        { customerId: 'cust-1', type: 'customer', token_use: 'access' },
        { expiresIn: '30d' },
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'customer_token',
        'mock-jwt-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
    });

    it('should auto-link Order/EventBooking/Feedback on first login', async () => {
      const otp = '123456';
      const hash = await bcrypt.hash(otp, 10);
      mockRedisClient.get.mockResolvedValue(hash);

      const now = new Date();
      const customer = {
        id: 'cust-new',
        phone: '9876543210',
        name: null,
        email: null,
        created_at: now, // just created (first-time)
      };
      prisma.customer.findUnique.mockResolvedValue(null);
      prisma.customer.upsert.mockResolvedValue(customer);

      await service.verifyOtp('9876543210', otp, mockRes);

      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { customer_phone: '9876543210', customer_id: null },
        data: { customer_id: 'cust-new' },
      });
      expect(prisma.eventBooking.updateMany).toHaveBeenCalledWith({
        where: { customer_phone: '9876543210', customer_id: null },
        data: { customer_id: 'cust-new' },
      });
      expect(prisma.feedback.updateMany).toHaveBeenCalledWith({
        where: { customer_phone: '9876543210', customer_id: null },
        data: { customer_id: 'cust-new' },
      });
    });

    it('should NOT auto-link for returning customer', async () => {
      const otp = '123456';
      const hash = await bcrypt.hash(otp, 10);
      mockRedisClient.get.mockResolvedValue(hash);

      const now = new Date();
      const customer = {
        id: 'cust-returning',
        phone: '9876543210',
        name: 'Existing',
        email: null,
        created_at: new Date(now.getTime() - 86400000), // created yesterday
      };
      prisma.customer.findUnique.mockResolvedValue(customer);
      prisma.customer.upsert.mockResolvedValue(customer);

      await service.verifyOtp('9876543210', otp, mockRes);

      expect(prisma.order.updateMany).not.toHaveBeenCalled();
      expect(prisma.eventBooking.updateMany).not.toHaveBeenCalled();
      expect(prisma.feedback.updateMany).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------
  // ACCT-01 — the customer's own marketing consent toggle
  // -----------------------------------------------------------------

  describe('updateProfile', () => {
    const CUSTOMER_ID = 'cust-1';

    const stubBefore = (marketing_opt_in: boolean) =>
      prisma.customer.findUnique.mockResolvedValue({
        id: CUSTOMER_ID,
        marketing_opt_in,
      });

    const stubUpdated = (over: Record<string, unknown> = {}) =>
      prisma.customer.update.mockResolvedValue({
        id: CUSTOMER_ID,
        phone: '9876543210',
        name: 'Demo',
        email: null,
        marketing_opt_in: false,
        ...over,
      });

    it('returns marketing_opt_in so the toggle can render its own state', async () => {
      stubBefore(true);
      stubUpdated({ marketing_opt_in: true });

      const result = await service.updateProfile(CUSTOMER_ID, { name: 'Demo' });

      expect(result).toHaveProperty('marketing_opt_in', true);
      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ marketing_opt_in: true }),
        }),
      );
    });

    it('persists an opt-in and audits it as the customer', async () => {
      stubBefore(false);
      stubUpdated({ marketing_opt_in: true });

      const result = await service.updateProfile(CUSTOMER_ID, {
        marketing_opt_in: true,
      });

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CUSTOMER_ID },
          data: { marketing_opt_in: true },
        }),
      );
      expect(result.marketing_opt_in).toBe(true);

      expect(auditService.record).toHaveBeenCalledTimes(1);
      const [, entry] = auditService.record.mock.calls[0];
      expect(entry).toMatchObject({
        entity_type: 'customer',
        entity_id: CUSTOMER_ID,
        // The same action the staff-side `PATCH /customers/:id` writes, so the
        // consent trail reads as one story whichever side flipped it.
        action: 'customer.marketing_opt_in_changed',
        actor_type: ActorType.customer,
        actor_id: CUSTOMER_ID,
        before: { marketing_opt_in: false },
        after: { marketing_opt_in: true },
      });
    });

    it('persists an opt-out too', async () => {
      stubBefore(true);
      stubUpdated({ marketing_opt_in: false });

      await service.updateProfile(CUSTOMER_ID, { marketing_opt_in: false });

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { marketing_opt_in: false } }),
      );
      const [, entry] = auditService.record.mock.calls[0];
      expect(entry).toMatchObject({
        before: { marketing_opt_in: true },
        after: { marketing_opt_in: false },
      });
    });

    it('writes no audit row when the consent value is unchanged', async () => {
      stubBefore(true);
      stubUpdated({ marketing_opt_in: true });

      await service.updateProfile(CUSTOMER_ID, { marketing_opt_in: true });

      expect(auditService.record).not.toHaveBeenCalled();
    });

    it('writes no audit row when the patch never mentions consent', async () => {
      stubBefore(false);
      stubUpdated({ name: 'Renamed' });

      await service.updateProfile(CUSTOMER_ID, { name: 'Renamed' });

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'Renamed' } }),
      );
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it('404s rather than creating a customer that is not there', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile('ghost', { marketing_opt_in: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });

    it('runs the update and its audit row in one transaction', async () => {
      stubBefore(false);
      stubUpdated({ marketing_opt_in: true });

      await service.updateProfile(CUSTOMER_ID, { marketing_opt_in: true });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // The audit row must be written with the *transaction* client, or it
      // would survive a rollback of the change it describes.
      const [tx] = auditService.record.mock.calls[0];
      expect(tx).toBe(prisma);
    });
  });

  describe('getProfile', () => {
    it('includes marketing_opt_in and never a secret', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        id: 'cust-1',
        phone: '9876543210',
        name: 'Demo',
        email: null,
        marketing_opt_in: true,
      });

      const result = await service.getProfile('cust-1');

      expect(result).toEqual({
        id: 'cust-1',
        phone: '9876543210',
        name: 'Demo',
        email: null,
        marketing_opt_in: true,
      });
    });

    it('404s on an unknown customer', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.getProfile('ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('UpdateCustomerDto', () => {
    it('accepts a boolean marketing_opt_in and rejects anything else', async () => {
      await expect(
        validate(plainToInstance(UpdateCustomerDto, { marketing_opt_in: true })),
      ).resolves.toEqual([]);

      const bad = await validate(
        plainToInstance(UpdateCustomerDto, { marketing_opt_in: 'yes' }),
      );
      expect(bad).toHaveLength(1);
      expect(bad[0].property).toBe('marketing_opt_in');
    });

    it('leaves the field optional — a name-only patch still validates', async () => {
      await expect(
        validate(plainToInstance(UpdateCustomerDto, { name: 'Demo' })),
      ).resolves.toEqual([]);
    });
  });

  describe('WhatsAppService dev fallback', () => {
    it('should warn-log the OTP when WHATSAPP_TOKEN not set (never throw — a node without Meta credentials is a supported production state)', async () => {
      const wa = new WhatsAppService();
      const warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      await wa.sendOtp('9876543210', '123456');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('OTP for 9876543210: 123456'),
      );
      warnSpy.mockRestore();
    });
  });
});
