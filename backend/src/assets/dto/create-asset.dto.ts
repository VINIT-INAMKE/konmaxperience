import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

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
  @IsString()
  linked_brand_id?: string;

  @IsOptional()
  @IsString()
  linked_task_id?: string;
}
