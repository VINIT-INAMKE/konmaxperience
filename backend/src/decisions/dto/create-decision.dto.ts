import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateDecisionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsIn(['individual', 'cross_function', 'strategic'])
  decision_type: string;

  @IsString()
  @IsNotEmpty()
  context: string;

  @IsOptional()
  @IsString()
  linked_mission_id?: string;

  @IsOptional()
  @IsString()
  linked_task_id?: string;
}
