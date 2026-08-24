import {
  IsBoolean,
  IsOptional,
  IsString,
  IsEmail,
  MinLength,
} from 'class-validator';

/**
 * `PATCH /customer-auth/profile` — what a customer may change about themselves.
 *
 * `phone` is deliberately absent: it is the login identity and only the OTP
 * flow may establish it.
 */
export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  /**
   * `ACCT-01` — the customer's own consent toggle, the storefront counterpart
   * of the staff `PATCH /customers/:id`. Both writers audit the change, so the
   * consent trail is complete whichever side flipped it.
   */
  @IsOptional()
  @IsBoolean()
  marketing_opt_in?: boolean;
}
