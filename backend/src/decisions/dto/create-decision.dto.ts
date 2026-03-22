import { IsString, IsNotEmpty, IsOptional, IsIn, IsUUID } from 'class-validator';

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
  @IsUUID()
  linked_mission_id?: string;

  @IsOptional()
  @IsUUID()
  linked_task_id?: string;
}
