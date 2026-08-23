import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

/**
 * The body of `POST /customer/orders` (CHK-03).
 *
 * The old call took an **empty** body and re-derived the price from the cart on
 * the fly. It now takes the id of a quote that was already priced, validated and
 * frozen by `POST /customer/checkout/quote`, so the amount charged is the amount
 * the customer was shown — the storefront must obtain a `quote_id` first.
 */
export class CreateOrderFromQuoteDto {
  /** The quote returned by `POST /customer/checkout/quote`, still inside its 15-minute TTL. */
  @IsUUID()
  quote_id: string;

  /** Client-supplied replay guard; also written to `Order.idempotency_key`. */
  @IsOptional()
  @IsString()
  @Length(8, 64)
  idempotency_key?: string;
}
