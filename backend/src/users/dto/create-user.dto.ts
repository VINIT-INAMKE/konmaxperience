import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * `WhatsAppService.normalize` prepends `91` when the number does not already
 * carry it, so the column stores **digits only** — no `+`, no spaces, no dashes.
 * 10 digits is a bare Indian mobile number, 13 the widest form with a country
 * code, and anything outside that range is a typo rather than a phone number.
 */
export const STAFF_PHONE_PATTERN = /^[0-9]{10,13}$/;

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsUUID()
  roleId!: string;

  /** RUN-01 — the number staff WhatsApp nudges are sent to. Digits only. */
  @IsOptional()
  @IsString()
  @Matches(STAFF_PHONE_PATTERN, {
    message: 'phone must be 10 to 13 digits with no spaces, dashes or +',
  })
  phone?: string | null;

  /**
   * Defaults to `false` in the schema and is never turned on implicitly:
   * consent to be messaged is given, not inferred from having a number.
   */
  @IsOptional()
  @IsBoolean()
  whatsapp_opt_in?: boolean;
}
