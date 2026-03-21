import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['draft', 'in_review', 'approved', 'rejected'])
  status?: string;

  @IsOptional()
  @IsString()
  linked_brand_id?: string;

  @IsOptional()
  @IsString()
  linked_task_id?: string;
}
