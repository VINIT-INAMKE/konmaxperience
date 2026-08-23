import {
  IsInt,
  IsString,
  Max,
  Min,
  MinLength,
  MaxLength,
  NotEquals,
} from 'class-validator';

/**
 * LOYAL-01 staff adjustment. `delta` is a whole number of points and may be
 * negative (a clawback); zero is rejected because an adjustment that changes
 * nothing is a mistake, not an intent. `notes` is mandatory — the audit row is
 * worthless without a reason.
 */
export class AdjustLoyaltyDto {
  @IsInt()
  @NotEquals(0)
  @Min(-1_000_000)
  @Max(1_000_000)
  delta: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  notes: string;
}
