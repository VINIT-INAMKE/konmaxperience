import {
  IsString,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsString()
  event_type: string; // dining | workshop | pop_up | tasting | other

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
  @IsString()
  image_url?: string;
}
