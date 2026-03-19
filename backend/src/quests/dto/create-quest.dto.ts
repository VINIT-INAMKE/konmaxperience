import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateQuestDto {
  @IsUUID()
  mission_id!: string;

  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  description!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  week_number!: number;

  @IsUUID()
  owner_user_id!: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}
