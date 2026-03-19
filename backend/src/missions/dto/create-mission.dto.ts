import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum MissionPhase {
  SETUP = 'setup',
  FOUNDATION = 'foundation',
  ACTIVATION = 'activation',
  SCALE = 'scale',
}

export enum MissionScope {
  FOOD = 'food',
  ART = 'art',
  LIFESTYLE = 'lifestyle',
  SYSTEM = 'system',
  MIXED = 'mixed',
}

export class CreateMissionDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  description!: string;

  @IsEnum(MissionPhase)
  phase!: string;

  @IsEnum(MissionScope)
  scope!: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}
