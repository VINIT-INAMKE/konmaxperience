import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsUUID,
  IsIn,
} from 'class-validator';

export class CreateKpiDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  unit: string;

  @IsNumber()
  target_value: number;

  @IsOptional()
  @IsNumber()
  current_value?: number;

  @IsOptional()
  @IsIn(['on_track', 'at_risk', 'off_track'])
  status?: string;

  @IsString()
  domain: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  linked_task_ids?: string[];
}
