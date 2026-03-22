import { IsString, IsNotEmpty, IsOptional, IsIn, IsUUID } from 'class-validator';

export class CreateAssetDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['recipe', 'sop', 'menu', 'cost_sheet', 'training_doc'])
  asset_type: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsOptional()
  @IsUUID()
  linked_brand_id?: string;

  @IsOptional()
  @IsUUID()
  linked_task_id?: string;
}
