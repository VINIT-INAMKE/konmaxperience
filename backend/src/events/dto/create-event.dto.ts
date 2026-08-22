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
import { EventType } from '@prisma/client';

export class CreateEventDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsEnum(EventType)
  event_type: EventType;

  @IsDateString()
  date: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsNumber()
  price: number;

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
}
