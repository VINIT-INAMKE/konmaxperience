import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { MissionPhase, MissionScope } from './create-mission.dto';

export enum MissionStatus {
  PLANNED = 'planned',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  PAUSED = 'paused',
}

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
  phase?: string;

  @IsOptional()
  @IsEnum(MissionScope)
  scope?: string;

  @IsOptional()
  @IsEnum(MissionStatus)
  status?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}
