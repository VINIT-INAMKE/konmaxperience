import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * `GET /daily-close?from=&to=&limit=`.
 *
 * `from`/`to` are node-local `YYYY-MM-DD` business days, inclusive on both ends
 * — `business_date` is a `@db.Date`, so there is no partial last day to miss and
 * no reason for the exclusive upper bound the timestamp ranges use.
 */
export class ListDailyCloseDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from must be a YYYY-MM-DD date',
  })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be a YYYY-MM-DD date' })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
