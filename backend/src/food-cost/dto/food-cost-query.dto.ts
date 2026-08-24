import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * Window for `GET /analytics/food-cost`.
 *
 * Both bounds are node-local `YYYY-MM-DD` calendar days, inclusive. Both are
 * optional: omitting them asks for the last 30 node-local days ending today.
 * The default is resolved in the service, not here — only the service knows
 * the node's timezone, and "today" is a question that timezone answers.
 */
export class FoodCostQueryDto {
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
}
