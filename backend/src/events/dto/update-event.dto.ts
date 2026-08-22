import {
  IsString,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EventStatus, EventType } from '@prisma/client';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsEnum(EventType)
  event_type?: EventType;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsUUID()
  zone_id?: string;

  @IsOptional()
  @IsUUID()
  brand_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUrl()
  image_url?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
