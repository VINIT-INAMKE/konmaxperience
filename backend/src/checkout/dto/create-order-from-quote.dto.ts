import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

/**
 * `POST /customer/orders` (Task 9) — the pay step names a **stored quote**
 * rather than re-describing the cart.
 *
 * The quote already froze the line totals, the coupon, the loyalty burn and the
 * shipping rate; re-sending any of them would only create a second source of
 * truth for the same order. The body is therefore just the pointer plus an
 * optional client-supplied idempotency key.
 *
 * Declared here (not in `customer-orders/dto/`) because the quote is this
 * module's artefact: Task 9 imports the class, keeping the shape and the store
 * that produced it in one place.
 */
export class CreateOrderFromQuoteDto {
  /** The `quote_id` returned by `POST /customer/checkout/quote`. */
  @IsUUID()
  quote_id: string;

  /**
   * Optional client-generated key that makes a retried "Pay" tap resolve to the
   * same Razorpay order instead of a second one.
   */
  @IsOptional()
  @IsString()
  @Length(8, 64)
  idempotency_key?: string;
}
