import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { MissionPhase, MissionScope, MissionStatus } from '@prisma/client';

export class UpdateMissionDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(MissionPhase)
  phase?: MissionPhase;

  @IsOptional()
  @IsEnum(MissionScope)
  scope?: MissionScope;

  @IsOptional()
  @IsEnum(MissionStatus)
  status?: MissionStatus;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}
