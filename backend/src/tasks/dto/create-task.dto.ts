import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import {
  TaskDomain,
  TaskPriority,
  TaskSubjectType,
  TaskType,
} from '@prisma/client';

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

  /**
   * SPEC §4.4 — when true (the default) the create transaction materialises one
   * pending `Approval` per role required by the `(scope=task, domain)` policy.
   */
  @IsOptional()
  @IsBoolean()
  requires_approval?: boolean;

  /**
   * SPEC §3.2 — what this task is *about*. `subject_type` and `subject_id` must
   * be supplied together; the pairing is enforced in `TasksService.create`
   * (the codebase has no cross-field `@ValidateIf` rules).
   */
  @IsOptional()
  @IsEnum(TaskSubjectType)
  subject_type?: TaskSubjectType;

  @IsOptional()
  @IsUUID()
  subject_id?: string;

  @IsOptional()
  @IsUUID()
  readiness_meter_id?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  readiness_value?: number;
}
