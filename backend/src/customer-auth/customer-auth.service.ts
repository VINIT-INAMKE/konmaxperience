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
import { RedisService } from './redis.service';
import { WhatsAppService } from './whatsapp.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly whatsAppService: WhatsAppService,
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

    // Consume OTP (prevent reuse)
    await redis.del(`otp:${phone}`);

    // Upsert customer
    const customer = await this.prisma.customer.upsert({
      where: { phone },
      create: { phone },
      update: {},
    });

    // Check if first login (created within last 5 seconds)
    const isNewCustomer =
      Date.now() - customer.created_at.getTime() < 5000;

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
      { customerId: customer.id, type: 'customer' },
      { expiresIn: '30d' },
    );

    // Set cookie — same name as staff token, type field distinguishes
    res.cookie('access_token', token, {
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
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async updateProfile(customerId: string, dto: UpdateCustomerDto) {
    return this.prisma.customer.update({
      where: { id: customerId },
      data: { ...dto },
    });
  }

  async logout(res: express.Response) {
    res.clearCookie('access_token', { path: '/' });
    return { message: 'Logged out' };
  }
}
