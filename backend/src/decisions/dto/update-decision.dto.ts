import { IsString, IsOptional, IsIn, IsEnum } from 'class-validator';
import { DecisionStatus } from '@prisma/client';

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
  @IsEnum(DecisionStatus)
  status?: DecisionStatus;

  @IsOptional()
  @IsString()
  linked_mission_id?: string;

  @IsOptional()
  @IsString()
  linked_task_id?: string;
}
