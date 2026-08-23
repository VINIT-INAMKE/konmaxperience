import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * `POST /customer/reviews` (storefront, `CustomerGuard`).
 *
 * The review is keyed on the **order item**, never on the product: `REV-01` is
 * "one review per delivered line", and `Review.order_item_id` is unique, so the
 * client cannot phrase a request that reviews a product it never bought. The
 * service resolves `product_id` from the line — accepting it in the body would
 * let a client attach a 5-star review to a product it did not purchase.
 *
 * `rating` is bounded here rather than in the service so an out-of-range value
 * is a `400` from the global `ValidationPipe` and never reaches Prisma (`Int`
 * would happily store `9`, and the `Decimal(3,2)` rollup would then be a lie).
 */
export class CreateReviewDto {
  @IsUUID()
  order_item_id: string;

  /** 1–5 whole stars. `auto_publish_min_rating` is compared against this. */
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  /**
   * Already-uploaded asset URLs (the storefront presigns through
   * `StorageService` first). Capped at five so one review cannot balloon the
   * public product page.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  media?: string[];
}
