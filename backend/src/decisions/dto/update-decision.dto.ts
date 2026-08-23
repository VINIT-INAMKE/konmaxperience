import { IsString, IsOptional, IsIn } from 'class-validator';

/**
 * P3: `status` is deliberately absent. A decision only moves through
 * `castVote`, `resolve` and `reopen` (SPEC §4.4) — `PATCH /decisions/:id`
 * edits the narrative fields and nothing else.
 */
export class UpdateDecisionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn(['individual', 'cross_function', 'strategic'])
  decision_type?: string;

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsString()
  linked_mission_id?: string;

  @IsOptional()
  @IsString()
  linked_task_id?: string;
}
