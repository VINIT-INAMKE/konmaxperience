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

export enum TaskType {
  CORE = 'core',
  ADHOC = 'adhoc',
  IMPROVEMENT = 'improvement',
}

export enum TaskDomain {
  FOOD = 'food',
  ART = 'art',
  LIFESTYLE = 'lifestyle',
  OPS = 'ops',
  PROCUREMENT = 'procurement',
  BI = 'bi',
  TALENT = 'talent',
  TECH = 'tech',
  DESIGN = 'design',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

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
  task_type!: string;

  @IsEnum(TaskDomain)
  domain!: string;

  @IsUUID()
  owner_user_id!: string;

  @IsEnum(TaskPriority)
  priority!: string;

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
