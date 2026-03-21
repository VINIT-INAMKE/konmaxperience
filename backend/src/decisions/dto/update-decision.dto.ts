import { IsString, IsOptional, IsIn } from 'class-validator';

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
  @IsIn(['proposed', 'approved', 'rejected'])
  status?: string;

  @IsOptional()
  @IsString()
  linked_mission_id?: string;

  @IsOptional()
  @IsString()
  linked_task_id?: string;
}
