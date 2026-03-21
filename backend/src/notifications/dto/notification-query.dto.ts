import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class NotificationQueryDto {
  @IsOptional()
  @IsString()
  type?: string; // comma-separated: "task_due,task_blocked"

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  is_read?: boolean;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string; // notification ID for keyset pagination
}
