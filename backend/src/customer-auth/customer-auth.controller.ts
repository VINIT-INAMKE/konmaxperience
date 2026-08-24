import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import express from 'express';
import { CustomerAuthService } from './customer-auth.service';
import { PusherService } from '../chat/pusher.service';
import { CustomerGuard } from './guards/customer.guard';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Public } from '../common/decorators/public.decorator';

/**
 * Every route here is `@Public()`, and none of them is open.
 *
 * NestJS runs the **global** guards before the route-level ones, and the global
 * `PermissionsGuard` rejects `user.type === 'customer'` unconditionally on any
 * route not marked `@Public()`. So a customer route guarded only by
 * `@UseGuards(CustomerGuard)` answers `403` to its own logged-in customer —
 * which is exactly what the four session routes below used to do. `@Public()`
 * switches off the global staff stack; `CustomerGuard` remains the sole
 * authority and still answers `401` to a missing or staff token.
 *
 * This mirrors `CustomerOrdersController`, `CheckoutController`,
 * `LoyaltyController` and `CustomerReviewsController`, which all pair the two
 * decorators at class level for the same reason.
 */
@Controller('customer-auth')
export class CustomerAuthController {
  constructor(
    private readonly customerAuthService: CustomerAuthService,
    private readonly pusherService: PusherService,
  ) {}

  @Post('send-otp')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.customerAuthService.sendOtp(dto.phone);
  }

  @Post('verify-otp')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 3600000 } })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    return this.customerAuthService.verifyOtp(dto.phone, dto.otp, res);
  }

  @Get('profile')
  @UseGuards(CustomerGuard)
  @Public() // Bypass global JwtAuthGuard — CustomerGuard handles auth
  async getProfile(@Req() req: express.Request) {
    const user = (req as any).user;
    return this.customerAuthService.getProfile(user.customerId);
  }

  @Patch('profile')
  @UseGuards(CustomerGuard)
  @Public() // Bypass global JwtAuthGuard — CustomerGuard handles auth
  async updateProfile(
    @Req() req: express.Request,
    @Body() dto: UpdateCustomerDto,
  ) {
    const user = (req as any).user;
    return this.customerAuthService.updateProfile(user.customerId, dto);
  }

  @Post('logout')
  @UseGuards(CustomerGuard)
  @Public() // Bypass global JwtAuthGuard — CustomerGuard handles auth
  async logout(@Res({ passthrough: true }) res: express.Response) {
    return this.customerAuthService.logout(res);
  }

  @Post('pusher-auth')
  @UseGuards(CustomerGuard)
  @Public() // Bypass global JwtAuthGuard — CustomerGuard handles auth
  @HttpCode(200)
  async pusherAuth(
    @Body() body: { socket_id: string; channel_name: string },
    @Req() req: any,
  ) {
    const customerId: string = req.user.customerId;
    const expectedChannel = `private-customer-${customerId}`;
    if (body.channel_name !== expectedChannel) {
      throw new ForbiddenException('Not authorized for this channel');
    }
    return this.pusherService.authorizeChannel(body.socket_id, body.channel_name);
  }
}
