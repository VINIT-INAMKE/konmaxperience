import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * `GET /readiness-meters/:code/signals?limit=20` — the ops-derived contribution
 * ledger behind a derived meter. `limit` is capped server-side at
 * `MAX_SIGNAL_LIMIT` (100); absent means `DEFAULT_SIGNAL_LIMIT` (20).
 */
export class MeterSignalsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
