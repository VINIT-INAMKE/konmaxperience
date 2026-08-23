import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { UsageEventType } from '@prisma/client';

export class CreateUsageEventDto {
  @IsEnum(UsageEventType)
  event_type!: UsageEventType;

  /** Route path, query string already stripped. */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  path?: string;

  /** Dotted action key, e.g. `task.create`. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  action?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
