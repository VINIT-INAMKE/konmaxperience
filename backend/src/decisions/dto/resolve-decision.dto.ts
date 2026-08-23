import { IsEnum, IsString, MinLength, MaxLength } from 'class-validator';
import { DecisionStatus } from '@prisma/client';

/**
 * Body of `POST /decisions/:id/resolve` — the tier-3 founder call.
 * `status` is narrowed to `approved | rejected` in `DecisionsService.resolve`.
 */
export class ResolveDecisionDto {
  @IsEnum(DecisionStatus)
  status: DecisionStatus;

  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  final_decision: string;
}
