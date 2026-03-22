import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsUUID,
  IsIn,
} from 'class-validator';

export class UpdateKpiDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  target_value?: number;

  @IsOptional()
  @IsNumber()
  current_value?: number;

  @IsOptional()
  @IsIn(['on_track', 'at_risk', 'off_track'])
  status?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  linked_task_ids?: string[];
}
