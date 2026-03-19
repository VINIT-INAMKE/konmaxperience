import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum TaskStatus {
  TODO = 'todo',
  DOING = 'doing',
  DONE = 'done',
  BLOCKED = 'blocked',
  CANCELLED = 'cancelled',
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: string;

  @IsOptional()
  @IsEnum({ LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' })
  priority?: string;

  @IsOptional()
  @IsString()
  depends_on_task_id?: string | null;

  @IsOptional()
  @IsDateString()
  due_date?: string;
}
