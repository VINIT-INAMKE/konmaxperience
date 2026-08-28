import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';
import { STAFF_PHONE_PATTERN } from './create-user.dto';

/**
 * Body of `PATCH /me/notification-prefs`.
 *
 * Deliberately *not* `UpdateUserDto`: this route writes the calling user's own
 * row with no `MANAGE_RBAC`, so it must be structurally incapable of carrying
 * `name`, `status` or a role. Being able to say "stop messaging me" cannot
 * require an admin.
 */
export class UpdateNotificationPrefsDto {
  @IsOptional()
  @IsString()
  @Matches(STAFF_PHONE_PATTERN, {
    message: 'phone must be 10 to 13 digits with no spaces, dashes or +',
  })
  phone?: string | null;

  @IsOptional()
  @IsBoolean()
  whatsapp_opt_in?: boolean;
}
