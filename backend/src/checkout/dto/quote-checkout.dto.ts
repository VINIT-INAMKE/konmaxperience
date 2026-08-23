import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { OrderChannel } from '@prisma/client';

/**
 * `POST /customer/checkout/quote` — everything the storefront may say about a
 * checkout. Every number that matters (price, tax, discount, shipping, loyalty)
 * is computed server-side from this handful of intentions (`CHK-01`).
 *
 * The cart itself is **not** in the body: it is read from Redis
 * (`CustomerOrdersService.getCart`) so a client cannot quote a cart it does not
 * own.
 */
export class QuoteCheckoutDto {
  @IsEnum(OrderChannel)
  channel: OrderChannel;

  @IsOptional()
  @IsUUID()
  delivery_address_id?: string;

  /** True when local lines are collected at the villa (SPEC §5.2 "or pickup"). */
  @IsOptional()
  @IsBoolean()
  pickup?: boolean;

  /**
   * A single code — stacking is banned (`PROMO-02`). `@IsString()` plus the
   * global `ValidationPipe`'s `forbidNonWhitelisted` makes two codes unsayable.
   */
  @IsOptional()
  @IsString()
  @Length(3, 32)
  coupon_code?: string;

  /**
   * Loyalty points the customer wants to burn. Capped server-side by the
   * balance, `loyalty.max_redeem_percent` and the subtotal — an over-large
   * request is clamped, never rejected (`LoyaltyService.previewRedeem`).
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  redeem_points?: number;
}
