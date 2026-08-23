import { IsBoolean } from 'class-validator';

/**
 * `PATCH /customers/:id` (staff, `MANAGE_OPS`).
 *
 * Deliberately one field. `phone` is the login identity, `name`/`email` are the
 * customer's own to edit through `PATCH /customer-auth/profile`, and the
 * loyalty balance moves only through `POST /customers/:id/loyalty-adjust`.
 * With the global `ValidationPipe` running `forbidNonWhitelisted`, anything
 * else in the body is a `400`.
 */
export class UpdateCustomerDto {
  @IsBoolean()
  marketing_opt_in: boolean;
}
