import {
  Body,
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import express from 'express';
import { Public } from '../common/decorators/public.decorator';
import { WebhooksService } from './webhooks.service';
import {
  ShiprocketWebhookService,
  type ShiprocketWebhookBody,
} from './shiprocket-webhook.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly shiprocketWebhookService: ShiprocketWebhookService,
  ) {}

  @Post('razorpay')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async handleRazorpay(
    @Req() req: express.Request,
    @Headers('x-razorpay-signature') signature: string,
    @Headers('x-razorpay-event-id') eventId: string,
  ) {
    if (!signature)
      throw new UnauthorizedException('Missing webhook signature');
    if (!eventId) throw new UnauthorizedException('Missing event ID');

    // Access raw body preserved by main.ts verify callback
    const rawBody = (req as any).rawBody as Buffer | undefined;

    return this.webhooksService.processWebhook(rawBody, signature, eventId);
  }

  /**
   * SHIP-04 — Shiprocket's tracking callback.
   *
   * Authenticated by the `x-konma-webhook-token` shared secret (SPEC §5.3, plan
   * decision 9), **not** a body HMAC: `main.ts` preserves `rawBody` only for
   * `/webhooks/razorpay` and P5a does not touch it. The body is therefore read
   * through the normal JSON parser.
   *
   * `ShiprocketWebhookBody` is an interface, so the global `ValidationPipe`
   * passes it through untouched — a courier is free to add fields, and the raw
   * payload is stored verbatim in the shipment ledger.
   *
   * Always `200` unless the caller is unauthenticated: Shiprocket retries every
   * non-2xx, and a payload we choose to ignore is not a failure.
   */
  @Post('shiprocket')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 300, ttl: 60000 } })
  async handleShiprocket(
    @Headers('x-konma-webhook-token') token: string,
    @Body() body: ShiprocketWebhookBody,
  ) {
    return this.shiprocketWebhookService.handle(token, body);
  }
}
