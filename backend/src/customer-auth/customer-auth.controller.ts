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
  async getProfile(@Req() req: express.Request) {
    const user = (req as any).user;
    return this.customerAuthService.getProfile(user.customerId);
  }

  @Patch('profile')
  @UseGuards(CustomerGuard)
  async updateProfile(
    @Req() req: express.Request,
    @Body() dto: UpdateCustomerDto,
  ) {
    const user = (req as any).user;
    return this.customerAuthService.updateProfile(user.customerId, dto);
  }

  @Post('logout')
  @UseGuards(CustomerGuard)
  async logout(@Res({ passthrough: true }) res: express.Response) {
    return this.customerAuthService.logout(res);
  }

  @Post('pusher-auth')
  @UseGuards(CustomerGuard)
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
