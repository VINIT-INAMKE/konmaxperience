import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { CouponStatus, CouponType, ProductType } from '@prisma/client';

/**
 * `POST /promotions/coupons` (staff, `MANAGE_OPS`).
 *
 * Every money field is a **rupee** number with at most 2dp — the same unit the
 * `Decimal(12,2)` column stores and the same unit the API returns (decision 3).
 * The service converts to integer paise via `toPaise` before any arithmetic.
 */
export class CreateCouponDto {
  /**
   * Stored upper-cased and trimmed by the service, so `welcome10` and
   * `WELCOME10` are the same coupon and `Coupon.code @unique` means what a
   * customer typing the code expects it to mean.
   */
  @IsString()
  @Length(3, 32)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsEnum(CouponType)
  type: CouponType;

  /**
   * A percentage for `percent`, a rupee amount for `fixed`, ignored for
   * `free_shipping`. The 0-100 bound on `percent` is a service check, not a
   * DTO one — it depends on `type`.
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value: number;

  /** Minimum order **subtotal** (gross, tax-inclusive) in rupees. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  min_order?: number;

  /** Rupee ceiling on the computed discount. Meaningful for `percent`. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  max_discount?: number;

  /**
   * Product types the discount base is restricted to. An empty array (the
   * column default) means "every product type".
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(ProductType, { each: true })
  applies_to?: ProductType[];

  @IsDateString()
  starts_at: string;

  @IsDateString()
  ends_at: string;

  /** Total redemptions allowed across all customers. `null`/omitted = unlimited. */
  @IsOptional()
  @IsInt()
  @Min(1)
  usage_limit?: number;

  /** Redemptions allowed per customer. `null`/omitted = unlimited. */
  @IsOptional()
  @IsInt()
  @Min(1)
  per_customer_limit?: number;

  /** Omitted means `draft` (the column default) — a coupon is never live by accident. */
  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;
}
