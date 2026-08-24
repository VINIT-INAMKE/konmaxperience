import { IsOptional, IsString, Matches } from 'class-validator';

/** `YYYY-MM-DD` — the same node-local day key the analytics screens send. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Query for `GET /usage/summary`.
 *
 * `days` is the original parameter and stays the default, so every caller that
 * predates P6 keeps working unchanged. `from`/`to` pin an explicit node-local
 * window and win over `days` when supplied.
 */
export class UsageSummaryQueryDto {
  /**
   * Rolling window length in node-local calendar days, inclusive of today.
   * Left as a free string (not `@Matches`) so a junk value falls back to the
   * 30-day default exactly as it did before P6 rather than becoming a 400.
   */
  @IsOptional()
  @IsString()
  days?: string;

  /** First node-local day of the window, inclusive. Defaults to `to - (days - 1)`. */
  @IsOptional()
  @IsString()
  @Matches(ISO_DAY, { message: 'from must be a YYYY-MM-DD date' })
  from?: string;

  /** Last node-local day of the window, inclusive. Defaults to today. */
  @IsOptional()
  @IsString()
  @Matches(ISO_DAY, { message: 'to must be a YYYY-MM-DD date' })
  to?: string;
}
