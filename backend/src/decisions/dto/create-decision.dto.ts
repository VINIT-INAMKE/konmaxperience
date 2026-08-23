import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsUUID,
  IsEnum,
  IsArray,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import { GovernanceTier } from '@prisma/client';

export class CreateDecisionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsIn(['individual', 'cross_function', 'strategic'])
  decision_type: string;

  @IsString()
  @IsNotEmpty()
  context: string;

  /**
   * SPEC §4.4 governance tier. Optional so the v1 decision form keeps working;
   * omitted means `tier_1`, which is also the Prisma column default.
   */
  @IsOptional()
  @IsEnum(GovernanceTier)
  tier?: GovernanceTier;

  /**
   * The `TaskDomain` the decision lands in; anything unrecognised is treated as
   * `ops` (the value the service hardcoded before P3).
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  impact_scope?: string;

  /** Tier 2 only: two domain roles plus one impacted role (>= 3 entries). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(12)
  required_role_codes?: string[];

  @IsOptional()
  @IsUUID()
  linked_mission_id?: string;

  @IsOptional()
  @IsUUID()
  linked_task_id?: string;
}
