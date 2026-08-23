import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { OrderChannel } from '@prisma/client';

/**
 * `POST /customer/coupons/validate` — mounted on `CheckoutController` so it
 * shares the storefront `CustomerGuard`; the evaluation itself is
 * {@link CouponsService.validate}.
 *
 * **`code` is a single string, never an array.** `PROMO-02` bans stacking, and
 * this DTO is where the ban is enforced at the type level: `@IsString()`
 * rejects `["A","B"]`, and the global `ValidationPipe`'s
 * `forbidNonWhitelisted: true` rejects a smuggled `codes` property. A client
 * that wants two discounts cannot even phrase the request.
 */
export class ValidateCouponDto {
  @IsString()
  @Length(3, 32)
  code: string;

  /**
   * The channel the cart will check out on. Accepted so the storefront can
   * validate before the channel is final; the eligibility rules do not branch
   * on it today.
   */
  @IsOptional()
  @IsEnum(OrderChannel)
  channel?: OrderChannel;
}
