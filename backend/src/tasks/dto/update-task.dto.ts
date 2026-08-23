import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import {
  TaskDomain,
  TaskPriority,
  TaskStatus,
  TaskSubjectType,
} from '@prisma/client';

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
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsUUID()
  depends_on_task_id?: string | null;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  /**
   * SPEC §4.4 — flipping this to `true`, or changing `domain` while it is true,
   * re-runs policy materialisation inside the update transaction. Flipping it to
   * `false` deletes the still-pending rows (decided rows are never deleted).
   */
  @IsOptional()
  @IsBoolean()
  requires_approval?: boolean;

  @IsOptional()
  @IsEnum(TaskDomain)
  domain?: TaskDomain;

  @IsOptional()
  @IsUUID()
  owner_user_id?: string;

  @IsOptional()
  @IsEnum(TaskSubjectType)
  subject_type?: TaskSubjectType;

  @IsOptional()
  @IsUUID()
  subject_id?: string;
}
