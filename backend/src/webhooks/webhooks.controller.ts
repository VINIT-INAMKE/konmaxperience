import { Controller, Post, Req, Headers, HttpCode, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import express from 'express';
import { Public } from '../common/decorators/public.decorator';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('razorpay')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async handleRazorpay(
    @Req() req: express.Request,
    @Headers('x-razorpay-signature') signature: string,
    @Headers('x-razorpay-event-id') eventId: string,
  ) {
    if (!signature) throw new UnauthorizedException('Missing webhook signature');
    if (!eventId) throw new UnauthorizedException('Missing event ID');

    // Access raw body preserved by main.ts verify callback
    const rawBody = (req as any).rawBody as Buffer | undefined;

    return this.webhooksService.processWebhook(rawBody, signature, eventId);
  }
}
