import {
  Injectable,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  GoneException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import express from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RedisService } from './redis.service';
import { WhatsAppService } from './whatsapp.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';

/** The projection every profile route returns — `phone` included, secrets never. */
const PROFILE_SELECT = {
  id: true,
  phone: true,
  name: true,
  email: true,
  marketing_opt_in: true,
} as const;

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly whatsAppService: WhatsAppService,
    private readonly audit: AuditService,
  ) {}

  async sendOtp(phone: string) {
    const redis = this.redisService.getClient();
    if (!redis) {
      throw new ServiceUnavailableException('OTP service unavailable');
    }

    // Rate limit check: max 3 per phone per hour
    const rateKey = `otp_rate:${phone}`;
    const attempts = await redis.incr(rateKey);
    if (attempts === 1) {
      await redis.expire(rateKey, 3600);
    }
    if (attempts > 3) {
      throw new HttpException(
        'Too many attempts -- try again in 1 hour',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Hash before storing
    const hash = await bcrypt.hash(otp, 10);

    // Store with 5-minute TTL
    await redis.set(`otp:${phone}`, hash, 'EX', 300);

    // Send via WhatsApp (or dev console fallback)
    await this.whatsAppService.sendOtp(phone, otp);

    return { message: 'OTP sent' };
  }

  async verifyOtp(phone: string, submittedOtp: string, res: express.Response) {
    const redis = this.redisService.getClient();
    if (!redis) {
      throw new ServiceUnavailableException('OTP service unavailable');
    }

    // Per-phone brute-force guard: max 5 verification attempts per OTP
    const verifyKey = `otp_verify:${phone}`;
    const attempts = await redis.incr(verifyKey);
    if (attempts === 1) await redis.expire(verifyKey, 300); // 5min TTL matches OTP
    if (attempts > 5) {
      await redis.del(`otp:${phone}`); // invalidate OTP entirely
      await redis.del(verifyKey);
      throw new HttpException(
        'Too many attempts -- request a new code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Fetch stored hash
    const storedHash = await redis.get(`otp:${phone}`);
    if (!storedHash) {
      throw new GoneException(
        'This code has expired -- request a new one',
      );
    }

    // Compare
    const isValid = await bcrypt.compare(submittedOtp, storedHash);
    if (!isValid) {
      throw new UnauthorizedException(
        'Incorrect code -- check your WhatsApp and try again',
      );
    }

    // Consume OTP + clear attempt counter
    await redis.del(`otp:${phone}`);
    await redis.del(verifyKey);

    // Deterministic new-customer detection: check existence before upsert
    const existing = await this.prisma.customer.findUnique({ where: { phone } });
    const isNewCustomer = !existing;

    const customer = await this.prisma.customer.upsert({
      where: { phone },
      create: { phone },
      update: {},
    });

    // Auto-link existing records on first login
    if (isNewCustomer) {
      await this.prisma.order.updateMany({
        where: { customer_phone: phone, customer_id: null },
        data: { customer_id: customer.id },
      });
      await this.prisma.eventBooking.updateMany({
        where: { customer_phone: phone, customer_id: null },
        data: { customer_id: customer.id },
      });
      await this.prisma.feedback.updateMany({
        where: { customer_phone: phone, customer_id: null },
        data: { customer_id: customer.id },
      });
    }

    // Sign JWT
    const token = this.jwtService.sign(
      { customerId: customer.id, type: 'customer', token_use: 'access' },
      { expiresIn: '30d' },
    );

    // Separate cookie from staff — both can coexist in the same browser
    res.cookie('customer_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return {
      customer: {
        id: customer.id,
        phone: customer.phone,
        name: customer.name,
        email: customer.email,
      },
      isNewCustomer,
    };
  }

  async getProfile(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: PROFILE_SELECT,
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  /**
   * `ACCT-01`. `name` and `email` are the customer's own presentation and are
   * written straight through; `marketing_opt_in` is **consent**, so it moves
   * inside a transaction that also writes the `AuditEvent` — the same row, with
   * the same action name, that the staff-side `PATCH /customers/:id` writes.
   * The audit row is only written when the value actually changes, so a client
   * that echoes the whole profile back on every save does not fill the trail
   * with no-ops.
   */
  async updateProfile(customerId: string, dto: UpdateCustomerDto) {
    const before = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, marketing_opt_in: true },
    });
    if (!before) {
      throw new NotFoundException('Customer not found');
    }

    const consentChanged =
      dto.marketing_opt_in !== undefined &&
      dto.marketing_opt_in !== before.marketing_opt_in;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id: customerId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.marketing_opt_in !== undefined && {
            marketing_opt_in: dto.marketing_opt_in,
          }),
        },
        select: PROFILE_SELECT,
      });

      if (consentChanged) {
        await this.audit.record(tx, {
          entity_type: 'customer',
          entity_id: customerId,
          action: 'customer.marketing_opt_in_changed',
          ...AuditService.customer(customerId),
          before: { marketing_opt_in: before.marketing_opt_in },
          after: { marketing_opt_in: updated.marketing_opt_in },
        });
      }

      return updated;
    });
  }

  async logout(res: express.Response) {
    res.clearCookie('customer_token', { path: '/' });
    return { message: 'Logged out' };
  }
}
