import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { STAFF_PHONE_PATTERN } from './create-user.dto';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;

  /**
   * `@IsOptional()` skips `null` as well as `undefined`, so an explicit
   * `"phone": null` is how an admin clears a number — and clearing it also
   * clears the opt-in, in `UsersService`.
   */
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
