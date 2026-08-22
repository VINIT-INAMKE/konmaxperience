import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { TaskDomain, TaskPriority, TaskType } from '@prisma/client';

export class CreateTaskDto {
  @IsUUID()
  mission_id!: string;

  @IsOptional()
  @IsUUID()
  quest_id?: string;

  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  description!: string;

  @IsEnum(TaskType)
  task_type!: TaskType;

  @IsEnum(TaskDomain)
  domain!: TaskDomain;

  @IsUUID()
  owner_user_id!: string;

  @IsEnum(TaskPriority)
  priority!: TaskPriority;

  @IsOptional()
  @IsInt()
  @Min(0)
  xp?: number;

  @IsOptional()
  @IsUUID()
  depends_on_task_id?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;
}
