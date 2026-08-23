import { IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

/**
 * `POST /orders/:id/refund` (staff, `MANAGE_POS`).
 *
 * `amount` is in **rupees** because that is what the staff screen shows and what
 * the rest of the API speaks (plan decision 3: money leaves the API as JSON
 * numbers). `RefundsService` converts it to integer paise before any arithmetic
 * touches it, so the two-decimal-place cap here is the outer edge of the money
 * domain, not a display nicety.
 *
 * Omitting `amount` means "refund whatever is left" — the refundable balance is
 * `Payment.amount − Payment.refunded_amount`, which the service computes rather
 * than trusting the caller to have read a fresh order.
 */
export class CreateRefundDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  /**
   * Why the money is going back. Recorded on the `Refund` row, sent to Razorpay
   * as a note, and copied into the `order.refunded` audit event — a refund with
   * no stated reason is unauditable, so this is required.
   */
  @IsString()
  @Length(3, 200)
  reason: string;
}
