import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { MissionPhase, MissionScope } from '@prisma/client';

export class CreateMissionDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  description!: string;

  @IsEnum(MissionPhase)
  phase!: MissionPhase;

  @IsEnum(MissionScope)
  scope!: MissionScope;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}
