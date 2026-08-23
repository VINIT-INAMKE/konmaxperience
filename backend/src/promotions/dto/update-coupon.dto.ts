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
 * `PATCH /promotions/coupons/:id` — every field of {@link CreateCouponDto}
 * made optional. Written out rather than derived with `PartialType` because
 * `@nestjs/mapped-types` is not a dependency of this project.
 *
 * `null` is deliberately accepted for the four nullable columns so a limit or a
 * cap can be *cleared*: `{ "max_discount": null }` removes the ceiling, which
 * `undefined` (the "leave unchanged" signal) cannot express.
 */
export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  @Length(3, 32)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsOptional()
  @IsEnum(CouponType)
  type?: CouponType;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  min_order?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  max_discount?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(ProductType, { each: true })
  applies_to?: ProductType[];

  @IsOptional()
  @IsDateString()
  starts_at?: string;

  @IsOptional()
  @IsDateString()
  ends_at?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  usage_limit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  per_customer_limit?: number | null;

  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;
}
