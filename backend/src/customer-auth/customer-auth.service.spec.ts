import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpException,
  HttpStatus,
  UnauthorizedException,
  GoneException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { CustomerAuthService } from './customer-auth.service';
import { WhatsAppService } from './whatsapp.service';
import { RedisService } from './redis.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CustomerAuthService', () => {
  let service: CustomerAuthService;
  let prisma: any;
  let jwtService: any;
  let redisService: any;
  let whatsAppService: any;
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerAuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: () => 'test' } },
        { provide: RedisService, useValue: redisService },
        { provide: WhatsAppService, useValue: whatsAppService },
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
        { customerId: 'cust-1', type: 'customer' },
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

  describe('WhatsAppService dev fallback', () => {
    it('should log to console when WHATSAPP_TOKEN not set', async () => {
      const wa = new WhatsAppService();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await wa.sendOtp('9876543210', '123456');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEV] OTP for 9876543210: 123456'),
      );
      consoleSpy.mockRestore();
    });
  });
});
